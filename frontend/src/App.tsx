/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './app/store.ts';
import { useAppDispatch, useAppSelector } from './app/hooks.ts';
import { socketService } from './services/socketClient.ts';
import { LoginPage } from './components/auth/LoginPage.tsx';
import { ChatSidebar } from './components/chat/ChatSidebar.tsx';
import { ChatWindow } from './components/chat/ChatWindow.tsx';
import { LanStatusBadge } from './components/common/LanStatusBadge.tsx';
import { UserAvatar } from './components/common/UserAvatar.tsx';
import { NewChatModal } from './components/modals/NewChatModal.tsx';
import { NewGroupModal } from './components/modals/NewGroupModal.tsx';
import { AdminModal } from './components/modals/AdminModal.tsx';
import { ProfileModal } from './components/modals/ProfileModal.tsx';
import { PinnedModal } from './components/modals/PinnedModal.tsx';
import { DeploymentModal } from './components/modals/DeploymentModal.tsx';
import { RegisterEmployeeModal } from './components/modals/RegisterEmployeeModal.tsx';
import { setActiveModal } from './features/chat/chatSlice.ts';
import { setCredentials, logoutUser, toggleTheme } from './features/auth/authSlice.ts';
import { useGetMeQuery } from './features/api/apiSlice.ts';
import { Sun, Moon } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const currentUser = useAppSelector((state) => state.auth.user);
  const token = useAppSelector((state) => state.auth.accessToken);
  const theme = useAppSelector((state) => state.auth.theme);
  const activeModal = useAppSelector((state) => state.chat.activeModal);
  const activeConvId = useAppSelector((state) => state.chat.activeConversationId);
  const { data: sessionData, error: sessionError } = useGetMeQuery(undefined, {
    skip: !token,
  });

  useEffect(() => {
    if (token && sessionData?.user) {
      dispatch(setCredentials({ user: sessionData.user, accessToken: token }));
      return;
    }

    if (sessionError && 'status' in sessionError && sessionError.status === 401) {
      dispatch(logoutUser());
      socketService.disconnect();
    }
  }, [dispatch, sessionData, sessionError]);

  // Initialize Socket on authentication or load
  useEffect(() => {
    if (isAuthenticated && token) {
      socketService.initialize(token);
    }
    return () => {
      // Don't disconnect immediately on re-render, only on logout
    };
  }, [isAuthenticated, token]);

  // Apply dark mode class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans antialiased relative transition-colors">
      {/* iOS Ambient Background Mesh Blooms */}
      <div className="absolute -top-40 -left-40 w-[32rem] h-[32rem] rounded-full bg-blue-500/15 dark:bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[28rem] h-[28rem] rounded-full bg-purple-500/15 dark:bg-indigo-600/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-teal-400/10 dark:bg-teal-500/10 blur-3xl pointer-events-none" />

      {/* Top iOS Frosted Glass Header Bar */}
      <header className="h-13 bg-white/70 dark:bg-slate-900/65 backdrop-blur-2xl border-b border-white/50 dark:border-white/10 px-3 md:px-5 flex items-center justify-between select-none z-30 flex-shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5 md:gap-3.5">
          <div className="flex items-center gap-2 font-bold text-xs tracking-tight text-slate-900 dark:text-white">
            <div className="w-7 h-7 rounded-[9px] bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 border border-white/30">
              <span className="text-[11px] font-black">OC</span>
            </div>
            <span className="hidden sm:inline font-semibold">OfficeConnect</span>
            <span className="sm:hidden font-semibold">OC</span>
          </div>
          <span className="text-slate-300 dark:text-white/20">|</span>
          <LanStatusBadge />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch(toggleTheme())}
            className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-full bg-white/60 dark:bg-white/[0.08] backdrop-blur-md border border-white/50 dark:border-white/10 shadow-xs hover:bg-white/90 dark:hover:bg-white/[0.14] active:scale-95 transition-all cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 drop-shadow-xs" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {currentUser && (
            <button
              onClick={() => dispatch(setActiveModal('profile'))}
              className="flex items-center gap-2 px-3 py-1.5 text-xs bg-white/60 dark:bg-white/[0.08] hover:bg-white/90 dark:hover:bg-white/[0.14] backdrop-blur-md border border-white/50 dark:border-white/10 rounded-full shadow-xs active:scale-[0.98] transition-all cursor-pointer"
              title="View profile & connection details"
              aria-label="View user profile"
            >
              <UserAvatar
                name={currentUser.name}
                avatarUrl={currentUser.avatarUrl}
                size="sm"
                status={currentUser.status}
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200 hidden sm:inline">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                {currentUser.employeeId}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Main Responsive Messaging Workspace */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        <div className={`${activeConvId ? 'hidden md:flex' : 'flex w-full md:w-auto'} h-full flex-shrink-0 transition-all duration-300`}>
          <ChatSidebar />
        </div>
        <div className={`${!activeConvId ? 'hidden md:flex' : 'flex'} flex-1 h-full overflow-hidden transition-all duration-300 ${activeConvId ? 'animate-chat-slide-in md:animate-none' : ''}`}>
          <ChatWindow />
        </div>
      </div>

      {/* Interactive Modals */}
      {activeModal === 'new-chat' && <NewChatModal />}
      {activeModal === 'new-group' && <NewGroupModal />}
      {activeModal === 'admin' && <AdminModal />}
      {activeModal === 'profile' && <ProfileModal />}
      {activeModal === 'pinned' && <PinnedModal />}
      {activeModal === 'register-employee' && currentUser?.role === 'Super Admin' && (
        <RegisterEmployeeModal />
      )}
    </div>
  );
};

export default function App() {
  return (
    <Provider store={store}>
      <MainAppContent />
    </Provider>
  );
}
