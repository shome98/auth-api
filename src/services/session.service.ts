import { db } from '../db';
import { sessions } from '../db/schema';
import { eq, lt, asc, inArray } from 'drizzle-orm';
import { generateSecureToken, hashToken } from '../utils/crypto';
import { env } from '../config/env';

// 🔑 Session Service

/** Maximum concurrent sessions per user. Oldest are evicted. */
const MAX_SESSIONS_PER_USER = 5;

class SessionService {
  /** Create a new session for a user and return the session row + raw token. */
  async createSession(userId: string, ipAddress?: string, userAgent?: string) {
    // Enforce session limit — evict oldest when at capacity
    const existing = await db.query.sessions.findMany({
      where: eq(sessions.userId, userId),
      orderBy: [asc(sessions.createdAt)],
      columns: { id: true },
    });

    if (existing.length >= MAX_SESSIONS_PER_USER) {
      const toEvict = existing.slice(
        0,
        existing.length - MAX_SESSIONS_PER_USER + 1,
      );
      await db.delete(sessions).where(
        inArray(
          sessions.id,
          toEvict.map((s) => s.id),
        ),
      );
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    );

    const [session] = await db
      .insert(sessions)
      .values({
        userId,
        token: tokenHash,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        expiresAt,
      })
      .returning();

    // Return raw token separately — the DB stores only the hash
    return { ...session, rawToken };
  }

  /** Delete a single session by token (logout). */
  async deleteSession(token: string) {
    await db.delete(sessions).where(eq(sessions.token, hashToken(token)));
  }

  /** Delete ALL sessions for a user (e.g. after password reset). */
  async deleteAllUserSessions(userId: string) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  /** Delete all sessions for a user EXCEPT the given session (by hashed token). */
  async deleteOtherUserSessions(userId: string, currentRawToken: string) {
    const currentHash = hashToken(currentRawToken);
    const all = await db.query.sessions.findMany({
      where: eq(sessions.userId, userId),
      columns: { id: true, token: true },
    });
    const toDelete = all.filter((s) => s.token !== currentHash);
    if (toDelete.length > 0) {
      await db.delete(sessions).where(
        inArray(
          sessions.id,
          toDelete.map((s) => s.id),
        ),
      );
    }
  }

  /** Rotate a session: delete old, create new. Returns new session. */
  async rotateSession(
    oldToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const old = await db.query.sessions.findFirst({
      where: eq(sessions.token, hashToken(oldToken)),
    });
    if (!old) return null;

    await db.delete(sessions).where(eq(sessions.id, old.id));
    return this.createSession(old.userId, ipAddress, userAgent);
  }

  /** Cleanup all expired sessions (call periodically). */
  async cleanupExpired() {
    const result = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, new Date()));
    return result;
  }
}

export const sessionService = new SessionService();
