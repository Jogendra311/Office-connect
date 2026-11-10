/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { db } from '../db/database.ts';
import {
  authenticateJwt,
  extractClientIp,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticateJwt);

// List all conversations for the authenticated user
router.get('/', (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.id;
  const conversations = db.getUserConversations(currentUserId);
  res.json({ conversations });
});

// Create new conversation (direct or group)
router.post('/', (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.id;
  const { type, recipientId, title, description, memberIds } = req.body;
  const ip = extractClientIp(req);

  if (type === 'direct') {
    const numRecipientId = Number(recipientId);
    if (!numRecipientId) {
      res.status(400).json({ error: 'recipientId is required for direct conversation' });
      return;
    }
    if (numRecipientId === currentUserId) {
      res.status(400).json({ error: 'Cannot create direct conversation with yourself' });
      return;
    }

    const recipient = db.getUserById(numRecipientId);
    if (!recipient) {
      res.status(404).json({ error: 'Recipient user does not exist' });
      return;
    }

    const conversation = db.createDirectConversation(currentUserId, numRecipientId);
    res.status(201).json({ conversation });
  } else if (type === 'group') {
    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Title is required for group conversation' });
      return;
    }

    const members: number[] = Array.isArray(memberIds)
      ? memberIds.map((m: any) => Number(m)).filter((n: number) => !isNaN(n))
      : [];
    const conversation = db.createGroupConversation(
      currentUserId,
      title.trim(),
      description,
      members
    );

    db.addAuditLog(
      currentUserId,
      req.user!.name,
      'CREATE_GROUP',
      'Conversation',
      `Created group "${title}" with ${members.length + 1} members`,
      ip
    );

    res.status(201).json({ conversation });
  } else {
    res.status(400).json({ error: 'Invalid conversation type' });
  }
});

// Get specific conversation by ID
router.get('/:id', (req: AuthenticatedRequest, res) => {
  const convId = Number(req.params.id);
  const currentUserId = req.user!.id;

  if (isNaN(convId) || !db.isUserInConversation(convId, currentUserId)) {
    res.status(403).json({ error: 'You are not a member of this conversation' });
    return;
  }

  const conversation = db.getConversationById(convId, currentUserId);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  res.json({ conversation });
});

// Get messages for a conversation (cursor-based pagination)
router.get('/:id/messages', (req: AuthenticatedRequest, res) => {
  const convId = Number(req.params.id);
  const currentUserId = req.user!.id;

  if (isNaN(convId) || !db.isUserInConversation(convId, currentUserId)) {
    res.status(403).json({ error: 'You are not a member of this conversation' });
    return;
  }

  const cursorMessageId = req.query.cursor ? Number(req.query.cursor) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

  const result = db.getMessagesByConversation(convId, {
    cursorMessageId: isNaN(cursorMessageId as number) ? undefined : cursorMessageId,
    limit,
  });

  res.json(result);
});

// Add member to group conversation
router.post('/:id/members', (req: AuthenticatedRequest, res) => {
  const convId = Number(req.params.id);
  const currentUserId = req.user!.id;
  const { userId, role } = req.body;
  const targetUserId = Number(userId);

  if (isNaN(convId) || isNaN(targetUserId)) {
    res.status(400).json({ error: 'Invalid conversation or user ID' });
    return;
  }

  const conv = db.getConversationById(convId, currentUserId);
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  if (conv.type !== 'group') {
    res.status(400).json({ error: 'Cannot add members to a 1:1 direct conversation' });
    return;
  }

  // Must be admin of group or Super Admin
  const isGroupAdmin = conv.members.some(
    (m) => m.userId === currentUserId && m.role === 'admin'
  );
  if (!isGroupAdmin && req.user!.role !== 'Super Admin') {
    res.status(403).json({ error: 'Only group admins can add members' });
    return;
  }

  const member = db.addMemberToConversation(convId, targetUserId, role || 'member');
  const ip = extractClientIp(req);
  db.addAuditLog(
    currentUserId,
    req.user!.name,
    'ADD_GROUP_MEMBER',
    'Conversation',
    `Added user ${targetUserId} to group ${conv.title}`,
    ip
  );

  res.status(201).json({ member });
});

// Remove member from group conversation / Leave group
router.delete('/:id/members/:userId', (req: AuthenticatedRequest, res) => {
  const convId = Number(req.params.id);
  const currentUserId = req.user!.id;
  const targetUserId = Number(req.params.userId);

  if (isNaN(convId) || isNaN(targetUserId)) {
    res.status(400).json({ error: 'Invalid conversation or user ID' });
    return;
  }

  const conv = db.getConversationById(convId, currentUserId);
  if (!conv || conv.type !== 'group') {
    res.status(400).json({ error: 'Invalid group conversation' });
    return;
  }

  const isSelf = currentUserId === targetUserId;
  const isGroupAdmin = conv.members.some(
    (m) => m.userId === currentUserId && m.role === 'admin'
  );

  if (!isSelf && !isGroupAdmin && req.user!.role !== 'Super Admin') {
    res.status(403).json({ error: 'Unauthorized to remove this member' });
    return;
  }

  db.removeMemberFromConversation(convId, targetUserId);
  const ip = extractClientIp(req);
  db.addAuditLog(
    currentUserId,
    req.user!.name,
    isSelf ? 'LEAVE_GROUP' : 'REMOVE_GROUP_MEMBER',
    'Conversation',
    `${isSelf ? 'Left' : 'Removed user ' + targetUserId + ' from'} group ${conv.title}`,
    ip
  );

  res.json({ success: true, message: 'Member removed successfully' });
});

export default router;
