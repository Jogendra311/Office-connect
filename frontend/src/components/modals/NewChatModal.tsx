/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import {
  setActiveModal,
  setActiveConversationId,
} from '../../features/chat/chatSlice.ts';
import {
  useGetUsersQuery,
  useCreateConversationMutation,
} from '../../features/api/apiSlice.ts';
import { UserAvatar } from '../common/UserAvatar.tsx';
import { Search, X, MessageSquare, Loader2 } from 'lucide-react';

export const NewChatModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useGetUsersQuery();
  const [createConversation, { isLoading: isCreating }] = useCreateConversationMutation();

  const users = data?.users || [];
  const otherUsers = users.filter((u) => u.id !== currentUser?.id);

  const filtered = otherUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
      (u.departmentName && u.departmentName.toLowerCase().includes(search.toLowerCase()))
  );

  const handleStartChat = async (recipientId: number) => {
    try {
      const result = await createConversation({
        type: 'direct',
        recipientId,
      }).unwrap();

      dispatch(setActiveConversationId(result.conversation.id));
      dispatch(setActiveModal(null));
    } catch (err) {
      console.error('Failed to create direct chat:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md select-none">
      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-chat-transition">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/40 dark:border-white/10 flex items-center justify-between bg-white/50 dark:bg-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 border border-white/30">
              <MessageSquare className="w-4 h-4 drop-shadow-xs" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              New Direct Conversation
            </h3>
          </div>
          <button
            onClick={() => dispatch(setActiveModal(null))}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-200/60 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3.5 border-b border-white/30 dark:border-white/10">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search colleagues by name, department, title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-200/50 dark:bg-white/[0.07] backdrop-blur-xl border border-slate-300/40 dark:border-white/10 rounded-full text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 transition-all shadow-inner"
              autoFocus
            />
          </div>
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center p-8 text-xs text-slate-400 font-medium">
              No colleagues found matching "{search}"
            </div>
          ) : (
            filtered.map((user) => (
              <div
                key={user.id}
                onClick={() => handleStartChat(user.id)}
                className="flex items-center justify-between p-2.5 hover:bg-white/60 dark:hover:bg-white/[0.06] rounded-2xl cursor-pointer transition-all active:scale-[0.99] border border-transparent hover:border-white/40 dark:hover:border-white/10"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    name={user.name}
                    avatarUrl={user.avatarUrl}
                    size="md"
                    status={user.status}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {user.name}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">@{user.username}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {user.jobTitle} · {user.departmentName}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-mono font-semibold text-blue-600 dark:text-blue-400 px-2 py-0.5 bg-blue-500/10 dark:bg-blue-400/10 rounded-full border border-blue-500/20">
                  {user.employeeId}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
