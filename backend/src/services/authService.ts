/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { CONFIG } from '../config.ts';
import { db } from '../db/database.ts';
import type { User, AuthResponse } from '../types/index.ts';

export class AuthService {
  public static generateAccessToken(user: User): string {
    return jwt.sign(
      {
        userId: user.id,
        role: user.role,
        departmentId: user.departmentId,
        username: user.username,
      },
      CONFIG.JWT_SECRET,
      { expiresIn: '2h' }
    );
  }

  public static generateRefreshToken(userId: number): { token: string; hash: string; expiresAt: string } {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + CONFIG.REFRESH_TOKEN_EXPIRES_DAYS * 86400000).toISOString();

    db.saveRefreshToken(userId, tokenHash, expiresAt);
    return { token: rawToken, hash: tokenHash, expiresAt };
  }

  public static async authenticate(
    usernameOrEmail: string,
    plainPassword: string,
    ipAddress: string
  ): Promise<AuthResponse> {
    const dbUser =
      db.getUserByUsername(usernameOrEmail) || db.getUserByEmail(usernameOrEmail);

    if (!dbUser) {
      db.addAuditLog(
        0,
        usernameOrEmail,
        'FAILED_LOGIN',
        'Auth',
        `Failed login attempt for unknown user: ${usernameOrEmail}`,
        ipAddress
      );
      throw new Error('Invalid credentials');
    }

    if (!dbUser.isActive) {
      db.addAuditLog(
        dbUser.id,
        dbUser.name,
        'BLOCKED_LOGIN',
        'Auth',
        'Login blocked: Account deactivated by administrator',
        ipAddress
      );
      throw new Error('Account has been deactivated. Please contact your IT administrator.');
    }

    const isMatch = await bcrypt.compare(plainPassword, dbUser.passwordHash);
    if (!isMatch) {
      db.addAuditLog(
        dbUser.id,
        dbUser.name,
        'FAILED_LOGIN',
        'Auth',
        'Incorrect password entered',
        ipAddress
      );
      throw new Error('Invalid credentials');
    }

    const { passwordHash: _, ...user } = dbUser;
    const accessToken = this.generateAccessToken(user);
    this.generateRefreshToken(user.id);

    db.setUserStatus(user.id, 'online');
    db.addAuditLog(
      user.id,
      user.name,
      'USER_LOGIN',
      'Auth',
      `Successful authentication on LAN (${ipAddress})`,
      ipAddress
    );

    return { user, accessToken };
  }

  public static refreshAccessToken(rawRefreshToken: string, ipAddress: string): AuthResponse {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const stored = db.getRefreshToken(tokenHash);

    if (!stored || stored.isRevoked || new Date(stored.expiresAt).getTime() < Date.now()) {
      throw new Error('Invalid or expired refresh token');
    }

    const user = db.getUserById(stored.userId);
    if (!user || !user.isActive) {
      throw new Error('User inactive or not found');
    }

    // Revoke old token and issue new pair (rotation)
    db.revokeRefreshToken(tokenHash);
    const newRefresh = this.generateRefreshToken(user.id);
    const newAccessToken = this.generateAccessToken(user);

    db.addAuditLog(
      user.id,
      user.name,
      'TOKEN_REFRESH',
      'Auth',
      'Refreshed JWT session token',
      ipAddress
    );

    return { user, accessToken: newAccessToken };
  }

  public static logout(userId: number, rawRefreshToken?: string, ipAddress = '127.0.0.1'): void {
    if (rawRefreshToken) {
      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      db.revokeRefreshToken(tokenHash);
    }
    const user = db.getUserById(userId);
    if (user) {
      db.setUserStatus(userId, 'offline');
      db.addAuditLog(
        userId,
        user.name,
        'USER_LOGOUT',
        'Auth',
        'Logged out of OfficeConnect',
        ipAddress
      );
    }
  }
}
