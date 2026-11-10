/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { setActiveModal } from '../../features/chat/chatSlice.ts';
import { updateCurrentUser } from '../../features/auth/authSlice.ts';
import { useUpdateProfileMutation } from '../../features/api/apiSlice.ts';
import { UserAvatar } from '../common/UserAvatar.tsx';
import type { UserStatus } from '../../types/index.ts';
import { User, X, Check, Loader2 } from 'lucide-react';

export const ProfileModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const lanServerIp = useAppSelector((state) => state.auth.lanServerIp);

  const [name, setName] = useState(currentUser?.name || '');
  const [jobTitle, setJobTitle] = useState(currentUser?.jobTitle || '');
  const [status, setStatus] = useState<UserStatus>(currentUser?.status || 'online');
  const [isSaved, setIsSaved] = useState(false);

  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await updateProfile({
        name: name.trim(),
        jobTitle: jobTitle.trim(),
        status,
      }).unwrap();

      dispatch(updateCurrentUser(res.user));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md select-none">
      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-chat-transition">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/40 dark:border-white/10 flex items-center justify-between bg-white/50 dark:bg-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 border border-white/30">
              <User className="w-4 h-4 drop-shadow-xs" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Employee Profile & Presence
            </h3>
          </div>
          <button
            onClick={() => dispatch(setActiveModal(null))}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-200/60 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <UserAvatar
              name={name || 'User'}
              avatarUrl={currentUser?.avatarUrl}
              size="xl"
              status={status}
            />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</p>
              <p className="text-xs text-slate-500">{currentUser?.email}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium rounded">
                  {currentUser?.role}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {currentUser?.employeeId}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Presence Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
              >
                <option value="online">🟢 Online (Available on LAN)</option>
                <option value="away">🟡 Away (Temporarily away from desk)</option>
                <option value="busy">🔴 Busy (Do not disturb / In meeting)</option>
                <option value="offline">⚪ Offline (Appear offline)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
                required
              />
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>Department:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {currentUser?.departmentName}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>LAN Subnet:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  10.1.60.0/24 (App Server: {lanServerIp})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {isSaved ? (
              <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                <Check className="w-3.5 h-3.5" />
                <span>Profile updated</span>
              </span>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => dispatch(setActiveModal(null))}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center gap-1.5 shadow-xs"
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
