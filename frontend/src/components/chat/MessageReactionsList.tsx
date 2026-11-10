/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { MessageReaction } from '../../types/index.ts';
import { SmilePlus } from 'lucide-react';

interface MessageReactionsListProps {
  reactions?: MessageReaction[];
  currentUserId: number;
  onToggleReaction: (emoji: string) => void;
  onOpenOverlay: () => void;
  isOutgoing?: boolean;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  users: string[];
}

export const MessageReactionsList: React.FC<MessageReactionsListProps> = ({
  reactions = [],
  currentUserId,
  onToggleReaction,
  onOpenOverlay,
  isOutgoing = false,
}) => {
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);

  if (!reactions || reactions.length === 0) {
    return null;
  }

  // Group reactions by emoji
  const groupedMap = new Map<string, GroupedReaction>();

  reactions.forEach((r) => {
    let group = groupedMap.get(r.emoji);
    if (!group) {
      group = {
        emoji: r.emoji,
        count: 0,
        reactedByMe: false,
        users: [],
      };
      groupedMap.set(r.emoji, group);
    }
    group.count += 1;
    if (r.userId === currentUserId) {
      group.reactedByMe = true;
    }
    if (r.userName && !group.users.includes(r.userName)) {
      group.users.push(r.userName);
    }
  });

  const grouped = Array.from(groupedMap.values());

  return (
    <div
      className={`flex flex-wrap items-center gap-1 mt-1 select-none ${
        isOutgoing ? 'justify-end' : 'justify-start'
      }`}
    >
      {grouped.map((item) => {
        const userListString =
          item.users.length > 0
            ? item.users.slice(0, 3).join(', ') + (item.users.length > 3 ? ` +${item.users.length - 3}` : '')
            : '1 colleague';

        return (
          <div key={item.emoji} className="relative group/pill">
            <button
              type="button"
              onClick={() => onToggleReaction(item.emoji)}
              onMouseEnter={() => setHoveredEmoji(item.emoji)}
              onMouseLeave={() => setHoveredEmoji(null)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all cursor-pointer border ${
                item.reactedByMe
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700/80 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
              }`}
              title={`${userListString} reacted with ${item.emoji}`}
              aria-label={`${item.emoji} reacted by ${userListString}`}
            >
              <span className="text-xs leading-none">{item.emoji}</span>
              <span className="text-[11px] font-medium leading-none">{item.count}</span>
            </button>

            {/* Hover Tooltip showing user names */}
            {hoveredEmoji === item.emoji && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded shadow-md whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-100">
                <span>{userListString}</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Quick Add Reaction Button */}
      <button
        type="button"
        onClick={onOpenOverlay}
        className="w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        title="Add reaction"
        aria-label="Add reaction"
      >
        <SmilePlus className="w-3 h-3" />
      </button>
    </div>
  );
};
