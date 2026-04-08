import { db } from '../db';
import { users, sessions, loginActivity } from '../db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../utils/password';
import { BadRequestError, NotFoundError } from '../utils/api-error';
import { sessionService } from './session.service';
import { tokenService } from './token.service';

// 👤 User Service — profile, password, account management

class UserService {
  /** List all users with pagination (admin only). */
  async getUserList({ page, limit }: { page: number; limit: number }) {
    const offset = (page - 1) * limit;

    const [{ total }] = await db.select({ total: count() }).from(users);

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        emailVerified: users.emailVerified,
        isBlocked: users.isBlocked,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(Number(total) / limit);
    return { users: rows, total: Number(total), page, limit, totalPages };
  }

  /** Get user by ID (public profile fields). */
  async getById(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) throw new NotFoundError('👤 User not found.');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  /** Update profile fields (name, image). */
  async updateProfile(
    userId: string,
    data: { name?: string; image?: string | null },
  ) {
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) throw new NotFoundError('👤 User not found.');

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      image: updated.image,
      role: updated.role,
      emailVerified: updated.emailVerified,
    };
  }

  /** Change password (requires current password). Keeps the current session alive. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionToken?: string,
  ) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user || !user.passwordHash) {
      throw new BadRequestError(
        '❌ Cannot change password. Account uses social login only.',
      );
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestError('🔐 Current password is incorrect.');
    }

    // Prevent password reuse
    const isSame = await verifyPassword(newPassword, user.passwordHash);
    if (isSame) {
      throw new BadRequestError(
        '❌ New password must be different from your current password.',
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Invalidate all OTHER PG sessions (keep current session alive)
    if (currentSessionToken) {
      await sessionService.deleteOtherUserSessions(userId, currentSessionToken);
    } else {
      await sessionService.deleteAllUserSessions(userId);
    }

    // Also purge ALL Redis refresh tokens for this user.
    // The current session will get a fresh refresh token on next rotation.
    // This ensures other devices can't silently stay logged in.
    await tokenService.deleteAllRefreshTokensForUser(userId);
  }

  /**
   * Delete user account.
   * Cascade on FK will remove sessions, oauth_accounts, tokens, activity.
   * Redis refresh tokens are purged here since FK cascade won't touch Redis.
   */
  async deleteAccount(userId: string) {
    //  purge Redis refresh tokens BEFORE deleting the user row
    // FK cascade removes PG sessions but Redis is not aware of the cascade
    await tokenService.deleteAllRefreshTokensForUser(userId);

    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning();

    if (!deleted) throw new NotFoundError('👤 User not found.');
  }

  /** Block a user (prevents login, kills sessions). */
  async blockUser(userId: string) {
    const [updated] = await db
      .update(users)
      .set({ isBlocked: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) throw new NotFoundError('👤 User not found.');

    // Kill all PG sessions immediately
    await db.delete(sessions).where(eq(sessions.userId, userId));

    //  Also purge all Redis refresh tokens so blocked
    // user cannot silently re-authenticate via token rotation
    await tokenService.deleteAllRefreshTokensForUser(userId);
  }

  /** Unblock a user. */
  async unblockUser(userId: string) {
    const [updated] = await db
      .update(users)
      .set({ isBlocked: false, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) throw new NotFoundError('👤 User not found.');
  }

  /** Update a user's role (admin only). */
  async updateRole(userId: string, role: 'user' | 'admin') {
    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) throw new NotFoundError('👤 User not found.');

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
    };
  }

  /** Get login activity for a user. */
  async getLoginActivity(userId: string, limit = 20) {
    return db.query.loginActivity.findMany({
      where: eq(loginActivity.userId, userId),
      orderBy: (la, { desc }) => [desc(la.createdAt)],
      limit,
    });
  }
}

export const userService = new UserService();
