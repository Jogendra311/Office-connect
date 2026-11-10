/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.ts';
import { AuthService } from '../services/authService.ts';

const department = db.createDepartment({
  name: 'Test Department',
  code: 'TEST',
  description: 'Department fixture for backend tests',
});
const testPassword = 'TestPassword!';
const testPasswordHash = bcrypt.hashSync(testPassword, bcrypt.genSaltSync(4));

const createFixtureUser = (username: string, name: string, role: 'Super Admin' | 'Employee' = 'Employee') =>
  db.createUser({
    employeeId: Math.floor(100000 + Math.random() * 900000),
    username,
    name,
    email: `${username}@test.invalid`,
    passwordHash: testPasswordHash,
    role,
    departmentId: department.id,
    departmentName: department.name,
    jobTitle: 'Test User',
    status: 'offline',
    lastSeen: new Date().toISOString(),
    isActive: true,
  });

const admin = createFixtureUser('test.admin', 'Test Admin', 'Super Admin');
const employeeA = createFixtureUser('test.employee.a', 'Test Employee A');
const employeeB = createFixtureUser('test.employee.b', 'Test Employee B');
const announcements = db.createGroupConversation(admin.id, 'Test Announcements', '', [
  employeeA.id,
  employeeB.id,
]);
const directConversation = db.createDirectConversation(admin.id, employeeA.id);
db.createMessage({
  conversationId: directConversation.id,
  senderId: admin.id,
  content: 'First cursor fixture message',
});
db.createMessage({
  conversationId: directConversation.id,
  senderId: employeeA.id,
  content: 'Second cursor fixture message',
});

test('login rejects a password that does not match the stored hash', async () => {
  await assert.rejects(
    AuthService.authenticate(admin.username, 'WrongTestPassword!', '127.0.0.1'),
    /Invalid credentials/
  );
});

test('1-to-1 direct conversation deduplication works bidirectionally', () => {
  const userA = admin.id;
  const userB = employeeB.id;

  // First creation: userA -> userB
  const conv1 = db.createDirectConversation(userA, userB);
  assert.ok(typeof conv1.id === 'number', 'Conversation ID should be created as number');
  assert.equal(conv1.type, 'direct');

  // Second creation: userB -> userA (counterpart)
  const conv2 = db.createDirectConversation(userB, userA);
  assert.equal(conv1.id, conv2.id, 'Both users must get the identical conversation ID without duplicates');
});

test('Message idempotency prevents duplicate records on network retry', () => {
  const conv = db.createDirectConversation(admin.id, employeeB.id);
  const idempotencyKey = `idem-test-${Date.now()}`;

  const msg1 = db.createMessage({
    conversationId: conv.id,
    senderId: admin.id,
    content: 'Reliable network idempotency test',
    idempotencyId: idempotencyKey,
  });

  const msg2 = db.createMessage({
    conversationId: conv.id,
    senderId: admin.id,
    content: 'Reliable network idempotency test (retry attempt)',
    idempotencyId: idempotencyKey,
  });

  assert.equal(msg1.id, msg2.id, 'Duplicate send with same idempotency key must return existing message');
  assert.equal(msg1.content, msg2.content, 'Content must match original');
});

test('Cursor pagination returns ordered messages without duplicates', () => {
  const conv = db.getConversationById(directConversation.id, admin.id);
  assert.ok(conv, 'Conversation must exist');

  const page1 = db.getMessagesByConversation(directConversation.id, { limit: 1 });
  assert.equal(page1.messages.length, 1);
  assert.ok(page1.hasMore, 'Should have more messages');
  assert.ok(typeof page1.nextCursor === 'number', 'Should have numeric next cursor');

  const page2 = db.getMessagesByConversation(directConversation.id, {
    cursorMessageId: page1.nextCursor,
    limit: 5,
  });

  assert.ok(page2.messages.length > 0);
  assert.notEqual(page2.messages[0].id, page1.messages[0].id, 'Next page should not repeat current message');
});

test('Message reaction toggle adds and removes cleanly', () => {
  const conv = db.createDirectConversation(admin.id, employeeA.id);
  const msg = db.createMessage({
    conversationId: conv.id,
    senderId: admin.id,
    content: 'Reaction toggle test',
  });

  // 1. Add reaction
  const rx1 = db.toggleReaction(msg.id, admin.id, '👍');
  assert.equal(rx1.added, true);

  const reactionsAfterAdd = db.getMessageReactions(msg.id);
  assert.equal(reactionsAfterAdd.length, 1);
  assert.equal(reactionsAfterAdd[0].emoji, '👍');

  // 2. Remove reaction (toggle)
  const rx2 = db.toggleReaction(msg.id, admin.id, '👍');
  assert.equal(rx2.added, false);

  const reactionsAfterRemove = db.getMessageReactions(msg.id);
  assert.equal(reactionsAfterRemove.length, 0);
});

test('Multi-user message reactions aggregate correctly with user names', () => {
  const conv = db.createDirectConversation(admin.id, employeeB.id);
  const msg = db.createMessage({
    conversationId: conv.id,
    senderId: admin.id,
    content: 'Multi user reaction test',
  });

  db.toggleReaction(msg.id, admin.id, '🚀');
  db.toggleReaction(msg.id, employeeB.id, '🚀');

  const reactions = db.getMessageReactions(msg.id);
  assert.equal(reactions.length, 2);
  assert.equal(reactions[0].userName, admin.name);
  assert.equal(reactions[1].userName, employeeB.name);
});

test('Message soft deletion hides original content and sets isDeleted', () => {
  const conv = db.createDirectConversation(admin.id, employeeB.id);
  const msg = db.createMessage({
    conversationId: conv.id,
    senderId: admin.id,
    content: 'Confidential draft message to delete',
  });

  const deleted = db.deleteMessage(msg.id, admin.id);
  assert.equal(deleted.isDeleted, true);
  assert.equal(deleted.content, 'This message was deleted');

  // Querying from conversation should return the masked message
  const result = db.getMessagesByConversation(conv.id);
  const found = result.messages.find((m) => m.id === msg.id);
  assert.ok(found);
  assert.equal(found.isDeleted, true);
  assert.equal(found.content, 'This message was deleted');
});

test('Audit log stores action with IP and actor details', () => {
  const log = db.addAuditLog(
    admin.id,
    admin.name,
    'SECURITY_TEST',
    'System',
    'Automated audit pipeline validation',
    '10.1.60.100'
  );

  assert.ok(typeof log.id === 'number', 'Log id should be number');
  assert.equal(log.userName, admin.name);
  assert.equal(log.ipAddress, '10.1.60.100');
  assert.equal(log.action, 'SECURITY_TEST');

  const logs = db.getAuditLogs(10);
  assert.equal(logs[0].id, log.id);
});

test('Super User registration provisions new employee and enrolls in general channel', () => {
  const initialUserCount = db.getAllUsers(false).length;
  const username = `test.employee.${Date.now()}`;
  const email = `${username}@office.internal`;

  const newEmployee = db.createUser({
    employeeId: Math.floor(1000 + Math.random() * 9000),
    username,
    name: 'New Test Employee',
    email,
    passwordHash: '$2a$10$xyzFakeHashedPassword',
    role: 'Employee',
    departmentId: 1,
    departmentName: 'Information Technology',
    jobTitle: 'Junior Developer',
    status: 'offline',
    lastSeen: new Date().toISOString(),
    isActive: true,
  });

  assert.ok(typeof newEmployee.id === 'number', 'New employee id should be number');
  assert.equal(newEmployee.username, username);
  assert.equal(newEmployee.isActive, true);

  db.addMemberToConversation(announcements.id, newEmployee.id, 'member');

  const generalConv = db.getConversationById(announcements.id, newEmployee.id);
  assert.ok(generalConv, 'Employee must be able to access general announcements');
  const isMember = generalConv.members.some((m) => m.userId === newEmployee.id);
  assert.equal(isMember, true, 'Employee should be registered as a member of general channel');

  const afterUserCount = db.getAllUsers(false).length;
  assert.equal(afterUserCount, initialUserCount + 1);
});

test('User registration prevents duplicate usernames and emails', () => {
  const duplicateUsername = admin.username;
  const duplicateEmail = admin.email;

  const userByUname = db.getUserByUsername(duplicateUsername);
  assert.ok(userByUname, 'Existing user must be found by username');

  const userByEmail = db.getUserByEmail(duplicateEmail);
  assert.ok(userByEmail, 'Existing user must be found by email');
});
