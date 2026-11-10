/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppDispatch } from '../../app/hooks.ts';
import { setReplyingToMessage } from '../../features/chat/chatSlice.ts';
import {
  useToggleReactionMutation,
  useTogglePinMutation,
  useDeleteMessageMutation,
  useEditMessageMutation,
} from '../../features/api/apiSlice.ts';
import { UserAvatar } from '../common/UserAvatar.tsx';
import { MessageReactionsOverlay } from './MessageReactionsOverlay.tsx';
import { MessageReactionsList } from './MessageReactionsList.tsx';
import type { Message, User } from '../../types/index.ts';
import {
  Reply,
  Smile,
  Pin,
  Trash2,
  Edit2,
  Copy,
  Check,
  CheckCheck,
  FileText,
  Download,
  X,
} from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  currentUser: User;
  conversationId: number;
  isGroup: boolean;
  showSenderInfo: boolean;
}

const COMMON_EMOJIS = ['👍', '❤️', '🎉', '🚀', '👀', '👏'];

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  currentUser,
  conversationId,
  isGroup,
  showSenderInfo,
}) => {
  const dispatch = useAppDispatch();
  const [showReactionOverlay, setShowReactionOverlay] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copied, setCopied] = useState(false);

  const [toggleReaction] = useToggleReactionMutation();
  const [togglePin] = useTogglePinMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const [editMessage] = useEditMessageMutation();

  const isOutgoing = message.senderId === currentUser.id;
  const isSuperAdmin = currentUser.role === 'Super Admin';
  const canDelete = (isOutgoing || isSuperAdmin) && !message.isDeleted;
  const canEdit = isOutgoing && !message.isDeleted;

  const userReactions =
    message.reactions
      ?.filter((r) => r.userId === currentUser.id)
      .map((r) => r.emoji) || [];

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await editMessage({
        id: message.id,
        content: editContent.trim(),
        conversationId,
      }).unwrap();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const handleDelete = async () => {
    if (confirm('Delete this message for everyone?')) {
      try {
        await deleteMessage({ id: message.id, conversationId }).unwrap();
      } catch (err) {
        console.error('Failed to delete message:', err);
      }
    }
  };

  const handleEmojiClick = async (emoji: string) => {
    try {
      await toggleReaction({
        messageId: message.id,
        emoji,
        conversationId,
      }).unwrap();
      setShowReactionOverlay(false);
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  const handlePinToggle = async () => {
    try {
      await togglePin({ messageId: message.id, conversationId }).unwrap();
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  // Group reactions by emoji
  const reactionCounts: Record<string, { count: number; reactedByMe: boolean }> = {};
  message.reactions?.forEach((r) => {
    if (!reactionCounts[r.emoji]) {
      reactionCounts[r.emoji] = { count: 0, reactedByMe: false };
    }
    reactionCounts[r.emoji].count += 1;
    if (r.userId === currentUser.id) {
      reactionCounts[r.emoji].reactedByMe = true;
    }
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={`group relative flex gap-2.5 px-4 py-1.5 transition-colors animate-message-pop hover:bg-white/40 dark:hover:bg-white/[0.02] ${
        isOutgoing ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Sender Avatar (Only for incoming messages) */}
      {!isOutgoing && (
        <div className="flex-shrink-0 self-end">
          {showSenderInfo ? (
            <UserAvatar
              name={message.senderName || 'Colleague'}
              avatarUrl={message.senderAvatar}
              size="sm"
            />
          ) : (
            <div className="w-8" />
          )}
        </div>
      )}

      {/* Main Message Content */}
      <div className={`max-w-[85%] md:max-w-[70%] flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}>
        {/* Sender Name in group chats */}
        {!isOutgoing && isGroup && showSenderInfo && (
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-1 ml-1">
            {message.senderName}
          </span>
        )}

        {/* Pinned Tag */}
        {message.isPinned && (
          <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold mb-1 px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 backdrop-blur-xs">
            <Pin className="w-3 h-3 fill-amber-500/30" />
            <span>Pinned message</span>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`relative rounded-2xl px-4 py-2.5 text-xs leading-relaxed transition-all ${
            isOutgoing
              ? 'bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-600 text-white rounded-br-xs shadow-md shadow-blue-500/20 border border-blue-400/30'
              : 'bg-white/80 dark:bg-white/[0.08] backdrop-blur-xl text-slate-800 dark:text-slate-100 border border-white/60 dark:border-white/10 rounded-bl-xs shadow-xs'
          }`}
        >
          {/* Reply Quote Block */}
          {message.replyTo && (
            <div
              className={`mb-2 p-2 rounded text-[11px] border-l-2 ${
                isOutgoing
                  ? 'bg-indigo-700/60 border-indigo-300 text-indigo-100'
                  : 'bg-slate-100 dark:bg-slate-750 border-indigo-500 text-slate-600 dark:text-slate-300'
              }`}
            >
              <p className="font-semibold">{message.replyTo.senderName}</p>
              <p className="truncate line-clamp-1">{message.replyTo.content}</p>
            </div>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="space-y-2 mb-2">
              {message.attachments.map((att) => (
                <div key={att.id} className="rounded-lg overflow-hidden">
                  {att.fileType === 'image' ? (
                    <img
                      src={att.url}
                      alt={att.fileName}
                      className="max-h-64 rounded-md object-cover border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div
                      className={`flex items-center justify-between gap-3 p-2 rounded-md ${
                        isOutgoing ? 'bg-indigo-700/60' : 'bg-slate-100 dark:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-5 h-5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{att.fileName}</p>
                          <p className="text-[10px] opacity-75">{formatFileSize(att.fileSize)}</p>
                        </div>
                      </div>
                      <a
                        href={att.url}
                        download={att.fileName}
                        className="p-1 hover:opacity-80 rounded"
                        title="Download attachment"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Content Body */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full text-xs p-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded border border-slate-300 dark:border-slate-600 focus:outline-hidden"
                rows={2}
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-2 py-0.5 rounded bg-white text-indigo-700 font-semibold"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="break-words whitespace-pre-wrap">
              {message.isDeleted ? (
                <span className="italic opacity-60">This message was deleted</span>
              ) : (
                message.content
              )}
            </div>
          )}

          {/* Timestamp & Status Metadata */}
          <div
            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
              isOutgoing ? 'text-indigo-200' : 'text-slate-400'
            }`}
          >
            {message.isEdited && <span>(edited)</span>}
            <span>{formatTime(message.createdAt)}</span>
            {isOutgoing && (
              <span>
                {message.status === 'read' ? (
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-200" />
                ) : message.status === 'delivered' ? (
                  <CheckCheck className="w-3.5 h-3.5 text-indigo-200" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-indigo-200" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Message Reactions Badges with Tooltips */}
        <MessageReactionsList
          reactions={message.reactions}
          currentUserId={currentUser.id}
          onToggleReaction={handleEmojiClick}
          onOpenOverlay={() => setShowReactionOverlay(true)}
          isOutgoing={isOutgoing}
        />
      </div>

      {/* Floating Hover Action Toolbar - iOS Glass Capsule */}
      {!message.isDeleted && (
        <div
          className={`absolute top-0 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 p-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-full shadow-lg z-20 ${
            isOutgoing ? 'right-16' : 'left-16'
          }`}
        >
          {/* Emoji Reaction Overlay Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReactionOverlay(!showReactionOverlay)}
              className={`p-1.5 hover:bg-white/80 dark:hover:bg-white/10 rounded-full transition-all active:scale-90 ${
                showReactionOverlay
                  ? 'text-blue-600 bg-blue-500/10'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
              }`}
              title="React with emoji"
              aria-label="React with emoji"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            {/* Floating Overlay for Individual Message */}
            <MessageReactionsOverlay
              isOpen={showReactionOverlay}
              onClose={() => setShowReactionOverlay(false)}
              onSelectEmoji={handleEmojiClick}
              userReactions={userReactions}
              align={isOutgoing ? 'right' : 'left'}
            />
          </div>

          {/* Reply */}
          <button
            onClick={() => dispatch(setReplyingToMessage(message))}
            className="p-1.5 hover:bg-white/80 dark:hover:bg-white/10 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white active:scale-90 transition-all"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          {/* Pin */}
          <button
            onClick={handlePinToggle}
            className={`p-1.5 hover:bg-white/80 dark:hover:bg-white/10 rounded-full active:scale-90 transition-all ${
              message.isPinned ? 'text-amber-500' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
            title={message.isPinned ? 'Unpin message' : 'Pin message'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {/* Copy */}
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-white/80 dark:hover:bg-white/10 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white active:scale-90 transition-all"
            title="Copy text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Edit */}
          {canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 hover:bg-white/80 dark:hover:bg-white/10 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white active:scale-90 transition-all"
              title="Edit message"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete */}
          {canDelete && (
            <button
              onClick={handleDelete}
              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full text-rose-500 hover:text-rose-600 active:scale-90 transition-all"
              title="Delete message"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
