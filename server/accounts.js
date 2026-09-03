// Lightweight name-claim passwords + the admin check. Everything here lives
// in memory only -- like every other piece of server state in this game, it
// resets on restart. That's a deliberate trade-off (see README) rather than
// an oversight: a real persistent account system needs a real database,
// which is a much bigger project than a casual tag game calls for.

import crypto from 'node:crypto';

/** name.toLowerCase() -> { hash, salt, displayName } */
const claims = new Map();

function hash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Try to use `name` with an optional `password`.
 *   - Unclaimed name, no password: anyone can use it, first come first served
 *     each time -- no protection, matches how the game worked before.
 *   - Unclaimed name, with a password: claims it right now for that password.
 *   - Claimed name, matching password: succeeds.
 *   - Claimed name, wrong or missing password: fails -- caller should pick a
 *     different name rather than let someone borrow it.
 */
export function claimName(name, password) {
  const key = name.toLowerCase();
  const existing = claims.get(key);

  if (!existing) {
    if (password) {
      const salt = crypto.randomBytes(16).toString('hex');
      claims.set(key, { hash: hash(password, salt), salt, displayName: name });
    }
    return { ok: true };
  }

  if (!password || !timingSafeStringEqual(hash(password, existing.salt), existing.hash)) {
    return { ok: false };
  }
  return { ok: true };
}

export function isNameClaimed(name) {
  return claims.has(name.toLowerCase());
}

/** Timing-safe compare against the server owner's private ADMIN_PASSWORD env var. */
export function checkAdminPassword(password) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real || !password) return false;
  return timingSafeStringEqual(password, real);
}
