/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { setActiveModal } from '../../features/chat/chatSlice.ts';
import { Wifi, WifiOff, ShieldCheck, ChevronRight } from 'lucide-react';

export const LanStatusBadge: React.FC = () => {
  const dispatch = useAppDispatch();
  const isConnected = useAppSelector((state) => state.chat.isNetworkConnected);
  const lanServerIp = useAppSelector((state) => state.auth.lanServerIp);

  return (
    <button
      onClick={() => dispatch(setActiveModal('deployment'))}
      className="flex items-center gap-1.5 md:gap-2 px-3 py-1 text-xs bg-white/60 hover:bg-white/90 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] backdrop-blur-md rounded-full border border-white/50 dark:border-white/10 select-none cursor-pointer shadow-xs active:scale-[0.98] transition-all text-left"
      title="Click to view Host IP (10.1.60.8) & LAN Deployment Guide"
      aria-label="View LAN Deployment Guide"
    >
      <div className="flex items-center gap-1.5">
        {isConnected ? (
          <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
        )}
        <span className="font-semibold text-slate-800 dark:text-slate-100 text-[11px] md:text-xs">
          {isConnected ? 'LAN Connected' : 'Reconnecting...'}
        </span>
      </div>
      <span className="hidden sm:inline text-slate-300 dark:text-white/20" aria-hidden="true">
        ·
      </span>
      <span className="hidden sm:inline font-mono font-semibold text-blue-600 dark:text-blue-400 text-[11px]">
        {lanServerIp}
      </span>
      <span className="hidden md:inline text-slate-300 dark:text-white/20" aria-hidden="true">
        ·
      </span>
      <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
        <ShieldCheck className="w-3 h-3 text-indigo-500" />
        {/* <span>Subnet 10.1.60.0/24</span>   */}
      </div>
      <ChevronRight className="w-3 h-3 text-slate-400 hidden lg:inline ml-0.5" />
    </button>
  );
};
