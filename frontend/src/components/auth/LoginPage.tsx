/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { setCredentials, toggleTheme } from '../../features/auth/authSlice.ts';
import { useLoginMutation } from '../../features/api/apiSlice.ts';
import { socketService } from '../../services/socketClient.ts';
import {
  Shield,
  Lock,
  Server,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  User,
  Sparkles,
  ShieldAlert,
  Sun,
  Moon,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.auth.theme);

  // Login form state
  const [username, setUsername] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('oc_saved_user') || '' : '';
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    return typeof window !== 'undefined' ? Boolean(localStorage.getItem('oc_saved_user')) : false;
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [login, { isLoading: isLoggingIn }] = useLoginMutation();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    try {
      setLoginError(null);
      const result = await login({
        username: username.trim().toLowerCase(),
        password,
      }).unwrap();

      if (rememberMe) {
        localStorage.setItem('oc_saved_user', username.trim().toLowerCase());
      } else {
        localStorage.removeItem('oc_saved_user');
      }

      dispatch(setCredentials(result));
      socketService.initialize(result.accessToken);
    } catch (err: any) {
      setLoginError(
        err.data?.error ||
          err.message ||
          'Authentication failed. Please check your username and password.'
      );
    }
  };

  const fillSuperUserCredentials = () => {
    setUsername('sarah.connor');
    setPassword('Office123!');
    setLoginError(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 relative overflow-hidden select-none transition-colors">
      {/* iOS Floating Ambient Mesh Glow Orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-tr from-blue-400/30 via-indigo-400/25 to-purple-500/25 dark:from-blue-600/20 dark:via-indigo-700/25 dark:to-purple-900/20 blur-3xl animate-float-slow pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[30rem] h-[30rem] rounded-full bg-gradient-to-bl from-sky-400/30 via-cyan-400/20 to-blue-600/25 dark:from-indigo-600/20 dark:via-blue-800/25 dark:to-cyan-900/20 blur-3xl animate-float-reverse pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-gradient-to-r from-violet-300/20 to-pink-300/15 dark:from-purple-800/15 dark:to-blue-900/15 blur-3xl pointer-events-none" />

      {/* Top-Right iOS Frosted Glass Theme Toggle */}
      <div className="absolute top-5 right-5 z-20">
        <button
          type="button"
          onClick={() => dispatch(toggleTheme())}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-full bg-white/70 dark:bg-white/[0.08] backdrop-blur-xl border border-white/60 dark:border-white/15 text-slate-800 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-white/[0.15] shadow-lg shadow-black/5 active:scale-95 transition-all cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold tracking-tight">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] font-semibold tracking-tight">Dark</span>
            </>
          )}
        </button>
      </div>

      <div className="relative z-10 w-full max-w-md my-auto py-6">
        {/* Main iOS Frosted Glass Card */}
        <div className="bg-white/70 dark:bg-slate-900/65 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-3xl p-7 md:p-8 shadow-[0_20px_50px_rgba(8,_112,_184,_0.1)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.6)] text-slate-900 dark:text-slate-100 transition-all">
          {/* Header Branding with Apple Squircle */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-[22px] bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 mb-3 border border-white/40 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
              <Shield className="w-8 h-8 relative z-10 drop-shadow-sm" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              OfficeConnect
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-300 border border-blue-500/20 backdrop-blur-md uppercase tracking-wider">
                LAN
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enterprise On-Premise Team Messaging & Collaboration
            </p>

            <div className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Corporate LAN Active · 10.1.60.0/24</span>
            </div>
          </div>

          {/* Error Message */}
          {loginError && (
            <div className="mb-5 p-3.5 bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 backdrop-blur-md">
              <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
                Username or Corporate Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. sarah.connor"
                  autoComplete="username"
                  className="w-full pl-11 pr-4 py-3 text-xs bg-white/60 dark:bg-white/[0.06] backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all shadow-inner"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Account Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter corporate account password"
                  autoComplete="current-password"
                  className="w-full pl-11 pr-11 py-3 text-xs bg-white/60 dark:bg-white/[0.06] backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all shadow-inner"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-md bg-white/80 dark:bg-white/10 border-slate-300 dark:border-white/20 focus:ring-blue-500"
                />
                <span className="text-[11px] font-medium">Remember username</span>
              </label>

              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                <Server className="w-3 h-3 text-blue-500" />
                LAN Encrypted
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn || !username.trim() || !password}
              className="w-full mt-2 h-12 px-4 text-xs font-semibold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-500 active:scale-[0.98] text-white rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In to OfficeConnect</span>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Helper */}
          <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">Demo Access:</span>
            <button
              type="button"
              onClick={fillSuperUserCredentials}
              className="px-3 py-1.5 text-[11px] font-medium bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.08] dark:hover:bg-white/[0.12] text-indigo-700 dark:text-indigo-300 rounded-xl border border-slate-200/70 dark:border-white/10 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer backdrop-blur-md"
              title="Auto-fill Super User Sarah Connor credentials"
            >
              <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              <span>Fill Super User (sarah.connor)</span>
            </button>
          </div>

          {/* Super User Provisioning Notice */}
          <div className="mt-4 p-3 bg-slate-50/70 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 rounded-2xl flex items-start gap-2.5 text-[11px] text-slate-600 dark:text-slate-400 backdrop-blur-md">
            <ShieldAlert className="w-4 h-4 text-amber-500 dark:text-amber-400/90 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-800 dark:text-slate-200">Registration Notice:</strong> Employee accounts
              are provisioned strictly by the <strong className="text-indigo-600 dark:text-indigo-300">Super User</strong> after
              signing in via the sidebar menu.
            </span>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span>OfficeConnect Enterprise LAN</span>
            <span className="font-mono text-slate-400 dark:text-slate-500">SQL Server · On-Premise</span>
          </div>
        </div>
      </div>
    </div>
  );
};
