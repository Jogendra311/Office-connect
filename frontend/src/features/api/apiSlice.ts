/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../../app/store.ts';
import type {
  Conversation,
  Message,
  User,
  Department,
  RoleRecord,
  AuditLog,
} from '../../types/index.ts';

const apiBaseUrl = '/api/v1';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: apiBaseUrl,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: [
    'Conversations',
    'Messages',
    'Users',
    'AdminUsers',
    'AuditLogs',
    'Departments',
    'Roles',
    'SetupStatus',
  ],
  endpoints: (builder) => ({
    // Auth
    login: builder.mutation<
      { user: User; accessToken: string },
      { username: string; password: string }
    >({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Conversations', 'Users'],
    }),

    getMe: builder.query<{ user: User }, void>({
      query: () => '/auth/me',
      providesTags: ['Users'],
    }),

    setupInitialAdmin: builder.mutation<
      { user: User; accessToken: string },
      {
        username: string;
        name: string;
        email: string;
        password: string;
        departmentName: string;
        departmentCode: string;
        jobTitle: string;
      }
    >({
      query: (body) => ({
        url: '/auth/setup',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Users', 'AdminUsers', 'Departments'],
    }),

    logout: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
        body: {},
      }),
    }),

    getHealth: builder.query<
      { status: string; platform: string; hostIp?: string; clientIp?: string; timestamp: string },
      void
    >({
      query: () => '/health',
    }),

    // Conversations
    getConversations: builder.query<{ conversations: Conversation[] }, void>({
      query: () => '/conversations',
      providesTags: ['Conversations'],
    }),

    getConversation: builder.query<{ conversation: Conversation }, number | string>({
      query: (id) => `/conversations/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Conversations', id }],
    }),

    createConversation: builder.mutation<
      { conversation: Conversation },
      {
        type: 'direct' | 'group';
        recipientId?: number;
        title?: string;
        description?: string;
        memberIds?: number[];
      }
    >({
      query: (body) => ({
        url: '/conversations',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Conversations'],
    }),

    // Messages
    getMessages: builder.query<
      { messages: Message[]; nextCursor?: number; hasMore: boolean },
      { conversationId: number; cursor?: number; limit?: number }
    >({
      query: ({ conversationId, cursor, limit = 50 }) => {
        let url = `/conversations/${conversationId}/messages?limit=${limit}`;
        if (cursor) url += `&cursor=${cursor}`;
        return url;
      },
      providesTags: (_result, _error, { conversationId }) => [
        { type: 'Messages', id: conversationId },
      ],
    }),

    sendMessage: builder.mutation<
      { message: Message },
      {
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
      }
    >({
      query: (body) => ({
        url: '/messages',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: 'Messages', id: conversationId },
        'Conversations',
      ],
    }),

    editMessage: builder.mutation<
      { message: Message },
      { id: number; content: string; conversationId: number }
    >({
      query: ({ id, content }) => ({
        url: `/messages/${id}`,
        method: 'PATCH',
        body: { content },
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: 'Messages', id: conversationId },
      ],
    }),

    deleteMessage: builder.mutation<
      { message: Message },
      { id: number; conversationId: number }
    >({
      query: ({ id }) => ({
        url: `/messages/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: 'Messages', id: conversationId },
        'Conversations',
      ],
    }),

    toggleReaction: builder.mutation<
      { added: boolean },
      { messageId: number; emoji: string; conversationId: number }
    >({
      query: ({ messageId, emoji }) => ({
        url: `/messages/${messageId}/reactions`,
        method: 'POST',
        body: { emoji },
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: 'Messages', id: conversationId },
      ],
    }),

    togglePin: builder.mutation<
      { isPinned: boolean },
      { messageId: number; conversationId: number }
    >({
      query: ({ messageId }) => ({
        url: `/messages/${messageId}/pin`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: 'Messages', id: conversationId },
      ],
    }),

    markAsRead: builder.mutation<
      { success: boolean },
      { messageId: number; conversationId: number }
    >({
      query: ({ messageId }) => ({
        url: `/messages/${messageId}/read`,
        method: 'POST',
      }),
      invalidatesTags: ['Conversations'],
    }),

    // Users & Directory
    getUsers: builder.query<{ users: User[] }, void>({
      query: () => '/users',
      providesTags: ['Users'],
    }),

    searchUsers: builder.query<{ users: User[] }, string>({
      query: (q) => `/users/search?q=${encodeURIComponent(q)}`,
    }),

    updateProfile: builder.mutation<
      { user: User },
      Partial<{ name: string; jobTitle: string; avatarUrl: string; status: User['status'] }>
    >({
      query: (body) => ({
        url: '/users/profile/me',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Users'],
    }),

    getDepartments: builder.query<{ departments: Department[] }, void>({
      query: () => '/users/meta/departments',
      providesTags: ['Departments'],
    }),

    getRoles: builder.query<{ roles: RoleRecord[] }, void>({
      query: () => '/users/meta/roles',
      providesTags: ['Roles'],
    }),

    // Admin endpoints
    getAdminUsers: builder.query<{ users: User[] }, void>({
      query: () => '/admin/users',
      providesTags: ['AdminUsers'],
    }),

    createEmployee: builder.mutation<
      { user: User },
      {
        employeeId?: number | string;
        username: string;
        name: string;
        email: string;
        role: User['role'];
        departmentId: number;
        jobTitle: string;
        initialPassword?: string;
      }
    >({
      query: (body) => ({
        url: '/admin/users',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminUsers', 'Users', 'AuditLogs'],
    }),

    registerEmployee: builder.mutation<
      { user: User; authorizedBy?: string; message: string },
      {
        employeeId?: number | string;
        username: string;
        name: string;
        email: string;
        role: User['role'];
        departmentId: number;
        jobTitle: string;
        initialPassword?: string;
      }
    >({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminUsers', 'Users', 'AuditLogs'],
    }),

    updateUserStatus: builder.mutation<
      { user: User },
      { userId: number; isActive: boolean }
    >({
      query: ({ userId, isActive }) => ({
        url: `/admin/users/${userId}/status`,
        method: 'PATCH',
        body: { isActive },
      }),
      invalidatesTags: ['AdminUsers', 'Users', 'AuditLogs'],
    }),

    updateUserRole: builder.mutation<
      { user: User },
      { userId: number; role: User['role'] }
    >({
      query: ({ userId, role }) => ({
        url: `/admin/users/${userId}/role`,
        method: 'PATCH',
        body: { role },
      }),
      invalidatesTags: ['AdminUsers', 'Users', 'AuditLogs'],
    }),

    getAuditLogs: builder.query<{ logs: AuditLog[] }, void>({
      query: () => '/admin/audit-logs',
      providesTags: ['AuditLogs'],
    }),

    // Upload attachment
    uploadAttachment: builder.mutation<{ attachment: any }, FormData>({
      query: (formData) => ({
        url: '/attachments/upload',
        method: 'POST',
        body: formData,
      }),
    }),

    // SQL Server Endpoints
    getSqlServerStatus: builder.query<{ config: any }, void>({
      query: () => '/admin/sql-server/status',
    }),
    testSqlConnection: builder.mutation<any, any>({
      query: (body) => ({
        url: '/admin/sql-server/test-connection',
        method: 'POST',
        body: body || {},
      }),
    }),
    initSqlServerSchema: builder.mutation<any, void>({
      query: () => ({
        url: '/admin/sql-server/init-schema',
        method: 'POST',
      }),
    }),
    installStoredProcedures: builder.mutation<any, void>({
      query: () => ({
        url: '/admin/sql-server/install-sp',
        method: 'POST',
      }),
    }),
    syncSqlServerData: builder.mutation<any, void>({
      query: () => ({
        url: '/admin/sql-server/sync-data',
        method: 'POST',
      }),
      invalidatesTags: ['AuditLogs'],
    }),
  }),
});

export const {
  useLoginMutation,
  useGetMeQuery,
  useSetupInitialAdminMutation,
  useLogoutMutation,
  useLazyGetHealthQuery,
  useGetConversationsQuery,
  useGetConversationQuery,
  useCreateConversationMutation,
  useGetMessagesQuery,
  useSendMessageMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useToggleReactionMutation,
  useTogglePinMutation,
  useMarkAsReadMutation,
  useGetUsersQuery,
  useSearchUsersQuery,
  useUpdateProfileMutation,
  useGetDepartmentsQuery,
  useGetRolesQuery,
  useGetAdminUsersQuery,
  useCreateEmployeeMutation,
  useRegisterEmployeeMutation,
  useUpdateUserStatusMutation,
  useUpdateUserRoleMutation,
  useGetAuditLogsQuery,
  useUploadAttachmentMutation,
  useGetSqlServerStatusQuery,
  useTestSqlConnectionMutation,
  useInitSqlServerSchemaMutation,
  useInstallStoredProceduresMutation,
  useSyncSqlServerDataMutation,
} = apiSlice;
