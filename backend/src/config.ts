/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  LAN_SUBNET: process.env.LAN_SUBNET || '10.1.60.0/24',
  SERVER_IP: process.env.SERVER_IP || '10.1.60.8',
  JWT_SECRET: process.env.JWT_SECRET || 'officeconnect_super_secure_lan_jwt_secret_key_2026',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'officeconnect_super_secure_refresh_secret_2026',
  JWT_EXPIRES_IN: '2h',
  REFRESH_TOKEN_EXPIRES_DAYS: 7,
  MAX_FILE_SIZE_MB: 25,
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
  ],
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
};
