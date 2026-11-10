/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';

interface MessageReactionsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  userReactions?: string[]; // Emojis the current user has already selected
  align?: 'left' | 'right';
}

const PRIMARY_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥'];

const EXTENDED_EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Work & Feedback',
    emojis: ['👍', '👎', '✅', '❌', '🚀', '🔥', '💡', '📌', '🤝', '👏', '🙌', '🎯'],
  },
  {
    name: 'Reactions & Faces',
    emojis: ['😀', '😂', '🥹', '😍', '🤔', '😎', '😮', '😢', '😭', '🤯', '🥳', '😴'],
  },
  {
    name: 'Symbols & Objects',
    emojis: ['❤️', '💯', '✨', '⚡', '🎉', '☕', '👀', '💬', '📂', '🔒', '🔔', '⭐'],
  },
];

export const MessageReactionsOverlay: React.FC<MessageReactionsOverlayProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  userReactions = [],
  align = 'left',
}) => {
  const [showExtended, setShowExtended] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) {
      setShowExtended(false);
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute bottom-full mb-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 select-none ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
      role="dialog"
      aria-label="Message Reactions Picker"
    >
      {!showExtended ? (
        /* Compact Quick-Pick Floating Bar */
        <div className="flex items-center gap-0.5 p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg backdrop-blur-xs">
          {PRIMARY_REACTIONS.map((emoji) => {
            const isSelected = userReactions.includes(emoji);
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelectEmoji(emoji);
                  onClose();
                }}
                className={`w-8 h-8 flex items-center justify-center text-base rounded-full transition-transform hover:scale-125 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 ${
                  isSelected ? 'bg-indigo-100 dark:bg-indigo-950/60 ring-1 ring-indigo-500' : ''
                }`}
                title={`React with ${emoji}`}
                aria-label={`React with ${emoji}`}
              >
                <span>{emoji}</span>
              </button>
            );
          })}

          <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Expand to full emoji picker */}
          <button
            type="button"
            onClick={() => setShowExtended(true)}
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            title="More emojis"
            aria-label="More emojis"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Full Categorized Emoji Drawer */
        <div className="w-64 max-h-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2.5 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Pick Reaction
            </span>
            <button
              type="button"
              onClick={() => setShowExtended(false)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              title="Back to quick reactions"
              aria-label="Back to quick reactions"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {EXTENDED_EMOJI_CATEGORIES.map((category) => (
              <div key={category.name}>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 px-1">
                  {category.name}
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {category.emojis.map((emoji) => {
                    const isSelected = userReactions.includes(emoji);
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          onSelectEmoji(emoji);
                          onClose();
                        }}
                        className={`w-8 h-8 flex items-center justify-center text-base rounded-md hover:scale-125 transition-transform hover:bg-slate-100 dark:hover:bg-slate-700 ${
                          isSelected ? 'bg-indigo-100 dark:bg-indigo-950/60 ring-1 ring-indigo-500' : ''
                        }`}
                        title={`React with ${emoji}`}
                        aria-label={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
