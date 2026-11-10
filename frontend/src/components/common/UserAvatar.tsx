/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { UserStatus } from '../../types/index.ts';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: UserStatus;
  isGroup?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  size = 'md',
  status,
  isGroup = false,
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  }[size];

  const statusDotSizes = {
    sm: 'w-2.5 h-2.5 ring-1',
    md: 'w-3 h-3 ring-2',
    lg: 'w-3.5 h-3.5 ring-2',
    xl: 'w-4 h-4 ring-2',
  }[size];

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const getStatusColor = (s?: UserStatus) => {
    switch (s) {
      case 'online':
        return 'bg-emerald-500';
      case 'away':
        return 'bg-amber-500';
      case 'busy':
        return 'bg-rose-500';
      default:
        return 'bg-slate-400';
    }
  };

  // Consistent background color based on name string
  const colors = [
    'bg-gradient-to-tr from-blue-600 to-indigo-600',
    'bg-gradient-to-tr from-indigo-600 to-violet-600',
    'bg-gradient-to-tr from-sky-500 to-blue-600',
    'bg-gradient-to-tr from-emerald-500 to-teal-600',
    'bg-gradient-to-tr from-purple-500 to-pink-500',
    'bg-gradient-to-tr from-amber-500 to-orange-600',
  ];
  const charCodeSum = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const bgColor = colors[charCodeSum % colors.length];

  return (
    <div className="relative inline-flex flex-shrink-0 items-center justify-center">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className={`${sizeClasses} rounded-full object-cover ring-1 ring-white/60 dark:ring-white/15 shadow-xs`}
        />
      ) : (
        <div
          className={`${sizeClasses} ${isGroup ? 'bg-gradient-to-tr from-slate-600 to-slate-800' : bgColor} rounded-full flex items-center justify-center text-white font-semibold select-none ring-1 ring-white/60 dark:ring-white/15 shadow-xs`}
        >
          {isGroup ? (
            <svg
              className="w-1/2 h-1/2 text-slate-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          ) : (
            initials || 'OC'
          )}
        </div>
      )}

      {status && (
        <span
          className={`absolute bottom-0 right-0 ${statusDotSizes} rounded-full ring-white dark:ring-slate-900 ${getStatusColor(
            status
          )}`}
          title={`Status: ${status}`}
        />
      )}
    </div>
  );
};
