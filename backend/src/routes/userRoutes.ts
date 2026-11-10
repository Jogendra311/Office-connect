/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { db } from '../db/database.ts';
import { getDepartmentsFromDb, getRolesFromDb } from '../db/sqlServerClient.ts';
import {
  authenticateJwt,
  extractClientIp,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware.ts';

const router = Router();

// Get departments (public for registration portal and UI dropdowns)
router.get('/meta/departments', async (_req, res) => {
  try {
    const departments = await getDepartmentsFromDb();
    if (departments && departments.length > 0) {
      res.json({ departments });
      return;
    }
  } catch (_error: any) {
    // Fall back to local simulated relational database
  }
  const departments = db.getAllDepartments();
  res.json({ departments });
});

router.get('/meta/roles', async (_req, res) => {
  try {
    const roles = await getRolesFromDb();
    if (roles && roles.length > 0) {
      res.json({ roles });
      return;
    }
  } catch (_error: any) {
    // Fall back to standard roles
  }
  const roles = [
    { id: 1, name: 'Employee', description: 'Standard Staff & Team Member' },
    { id: 2, name: 'Department Admin', description: 'Department Manager & Channel Lead' },
    { id: 3, name: 'Admin', description: 'Office Administrator' },
    { id: 4, name: 'Super Admin', description: 'Executive System Super User' },
  ];
  res.json({ roles });
});

router.use(authenticateJwt);

// Get all active users in office directory
router.get('/', (req: AuthenticatedRequest, res) => {
  const users = db.getAllUsers(true);
  res.json({ users });
});

// Search users
router.get('/search', (req: AuthenticatedRequest, res) => {
  const q = (req.query.q as string) || '';
  const currentUserId = req.user!.id;
  const users = db.searchUsers(q, currentUserId);
  res.json({ users });
});

// Get user profile
router.get('/:id', (req, res) => {
  const userId = Number(req.params.id);
  if (isNaN(userId)) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }
  const user = db.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user });
});

// Update own profile
router.patch('/profile/me', (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.id;
  const { name, jobTitle, avatarUrl, status } = req.body;

  const updated = db.updateUser(currentUserId, {
    ...(name ? { name } : {}),
    ...(jobTitle ? { jobTitle } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(status ? { status } : {}),
  });

  const ip = extractClientIp(req);
  db.addAuditLog(
    currentUserId,
    req.user!.name,
    'PROFILE_UPDATE',
    'User',
    `Updated personal profile: ${JSON.stringify(req.body)}`,
    ip
  );

  res.json({ user: updated });
});

export default router;
