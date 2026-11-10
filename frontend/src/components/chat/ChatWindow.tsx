/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { setActiveModal } from '../../features/chat/chatSlice.ts';
import {
  useGetConversationQuery,
  useGetMessagesQuery,
} from '../../features/api/apiSlice.ts';
import { socketService } from '../../services/socketClient.ts';
import { ChatHeader } from './ChatHeader.tsx';
import { MessageBubble } from './MessageBubble.tsx';
import { MessageComposer } from './MessageComposer.tsx';
import {
  MessageSquare,
  Users,
  ShieldCheck,
  Server,
  Lock,
  ArrowDown,
} from 'lucide-react';

export const ChatWindow: React.FC = () => {
  const dispatch = useAppDispatch();
  const activeConvId = useAppSelector((state) => state.chat.activeConversationId);
  const currentUser = useAppSelector((state) => state.auth.user);
  const typingMap = useAppSelector((state) => state.chat.typingMap);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data: convData } = useGetConversationQuery(activeConvId || 0, {
    skip: !activeConvId,
  });

  const { data: messagesData, isLoading: isMessagesLoading } = useGetMessagesQuery(
    { conversationId: activeConvId || 0, limit: 100 },
    { skip: !activeConvId }
  );

  const conversation = convData?.conversation;
  const messages = messagesData?.messages || [];
  const typers = activeConvId ? typingMap[activeConvId] || [] : [];

  // Scroll to bottom when conversation changes or new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConvId, messages.length]);

  // Mark latest message as read
  useEffect(() => {
    if (activeConvId && messages.length > 0 && currentUser) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderId !== currentUser.id) {
        socketService.markMessageAsRead(activeConvId, lastMsg.id);
      }
    }
  }, [activeConvId, messages.length, currentUser]);

  if (!activeConvId || !conversation) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center p-6 select-none bg-white/30 dark:bg-slate-950/30 backdrop-blur-xl relative overflow-hidden animate-chat-transition">
        {/* Ambient Subtle Glow */}
        <div className="absolute w-80 h-80 rounded-full bg-blue-500/10 dark:bg-blue-600/10 blur-3xl pointer-events-none" />

        <div className="max-w-md w-full text-center space-y-5 relative z-10">
          <div className="w-16 h-16 rounded-[22px] bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 text-white mx-auto flex items-center justify-center shadow-xl shadow-blue-500/25 border border-white/30">
            <MessageSquare className="w-8 h-8 drop-shadow-sm" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Welcome to OfficeConnect
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
              Real-time, enterprise-grade team messaging and file collaboration operating strictly inside your organization's private Local Area Network.
            </p>
          </div>

          {/* Feature Highlights - iOS Frosted Glass Widgets */}
          <div className="grid grid-cols-2 gap-3 text-left pt-1">
            <div className="p-3.5 bg-white/60 dark:bg-white/[0.05] backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-2xl shadow-xs transition-all hover:bg-white/80 dark:hover:bg-white/[0.08]">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 dark:bg-blue-400/15 flex items-center justify-center mb-2">
                <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                100% On-Premise
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Zero cloud reliance; runs directly on IIS & SQL Server.
              </p>
            </div>

            <div className="p-3.5 bg-white/60 dark:bg-white/[0.05] backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-2xl shadow-xs transition-all hover:bg-white/80 dark:hover:bg-white/[0.08]">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 dark:bg-emerald-400/15 flex items-center justify-center mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Zero Cloud Leakage
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Subnet restricted (10.1.60.0/24) with audit logging.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => dispatch(setActiveModal('new-chat'))}
              className="px-4 py-2 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full shadow-md shadow-blue-500/25 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Direct Message</span>
            </button>
            <button
              onClick={() => dispatch(setActiveModal('new-group'))}
              className="px-4 py-2 text-xs font-semibold bg-white/70 dark:bg-white/[0.08] hover:bg-white/90 dark:hover:bg-white/[0.14] text-slate-700 dark:text-slate-200 border border-white/60 dark:border-white/10 rounded-full shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
            >
              <Users className="w-3.5 h-3.5" />
              <span>New Team Channel</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pinnedCount = messages.filter((m) => m.isPinned).length;

  return (
    <div
      key={activeConvId}
      className="flex-1 h-full flex flex-col bg-white/40 dark:bg-slate-950/40 backdrop-blur-2xl overflow-hidden relative animate-chat-transition"
    >
      {/* Conversation Header */}
      <ChatHeader conversation={conversation} pinnedCount={pinnedCount} />

      {/* Messages Stream */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto py-3 space-y-1.5"
      >
        {isMessagesLoading && (
          <div className="flex justify-center p-4">
            <span className="text-xs text-slate-400 font-medium">Loading conversation history...</span>
          </div>
        )}

        {/* Security Banner */}
        <div className="flex justify-center my-2">
          <div className="flex items-center gap-1.5 px-3.5 py-1 bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 rounded-full text-[10px] text-amber-700 dark:text-amber-300 font-medium select-none backdrop-blur-md shadow-2xs">
            <Lock className="w-3 h-3 text-amber-500" />
            <span>LAN Protected: Messages and files stay inside the office network</span>
          </div>
        </div>

        {messages.map((msg, index) => {
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showSenderInfo = !prevMsg || prevMsg.senderId !== msg.senderId;

          // Date Separator check
          const currentDate = new Date(msg.createdAt).toDateString();
          const prevDate = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
          const showDateSeparator = currentDate !== prevDate;

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="flex justify-center my-3 select-none">
                  <span className="px-3 py-1 bg-white/70 dark:bg-white/[0.08] backdrop-blur-md border border-white/50 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-full text-[10px] font-semibold tracking-tight shadow-2xs">
                    {new Date(msg.createdAt).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}

              <MessageBubble
                message={msg}
                currentUser={currentUser!}
                conversationId={activeConvId}
                isGroup={conversation.type === 'group'}
                showSenderInfo={showSenderInfo}
              />
            </React.Fragment>
          );
        })}

        {/* Live Typing Indicator in Stream */}
        {typers.length > 0 && (
          <div className="px-4 py-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/70 dark:bg-white/[0.08] backdrop-blur-md border border-white/50 dark:border-white/10 shadow-2xs">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 ml-1.5">
                {typers.join(', ')} typing...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Composer */}
      <MessageComposer conversationId={activeConvId} />
    </div>
  );
};
