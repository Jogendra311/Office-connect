/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { setReplyingToMessage } from '../../features/chat/chatSlice.ts';
import {
  useSendMessageMutation,
  useUploadAttachmentMutation,
} from '../../features/api/apiSlice.ts';
import { socketService } from '../../services/socketClient.ts';
import {
  Send,
  Paperclip,
  Smile,
  X,
  File,
  Loader2,
  CheckCircle,
} from 'lucide-react';

interface MessageComposerProps {
  conversationId: number;
}

const EMOJI_LIST = ['😀', '😂', '👍', '❤️', '🎉', '🔥', '🚀', '👏', '🙌', '💡', '✅', '🤝'];

export const MessageComposer: React.FC<MessageComposerProps> = ({ conversationId }) => {
  const dispatch = useAppDispatch();
  const replyingTo = useAppSelector((state) => state.chat.replyingToMessage);
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();
  const [uploadAttachment, { isLoading: isUploading }] = useUploadAttachmentMutation();

  useEffect(() => {
    textareaRef.current?.focus();
  }, [conversationId, replyingTo]);

  const handleTyping = () => {
    socketService.startTyping(conversationId);

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      socketService.stopTyping(conversationId);
    }, 2500);
  };

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed && !selectedFile) return;

    socketService.stopTyping(conversationId);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    let attachments: any[] | undefined;

    if (selectedFile) {
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await uploadAttachment(formData).unwrap();
        attachments = [uploadRes.attachment];
      } catch (err: any) {
        setUploadError(err.data?.error || 'Failed to upload attachment to LAN server');
        return;
      }
    }

    const idempotencyId = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      await sendMessage({
        conversationId,
        content: trimmed,
        idempotencyId,
        replyToMessageId: replyingTo?.id,
        attachments,
      }).unwrap();

      setContent('');
      setSelectedFile(null);
      setUploadError(null);
      dispatch(setReplyingToMessage(null));
      setShowEmojiPicker(false);

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File exceeds LAN policy limit of 25MB');
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
  };

  const addEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  return (
    <div className="p-3 bg-white/70 dark:bg-slate-900/65 backdrop-blur-2xl border-t border-white/40 dark:border-white/10 relative select-none">
      {/* Reply Quote Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between mb-2 px-3.5 py-2 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/25 rounded-2xl text-xs backdrop-blur-md">
          <div className="min-w-0">
            <span className="font-bold text-blue-900 dark:text-blue-300">
              Replying to {replyingTo.senderName}
            </span>
            <p className="text-slate-600 dark:text-slate-300 truncate text-[11px] mt-0.5">
              {replyingTo.content}
            </p>
          </div>
          <button
            onClick={() => dispatch(setReplyingToMessage(null))}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full"
            title="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selected File Attachment Banner */}
      {selectedFile && (
        <div className="flex items-center justify-between mb-2 px-3.5 py-2 bg-white/60 dark:bg-white/[0.08] rounded-2xl border border-white/50 dark:border-white/10 text-xs backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <File className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
              {selectedFile.name}
            </span>
            <span className="text-[10px] text-slate-400">
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            onClick={() => setSelectedFile(null)}
            className="p-1 text-slate-400 hover:text-rose-500 rounded-full"
            title="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="mb-2 px-3 py-1.5 bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-2xl text-xs flex items-center justify-between backdrop-blur-md">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="absolute bottom-full mb-3 left-4 p-2.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-2xl shadow-2xl grid grid-cols-6 gap-2 z-30">
          {EMOJI_LIST.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => addEmoji(em)}
              className="text-xl p-1.5 hover:bg-white/60 dark:hover:bg-white/[0.1] rounded-xl transition-all hover:scale-125 active:scale-95 cursor-pointer"
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* iOS Composer Capsule Input Bar */}
      <div className="flex items-end gap-2 bg-slate-200/50 dark:bg-white/[0.07] backdrop-blur-xl border border-slate-300/40 dark:border-white/10 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-blue-500/40 transition-all shadow-inner">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full hover:bg-white/50 dark:hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Attach LAN document or image (Max 25MB)"
          aria-label="Attach File"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2 text-slate-400 hover:text-amber-500 rounded-full hover:bg-white/50 dark:hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Insert Emoji"
          aria-label="Insert Emoji"
        >
          <Smile className="w-4 h-4" />
        </button>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            handleTyping();
            // Auto resize
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a LAN message... (Enter to send, Shift+Enter for newline)"
          className="flex-1 max-h-32 min-h-[38px] py-2 px-2 text-xs bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none focus:outline-hidden"
          rows={1}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={(!content.trim() && !selectedFile) || isSending || isUploading}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            (!content.trim() && !selectedFile) || isSending || isUploading
              ? 'bg-slate-300/40 dark:bg-white/10 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 active:scale-90 cursor-pointer'
          }`}
          title="Send message"
          aria-label="Send Message"
        >
          {isSending || isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      <div className="flex items-center justify-between mt-1 px-2 text-[10px] text-slate-400">
        <span>LAN Encrypted Peer Transfer</span>
        <span>Enter to send</span>
      </div>
    </div>
  );
};
