/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../types/index.ts';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  theme: 'light' | 'dark';
  lanServerIp: string;
}

const savedToken = typeof window !== 'undefined' ? localStorage.getItem('oc_token') : null;
const savedUser = typeof window !== 'undefined' ? localStorage.getItem('oc_user') : null;
const savedTheme = typeof window !== 'undefined' ? (localStorage.getItem('oc_theme') as 'light' | 'dark') : 'light';

const initialState: AuthState = {
  user: savedUser ? JSON.parse(savedUser) : null,
  accessToken: savedToken,
  isAuthenticated: Boolean(savedToken && savedUser),
  theme: savedTheme || 'light',
  lanServerIp: '10.1.60.8',
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; accessToken: string }>
    ) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;

      localStorage.setItem('oc_token', action.payload.accessToken);
      localStorage.setItem('oc_user', JSON.stringify(action.payload.user));
    },
    updateCurrentUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem('oc_user', JSON.stringify(state.user));
      }
    },
    logoutUser: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem('oc_token');
      localStorage.removeItem('oc_user');
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('oc_theme', state.theme);
      if (typeof document !== 'undefined') {
        if (state.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      localStorage.setItem('oc_theme', state.theme);
      if (typeof document !== 'undefined') {
        if (state.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    },
    setLanServerIp: (state, action: PayloadAction<string>) => {
      state.lanServerIp = action.payload;
    },
  },
});

export const {
  setCredentials,
  updateCurrentUser,
  logoutUser,
  toggleTheme,
  setTheme,
  setLanServerIp,
} = authSlice.actions;
export default authSlice.reducer;
