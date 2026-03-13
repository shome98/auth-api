import { db } from '../db';
import { loginActivity } from '../db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';

// 📋 Login Activity Service  (audit trail)

class LoginActivityService {
  /** Record a login attempt (success or failure). */
  async record(
    userId: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
  ) {
    await db.insert(loginActivity).values({
      userId,
      ipAddress,
      userAgent,
      success,
    });
  }

  /** Count consecutive failed login attempts within a time window. */
  async countRecentFailures(userId: string, windowMs: number): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    const rows = await db.query.loginActivity.findMany({
      where: and(
        eq(loginActivity.userId, userId),
        eq(loginActivity.success, false),
        gte(loginActivity.createdAt, since),
      ),
      columns: { id: true },
    });
    return rows.length;
  }

  /** Delete login activity older than the given number of days. */
  async cleanupOlderThan(days: number) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    await db.delete(loginActivity).where(lt(loginActivity.createdAt, cutoff));
  }

  /** Get login history for a user (most recent first). */
  async getByUserId(userId: string, limit = 20) {
    return db.query.loginActivity.findMany({
      where: eq(loginActivity.userId, userId),
      orderBy: (la, { desc }) => [desc(la.createdAt)],
      limit,
    });
  }
}

export const loginActivityService = new LoginActivityService();
