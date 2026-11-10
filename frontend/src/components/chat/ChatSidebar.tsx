/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import {
  setActiveConversationId,
  setFilterTab,
  setSearchQuery,
  setActiveModal,
} from '../../features/chat/chatSlice.ts';
import { logoutUser, toggleTheme } from '../../features/auth/authSlice.ts';
import { socketService } from '../../services/socketClient.ts';
import { useGetConversationsQuery, useLogoutMutation } from '../../features/api/apiSlice.ts';
import { UserAvatar } from '../common/UserAvatar.tsx';
import {
  Search,
  MessageSquarePlus,
  Users,
  Shield,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  CheckCheck,
  UserPlus,
} from 'lucide-react';

export const ChatSidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const theme = useAppSelector((state) => state.auth.theme);
  const activeConvId = useAppSelector((state) => state.chat.activeConversationId);
  const filterTab = useAppSelector((state) => state.chat.filterTab);
  const searchQuery = useAppSelector((state) => state.chat.searchQuery);
  const typingMap = useAppSelector((state) => state.chat.typingMap);
  const presenceMap = useAppSelector((state) => state.chat.presenceMap);
  const [logout] = useLogoutMutation();

  const { data, isLoading } = useGetConversationsQuery(undefined, {
    pollingInterval: 15000,
  });

  const conversations = data?.conversations || [];

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (c.type === 'direct' ? c.isDirectWithUser?.name : c.title) || '';
      const lastMsg = c.lastMessage?.content || '';
      if (!title.toLowerCase().includes(q) && !lastMsg.toLowerCase().includes(q)) {
        return false;
      }
    }

    // 2. Tab Filter
    if (filterTab === 'direct') return c.type === 'direct';
    if (filterTab === 'group') return c.type === 'group';
    if (filterTab === 'unread') return (c.unreadCount || 0) > 0;
    return true;
  });

  const handleLogout = async () => {
    await logout().unwrap().catch(() => undefined);
    socketService.disconnect();
    dispatch(logoutUser());
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const isSuperUser = currentUser?.role === 'Super Admin';
  const isAdmin = isSuperUser || currentUser?.role === 'Admin';

  return (
    <aside className="w-full md:w-96 h-full flex flex-col bg-white/65 dark:bg-slate-900/60 backdrop-blur-2xl border-r border-white/40 dark:border-white/10 select-none relative z-10 transition-colors shadow-lg  ">
      {/* Top Header */}
      <div className="p-3.5 border-b border-white/30 dark:border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-blue-500/25 border border-white/30">
              OC
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                OfficeConnect
              </h1>
              <span className="text-[10px] text-slate-400 font-medium">Enterprise LAN Chat</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isSuperUser && (
              <button
                onClick={() => dispatch(setActiveModal('register-employee'))}
                className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-full border border-blue-500/20 shadow-2xs active:scale-95 transition-all cursor-pointer"
                title="Super User: Register New User"
                aria-label="Register New User"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => dispatch(setActiveModal('new-chat'))}
              className="p-2 text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 bg-white/60 dark:bg-white/[0.06] hover:bg-white/90 dark:hover:bg-white/[0.12] rounded-full border border-white/50 dark:border-white/10 shadow-2xs active:scale-95 transition-all cursor-pointer"
              title="New Direct Chat (Search colleagues)"
              aria-label="New Direct Chat"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => dispatch(setActiveModal('new-group'))}
              className="p-2 text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 bg-white/60 dark:bg-white/[0.06] hover:bg-white/90 dark:hover:bg-white/[0.12] rounded-full border border-white/50 dark:border-white/10 shadow-2xs active:scale-95 transition-all cursor-pointer"
              title="Create Team Group Channel"
              aria-label="Create Team Group Channel"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* iOS Search Pill */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search conversations, colleagues..."
            value={searchQuery}
            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-200/50 dark:bg-white/[0.07] backdrop-blur-xl border border-slate-300/40 dark:border-white/10 rounded-full text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 transition-all shadow-inner"
          />
        </div>

        {/* iOS Segmented Filter Tabs */}
        <div className="flex items-center gap-1 mt-3 p-1 bg-slate-200/60 dark:bg-white/[0.07] backdrop-blur-xl rounded-full border border-slate-300/30 dark:border-white/10">
          {(['all', 'direct', 'group', 'unread'] as const).map((tab) => {
            const isActive = filterTab === tab;
            const labels = {
              all: 'All',
              direct: 'Direct',
              group: 'Teams',
              unread: 'Unread',
            };
            return (
              <button
                key={tab}
                onClick={() => dispatch(setFilterTab(tab))}
                className={`flex-1 py-1 text-xs font-medium rounded-full transition-all text-center capitalize cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-2xl bg-white/40 dark:bg-white/[0.03] animate-pulse">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded-full" />
                  <div className="w-36 h-2 bg-slate-200 dark:bg-slate-700 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && filteredConversations.length === 0 && (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
            <p>No conversations found</p>
            <button
              onClick={() => dispatch(setActiveModal('new-chat'))}
              className="mt-2 text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              Start a new chat
            </button>
          </div>
        )}

        {filteredConversations.map((conv) => {
          const isSelected = activeConvId === conv.id;
          const isDirect = conv.type === 'direct';
          const otherUser = conv.isDirectWithUser;
          const title = isDirect ? otherUser?.name || 'Colleague' : conv.title;
          const avatarUrl = isDirect ? otherUser?.avatarUrl : conv.avatarUrl;

          // Presence for 1:1 chat
          const userStatus =
            isDirect && otherUser
              ? presenceMap[otherUser.id]?.status || otherUser.status
              : undefined;

          // Live typing indicator
          const typers = typingMap[conv.id] || [];
          const isSomeoneTyping = typers.length > 0;

          return (
            <button
              type="button"
              key={conv.id}
              onClick={() => dispatch(setActiveConversationId(conv.id))}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all relative ${
                isSelected
                  ? 'bg-blue-500/15 dark:bg-blue-500/20 border border-blue-500/30 backdrop-blur-md shadow-xs'
                  : 'hover:bg-white/50 dark:hover:bg-white/[0.05] border border-transparent'
              }`}
            >
              <UserAvatar
                name={title || 'Chat'}
                avatarUrl={avatarUrl}
                size="md"
                status={userStatus}
                isGroup={!isDirect}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span
                    className={`text-xs truncate ${
                      isSelected
                        ? 'font-bold text-blue-950 dark:text-blue-100'
                        : 'font-semibold text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {title}
                  </span>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {formatMessageTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1">
                  {isSomeoneTyping ? (
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 italic truncate font-medium">
                      {typers.join(', ')} typing...
                    </span>
                  ) : (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                      {conv.lastMessage?.senderId === currentUser?.id && (
                        <CheckCheck className="w-3 h-3 text-blue-500 inline flex-shrink-0" />
                      )}
                      <span>
                        {conv.lastMessage?.isDeleted
                          ? 'Message deleted'
                          : conv.lastMessage?.content || 'No messages yet'}
                      </span>
                    </p>
                  )}

                  {(conv.unreadCount || 0) > 0 && (
                    <span className="min-w-[18px] h-4.5 px-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-[10px] font-bold text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Profile & Actions Footer */}
      <div className="p-3 bg-white/70 dark:bg-slate-900/65 backdrop-blur-2xl border-t border-white/40 dark:border-white/10 flex items-center justify-between">  
        <div
          onClick={() => dispatch(setActiveModal('profile'))}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-85 transition-opacity"
          title="Click to view & edit your employee profile"
        >
          <UserAvatar
            name={currentUser?.name || 'Me'}
            avatarUrl={currentUser?.avatarUrl}
            size="sm"
            status={currentUser?.status || 'online'}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">
              {currentUser?.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {currentUser?.role} · {currentUser?.departmentName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={() => dispatch(setActiveModal('admin'))}
              className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-full transition-all cursor-pointer"
              title="Admin Dashboard (Users, Roles, Audit Logs & IIS Setup)"
              aria-label="Admin Dashboard"
            >
              <Shield className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => dispatch(toggleTheme())}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-full transition-all cursor-pointer"
            title="Toggle Light/Dark Theme"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-full transition-all cursor-pointer"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
