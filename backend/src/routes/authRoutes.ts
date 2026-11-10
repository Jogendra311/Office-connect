/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config.ts';
import { db } from '../db/database.ts';
import {
  createDepartmentInDb,
  getDepartmentByIdFromDb,
  installDepartmentProceduresToDb,
} from '../db/sqlServerClient.ts';
import { AuthService } from '../services/authService.ts';
import {
  authenticateJwt,
  extractClientIp,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware.ts';

const router = Router();
let setupInProgress = false;

router.get('/setup-status', (_req, res) => {
  res.json({ setupRequired: db.getAllUsers(false).length === 0 });
});

router.post('/setup', async (req, res) => {
  if (setupInProgress || db.getAllUsers(false).length > 0) {
    res.status(409).json({ error: 'Initial setup has already been completed.' });
    return;
  }

  const { username, name, email, password, departmentName, departmentCode, jobTitle } = req.body;
  if (
    !username?.trim() ||
    !name?.trim() ||
    !email?.trim() ||
    !password ||
    String(password).length < 12 ||
    !departmentName?.trim() ||
    !departmentCode?.trim() ||
    !jobTitle?.trim()
  ) {
    res.status(400).json({ error: 'All administrator and department fields are required.' });
    return;
  }

  setupInProgress = true;
  try {
    const normalizedUsername = String(username).trim().toLowerCase();
    const normalizedEmail = String(email).trim().toLowerCase();
    if (db.getUserByUsername(normalizedUsername) || db.getUserByEmail(normalizedEmail)) {
      res.status(409).json({ error: 'Username or email is already in use.' });
      return;
    }

    await installDepartmentProceduresToDb();
    const department = await createDepartmentInDb({
      name: String(departmentName).trim(),
      code: String(departmentCode).trim().toUpperCase(),
      description: '',
    });
    const passwordHash = await bcrypt.hash(String(password), await bcrypt.genSalt(10));
    const user = db.createUser({
      employeeId: Math.floor(100000 + Math.random() * 900000),
      username: normalizedUsername,
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'Super Admin',
      departmentId: department.id,
      departmentName: department.name,
      jobTitle: String(jobTitle).trim(),
      status: 'online',
      lastSeen: new Date().toISOString(),
      isActive: true,
    });

    const ip = extractClientIp(req);
    db.addAuditLog(user.id, user.name, 'INITIAL_SETUP', 'System', 'Initial administrator created.', ip);
    const accessToken = AuthService.generateAccessToken(user);
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000,
    });
    res.status(201).json({ user, accessToken });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Initial setup failed.' });
  } finally {
    setupInProgress = false;
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const ip = extractClientIp(req);
    const authResult = await AuthService.authenticate(username, password, ip);

    // Set cookie for browser refresh sessions
    res.cookie('accessToken', authResult.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    });

    res.json(authResult);
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Login failed' });
  }
});

router.post('/refresh', (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }
    const ip = extractClientIp(req);
    const result = AuthService.refreshAccessToken(refreshToken, ip);

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000,
    });

    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Token refresh failed' });
  }
});

router.post('/logout', authenticateJwt, (req: AuthenticatedRequest, res) => {
  if (req.user) {
    const ip = extractClientIp(req);
    AuthService.logout(req.user.id, req.body.refreshToken, ip);
  }
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully' });
});

router.get('/me', authenticateJwt, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

router.post('/register', async (req, res) => {
  try {
    const { employeeId, username, name, email, role = 'Employee', departmentId, jobTitle, initialPassword } = req.body;
    if (!username?.trim() || !email?.trim() || !name?.trim() || !jobTitle?.trim() || !initialPassword) {
      res.status(400).json({ error: 'All employee fields and an initial password are required.' });
      return;
    }

    const roles = ['Employee', 'Department Admin', 'Admin', 'Super Admin'];
    if (!roles.includes(role)) {
      res.status(400).json({ error: 'Invalid employee role.' });
      return;
    }

    let registeringAdmin: ReturnType<typeof db.getUserById>;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as any;
        const candidate = db.getUserById(Number(decoded.userId));
        if (candidate && candidate.isActive && (candidate.role === 'Super Admin' || candidate.role === 'Admin')) {
          registeringAdmin = candidate;
        }
      } catch {
        registeringAdmin = undefined;
      }
    }

    if (role !== 'Employee' && !registeringAdmin) {
      res.status(403).json({ error: 'An authenticated administrator is required for elevated roles.' });
      return;
    }

    if (role === 'Super Admin' && registeringAdmin?.role !== 'Super Admin') {
      res.status(403).json({ error: 'Only a Super Admin can create another Super Admin.' });
      return;
    }

    if (db.getUserByUsername(username)) {
      res.status(409).json({ error: 'Username is already in use.' });
      return;
    }
    if (db.getUserByEmail(email)) {
      res.status(409).json({ error: 'Corporate email is already registered.' });
      return;
    }

    const numDeptId = Number(departmentId);
    let dept: any;
    try {
      dept = await getDepartmentByIdFromDb(numDeptId);
    } catch {
      // Offline fallback
    }
    if (!dept) {
      dept = db.getDepartmentById(numDeptId);
    }
    if (!Number.isInteger(numDeptId) || !dept) {
      res.status(400).json({ error: 'A valid department is required.' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(initialPassword), await bcrypt.genSalt(10));

    const newUser = db.createUser({
      employeeId: Number(employeeId) || Math.floor(1000 + Math.random() * 9000),
      username: username.toLowerCase().trim(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: registeringAdmin ? role : 'Employee',
      departmentId: numDeptId,
      departmentName: dept.name,
      jobTitle: jobTitle.trim(),
      status: 'offline',
      lastSeen: new Date().toISOString(),
      isActive: true,
    });

    const ip = extractClientIp(req);
    const actor = registeringAdmin || newUser;
    db.addAuditLog(
      actor.id,
      actor.name,
      registeringAdmin ? 'ADMIN_REGISTERED_EMPLOYEE' : 'EMPLOYEE_SELF_REGISTRATION',
      'User',
      `Registered employee ${newUser.name} (${newUser.username}, ${newUser.role}) in ${dept.name}`,
      ip
    );

    res.status(201).json({
      user: newUser,
      authorizedBy: registeringAdmin?.name,
      message: `Employee account created successfully for ${newUser.name}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

export default router;
