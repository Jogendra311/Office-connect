/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Super Admin' | 'Admin' | 'Department Admin' | 'Employee';

export type UserStatus = 'online' | 'away' | 'busy' | 'offline';

export type ConversationType = 'direct' | 'group';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface User {
  id: number;
  employeeId: number;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: number;
  departmentName?: string;
  jobTitle: string;
  avatarUrl?: string;
  status: UserStatus;
  lastSeen: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string;
  managerId?: number;
  createdAt: string;
}

export interface RoleRecord {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
}

export interface ConversationMember {
  id: number;
  conversationId: number;
  userId: number;
  role: 'admin' | 'member';
  joinedAt: string;
  lastReadMessageId?: number;
  user?: User;
}

export interface Attachment {
  id: number;
  messageId?: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  url: string;
  createdAt: string;
}

export interface MessageReaction {
  id: number;
  messageId: number;
  userId: number;
  userName?: string;
  emoji: string;
  createdAt: string;
}

export interface MessageReceipt {
  id: number;
  messageId: number;
  userId: number;
  status: 'delivered' | 'read';
  timestamp: string;
}

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  idempotencyId?: number | string;
  replyToMessageId?: number;
  replyTo?: {
    id: number;
    senderName: string;
    content: string;
  };
  attachments?: Attachment[];
  reactions?: MessageReaction[];
  receipts?: MessageReceipt[];
  isPinned?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  status: MessageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: number;
  type: ConversationType;
  title?: string;
  description?: string;
  avatarUrl?: string;
  createdById: number;
  createdAt: string;
  updatedAt: string;
  lastMessage?: Message;
  unreadCount?: number;
  members: ConversationMember[];
  isDirectWithUser?: User; // For 1:1 chats, the counterpart user
}

export interface AuditLog {
  id: number;
  userId: number;
  userName: string;
  action: string;
  targetResource: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}

export interface TypingIndicatorData {
  conversationId: number;
  userId: number;
  userName: string;
  isTyping: boolean;
}

export interface PresenceUpdateData {
  userId: number;
  status: UserStatus;
  lastSeen: string;
}

// Client to Server Events
export interface ClientToServerEvents {
  'conversation:join': (conversationId: number, ack?: (res: { success: boolean }) => void) => void;
  'conversation:leave': (conversationId: number) => void;
  'message:send': (
    payload: {
      conversationId: number;
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
    },
    ack?: (response: { success: boolean; message?: Message; error?: string }) => void
  ) => void;
  'message:read': (
    payload: {
      conversationId: number;
      messageId: number;
    },
    ack?: (response: { success: boolean }) => void
  ) => void;
  'message:react': (
    payload: {
      conversationId: number;
      messageId: number;
      emoji: string;
    },
    ack?: (response: { success: boolean; added: boolean; reactions?: MessageReaction[] }) => void
  ) => void;
  'typing:start': (conversationId: number) => void;
  'typing:stop': (conversationId: number) => void;
  'typing': (payload: { conversationId: number; isTyping: boolean }) => void;
  'presence:subscribe': (userIds: number[]) => void;
}

// Server to Client Events
export interface ServerToClientEvents {
  'message:new': (message: Message) => void;
  'message:updated': (message: Message) => void;
  'message:deleted': (payload: { messageId: number; conversationId: number }) => void;
  'message:receipt': (payload: { messageId: number; conversationId: number; userId: number; status: 'delivered' | 'read'; timestamp: string }) => void;
  'message:reaction': (payload: {
    messageId: number;
    conversationId: number;
    userId: number;
    userName: string;
    emoji: string;
    added: boolean;
    reactions: MessageReaction[];
  }) => void;
  'typing:update': (data: TypingIndicatorData) => void;
  'typing': (data: TypingIndicatorData) => void;
  'presence:update': (data: PresenceUpdateData) => void;
  'conversation:updated': (conversation: Conversation) => void;
  'notification:new': (notification: { id: number; title: string; body: string; conversationId: number; createdAt: string }) => void;
}

export interface SocketData {
  user: User;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}
