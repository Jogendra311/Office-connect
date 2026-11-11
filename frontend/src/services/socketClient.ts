/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { io, Socket } from 'socket.io-client';
import { store } from '../app/store.ts';
import {
  setNetworkConnected,
  setTypingStatus,
  updatePresence,
} from '../features/chat/chatSlice.ts';
import { apiSlice } from '../features/api/apiSlice.ts';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Message,
} from '../types/index.ts';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

class SocketClientService {
  private socket: ClientSocket | null = null;
  private currentToken: string | null = null;

  public initialize(token: string) {
    if (this.socket && this.currentToken === token && this.socket.connected) {
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.currentToken = token;

    // Use same origin so websocket connects to current proxy host
    this.socket = io({
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      store.dispatch(setNetworkConnected(true));
      console.log('[SocketClient] Connected to OfficeConnect LAN server');
    });

    this.socket.on('disconnect', () => {
      store.dispatch(setNetworkConnected(false));
      console.log('[SocketClient] Disconnected from server');
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[SocketClient] Connection error:', err.message);
      store.dispatch(setNetworkConnected(false));
    });

    // Real-Time Events
    this.socket.on('message:new', (message: Message) => {
      // Invalidate RTK Query cache to update conversation and messages
      store.dispatch(
        apiSlice.util.invalidateTags([
          { type: 'Messages', id: message.conversationId },
          'Conversations',
        ])
      );
    });

    this.socket.on('message:updated', (message: Message) => {
      store.dispatch(
        apiSlice.util.invalidateTags([
          { type: 'Messages', id: message.conversationId },
        ])
      );
    });

    this.socket.on('message:deleted', (payload) => {
      store.dispatch(
        apiSlice.util.invalidateTags([
          { type: 'Messages', id: payload.conversationId },
        ])
      );
    });

    this.socket.on('message:receipt', (payload) => {
      store.dispatch(
        apiSlice.util.invalidateTags([
          { type: 'Messages', id: payload.conversationId },
        ])
      );
    });

    this.socket.on('message:reaction', (payload) => {
      store.dispatch(
        apiSlice.util.invalidateTags([
          { type: 'Messages', id: payload.conversationId },
        ])
      );
    });

    this.socket.on('typing:update', (data) => {
      store.dispatch(setTypingStatus(data));
    });

    this.socket.on('typing', (data) => {
      store.dispatch(setTypingStatus(data));
    });

    this.socket.on('presence:update', (data) => {
      store.dispatch(updatePresence(data));
    });

    this.socket.on('conversation:updated', () => {
      store.dispatch(apiSlice.util.invalidateTags(['Conversations']));
    });
  }

  public getSocket(): ClientSocket | null {
    return this.socket;
  }

  public toggleReaction(
    payload: { conversationId: number; messageId: number; emoji: string },
    callback?: (res: { success: boolean; added: boolean; reactions?: any[] }) => void
  ) {
    if (this.socket?.connected) {
      this.socket.emit('message:react', payload, callback);
    }
  }

  public sendMessage(
    payload: {
      conversationId: number;
      content: string;
      idempotencyId?: number | string;
      replyToMessageId?: number;
      attachments?: any[];
    },
    callback?: (res: { success: boolean; message?: Message; error?: string }) => void
  ) {
    if (!this.socket || !this.socket.connected) {
      callback?.({ success: false, error: 'Socket not connected' });
      return;
    }
    this.socket.emit('message:send', payload, callback);
  }

  public startTyping(conversationId: number) {
    if (this.socket?.connected) {
      this.socket.emit('typing:start', conversationId);
      this.socket.emit('typing', { conversationId, isTyping: true });
    }
  }

  public stopTyping(conversationId: number) {
    if (this.socket?.connected) {
      this.socket.emit('typing:stop', conversationId);
      this.socket.emit('typing', { conversationId, isTyping: false });
    }
  }

  public markMessageAsRead(conversationId: number, messageId: number) {
    if (this.socket?.connected) {
      this.socket.emit('message:read', { conversationId, messageId });
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentToken = null;
    }
  }
}

export const socketService = new SocketClientService();
