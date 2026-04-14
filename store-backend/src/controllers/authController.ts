import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db';
import { sendPasswordResetEmail } from '../mailer';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

const BCRYPT_ROUNDS = 12;

// Characters allowed in usernames: lowercase letters, digits, hyphens, underscores.
const USERNAME_RE = /^[a-z0-9_-]{2,32}$/;

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function sanitizeUser(user: {
  id: number;
  username: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * POST /auth/register
 * Body: { username, email, password }
 * Returns: { token, user }
 */
export async function register(req: Request, res: Response): Promise<void> {
  const { username, email, password } = req.body ?? {};

  if (!username || !email || !password) {
    res.status(400).json({ error: 'username, email, and password are required.' });
    return;
  }

  if (!USERNAME_RE.test(username)) {
    res.status(400).json({
      error: 'username must be 2–32 characters and contain only lowercase letters, digits, hyphens, or underscores.',
    });
    return;
  }

  if (typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }

  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] },
    });
    if (existing) {
      const field = existing.email === email.toLowerCase() ? 'email' : 'username';
      res.status(409).json({ error: `That ${field} is already registered.` });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const apiToken = generateToken();

    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        passwordHash,
        apiToken,
      },
    });

    res.status(201).json({ token: apiToken, user: sanitizeUser(user) });
  } catch (err) {
    console.error('[auth/register]', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
}

/**
 * POST /auth/login
 * Body: { email, password }
 * Returns: { token, user }
 * Generates a fresh token on every successful login.
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required.' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Use a constant-time comparison even on "not found" to prevent user enumeration.
    const hashToCheck = user?.passwordHash ?? '$2b$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const valid = await bcrypt.compare(password, hashToCheck);

    if (!user || !valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const apiToken = generateToken();
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { apiToken },
    });

    res.json({ token: apiToken, user: sanitizeUser(updated) });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

/**
 * POST /auth/logout
 * Requires: Authorization: Bearer <token>
 * Clears the API token so the credential is immediately invalidated.
 */
export async function logout(req: Request, res: Response): Promise<void> {
  // req.user is attached by the authenticate middleware; requireAuth ensures it exists.
  const userId = req.user!.id;
  try {
    await prisma.user.update({ where: { id: userId }, data: { apiToken: null } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth/logout]', err);
    res.status(500).json({ error: 'Logout failed.' });
  }
}

/**
 * GET /auth/me
 * Requires: Authorization: Bearer <token>
 * Returns the authenticated user's public profile. Never returns passwordHash or apiToken.
 */
export async function me(req: Request, res: Response): Promise<void> {
  res.json({ user: req.user });
}

/**
 * PATCH /auth/me/password
 * Requires: Authorization: Bearer <token>
 * Body: { currentPassword, newPassword }
 * Verifies the current password, then replaces the hash and rotates the API
 * token (all other sessions are immediately invalidated). Returns the new token
 * so the calling client can update its stored credential without logging out.
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body ?? {};

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword and newPassword are required.' });
    return;
  }

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    res.status(400).json({ error: 'Passwords must be strings.' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters.' });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({ error: 'New password must differ from the current password.' });
    return;
  }

  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const [newHash, newToken] = await Promise.all([
      bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      Promise.resolve(generateToken()),
    ]);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, apiToken: newToken },
    });

    // Return the new token so the client can swap it without logging out.
    res.json({ token: newToken, user: sanitizeUser(updated) });
  } catch (err) {
    console.error('[auth/changePassword]', err);
    res.status(500).json({ error: 'Password change failed. Please try again.' });
  }
}

/**
 * PATCH /auth/me
 * Requires: Authorization: Bearer <token>
 * Body: { bio?, avatarUrl? }
 * Updates the authenticated user's bio and/or avatarUrl.
 */
export async function updateMe(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { bio, avatarUrl } = req.body ?? {};

  const patch: { bio?: string | null; avatarUrl?: string | null } = {};

  if (bio !== undefined) {
    if (bio === null || bio === '') {
      patch.bio = null;
    } else if (typeof bio !== 'string') {
      res.status(400).json({ error: 'bio must be a string.' });
      return;
    } else {
      const trimmed = bio.trim();
      if (trimmed.length > 300) {
        res.status(400).json({ error: 'bio must be 300 characters or fewer.' });
        return;
      }
      patch.bio = trimmed || null;
    }
  }

  if (avatarUrl !== undefined) {
    if (avatarUrl === null || avatarUrl === '') {
      patch.avatarUrl = null;
    } else if (typeof avatarUrl !== 'string') {
      res.status(400).json({ error: 'avatarUrl must be a string.' });
      return;
    } else {
      const trimmed = avatarUrl.trim();
      try {
        new URL(trimmed);
      } catch {
        res.status(400).json({ error: 'avatarUrl must be a valid URL.' });
        return;
      }
      if (trimmed.length > 500) {
        res.status(400).json({ error: 'avatarUrl must be 500 characters or fewer.' });
        return;
      }
      patch.avatarUrl = trimmed;
    }
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'Nothing to update. Provide bio or avatarUrl.' });
    return;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: patch,
    });
    res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    console.error('[auth/updateMe]', err);
    res.status(500).json({ error: 'Profile update failed. Please try again.' });
  }
}

/**
 * POST /auth/forgot-password
 * Body: { email }
 * Generates a time-limited reset token, stores its SHA-256 hash, and emails
 * the raw token to the user. Always returns 200 to prevent email enumeration.
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body ?? {};

  // Always respond 200 — never reveal whether an address is registered.
  const OK = { ok: true, message: 'If that address is registered you will receive a reset link shortly.' };

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.json(OK);
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      res.json(OK);
      return;
    }

    // Invalidate any existing unused tokens for this user.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = generateToken();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    await sendPasswordResetEmail(user.email, user.username, rawToken);
  } catch (err) {
    // Log but do not leak — the response is always the same.
    console.error('[auth/forgotPassword]', err);
  }

  res.json(OK);
}

/**
 * POST /auth/reset-password
 * Body: { token, newPassword }
 * Validates the reset token, updates the password hash, rotates the API token.
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body ?? {};

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'token is required.' });
    return;
  }

  if (!newPassword || typeof newPassword !== 'string') {
    res.status(400).json({ error: 'newPassword is required.' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters.' });
    return;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
      res.status(400).json({ error: 'This reset link is invalid or has expired.' });
      return;
    }

    const [newHash, newApiToken] = await Promise.all([
      bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      Promise.resolve(generateToken()),
    ]);

    // Mark token used and update credentials atomically.
    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: newHash, apiToken: newApiToken },
      }),
    ]);

    res.json({ ok: true, message: 'Password reset successfully. Please sign in.' });
  } catch (err) {
    console.error('[auth/resetPassword]', err);
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
}

/**
 * POST /auth/me/avatar
 * Requires: Authorization: Bearer <token>
 * Content-Type: multipart/form-data  (field name: "avatar")
 * Accepts: image/jpeg, image/png, image/webp, image/gif — max 2 MB
 *
 * Stores the file as uploads/avatars/<userId>.<ext>, replacing any previous
 * avatar for that user, and updates the avatarUrl on the User row.
 */
export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  const user = req.user!;

  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded. Send an image in the "avatar" field.' });
    return;
  }

  const { mimetype, size, path: tmpPath } = req.file;

  // Validate MIME type.
  if (!ALLOWED_MIME.has(mimetype)) {
    fs.unlinkSync(tmpPath);
    res.status(400).json({ error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' });
    return;
  }

  // Validate size (multer limits are advisory; double-check here).
  if (size > MAX_AVATAR_BYTES) {
    fs.unlinkSync(tmpPath);
    res.status(400).json({ error: 'Image too large. Maximum size is 2 MB.' });
    return;
  }

  // Derive extension from MIME type.
  const extMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'image/webp': '.webp',
    'image/gif':  '.gif',
  };
  const ext = extMap[mimetype];

  // Destination: uploads/avatars/<userId><ext>  (one file per user — auto-replaces old avatar)
  const avatarsDir = path.join(path.dirname(tmpPath), '../avatars');
  if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

  const destFilename = `${user.id}${ext}`;
  const destPath = path.join(avatarsDir, destFilename);

  // Remove any existing avatar files for this user (other extensions).
  for (const candidate of fs.readdirSync(avatarsDir)) {
    if (candidate.startsWith(`${user.id}.`) && candidate !== destFilename) {
      fs.unlinkSync(path.join(avatarsDir, candidate));
    }
  }

  fs.renameSync(tmpPath, destPath);

  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  const avatarUrl = `${baseUrl}/uploads/avatars/${destFilename}`;

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl },
    });
    res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    console.error('[auth/uploadAvatar]', err);
    res.status(500).json({ error: 'Failed to save avatar. Please try again.' });
  }
}
