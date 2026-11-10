/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import bcrypt from 'bcryptjs';
import {
  safeSyncToSqlServer,
  storeEmployeeToDb,
  storeMessageToDb,
  storeAuditLogToDb,
} from './sqlServerClient.ts';
import type {
  User,
  Department,
  Conversation,
  ConversationMember,
  Message,
  MessageReaction,
  MessageReceipt,
  Attachment,
  AuditLog,
} from '../types/index.ts';

export interface DBUser extends User {
  passwordHash: string;
}

export interface DBRefreshToken {
  tokenId: number;
  userId: number;
  tokenHash: string;
  expiresAt: string;
  isRevoked: boolean;
  createdAt: string;
}

export interface DBPinnedMessage {
  pinId: number;
  conversationId: number;
  messageId: number;
  pinnedById: number;
  pinnedAt: string;
}

class RelationalDatabase {
  private users: Map<number, DBUser> = new Map();
  private departments: Map<number, Department> = new Map();
  private conversations: Map<number, Conversation> = new Map();
  private conversationMembers: Map<number, ConversationMember> = new Map();
  private messages: Map<number, Message> = new Map();
  private messageReceipts: Map<number, MessageReceipt> = new Map();
  private messageReactions: Map<number, MessageReaction> = new Map();
  private attachments: Map<number, Attachment> = new Map();
  private pinnedMessages: Map<number, DBPinnedMessage> = new Map();
  private refreshTokens: Map<number, DBRefreshToken> = new Map();
  private auditLogs: AuditLog[] = [];

  // Integer Auto-Increment Sequences
  private nextUserId = 10;
  private nextEmployeeId = 1010;
  private nextDeptId = 10;
  private nextConvId = 10;
  private nextMemberId = 50;
  private nextMsgId = 100;
  private nextReactionId = 100;
  private nextReceiptId = 100;
  private nextAttachmentId = 100;
  private nextPinId = 100;
  private nextTokenId = 100;
  private nextLogId = 100;

  constructor() {
    this.initDefaultRecords();
  }

  private initDefaultRecords() {
    // 1. Standard Organization Departments
    const defaultDepts: Department[] = [
      { id: 1, name: 'Information Technology', code: 'IT', description: 'Internal infrastructure, security & systems', createdAt: new Date().toISOString() },
      { id: 2, name: 'Engineering', code: 'ENG', description: 'Software architecture & development', createdAt: new Date().toISOString() },
      { id: 3, name: 'Finance & Accounting', code: 'FIN', description: 'Financial analysis, reporting & budgets', createdAt: new Date().toISOString() },
      { id: 4, name: 'Operations & HR', code: 'OPS', description: 'Corporate LAN administration & logistics', createdAt: new Date().toISOString() },
    ];
    defaultDepts.forEach((d) => this.departments.set(d.id, d));

    // 2. Initial Super User & Sample Employee (Password: Office123!)
    const salt = bcrypt.genSaltSync(10);
    const defaultHash = bcrypt.hashSync('Office123!', salt);

    const superAdmin: DBUser = {
      id: 1,
      employeeId: 1001,
      username: 'super',
      name: 'Super',
      email: 'super@office.internal',
      passwordHash: defaultHash,
      role: 'Super Admin',
      departmentId: 1,
      departmentName: 'Information Technology',
      jobTitle: 'Chief Information Security Officer',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      status: 'online',
      lastSeen: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(superAdmin.id, superAdmin);

    const employee: DBUser = {
      id: 2,
      employeeId: 1002,
      username: 'alex.rivera',
      name: 'Alex Rivera',
      email: 'alex.rivera@office.internal',
      passwordHash: defaultHash,
      role: 'Employee',
      departmentId: 2,
      departmentName: 'Engineering',
      jobTitle: 'Software Architect',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      status: 'online',
      lastSeen: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(employee.id, employee);

    // 3. General Announcements Conversation
    const conv1: Conversation = {
      id: 1,
      type: 'group',
      title: 'Company Announcements & Office Updates',
      description: 'Official corporate and office LAN announcements for all staff',
      createdById: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: [],
    };
    this.conversations.set(conv1.id, conv1);

    this.conversationMembers.set(1, {
      id: 1,
      conversationId: 1,
      userId: 1,
      role: 'admin',
      joinedAt: conv1.createdAt,
    });
    this.conversationMembers.set(2, {
      id: 2,
      conversationId: 1,
      userId: 2,
      role: 'member',
      joinedAt: conv1.createdAt,
    });
  }

  // AUDIT LOGS
  public addAuditLog(
    userId: number,
    userName: string,
    action: string,
    targetResource: string,
    details: string,
    ipAddress: string
  ): AuditLog {
    const log: AuditLog = {
      id: this.nextLogId++,
      userId,
      userName,
      action,
      targetResource,
      details,
      ipAddress,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 1000) {
      this.auditLogs.pop();
    }

    safeSyncToSqlServer(() =>
      storeAuditLogToDb({
        id: log.id,
        actorId: log.userId,
        actorName: log.userName,
        action: log.action,
        target: log.targetResource,
        details: log.details,
        ipAddress: log.ipAddress,
      })
    );

    return log;
  }

  public getAuditLogs(limit = 100): AuditLog[] {
    return this.auditLogs.slice(0, limit);
  }

  // USERS
  public getUserById(id: number): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  public getDBUserById(id: number): DBUser | undefined {
    return this.users.get(id);
  }

  public getUserByUsername(username: string): DBUser | undefined {
    return Array.from(this.users.values()).find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
  }

  public getUserByEmail(email: string): DBUser | undefined {
    return Array.from(this.users.values()).find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
  }

  public getAllUsers(activeOnly = true): User[] {
    return Array.from(this.users.values())
      .filter((u) => (!activeOnly || u.isActive))
      .map(({ passwordHash: _, ...safeUser }) => safeUser);
  }

  public searchUsers(query: string, currentUserId: number): User[] {
    const q = query.toLowerCase().trim();
    return this.getAllUsers(true).filter(
      (u) =>
        u.id !== currentUserId &&
        (u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.jobTitle.toLowerCase().includes(q) ||
          (u.departmentName && u.departmentName.toLowerCase().includes(q)))
    );
  }

  public createUser(userData: Omit<DBUser, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }): User {
    const id = userData.id ?? this.nextUserId++;
    const now = new Date().toISOString();
    const newUser: DBUser = {
      ...userData,
      id,
      employeeId: userData.employeeId || this.nextEmployeeId++,
      departmentId: Number(userData.departmentId),
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, newUser);

    safeSyncToSqlServer(() =>
      storeEmployeeToDb({
        userId: id,
        employeeId: newUser.employeeId,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        passwordHash: newUser.passwordHash,
        role: newUser.role,
        departmentId: newUser.departmentId,
        departmentName: newUser.departmentName || '',
        jobTitle: newUser.jobTitle,
      })
    );

    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser;
  }

  public updateUser(id: number, updates: Partial<User>): User | undefined {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    const updated: DBUser = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, updated);
    const { passwordHash: _, ...safeUser } = updated;
    return safeUser;
  }

  public setUserStatus(id: number, status: User['status']): void {
    const user = this.users.get(id);
    if (user) {
      user.status = status;
      user.lastSeen = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
    }
  }

  // DEPARTMENTS
  public getAllDepartments(): Department[] {
    return Array.from(this.departments.values());
  }

  public getDepartmentById(id: number): Department | undefined {
    return this.departments.get(id);
  }

  public createDepartment(deptData: Omit<Department, 'id' | 'createdAt'>): Department {
    const id = this.nextDeptId++;
    const newDept: Department = {
      ...deptData,
      id,
      createdAt: new Date().toISOString(),
    };
    this.departments.set(id, newDept);
    return newDept;
  }

  // CONVERSATIONS
  public getConversationById(convId: number, currentUserId?: number): Conversation | undefined {
    const conv = this.conversations.get(convId);
    if (!conv) return undefined;

    const members = Array.from(this.conversationMembers.values())
      .filter((m) => m.conversationId === convId)
      .map((m) => {
        const u = this.getUserById(m.userId);
        return { ...m, user: u };
      });

    const msgs = Array.from(this.messages.values())
      .filter((m) => m.conversationId === convId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const lastMessage = msgs[0];

    let unreadCount = 0;
    if (currentUserId) {
      const currentMember = members.find((m) => m.userId === currentUserId);
      const lastReadId = currentMember?.lastReadMessageId;
      if (lastReadId) {
        const readMsg = this.messages.get(lastReadId);
        const readTime = readMsg ? new Date(readMsg.createdAt).getTime() : 0;
        unreadCount = msgs.filter(
          (m) =>
            m.senderId !== currentUserId &&
            new Date(m.createdAt).getTime() > readTime
        ).length;
      } else {
        unreadCount = msgs.filter((m) => m.senderId !== currentUserId).length;
      }
    }

    let isDirectWithUser: User | undefined;
    if (conv.type === 'direct' && currentUserId) {
      const otherMember = members.find((m) => m.userId !== currentUserId);
      if (otherMember?.user) {
        isDirectWithUser = otherMember.user;
      }
    }

    return {
      ...conv,
      members,
      lastMessage,
      unreadCount,
      isDirectWithUser,
    };
  }

  public getUserConversations(userId: number): Conversation[] {
    const memberConvIds = Array.from(this.conversationMembers.values())
      .filter((m) => m.userId === userId)
      .map((m) => m.conversationId);

    return memberConvIds
      .map((cid) => this.getConversationById(cid, userId))
      .filter((c): c is Conversation => c !== undefined)
      .sort((a, b) => {
        const timeA = a.lastMessage?.createdAt || a.updatedAt;
        const timeB = b.lastMessage?.createdAt || b.updatedAt;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });
  }

  public findDirectConversation(user1Id: number, user2Id: number): Conversation | undefined {
    for (const conv of this.conversations.values()) {
      if (conv.type === 'direct') {
        const members = Array.from(this.conversationMembers.values()).filter(
          (m) => m.conversationId === conv.id
        );
        const memberIds = members.map((m) => m.userId);
        if (
          memberIds.length === 2 &&
          memberIds.includes(user1Id) &&
          memberIds.includes(user2Id)
        ) {
          return this.getConversationById(conv.id, user1Id);
        }
      }
    }
    return undefined;
  }

  public createDirectConversation(user1Id: number, user2Id: number): Conversation {
    const existing = this.findDirectConversation(user1Id, user2Id);
    if (existing) {
      return existing;
    }

    const convId = this.nextConvId++;
    const now = new Date().toISOString();
    const newConv: Conversation = {
      id: convId,
      type: 'direct',
      createdById: user1Id,
      createdAt: now,
      updatedAt: now,
      members: [],
    };
    this.conversations.set(convId, newConv);

    const m1: ConversationMember = {
      id: this.nextMemberId++,
      conversationId: convId,
      userId: user1Id,
      role: 'member',
      joinedAt: now,
    };
    const m2: ConversationMember = {
      id: this.nextMemberId++,
      conversationId: convId,
      userId: user2Id,
      role: 'member',
      joinedAt: now,
    };
    this.conversationMembers.set(m1.id, m1);
    this.conversationMembers.set(m2.id, m2);

    return this.getConversationById(convId, user1Id)!;
  }

  public createGroupConversation(
    createdById: number,
    title: string,
    description: string | undefined,
    memberUserIds: number[]
  ): Conversation {
    const convId = this.nextConvId++;
    const now = new Date().toISOString();
    const newConv: Conversation = {
      id: convId,
      type: 'group',
      title,
      description,
      createdById,
      createdAt: now,
      updatedAt: now,
      members: [],
    };
    this.conversations.set(convId, newConv);

    const creatorMember: ConversationMember = {
      id: this.nextMemberId++,
      conversationId: convId,
      userId: createdById,
      role: 'admin',
      joinedAt: now,
    };
    this.conversationMembers.set(creatorMember.id, creatorMember);

    const uniqueMembers = Array.from(new Set(memberUserIds)).filter((uid) => uid !== createdById);
    uniqueMembers.forEach((uid) => {
      const member: ConversationMember = {
        id: this.nextMemberId++,
        conversationId: convId,
        userId: uid,
        role: 'member',
        joinedAt: now,
      };
      this.conversationMembers.set(member.id, member);
    });

    return this.getConversationById(convId, createdById)!;
  }

  public addMemberToConversation(
    conversationId: number,
    userId: number,
    role: 'admin' | 'member' = 'member'
  ): ConversationMember {
    const conv = this.conversations.get(conversationId);
    if (!conv) throw new Error('Conversation not found');

    const existing = Array.from(this.conversationMembers.values()).find(
      (m) => m.conversationId === conversationId && m.userId === userId
    );
    if (existing) return existing;

    const member: ConversationMember = {
      id: this.nextMemberId++,
      conversationId,
      userId,
      role,
      joinedAt: new Date().toISOString(),
    };
    this.conversationMembers.set(member.id, member);
    return member;
  }

  public removeMemberFromConversation(conversationId: number, userId: number): boolean {
    const existing = Array.from(this.conversationMembers.values()).find(
      (m) => m.conversationId === conversationId && m.userId === userId
    );
    if (existing) {
      this.conversationMembers.delete(existing.id);
      return true;
    }
    return false;
  }

  public isUserInConversation(conversationId: number, userId: number): boolean {
    return Array.from(this.conversationMembers.values()).some(
      (m) => m.conversationId === conversationId && m.userId === userId
    );
  }

  // MESSAGES
  public getMessagesByConversation(
    conversationId: number,
    options: {
      cursorMessageId?: number;
      limit?: number;
    } = {}
  ): { messages: Message[]; nextCursor?: number; hasMore: boolean } {
    const limit = options.limit || 50;

    let convMsgs = Array.from(this.messages.values())
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (options.cursorMessageId) {
      const cursorIdx = convMsgs.findIndex((m) => m.id === options.cursorMessageId);
      if (cursorIdx > 0) {
        convMsgs = convMsgs.slice(0, cursorIdx);
      }
    }

    const hasMore = convMsgs.length > limit;
    const pageMessages = hasMore ? convMsgs.slice(-limit) : convMsgs;
    const nextCursor = hasMore && pageMessages.length > 0 ? pageMessages[0].id : undefined;

    const enriched = pageMessages.map((m) => {
      const reactions = Array.from(this.messageReactions.values()).filter(
        (r) => r.messageId === m.id
      );
      const attachments = Array.from(this.attachments.values()).filter(
        (a) => a.messageId === m.id
      );
      const sender = this.getUserById(m.senderId);

      let replyTo: Message['replyTo'] | undefined;
      if (m.replyToMessageId) {
        const rm = this.messages.get(m.replyToMessageId);
        if (rm) {
          const rSender = this.getUserById(rm.senderId);
          replyTo = {
            id: rm.id,
            senderName: rSender?.name || 'Colleague',
            content: rm.isDeleted ? 'Message was deleted' : rm.content.substring(0, 100),
          };
        }
      }

      return {
        ...m,
        senderName: sender?.name || 'Colleague',
        senderAvatar: sender?.avatarUrl,
        reactions: reactions.length > 0 ? reactions : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        replyTo,
      };
    });

    return {
      messages: enriched,
      nextCursor,
      hasMore,
    };
  }

  public getMessageById(messageId: number): Message | undefined {
    return this.messages.get(messageId);
  }

  public createMessage(params: {
    conversationId: number;
    senderId: number;
    content: string;
    idempotencyId?: number | string;
    replyToMessageId?: number;
    attachments?: Array<{
      fileName: string;
      fileSize: number;
      fileType: string;
      mimeType: string;
      url: string;
    }>;
  }): Message {
    if (params.idempotencyId !== undefined) {
      const existing = Array.from(this.messages.values()).find(
        (m) =>
          m.conversationId === params.conversationId &&
          m.idempotencyId === params.idempotencyId
      );
      if (existing) {
        return existing;
      }
    }

    const messageId = this.nextMsgId++;
    const now = new Date().toISOString();
    const sender = this.getUserById(params.senderId);

    const message: Message = {
      id: messageId,
      conversationId: params.conversationId,
      senderId: params.senderId,
      senderName: sender?.name,
      senderAvatar: sender?.avatarUrl,
      content: params.content,
      idempotencyId: params.idempotencyId,
      replyToMessageId: params.replyToMessageId,
      isPinned: false,
      isEdited: false,
      isDeleted: false,
      status: 'sent',
      createdAt: now,
      updatedAt: now,
    };

    if (params.attachments && params.attachments.length > 0) {
      const createdAttachments: Attachment[] = [];
      params.attachments.forEach((att) => {
        const attachment: Attachment = {
          id: this.nextAttachmentId++,
          messageId,
          fileName: att.fileName,
          fileSize: att.fileSize,
          fileType: att.fileType,
          mimeType: att.mimeType,
          url: att.url,
          createdAt: now,
        };
        this.attachments.set(attachment.id, attachment);
        createdAttachments.push(attachment);
      });
      message.attachments = createdAttachments;
    }

    if (params.replyToMessageId) {
      const rm = this.messages.get(params.replyToMessageId);
      if (rm) {
        const rSender = this.getUserById(rm.senderId);
        message.replyTo = {
          id: rm.id,
          senderName: rSender?.name || 'Colleague',
          content: rm.isDeleted ? 'Message was deleted' : rm.content.substring(0, 100),
        };
      }
    }

    this.messages.set(messageId, message);

    safeSyncToSqlServer(() =>
      storeMessageToDb({
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content,
      })
    );

    const conv = this.conversations.get(params.conversationId);
    if (conv) {
      conv.updatedAt = now;
    }

    return message;
  }

  public updateMessageContent(messageId: number, newContent: string, userId: number): Message {
    const msg = this.messages.get(messageId);
    if (!msg) throw new Error('Message not found');
    if (msg.senderId !== userId) throw new Error('Unauthorized to edit this message');

    msg.content = newContent;
    msg.isEdited = true;
    msg.updatedAt = new Date().toISOString();
    return msg;
  }

  public deleteMessage(messageId: number, userId: number, isSuperAdmin = false): Message {
    const msg = this.messages.get(messageId);
    if (!msg) throw new Error('Message not found');
    if (msg.senderId !== userId && !isSuperAdmin) {
      throw new Error('Unauthorized to delete this message');
    }

    msg.content = 'This message was deleted';
    msg.isDeleted = true;
    msg.updatedAt = new Date().toISOString();
    return msg;
  }

  public togglePinMessage(conversationId: number, messageId: number, userId: number): boolean {
    const msg = this.messages.get(messageId);
    if (!msg || msg.conversationId !== conversationId) return false;

    const existingPin = Array.from(this.pinnedMessages.values()).find(
      (p) => p.conversationId === conversationId && p.messageId === messageId
    );

    if (existingPin) {
      this.pinnedMessages.delete(existingPin.pinId);
      msg.isPinned = false;
      return false;
    } else {
      const pinId = this.nextPinId++;
      this.pinnedMessages.set(pinId, {
        pinId,
        conversationId,
        messageId,
        pinnedById: userId,
        pinnedAt: new Date().toISOString(),
      });
      msg.isPinned = true;
      return true;
    }
  }

  public getPinnedMessages(conversationId: number): Message[] {
    const pinned = Array.from(this.pinnedMessages.values()).filter(
      (p) => p.conversationId === conversationId
    );
    return pinned
      .map((p) => this.getMessageById(p.messageId))
      .filter((m): m is Message => m !== undefined);
  }

  public toggleReaction(
    messageId: number,
    userId: number,
    emoji: string
  ): { added: boolean; reaction?: MessageReaction; reactions: MessageReaction[] } {
    const msg = this.messages.get(messageId);
    if (!msg) throw new Error('Message not found');

    const existing = Array.from(this.messageReactions.values()).find(
      (r) => r.messageId === messageId && r.userId === userId && r.emoji === emoji
    );

    let added = false;
    let newReaction: MessageReaction | undefined;

    if (existing) {
      this.messageReactions.delete(existing.id);
      added = false;
    } else {
      const user = this.getUserById(userId);
      newReaction = {
        id: this.nextReactionId++,
        messageId,
        userId,
        userName: user?.name,
        emoji,
        createdAt: new Date().toISOString(),
      };
      this.messageReactions.set(newReaction.id, newReaction);
      added = true;
    }

    const updatedReactions = this.getMessageReactions(messageId);
    return { added, reaction: newReaction, reactions: updatedReactions };
  }

  public getMessageReactions(messageId: number): MessageReaction[] {
    return Array.from(this.messageReactions.values())
      .filter((r) => r.messageId === messageId)
      .map((r) => {
        const u = this.getUserById(r.userId);
        return {
          ...r,
          userName: u?.name || r.userName || 'Colleague',
        };
      });
  }

  public markConversationRead(conversationId: number, userId: number, messageId: number): void {
    const member = Array.from(this.conversationMembers.values()).find(
      (m) => m.conversationId === conversationId && m.userId === userId
    );
    if (member) {
      member.lastReadMessageId = messageId;
    }

    const receiptId = this.nextReceiptId++;
    this.messageReceipts.set(receiptId, {
      id: receiptId,
      messageId,
      userId,
      status: 'read',
      timestamp: new Date().toISOString(),
    });
  }

  // REFRESH TOKENS
  public saveRefreshToken(userId: number, tokenHash: string, expiresAt: string): void {
    const tokenId = this.nextTokenId++;
    this.refreshTokens.set(tokenId, {
      tokenId,
      userId,
      tokenHash,
      expiresAt,
      isRevoked: false,
      createdAt: new Date().toISOString(),
    });
  }

  public getRefreshToken(tokenHash: string): DBRefreshToken | undefined {
    return Array.from(this.refreshTokens.values()).find(
      (t) => t.tokenHash === tokenHash && !t.isRevoked
    );
  }

  public revokeRefreshToken(tokenHash: string): void {
    const token = Array.from(this.refreshTokens.values()).find(
      (t) => t.tokenHash === tokenHash
    );
    if (token) {
      token.isRevoked = true;
    }
  }

  public revokeAllUserTokens(userId: number): void {
    for (const token of this.refreshTokens.values()) {
      if (token.userId === userId) {
        token.isRevoked = true;
      }
    }
  }
}

export const db = new RelationalDatabase();
