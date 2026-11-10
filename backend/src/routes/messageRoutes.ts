/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { db } from '../db/database.ts';
import {
  authenticateJwt,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticateJwt);

// Send message
router.post('/', (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.id;
  const { conversationId, content, idempotencyId, replyToMessageId, attachments } = req.body;
  const numConvId = Number(conversationId);

  if (isNaN(numConvId) || (!content && (!attachments || attachments.length === 0))) {
    res.status(400).json({ error: 'Valid Conversation ID and content or attachment are required' });
    return;
  }

  if (!db.isUserInConversation(numConvId, currentUserId)) {
    res.status(403).json({ error: 'You are not a member of this conversation' });
    return;
  }

  const message = db.createMessage({
    conversationId: numConvId,
    senderId: currentUserId,
    content: (content || '').trim(),
    idempotencyId,
    replyToMessageId: replyToMessageId ? Number(replyToMessageId) : undefined,
    attachments,
  });

  res.status(201).json({ message });
});

// Edit message
router.patch('/:id', (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.id;
  const messageId = Number(req.params.id);
  const { content } = req.body;

  if (isNaN(messageId)) {
    res.status(400).json({ error: 'Invalid message ID' });
    return;
  }

  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Message content cannot be empty' });
    return;
  }

  try {
    const updated = db.updateMessageContent(messageId, content.trim(), currentUserId);
    res.json({ message: updated });
  } catch (error: any) {
    res.status(403).json({ error: error.message || 'Cannot edit message' });
  }
});

// Delete message
router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.id;
  const messageId = Number(req.params.id);
  const isSuperAdmin = req.user!.role === 'Super Admin';

  if (isNaN(messageId)) {
    res.status(400).json({ error: 'Invalid message ID' });
    return;
  }

  try {
    const deleted = db.deleteMessage(messageId, currentUserId, isSuperAdmin);
    res.json({ message: deleted });
  } catch (error: any) {
    res.status(403).json({ error: error.message || 'Cannot delete message' });
  }
});

// Get reactions for a message
router.get('/:id/reactions', (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.id;
  const messageId = Number(req.params.id);

  if (isNaN(messageId)) {
    res.status(400).json({ error: 'Invalid message ID' });
    return;
  }

  const msg = db.getMessageById(messageId);
  if (!msg || !db.isUserInConversation(msg.conversationId, currentUserId)) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  const reactions = db.getMessageReactions(messageId);
  res.json({ messageId, conversationId: msg.conversationId, reactions });
});

// Toggle reaction
router.post('/:id/reactions', (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.id;
  const messageId = Number(req.params.id);
  const { emoji } = req.body;

  if (isNaN(messageId)) {
    res.status(400).json({ error: 'Invalid message ID' });
    return;
  }

  if (!emoji) {
    res.status(400).json({ error: 'Emoji is required' });
    return;
  }

  const msg = db.getMessageById(messageId);
  if (!msg || !db.isUserInConversation(msg.conversationId, currentUserId)) {
    res.status(403).json({ error: 'Unauthorized to react to this message' });
    return;
  }

  const result = db.toggleReaction(messageId, currentUserId, emoji);
  res.json({
    ...result,
    messageId,
    conversationId: msg.conversationId,
  });
});

// Toggle pin message
router.post('/:id/pin', (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.id;
  const messageId = Number(req.params.id);

  if (isNaN(messageId)) {
    res.status(400).json({ error: 'Invalid message ID' });
    return;
  }

  const msg = db.getMessageById(messageId);
  if (!msg || !db.isUserInConversation(msg.conversationId, currentUserId)) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  const isPinned = db.togglePinMessage(msg.conversationId, messageId, currentUserId);
  res.json({ isPinned, messageId });
});

// Get pinned messages for conversation
router.get('/pinned/:conversationId', (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.id;
  const convId = Number(req.params.conversationId);

  if (isNaN(convId) || !db.isUserInConversation(convId, currentUserId)) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  const pinned = db.getPinnedMessages(convId);
  res.json({ pinnedMessages: pinned });
});

// Mark messages as read
router.post('/:id/read', (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.id;
  const messageId = Number(req.params.id);

  if (isNaN(messageId)) {
    res.status(400).json({ error: 'Invalid message ID' });
    return;
  }

  const msg = db.getMessageById(messageId);
  if (!msg || !db.isUserInConversation(msg.conversationId, currentUserId)) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  db.markConversationRead(msg.conversationId, currentUserId, messageId);
  res.json({ success: true });
});

export default router;
