/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { setActiveModal } from '../../features/chat/chatSlice.ts';
import { UserAvatar } from '../common/UserAvatar.tsx';
import type { Conversation } from '../../types/index.ts';
import { Pin, ArrowLeft } from 'lucide-react';
import { setActiveConversationId } from '../../features/chat/chatSlice.ts';

interface ChatHeaderProps {
  conversation: Conversation;
  pinnedCount?: number;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation,
  pinnedCount = 0,
}) => {
  const dispatch = useAppDispatch();
  const presenceMap = useAppSelector((state) => state.chat.presenceMap);

  const isDirect = conversation.type === 'direct';
  const otherUser = conversation.isDirectWithUser;
  const title = isDirect ? otherUser?.name || 'Colleague' : conversation.title;
  const avatarUrl = isDirect ? otherUser?.avatarUrl : conversation.avatarUrl;

  const currentStatus =
    isDirect && otherUser
      ? presenceMap[otherUser.id]?.status || otherUser.status
      : undefined;

  const getSubtitle = () => {
    if (isDirect && otherUser) {
      if (currentStatus === 'online') {
        return <span className="text-emerald-600 dark:text-emerald-400 font-medium">Online</span>;
      }
      if (currentStatus === 'away') {
        return <span className="text-amber-500 font-medium">Away</span>;
      }
      if (currentStatus === 'busy') {
        return <span className="text-rose-500 font-medium">Busy / In Meeting</span>;
      }
      return (
        <span className="text-slate-400">
          Offline · {otherUser.jobTitle} ({otherUser.departmentName})
        </span>
      );
    } else {
      const memberNames = conversation.members
        .map((m) => m.user?.name?.split(' ')[0] || 'User')
        .slice(0, 4)
        .join(', ');
      const more = conversation.members.length > 4 ? ` +${conversation.members.length - 4}` : '';
      return (
        <span className="text-slate-400">
          {conversation.members.length} members: {memberNames}
          {more}
        </span>
      );
    }
  };

  return (
    <div className="h-14 px-4 bg-white/70 dark:bg-slate-900/65 backdrop-blur-2xl border-b border-white/40 dark:border-white/10 flex items-center justify-between select-none z-10 shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => dispatch(setActiveConversationId(null))}
          className="md:hidden p-2 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.1] rounded-full active:scale-95 transition-all cursor-pointer"
          title="Back to conversations list"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <UserAvatar
          name={title || 'Chat'}
          avatarUrl={avatarUrl}
          size="md"
          status={currentStatus}
          isGroup={!isDirect}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {title}
            </h2>
            {isDirect && otherUser && (
              <span className="text-[10px] px-2 py-0.5 bg-slate-200/60 dark:bg-white/[0.08] backdrop-blur-md text-slate-600 dark:text-slate-300 rounded-full font-mono font-semibold">
                {otherUser.employeeId}
              </span>
            )}
          </div>
          <div className="text-[11px] truncate font-medium">{getSubtitle()}</div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {pinnedCount > 0 && (
          <button
            onClick={() => dispatch(setActiveModal('pinned'))}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 rounded-full hover:bg-amber-500/20 transition-all active:scale-95 cursor-pointer backdrop-blur-md shadow-2xs"
            title="View Pinned Messages"
          >
            <Pin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 fill-amber-500/20" />
            <span>{pinnedCount} Pinned</span>
          </button>
        )}
      </div>
    </div>
  );
};
