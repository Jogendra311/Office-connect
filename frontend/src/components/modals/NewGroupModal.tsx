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
import { Users, X, Check, Loader2 } from 'lucide-react';

export const NewGroupModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: usersData, isLoading: isUsersLoading } = useGetUsersQuery();
  const [createConversation, { isLoading: isCreating }] = useCreateConversationMutation();

  const users = (usersData?.users || []).filter((u) => u.id !== currentUser?.id);

  const toggleSelectUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Group name is required');
      return;
    }

    try {
      setError(null);
      const result = await createConversation({
        type: 'group',
        title: title.trim(),
        description: description.trim() || undefined,
        memberIds: selectedUserIds,
      }).unwrap();

      dispatch(setActiveConversationId(result.conversation.id));
      dispatch(setActiveModal(null));
    } catch (err: any) {
      setError(err.data?.error || 'Failed to create group channel');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md select-none">
      <div className="w-full max-w-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-chat-transition">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/40 dark:border-white/10 flex items-center justify-between bg-white/50 dark:bg-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 border border-white/30">
              <Users className="w-4 h-4 drop-shadow-xs" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Create Team Channel
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

        <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-800">
            {error && (
              <div className="p-2 text-xs bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 rounded">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Channel Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Finance Operations, Project Titan, IT Infrastructure"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Purpose / Description
              </label>
              <input
                type="text"
                placeholder="Brief purpose of this team channel..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Select Team Members ({selectedUserIds.length} selected)
              </span>
              <span>All members on LAN can participate</span>
            </div>
          </div>

          {/* Members Checklist */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {isUsersLoading ? (
              <div className="flex justify-center p-6">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              </div>
            ) : (
              users.map((u) => {
                const isSelected = selectedUserIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleSelectUser(u.id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar
                        name={u.name}
                        avatarUrl={u.avatarUrl}
                        size="sm"
                        status={u.status}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          {u.name}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {u.jobTitle} · {u.departmentName}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-3" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={() => dispatch(setActiveModal(null))}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !title.trim()}
              className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isCreating ? 'Creating Channel...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
