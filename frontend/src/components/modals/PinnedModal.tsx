/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { setActiveModal } from '../../features/chat/chatSlice.ts';
import {
  useGetMessagesQuery,
  useTogglePinMutation,
} from '../../features/api/apiSlice.ts';
import { Pin, X, FileText } from 'lucide-react';

export const PinnedModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const activeConvId = useAppSelector((state) => state.chat.activeConversationId);

  const { data } = useGetMessagesQuery(
    { conversationId: activeConvId || 0, limit: 100 },
    { skip: !activeConvId }
  );

  const [togglePin] = useTogglePinMutation();

  const pinnedMessages = (data?.messages || []).filter((m) => m.isPinned);

  const handleUnpin = async (messageId: number) => {
    if (activeConvId) {
      await togglePin({ messageId, conversationId: activeConvId });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-amber-500 fill-amber-500/20" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Pinned Messages ({pinnedMessages.length})
            </h3>
          </div>
          <button
            onClick={() => dispatch(setActiveModal(null))}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {pinnedMessages.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">
              No pinned messages in this conversation.
            </p>
          ) : (
            pinnedMessages.map((msg) => (
              <div
                key={msg.id}
                className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg text-xs space-y-1 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {msg.senderName}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(msg.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>

                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="pt-1 flex items-center gap-1 text-[11px] text-slate-500">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{msg.attachments[0].fileName}</span>
                  </div>
                )}

                <button
                  onClick={() => handleUnpin(msg.id)}
                  className="text-[10px] text-amber-600 hover:underline pt-1 block"
                >
                  Unpin message
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
