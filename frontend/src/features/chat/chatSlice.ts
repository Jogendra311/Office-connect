/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Message, UserStatus } from '../../types/index.ts';

interface ChatState {
  activeConversationId: number | null;
  typingMap: Record<number, string[]>; // convId -> userNames
  presenceMap: Record<number, { status: UserStatus; lastSeen: string }>;
  isNetworkConnected: boolean;
  filterTab: 'all' | 'direct' | 'group' | 'unread';
  replyingToMessage: Message | null;
  searchQuery: string;
  activeModal: 'new-chat' | 'new-group' | 'admin' | 'profile' | 'settings' | 'pinned' | 'deployment' | 'register-employee' | null;
}

const initialState: ChatState = {
  activeConversationId: null,
  typingMap: {},
  presenceMap: {},
  isNetworkConnected: true,
  filterTab: 'all',
  replyingToMessage: null,
  searchQuery: '',
  activeModal: null,
};

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveConversationId: (state, action: PayloadAction<number | null>) => {
      state.activeConversationId = action.payload;
      state.replyingToMessage = null;
    },
    setReplyingToMessage: (state, action: PayloadAction<Message | null>) => {
      state.replyingToMessage = action.payload;
    },
    setFilterTab: (state, action: PayloadAction<ChatState['filterTab']>) => {
      state.filterTab = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setActiveModal: (state, action: PayloadAction<ChatState['activeModal']>) => {
      state.activeModal = action.payload;
    },
    setNetworkConnected: (state, action: PayloadAction<boolean>) => {
      state.isNetworkConnected = action.payload;
    },
    setTypingStatus: (
      state,
      action: PayloadAction<{ conversationId: number; userName: string; isTyping: boolean }>
    ) => {
      const { conversationId, userName, isTyping } = action.payload;
      const currentList = state.typingMap[conversationId] || [];

      if (isTyping) {
        if (!currentList.includes(userName)) {
          state.typingMap[conversationId] = [...currentList, userName];
        }
      } else {
        state.typingMap[conversationId] = currentList.filter((u) => u !== userName);
      }
    },
    updatePresence: (
      state,
      action: PayloadAction<{ userId: number; status: UserStatus; lastSeen: string }>
    ) => {
      const { userId, status, lastSeen } = action.payload;
      state.presenceMap[userId] = { status, lastSeen };
    },
  },
});

export const {
  setActiveConversationId,
  setReplyingToMessage,
  setFilterTab,
  setSearchQuery,
  setActiveModal,
  setNetworkConnected,
  setTypingStatus,
  updatePresence,
} = chatSlice.actions;

export default chatSlice.reducer;
