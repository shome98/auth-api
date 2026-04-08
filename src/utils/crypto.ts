import crypto from "crypto";

// ═══════════════════════════════════════════════════════════
// 🔐 Cryptographic Token Utilities
// ═══════════════════════════════════════════════════════════

/**
 * Generate a cryptographically secure random hex token.
 * Default: 32 bytes → 64 hex characters.
 */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Generate a URL-safe base64 token (good for URLs / cookies).
 * Default: 48 bytes → 64 base64url characters.
 */
export function generateSecureToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Hash a token with SHA-256 for secure database storage.
 * Raw tokens are sent to users via email/cookie; only hashes are stored.
 * This prevents token theft via database compromise.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
