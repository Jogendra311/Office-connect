/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.ts';
import {
  testSqlConnection,
  initSqlServerSchema,
  sqlConfig,
  storeEmployeeToDb,
  installStoredProceduresToDb,
  getDepartmentByIdFromDb,
  createDepartmentInDb,
} from '../db/sqlServerClient.ts';
import {
  authenticateJwt,
  requireRoles,
  extractClientIp,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticateJwt);
router.use(requireRoles('Super Admin', 'Admin'));

// List all users including inactive
router.get('/users', (_req, res) => {
  const users = db.getAllUsers(false);
  res.json({ users });
});

// Create new employee account
router.post('/users', async (req: AuthenticatedRequest, res) => {
  const { employeeId, username, name, email, role, departmentId, jobTitle, initialPassword } = req.body;

  if (!username || !email || !name || !role || !departmentId || !jobTitle || !initialPassword) {
    res.status(400).json({ error: 'Missing required employee fields' });
    return;
  }

  // Check unique constraints
  if (db.getUserByUsername(username)) {
    res.status(409).json({ error: 'Username already in use' });
    return;
  }
  if (db.getUserByEmail(email)) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(initialPassword, salt);
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

  const newUser = db.createUser({
    employeeId: Number(employeeId) || Math.floor(1000 + Math.random() * 9000),
    username: username.toLowerCase().trim(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    departmentId: numDeptId,
    departmentName: dept.name,
    jobTitle: jobTitle.trim(),
    status: 'offline',
    lastSeen: new Date().toISOString(),
    isActive: true,
  });

  const ip = extractClientIp(req);
  db.addAuditLog(
    req.user!.id,
    req.user!.name,
    'CREATE_EMPLOYEE',
    'User',
    `Created employee account ${newUser.username} (${newUser.role})`,
    ip
  );

  res.status(201).json({ user: newUser });
});

// Activate or Deactivate employee account
router.patch('/users/:id/status', (req: AuthenticatedRequest, res) => {
  const targetUserId = Number(req.params.id);
  const { isActive } = req.body;

  if (isNaN(targetUserId)) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }

  if (typeof isActive !== 'boolean') {
    res.status(400).json({ error: 'isActive boolean is required' });
    return;
  }

  if (targetUserId === req.user!.id) {
    res.status(400).json({ error: 'Administrators cannot deactivate their own account' });
    return;
  }

  const updated = db.updateUser(targetUserId, { isActive });
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Revoke all tokens if deactivated
  if (!isActive) {
    db.revokeAllUserTokens(targetUserId);
    db.setUserStatus(targetUserId, 'offline');
  }

  const ip = extractClientIp(req);
  db.addAuditLog(
    req.user!.id,
    req.user!.name,
    isActive ? 'ACTIVATE_EMPLOYEE' : 'DEACTIVATE_EMPLOYEE',
    'User',
    `Set active status to ${isActive} for employee ${updated.name}`,
    ip
  );

  res.json({ user: updated });
});

// Change user role (Super Admin only)
router.patch('/users/:id/role', (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== 'Super Admin') {
    res.status(403).json({ error: 'Only Super Admins can modify employee roles' });
    return;
  }

  const targetUserId = Number(req.params.id);
  const { role } = req.body;

  if (isNaN(targetUserId)) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }

  if (!['Super Admin', 'Admin', 'Department Admin', 'Employee'].includes(role)) {
    res.status(400).json({ error: 'Invalid role specified' });
    return;
  }

  const updated = db.updateUser(targetUserId, { role });
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const ip = extractClientIp(req);
  db.addAuditLog(
    req.user!.id,
    req.user!.name,
    'CHANGE_EMPLOYEE_ROLE',
    'User',
    `Promoted/Modified role to ${role} for ${updated.name}`,
    ip
  );

  res.json({ user: updated });
});

// Audit Logs
router.get('/audit-logs', (_req, res) => {
  const logs = db.getAuditLogs(200);
  res.json({ logs });
});

// Create department
router.post('/departments', async (req: AuthenticatedRequest, res) => {
  const { name, code, description } = req.body;
  if (!name || !code) {
    res.status(400).json({ error: 'Department name and code are required' });
    return;
  }

  try {
    const newDept = await createDepartmentInDb({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description,
    });

    const ip = extractClientIp(req);
    db.addAuditLog(
      req.user!.id,
      req.user!.name,
      'CREATE_DEPARTMENT',
      'Department',
      `Created department ${newDept.name} (${newDept.code})`,
      ip
    );

    res.status(201).json({ department: newDept });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create department in SQL Server.' });
  }
});

// SQL Server Diagnostics & Configuration Status
router.get('/sql-server/status', (_req, res) => {
  res.json({
    config: {
      server: sqlConfig.server,
      database: sqlConfig.database,
      port: sqlConfig.port,
      user: sqlConfig.user,
      encrypt: sqlConfig.options?.encrypt,
      trustServerCertificate: sqlConfig.options?.trustServerCertificate,
    },
  });
});

// Test SQL Server connection
router.post('/sql-server/test-connection', async (req, res) => {
  try {
    const result = await testSqlConnection(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Initialize SQL Server Schema (Creates tables & schemas)
router.post('/sql-server/init-schema', async (_req, res) => {
  try {
    const result = await initSqlServerSchema();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Install / Compile all Stored Procedures (SPs)
router.post('/sql-server/install-sp', async (_req, res) => {
  try {
    const result = await installStoredProceduresToDb();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sync local users & audit logs to SQL Server
router.post('/sql-server/sync-data', async (req: AuthenticatedRequest, res) => {
  try {
    const allUsers = db.getAllUsers(false);
    let syncedUsers = 0;
    for (const u of allUsers) {
      const dbUser = db.getDBUserById(u.id);
      if (dbUser) {
        await storeEmployeeToDb({
          userId: dbUser.id,
          employeeId: dbUser.employeeId,
          username: dbUser.username,
          name: dbUser.name,
          email: dbUser.email,
          passwordHash: dbUser.passwordHash,
          role: dbUser.role,
          departmentId: dbUser.departmentId,
          departmentName: dbUser.departmentName || '',
          jobTitle: dbUser.jobTitle,
        });
        syncedUsers++;
      }
    }

    const ip = extractClientIp(req);
    db.addAuditLog(
      req.user!.id,
      req.user!.name,
      'SQL_SERVER_SYNC',
      'Database',
      `Synchronized ${syncedUsers} employees to Microsoft SQL Server`,
      ip
    );

    res.json({ success: true, syncedUsers, message: `Successfully synchronized ${syncedUsers} employees to SQL Server.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
