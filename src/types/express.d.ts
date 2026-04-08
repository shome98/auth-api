// ─── Extend Express Request with auth properties ─────────
declare global {
  namespace Express {
    interface Request {
      /** Authenticated user (set by authenticate middleware) */
      user?: {
        id: string;
        email: string;
        name: string | null;
        image: string | null;
        role: "user" | "admin";
        emailVerified: boolean;
      };
      /** Current session token */
      sessionToken?: string;
      /** Authenticated userId — shorthand from JWT payload */
      userId?: string;
      /** Guest ID from database */
      guestId?: string;
      /** Guest session token from cookie */
      guestToken?: string;
    }
  }
}

export {};
