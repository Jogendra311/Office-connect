/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config.ts';
import { db } from '../db/database.ts';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/index.ts';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export class SocketHandler {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
  // Map of userId -> Set of socket IDs (multi-session presence)
  private userSockets: Map<number, Set<string>> = new Map();
  // Map of `${conversationId}:${userId}` -> NodeJS.Timeout (typing expiration)
  private typingTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(server: any) {
    this.io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
      server,
      {
        path: '/socket.io',
        cors: {
          origin: true,
          credentials: true,
        },
        transports: ['websocket', 'polling'],
      }
    );

    this.setupAuthMiddleware();
    this.setupConnectionHandler();
  }

  private setupAuthMiddleware() {
    this.io.use((socket: TypedSocket, next) => {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication failed: Missing token'));
      }

      try {
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as { userId: number | string };
        const user = db.getUserById(Number(decoded.userId));

        if (!user || !user.isActive) {
          return next(new Error('Authentication failed: User inactive or not found'));
        }

        socket.data.user = user;
        next();
      } catch (_err) {
        return next(new Error('Authentication failed: Invalid token'));
      }
    });
  }

  private setupConnectionHandler() {
    this.io.on('connection', (socket: TypedSocket) => {
      const user = socket.data.user;
      const userId = user.id;

      // 1. Join personal user room for direct pings/notifications
      socket.join(`user:${userId}`);

      // 2. Track multi-session presence
      let socketsForUser = this.userSockets.get(userId);
      if (!socketsForUser) {
        socketsForUser = new Set();
        this.userSockets.set(userId, socketsForUser);
      }
      socketsForUser.add(socket.id);

      // Transition to online
      db.setUserStatus(userId, 'online');
      this.io.emit('presence:update', {
        userId,
        status: 'online',
        lastSeen: new Date().toISOString(),
      });

      // Automatically join all existing conversations of this user
      const userConvs = db.getUserConversations(userId);
      userConvs.forEach((conv) => {
        socket.join(`conversation:${conv.id}`);
      });

      // 3. Conversation Join
      socket.on('conversation:join', (conversationId, ack) => {
        const convId = Number(conversationId);
        if (db.isUserInConversation(convId, userId)) {
          socket.join(`conversation:${convId}`);
          ack?.({ success: true });
        } else {
          ack?.({ success: false });
        }
      });

      // 4. Conversation Leave
      socket.on('conversation:leave', (conversationId) => {
        socket.leave(`conversation:${conversationId}`);
      });

      // 5. Message Send
      socket.on('message:send', (payload, ack) => {
        try {
          const { conversationId, content, idempotencyId, replyToMessageId, attachments } = payload;
          const convId = Number(conversationId);

          if (!db.isUserInConversation(convId, userId)) {
            ack?.({ success: false, error: 'Unauthorized to post to this conversation' });
            return;
          }

          const message = db.createMessage({
            conversationId: convId,
            senderId: userId,
            content: (content || '').trim(),
            idempotencyId,
            replyToMessageId: replyToMessageId ? Number(replyToMessageId) : undefined,
            attachments,
          });

          // Broadcast to conversation room
          this.io.to(`conversation:${convId}`).emit('message:new', message);

          // Notify members not currently in room if needed
          const conv = db.getConversationById(convId, userId);
          if (conv) {
            conv.members.forEach((m) => {
              if (m.userId !== userId) {
                this.io.to(`user:${m.userId}`).emit('notification:new', {
                  id: Math.floor(Math.random() * 1000000),
                  title: conv.type === 'direct' ? user.name : (conv.title || 'New Group Message'),
                  body: message.content ? message.content.substring(0, 100) : 'Sent an attachment',
                  conversationId: convId,
                  createdAt: message.createdAt,
                });
              }
            });
          }

          ack?.({ success: true, message });
        } catch (err: any) {
          ack?.({ success: false, error: err.message || 'Failed to send message' });
        }
      });

      // 6. Message Read Receipt
      socket.on('message:read', (payload, ack) => {
        const conversationId = Number(payload.conversationId);
        const messageId = Number(payload.messageId);
        if (db.isUserInConversation(conversationId, userId)) {
          db.markConversationRead(conversationId, userId, messageId);
          this.io.to(`conversation:${conversationId}`).emit('message:receipt', {
            messageId,
            conversationId,
            userId,
            status: 'read',
            timestamp: new Date().toISOString(),
          });
          ack?.({ success: true });
        } else {
          ack?.({ success: false });
        }
      });

      // 7. Message Reaction Toggle
      socket.on('message:react', (payload, ack) => {
        try {
          const conversationId = Number(payload.conversationId);
          const messageId = Number(payload.messageId);
          const emoji = payload.emoji;

          if (!db.isUserInConversation(conversationId, userId)) {
            ack?.({ success: false, added: false });
            return;
          }

          const result = db.toggleReaction(messageId, userId, emoji);

          // Broadcast reaction update to entire conversation room
          this.io.to(`conversation:${conversationId}`).emit('message:reaction', {
            messageId,
            conversationId,
            userId,
            userName: user.name,
            emoji,
            added: result.added,
            reactions: result.reactions,
          });

          ack?.({ success: true, added: result.added, reactions: result.reactions });
        } catch (_err) {
          ack?.({ success: false, added: false });
        }
      });

      // 8. Typing Indicators
      socket.on('typing:start', (conversationId) => {
        const convId = Number(conversationId);
        if (!db.isUserInConversation(convId, userId)) return;

        const timerKey = `${convId}:${userId}`;
        if (this.typingTimers.has(timerKey)) {
          clearTimeout(this.typingTimers.get(timerKey)!);
        }

        const typingPayload = {
          conversationId: convId,
          userId,
          userName: user.name,
          isTyping: true,
        };
        socket.to(`conversation:${convId}`).emit('typing:update', typingPayload);
        socket.to(`conversation:${convId}`).emit('typing', typingPayload);

        const timer = setTimeout(() => {
          const stopPayload = {
            conversationId: convId,
            userId,
            userName: user.name,
            isTyping: false,
          };
          socket.to(`conversation:${convId}`).emit('typing:update', stopPayload);
          socket.to(`conversation:${convId}`).emit('typing', stopPayload);
          this.typingTimers.delete(timerKey);
        }, 3000);

        this.typingTimers.set(timerKey, timer);
      });

      socket.on('typing:stop', (conversationId) => {
        const convId = Number(conversationId);
        const timerKey = `${convId}:${userId}`;
        if (this.typingTimers.has(timerKey)) {
          clearTimeout(this.typingTimers.get(timerKey)!);
          this.typingTimers.delete(timerKey);
        }
        const stopPayload = {
          conversationId: convId,
          userId,
          userName: user.name,
          isTyping: false,
        };
        socket.to(`conversation:${convId}`).emit('typing:update', stopPayload);
        socket.to(`conversation:${convId}`).emit('typing', stopPayload);
      });

      // Generic typing event listener ({ conversationId, isTyping })
      socket.on('typing', (payload: any) => {
        if (!payload) return;
        const convId = Number(payload.conversationId || payload);
        const isTyping = payload.isTyping !== undefined ? Boolean(payload.isTyping) : true;
        if (!db.isUserInConversation(convId, userId)) return;

        const timerKey = `${convId}:${userId}`;
        if (this.typingTimers.has(timerKey)) {
          clearTimeout(this.typingTimers.get(timerKey)!);
        }

        const data = {
          conversationId: convId,
          userId,
          userName: user.name,
          isTyping,
        };

        socket.to(`conversation:${convId}`).emit('typing', data);
        socket.to(`conversation:${convId}`).emit('typing:update', data);

        if (isTyping) {
          const timer = setTimeout(() => {
            const stopData = {
              conversationId: convId,
              userId,
              userName: user.name,
              isTyping: false,
            };
            socket.to(`conversation:${convId}`).emit('typing', stopData);
            socket.to(`conversation:${convId}`).emit('typing:update', stopData);
            this.typingTimers.delete(timerKey);
          }, 3000);
          this.typingTimers.set(timerKey, timer);
        }
      });

      // 9. Presence Subscribe
      socket.on('presence:subscribe', (userIds) => {
        userIds.forEach((targetUid) => {
          const target = db.getUserById(Number(targetUid));
          if (target) {
            socket.emit('presence:update', {
              userId: target.id,
              status: target.status,
              lastSeen: target.lastSeen,
            });
          }
        });
      });

      // 10. Disconnect Handling
      socket.on('disconnect', () => {
        const sockets = this.userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.userSockets.delete(userId);
            const now = new Date().toISOString();
            db.setUserStatus(userId, 'offline');
            this.io.emit('presence:update', {
              userId,
              status: 'offline',
              lastSeen: now,
            });
          }
        }
      });
    });
  }

  public getIO() {
    return this.io;
  }
}
