/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config.ts';
import { db } from '../db/database.ts';
import {
  authenticateJwt,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware.ts';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.resolve(CONFIG.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${safeBase}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (CONFIG.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not permitted on this LAN network.`));
    }
  },
});

router.use(authenticateJwt);

// Upload endpoint
router.post('/upload', upload.single('file'), (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const { originalname, size, mimetype, filename } = req.file;
  const isImage = mimetype.startsWith('image/');

  const attachment = {
    id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    fileName: originalname,
    fileSize: size,
    fileType: isImage ? 'image' : 'document',
    mimeType: mimetype,
    url: `/api/v1/attachments/${filename}/file`,
  };

  res.status(201).json({ attachment });
});

// Download / View endpoint
router.get('/:filename/file', (req, res) => {
  const filename = path.basename(req.params.filename); // Prevent path traversal
  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.sendFile(filePath);
});

export default router;
