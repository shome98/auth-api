import { db } from '../db';
import { guests } from '../db/schema';
import { eq, lt } from 'drizzle-orm';
import { generateSecureToken, hashToken } from '../utils/crypto';
import { env } from '../config/env';

// 👻 Guest Service
// Manages guest sessions for pre-login features (cart, prefs)

class GuestService {
  /** Create a new guest session and return it with raw token. */
  async createGuestSession() {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + env.GUEST_SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    );

    const [guest] = await db
      .insert(guests)
      .values({ sessionToken: tokenHash, data: {}, expiresAt })
      .returning();

    return { ...guest, rawToken };
  }

  /** Look up a guest by raw session token. Returns null if expired/missing. */
  async getGuestByToken(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const guest = await db.query.guests.findFirst({
      where: eq(guests.sessionToken, tokenHash),
    });

    if (!guest) return null;

    if (guest.expiresAt < new Date()) {
      await db.delete(guests).where(eq(guests.id, guest.id));
      return null;
    }

    return guest;
  }

  /** Merge / update guest data (shallow merge). */
  async updateGuestData(token: string, data: Record<string, unknown>) {
    const guest = await this.getGuestByToken(token);
    if (!guest) return null;

    const merged = {
      ...(guest.data as Record<string, unknown>),
      ...data,
    };

    const [updated] = await db
      .update(guests)
      .set({ data: merged })
      .where(eq(guests.id, guest.id))
      .returning();

    return updated;
  }

  /**
   * Delete the guest session on login.
   * Returns the guest data so the caller can apply domain-specific
   * merge logic if needed (e.g. cart items → user cart).
   */
  async deleteGuestOnLogin(guestToken: string) {
    const guest = await this.getGuestByToken(guestToken);
    if (!guest) return null;

    const guestData = guest.data as Record<string, unknown>;

    // Delete guest record after extracting data
    await db.delete(guests).where(eq(guests.id, guest.id));

    return guestData;
  }

  /** Delete a guest session by raw token. */
  async deleteGuestSession(rawToken: string) {
    await db.delete(guests).where(eq(guests.sessionToken, hashToken(rawToken)));
  }

  /** Cleanup all expired guest sessions (call periodically). */
  async cleanupExpired() {
    await db.delete(guests).where(lt(guests.expiresAt, new Date()));
  }
}

export const guestService = new GuestService();
