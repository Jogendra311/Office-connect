/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { configureStore } from '@reduxjs/toolkit';
import { apiSlice } from '../features/api/apiSlice.ts';
import authReducer from '../features/auth/authSlice.ts';
import chatReducer from '../features/chat/chatSlice.ts';

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
    chat: chatReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
