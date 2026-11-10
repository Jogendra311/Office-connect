/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';

dotenv.config();

import { CONFIG } from './src/config.ts';
import { SocketHandler } from './src/socket/socketHandler.ts';
import authRoutes from './src/routes/authRoutes.ts';
import userRoutes from './src/routes/userRoutes.ts';
import conversationRoutes from './src/routes/conversationRoutes.ts';
import messageRoutes from './src/routes/messageRoutes.ts';
import adminRoutes from './src/routes/adminRoutes.ts';
import attachmentRoutes from './src/routes/attachmentRoutes.ts';

const app = express();
const server = http.createServer(app);

// Configure CORS for standalone Frontend communication
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://10.1.60.8:3000')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*') || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in LAN intranet
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Static uploads folder for file attachments
const uploadDir = path.resolve(process.cwd(), CONFIG.UPLOAD_DIR);
app.use('/uploads', express.static(uploadDir));

// Initialize Real-time Socket.IO Server
new SocketHandler(server);

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'OfficeConnect Enterprise LAN Server',
    hostIp: req.socket.localAddress,
    clientIp: req.ip,
    timestamp: new Date().toISOString(),
  });
});

// REST API Route Mounts
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/attachments', attachmentRoutes);

const PORT = parseInt(process.env.PORT || '5000', 10);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n============================================================`);
  console.log(`🏢 OfficeConnect Standalone Backend Server Running`);
  console.log(`📡 Local Port:       ${PORT}`);
  console.log(`🌐 LAN Interface:   http://${CONFIG.SERVER_IP}:${PORT}`);
  console.log(`🔒 Subnet Range:    ${CONFIG.LAN_SUBNET}`);
  console.log(`💾 SQL Server Host: ${process.env.DB_SERVER || '10.1.60.8'}:${process.env.DB_PORT || 1433}`);
  console.log(`============================================================\n`);
});
