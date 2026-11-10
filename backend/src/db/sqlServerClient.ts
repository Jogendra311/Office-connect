/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type { Department, RoleRecord } from '../types/index.ts';
dotenv.config();

// 1. Connection Configuration from Environment Variables
export const sqlConfig: sql.config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'OfficeConnect',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'false' ? false : true,
    enableArithAbort: true,
  },
};

let pool: sql.ConnectionPool | null = null;

/**
 * 2. Connect to SQL Server and return a singleton ConnectionPool.
 */
export async function getDbPool(): Promise<sql.ConnectionPool> {
  try {
    if (!pool || !pool.connected) {
      console.log(`[SQL Server] Connecting to ${sqlConfig.server}:${sqlConfig.port}/${sqlConfig.database}...`);
      pool = await sql.connect(sqlConfig);
      console.log('✅ [SQL Server] Database Connected successfully!');

      pool.on('error', (err) => {
        console.error('❌ [SQL Server Pool Error]:', err);
        pool = null;
      });
    }
    return pool;
  } catch (err: any) {
    console.error('❌ [SQL Server Connection Failed]:', err.message);
    throw err;
  }
}

/**
 * 3. Storing an Employee to SQL Server using Parameterized Queries
 */
export async function storeEmployeeToDb(employee: {
  userId: number;
  employeeId: number;
  username: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  departmentId: number;
  departmentName: string;
  jobTitle: string;
}) {
  const db = await getDbPool();
  
  const result = await db.request()
    .input('UserId', sql.Int, employee.userId)
    .input('EmployeeId', sql.Int, employee.employeeId)
    .input('Username', sql.NVarChar(50), employee.username.toLowerCase())
    .input('FullName', sql.NVarChar(150), employee.name)
    .input('Email', sql.NVarChar(150), employee.email.toLowerCase())
    .input('PasswordHash', sql.NVarChar(255), employee.passwordHash)
    .input('DepartmentId', sql.Int, employee.departmentId)
    .input('JobTitle', sql.NVarChar(100), employee.jobTitle)
    .query(`
      SET IDENTITY_INSERT [Auth].[Users] ON;
      INSERT INTO [Auth].[Users] (
        [UserId], [EmployeeId], [Username], [FullName], [Email],
        [PasswordHash], [DepartmentId], [JobTitle],
        [IsActive], [CreatedAt], [UpdatedAt]
      )
      VALUES (
        @UserId, @EmployeeId, @Username, @FullName, @Email,
        @PasswordHash, @DepartmentId, @JobTitle,
        1, SYSUTCDATETIME(), SYSUTCDATETIME()
      );
      SET IDENTITY_INSERT [Auth].[Users] OFF;
      
      SELECT * FROM [Auth].[Users] WHERE [UserId] = @UserId;
    `);

  return result.recordset[0];
}

/**
 * 4. Finding User by Username or Email
 */
export async function findUserInDb(usernameOrEmail: string) {
  const db = await getDbPool();

  const result = await db.request()
    .input('Identifier', sql.NVarChar(150), usernameOrEmail.toLowerCase().trim())
    .query(`
      SELECT TOP 1 *
      FROM [Auth].[Users]
      WHERE [Username] = @Identifier OR [Email] = @Identifier;
    `);

  return result.recordset[0] || null;
}

/**
 * 5. Storing a Chat Message to SQL Server
 */
export async function storeMessageToDb(msg: {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
}) {
  const db = await getDbPool();

  const result = await db.request()
    .input('MessageId', sql.Int, msg.id)
    .input('ConversationId', sql.Int, msg.conversationId)
    .input('SenderId', sql.Int, msg.senderId)
    .input('Content', sql.NVarChar(sql.MAX), msg.content)
    .query(`
      SET IDENTITY_INSERT [Chat].[Messages] ON;
      INSERT INTO [Chat].[Messages] (
        [MessageId], [ConversationId], [SenderId], [Content], [CreatedAt], [IsDeleted]
      )
      VALUES (
        @MessageId, @ConversationId, @SenderId, @Content, SYSUTCDATETIME(), 0
      );
      SET IDENTITY_INSERT [Chat].[Messages] OFF;

      SELECT * FROM [Chat].[Messages] WHERE [MessageId] = @MessageId;
    `);

  return result.recordset[0];
}

/**
 * 6. Recording Security Audit Log in SQL Server
 */
export async function storeAuditLogToDb(log: {
  id: number;
  actorId: number;
  actorName: string;
  action: string;
  target: string;
  details: string;
  ipAddress: string;
}) {
  const db = await getDbPool();

  await db.request()
    .input('LogId', sql.Int, log.id)
    .input('UserId', sql.Int, log.actorId)
    .input('UserName', sql.NVarChar(150), log.actorName)
    .input('Action', sql.NVarChar(100), log.action)
    .input('TargetResource', sql.NVarChar(100), log.target)
    .input('Details', sql.NVarChar(sql.MAX), log.details)
    .input('IpAddress', sql.NVarChar(50), log.ipAddress)
    .query(`
      SET IDENTITY_INSERT [Administration].[AuditLogs] ON;
      INSERT INTO [Administration].[AuditLogs] (
        [LogId], [UserId], [UserName], [Action], [TargetResource], [Details], [IpAddress], [Timestamp]
      )
      VALUES (
        @LogId, @UserId, @UserName, @Action, @TargetResource, @Details, @IpAddress, SYSUTCDATETIME()
      );
      SET IDENTITY_INSERT [Administration].[AuditLogs] OFF;
    `);
}

/**
 * 7. Test Connection Function
 */
export async function testSqlConnection(customConfig?: Partial<sql.config>) {
  const cfg = { ...sqlConfig, ...(customConfig || {}) };
  const start = Date.now();
  let tempPool: sql.ConnectionPool | null = null;
  try {
    tempPool = await new sql.ConnectionPool(cfg).connect();
    const result = await tempPool.request().query(`
      SELECT 
        @@VERSION AS [ServerVersion],
        DB_NAME() AS [CurrentDatabase],
        SYSUTCDATETIME() AS [ServerTime]
    `);
    const latencyMs = Date.now() - start;
    return {
      success: true,
      latencyMs,
      server: cfg.server,
      database: result.recordset[0]?.CurrentDatabase || cfg.database,
      version: result.recordset[0]?.ServerVersion?.split('\n')[0] || 'Microsoft SQL Server',
      serverTime: result.recordset[0]?.ServerTime,
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err.message,
      server: cfg.server,
      database: cfg.database,
    };
  } finally {
    if (tempPool) {
      await tempPool.close().catch(() => {});
    }
  }
}

/**
 * 8. Safe Background Sync Helper (Non-blocking)
 */
export function safeSyncToSqlServer(task: () => Promise<any>) {
  Promise.resolve()
    .then(task)
    .catch((err) => {
      if (process.env.DEBUG_SQL === 'true') {
        console.warn('[SQL Server Background Sync Standby]:', err.message);
      }
    });
}

/**
 * 9. Execute Stored Procedure: [Auth].[sp_RegisterEmployee]
 */
export async function registerEmployeeViaSp(employee: {
  employeeId: number;
  username: string;
  fullName: string;
  email: string;
  passwordHash: string;
  roleName?: string;
  departmentId: number;
  jobTitle: string;
  avatarUrl?: string;
  registeredByUserId?: number;
  registeredByName?: string;
  ipAddress?: string;
}) {
  const db = await getDbPool();

  const request = db.request()
    .input('EmployeeId', sql.Int, employee.employeeId)
    .input('Username', sql.NVarChar(50), employee.username.toLowerCase())
    .input('FullName', sql.NVarChar(150), employee.fullName)
    .input('Email', sql.NVarChar(150), employee.email.toLowerCase())
    .input('PasswordHash', sql.NVarChar(255), employee.passwordHash)
    .input('RoleName', sql.NVarChar(50), employee.roleName || 'Employee')
    .input('DepartmentId', sql.Int, employee.departmentId)
    .input('JobTitle', sql.NVarChar(100), employee.jobTitle)
    .input('AvatarUrl', sql.NVarChar(500), employee.avatarUrl || null)
    .input('RegisteredByUserId', sql.Int, employee.registeredByUserId || null)
    .input('RegisteredByName', sql.NVarChar(150), employee.registeredByName || 'Super Admin')
    .input('IpAddress', sql.NVarChar(50), employee.ipAddress || '127.0.0.1');

  const result = await request.execute('[Auth].[sp_RegisterEmployee]');
  return result.recordset[0];
}

/**
 * 10. Execute Stored Procedure: [Chat].[sp_CreateMessage]
 */
export async function createMessageViaSp(msg: {
  conversationId: number;
  senderId: number;
  content: string;
  idempotencyId?: number;
  replyToMessageId?: number;
}) {
  const db = await getDbPool();

  const request = db.request()
    .input('ConversationId', sql.Int, msg.conversationId)
    .input('SenderId', sql.Int, msg.senderId)
    .input('Content', sql.NVarChar(sql.MAX), msg.content)
    .input('IdempotencyId', sql.Int, msg.idempotencyId || null)
    .input('ReplyToMessageId', sql.Int, msg.replyToMessageId || null);

  const result = await request.execute('[Chat].[sp_CreateMessage]');
  return result.recordset[0];
}

/**
 * 11. Execute Stored Procedure: [Chat].[sp_CreateConversation]
 */
export async function createConversationViaSp(conv: {
  type: 'direct' | 'group';
  title?: string;
  description?: string;
  avatarUrl?: string;
  createdById: number;
  recipientUserId?: number;
}) {
  const db = await getDbPool();

  const request = db.request()
    .input('Type', sql.NVarChar(20), conv.type)
    .input('Title', sql.NVarChar(150), conv.title || null)
    .input('Description', sql.NVarChar(500), conv.description || null)
    .input('AvatarUrl', sql.NVarChar(500), conv.avatarUrl || null)
    .input('CreatedById', sql.Int, conv.createdById)
    .input('RecipientUserId', sql.Int, conv.recipientUserId || null);

  const result = await request.execute('[Chat].[sp_CreateConversation]');
  return result.recordset[0];
}

/**
 * 12. Execute Stored Procedure: [Chat].[sp_ToggleReaction]
 */
export async function toggleReactionViaSp(reaction: {
  messageId: number;
  userId: number;
  emoji: string;
}) {
  const db = await getDbPool();

  const request = db.request()
    .input('MessageId', sql.Int, reaction.messageId)
    .input('UserId', sql.Int, reaction.userId)
    .input('Emoji', sql.NVarChar(20), reaction.emoji);

  const result = await request.execute('[Chat].[sp_ToggleReaction]');
  return result.recordset[0];
}

/**
 * 13. Execute Stored Procedure: [Administration].[sp_RecordAuditLog]
 */
export async function recordAuditLogViaSp(log: {
  userId: number;
  userName: string;
  action: string;
  targetResource: string;
  details?: string;
  ipAddress?: string;
}) {
  const db = await getDbPool();

  const request = db.request()
    .input('UserId', sql.Int, log.userId)
    .input('UserName', sql.NVarChar(150), log.userName)
    .input('Action', sql.NVarChar(100), log.action)
    .input('TargetResource', sql.NVarChar(100), log.targetResource)
    .input('Details', sql.NVarChar(sql.MAX), log.details || null)
    .input('IpAddress', sql.NVarChar(50), log.ipAddress || '127.0.0.1');

  const result = await request.execute('[Administration].[sp_RecordAuditLog]');
  return result.recordset[0];
}

/**
 * 14. Execute Stored Procedure: [Auth].[sp_LoginUser]
 */
export async function loginUserViaSp(usernameOrEmail: string, clientIp = '127.0.0.1') {
  const db = await getDbPool();
  const request = db.request()
    .input('UsernameOrEmail', sql.NVarChar(150), usernameOrEmail)
    .input('ClientIp', sql.NVarChar(50), clientIp);

  const result = await request.execute('[Auth].[sp_LoginUser]');
  return result.recordset[0];
}

/**
 * 15. Execute Stored Procedure: [Auth].[sp_GetUserProfile]
 */
export async function getUserProfileViaSp(userId: number) {
  const db = await getDbPool();
  const request = db.request().input('UserId', sql.Int, userId);
  const result = await request.execute('[Auth].[sp_GetUserProfile]');
  return result.recordset[0] || null;
}

/**
 * 16. Execute Stored Procedure: [Auth].[sp_UpdateUserStatus]
 */
export async function updateUserStatusViaSp(userId: number, status: string) {
  const db = await getDbPool();
  const request = db.request()
    .input('UserId', sql.Int, userId)
    .input('Status', sql.NVarChar(20), status);
  const result = await request.execute('[Auth].[sp_UpdateUserStatus]');
  return result.recordset[0];
}

/**
 * 17. Execute Stored Procedure: [Auth].[sp_GetAllEmployees]
 */
export async function getAllEmployeesViaSp(activeOnly = true) {
  const db = await getDbPool();
  const request = db.request().input('ActiveOnly', sql.Bit, activeOnly ? 1 : 0);
  const result = await request.execute('[Auth].[sp_GetAllEmployees]');
  return result.recordset;
}

export async function getDepartmentsFromDb(): Promise<Department[]> {
  const db = await getDbPool();
  const result = await db.request().execute('[Organization].[sp_GetDepartments]');

  return result.recordset.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    code: String(row.code),
    description: row.description ?? undefined,
    managerId: row.managerId == null ? undefined : Number(row.managerId),
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}

export async function getRolesFromDb(): Promise<RoleRecord[]> {
  const db = await getDbPool();
  const result = await db.request().execute('[Auth].[usp_GetRoles]');

  return result.recordset.map((row) => ({
    id: Number(row.RoleId),
    name: String(row.RoleName),
    description: row.Description ?? undefined,
    createdAt: new Date(row.CreatedAt).toISOString(),
  }));
}

export async function getDepartmentByIdFromDb(departmentId: number): Promise<Department | undefined> {
  const db = await getDbPool();
  const result = await db.request()
    .input('DepartmentId', sql.Int, departmentId)
    .execute('[Organization].[sp_GetDepartmentById]');
  const row = result.recordset[0];

  if (!row) return undefined;

  return {
    id: Number(row.id),
    name: String(row.name),
    code: String(row.code),
    description: row.description ?? undefined,
    managerId: row.managerId == null ? undefined : Number(row.managerId),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export async function createDepartmentInDb(
  department: Omit<Department, 'id' | 'createdAt'>
): Promise<Department> {
  const db = await getDbPool();
  const result = await db.request()
    .input('Name', sql.NVarChar(100), department.name.trim())
    .input('Code', sql.NVarChar(20), department.code.trim().toUpperCase())
    .input('Description', sql.NVarChar(255), department.description?.trim() || null)
    .input('ManagerId', sql.Int, department.managerId ?? null)
    .execute('[Organization].[sp_CreateDepartment]');
  const row = result.recordset[0];

  if (!row) throw new Error('Department procedure returned no department.');

  return {
    id: Number(row.id),
    name: String(row.name),
    code: String(row.code),
    description: row.description ?? undefined,
    managerId: row.managerId == null ? undefined : Number(row.managerId),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

/**
 * 18. Execute Stored Procedure: [Auth].[sp_UpdateEmployeeStatus]
 */
export async function updateEmployeeStatusViaSp(targetUserId: number, isActive: boolean, adminUserId: number, adminName: string, ip = '127.0.0.1') {
  const db = await getDbPool();
  const request = db.request()
    .input('TargetUserId', sql.Int, targetUserId)
    .input('IsActive', sql.Bit, isActive ? 1 : 0)
    .input('AdminUserId', sql.Int, adminUserId)
    .input('AdminName', sql.NVarChar(150), adminName)
    .input('IpAddress', sql.NVarChar(50), ip);
  const result = await request.execute('[Auth].[sp_UpdateEmployeeStatus]');
  return result.recordset[0];
}

/**
 * 19. Execute Stored Procedure: [Auth].[sp_UpdateEmployeeRole]
 */
export async function updateEmployeeRoleViaSp(targetUserId: number, newRoleName: string, adminUserId: number, adminName: string, ip = '127.0.0.1') {
  const db = await getDbPool();
  const request = db.request()
    .input('TargetUserId', sql.Int, targetUserId)
    .input('NewRoleName', sql.NVarChar(50), newRoleName)
    .input('AdminUserId', sql.Int, adminUserId)
    .input('AdminName', sql.NVarChar(150), adminName)
    .input('IpAddress', sql.NVarChar(50), ip);
  const result = await request.execute('[Auth].[sp_UpdateEmployeeRole]');
  return result.recordset[0];
}

/**
 * 20. Execute Stored Procedure: [Chat].[sp_GetUserConversations]
 */
export async function getUserConversationsViaSp(userId: number) {
  const db = await getDbPool();
  const request = db.request().input('UserId', sql.Int, userId);
  const result = await request.execute('[Chat].[sp_GetUserConversations]');
  return result.recordset;
}

/**
 * 21. Execute Stored Procedure: [Chat].[sp_GetMessagesCursor]
 */
export async function getMessagesCursorViaSp(conversationId: number, cursorMessageId?: number, limit = 50) {
  const db = await getDbPool();
  const request = db.request()
    .input('ConversationId', sql.Int, conversationId)
    .input('CursorMessageId', sql.Int, cursorMessageId || null)
    .input('Limit', sql.Int, limit);
  const result = await request.execute('[Chat].[sp_GetMessagesCursor]');
  return result.recordset;
}

/**
 * 22. Execute Stored Procedure: [Chat].[sp_UpdateMessageContent]
 */
export async function updateMessageContentViaSp(messageId: number, senderId: number, newContent: string) {
  const db = await getDbPool();
  const request = db.request()
    .input('MessageId', sql.Int, messageId)
    .input('SenderId', sql.Int, senderId)
    .input('NewContent', sql.NVarChar(sql.MAX), newContent);
  const result = await request.execute('[Chat].[sp_UpdateMessageContent]');
  return result.recordset[0];
}

/**
 * 23. Execute Stored Procedure: [Chat].[sp_DeleteMessage]
 */
export async function deleteMessageViaSp(messageId: number, userId: number) {
  const db = await getDbPool();
  const request = db.request()
    .input('MessageId', sql.Int, messageId)
    .input('UserId', sql.Int, userId);
  const result = await request.execute('[Chat].[sp_DeleteMessage]');
  return result.recordset[0];
}

/**
 * 24. Execute Stored Procedure: [Chat].[sp_TogglePinMessage]
 */
export async function togglePinMessageViaSp(messageId: number, userId: number) {
  const db = await getDbPool();
  const request = db.request()
    .input('MessageId', sql.Int, messageId)
    .input('UserId', sql.Int, userId);
  const result = await request.execute('[Chat].[sp_TogglePinMessage]');
  return result.recordset[0];
}

/**
 * 25. Execute Stored Procedure: [Administration].[sp_GetAuditLogs]
 */
export async function getAuditLogsViaSp(limit = 200) {
  const db = await getDbPool();
  const request = db.request().input('Limit', sql.Int, limit);
  const result = await request.execute('[Administration].[sp_GetAuditLogs]');
  return result.recordset;
}

/**
 * 26. Install / Deploy All Stored Procedures to SQL Server
 */
function findMigrationPath(fileName: string): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), 'backend/database/migrations', fileName),
    path.resolve(process.cwd(), 'database/migrations', fileName),
    path.resolve(__dirname, '../../database/migrations', fileName),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function runMigrationFile(db: sql.ConnectionPool, filePath: string): Promise<number> {
  const batches = fs.readFileSync(filePath, 'utf-8')
    .split(/^\s*GO\s*$/gim)
    .map((batch) => batch.trim())
    .filter((batch) => batch.length > 0);

  for (const batch of batches) {
    await db.request().batch(batch);
  }

  return batches.length;
}

export async function installDepartmentProceduresToDb(): Promise<number> {
  const db = await getDbPool();
  const filePath = findMigrationPath('004_departments.sql');
  if (!filePath) throw new Error('004_departments.sql migration file not found');
  return runMigrationFile(db, filePath);
}

export async function installRoleProceduresToDb(): Promise<number> {
  const db = await getDbPool();
  const filePath = findMigrationPath('005_get_roles.sql');
  if (!filePath) throw new Error('005_get_roles.sql migration file not found');
  return runMigrationFile(db, filePath);
}

export async function installStoredProceduresToDb() {
  const db = await getDbPool();
  const crudPath =
    findMigrationPath('003_stored_procedures_crud.sql') ||
    findMigrationPath('003_stored_procedures.sql');
  let installedBatches = crudPath ? await runMigrationFile(db, crudPath) : 0;
  installedBatches += await installDepartmentProceduresToDb();
  installedBatches += await installRoleProceduresToDb();

  return {
    success: true,
    installedBatches,
    message: 'Successfully compiled and installed all Master CRUD Stored Procedures with INT IDs in SQL Server!',
  };
}

/**
 * 27. Initialize Database Schema (Tables, Schemas, Indexes)
 */
export async function initSqlServerSchema() {
  const db = await getDbPool();
  const fileCandidates = [
    path.resolve(process.cwd(), 'backend/database/migrations/001_initial_schema.sql'),
    path.resolve(process.cwd(), 'database/migrations/001_initial_schema.sql'),
  ];
  const schemaPath = fileCandidates.find((f) => fs.existsSync(f));
  if (!schemaPath) {
    throw new Error('001_initial_schema.sql migration file not found');
  }

  const sqlContent = fs.readFileSync(schemaPath, 'utf-8');
  const batches = sqlContent
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  for (const batch of batches) {
    await db.request().batch(batch);
  }

  // Also apply 002 if exists
  const rxCandidates = [
    path.resolve(process.cwd(), 'backend/database/migrations/002_message_reactions_update.sql'),
    path.resolve(process.cwd(), 'database/migrations/002_message_reactions_update.sql'),
  ];
  const rxPath = rxCandidates.find((f) => fs.existsSync(f));
  if (rxPath) {
    const rxContent = fs.readFileSync(rxPath, 'utf-8');
    const rxBatches = rxContent
      .split(/^\s*GO\s*$/gim)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);
    for (const batch of rxBatches) {
      await db.request().batch(batch);
    }
  }

  return {
    success: true,
    batchesExecuted: batches.length,
    message: 'Successfully initialized SQL Server schemas and tables!',
  };
}

export { sql };
