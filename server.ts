/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

import { CONFIG } from './backend/src/config.ts';
import { SocketHandler } from './backend/src/socket/socketHandler.ts';
import authRoutes from './backend/src/routes/authRoutes.ts';
import userRoutes from './backend/src/routes/userRoutes.ts';
import conversationRoutes from './backend/src/routes/conversationRoutes.ts';
import messageRoutes from './backend/src/routes/messageRoutes.ts';
import adminRoutes from './backend/src/routes/adminRoutes.ts';
import attachmentRoutes from './backend/src/routes/attachmentRoutes.ts';

const app = express();
const server = http.createServer(app);

// Configure CORS for LAN and dev clients
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow local and LAN requests
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Rewrite any frontend asset requests that include /frontend/ prefix
app.use((req, _res, next) => {
  if (req.url.startsWith('/frontend/src/')) {
    req.url = req.url.replace(/^\/frontend/, '');
  }
  next();
});

// Static uploads folder for file attachments
const uploadDir = path.resolve(process.cwd(), CONFIG.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
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

// Setup Frontend Vite Middleware / Static Serve
async function setupFrontend() {
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'frontend', 'dist');

  if (isProd && fs.existsSync(distPath)) {
    // Production static file serving
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads')) {
        return next();
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configFile: path.resolve(process.cwd(), 'frontend', 'vite.config.ts'),
      server: { middlewareMode: true, hmr: false, allowedHosts: true },
      appType: 'spa',
      root: path.resolve(process.cwd(), 'frontend'),
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (
        req.method !== 'GET' ||
        req.originalUrl.startsWith('/api') ||
        req.originalUrl.startsWith('/socket.io') ||
        req.originalUrl.startsWith('/uploads') ||
        (req.path.includes('.') && !req.path.endsWith('.html'))
      ) {
        return next();
      }
      try {
        const url = req.originalUrl;
        const htmlPath = path.resolve(process.cwd(), 'frontend', 'index.html');
        let template = fs.readFileSync(htmlPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }
}

// Dev server must always bind to port 3000 in AI Studio
const PORT = 3000;

setupFrontend()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n============================================================`);
      console.log(`🏢 OfficeConnect Enterprise LAN Server Online`);
      console.log(`📡 Local Port:       ${PORT}`);
      console.log(`🌐 LAN Interface:   http://${CONFIG.SERVER_IP}:${PORT}`);
      console.log(`💻 Web Application:  http://localhost:${PORT}`);
      console.log(`🔒 Subnet:           ${CONFIG.LAN_SUBNET}`);
      console.log(`💾 SQL Server Sync:  ${process.env.DB_SERVER || '10.1.60.8'}:${process.env.DB_PORT || 1433}`);
      console.log(`============================================================\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
