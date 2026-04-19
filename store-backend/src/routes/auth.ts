import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { register, login, logout, me, updateMe, changePassword, forgotPassword, resetPassword, uploadAvatar } from '../controllers/authController';
import { githubOAuthStart, githubOAuthCallback } from '../controllers/oauthGithubController';
import { oauthBrowserExchange } from '../services/oauthService';
import { googleOAuthStart, googleOAuthCallback } from '../controllers/oauthGoogleController';
import { getMyOrgs } from '../controllers/orgsController';
import { requireAuth } from '../middleware/auth';

/**
 * Rate limiters for sensitive auth endpoints.
 * In-memory (per-process); sufficient for single-instance deployments.
 * Swap the store for redis-rate-limit when running multiple instances.
 */
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // max 5 registrations per IP per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again in 15 minutes.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 login attempts per IP per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // max 5 reset emails per IP per hour (prevent email bombing)
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again in 1 hour.' },
});

const githubOAuthStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many OAuth attempts. Please try again in 15 minutes.' },
});

const googleOAuthStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many OAuth attempts. Please try again in 15 minutes.' },
});

const oauthBrowserExchangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many OAuth exchange attempts. Please try again in 15 minutes.' },
});

// Multer: store in uploads/tmp while we validate, then move to uploads/avatars/.
const tmpDir = path.join(__dirname, '../../uploads/tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const avatarUpload = multer({
  dest: tmpDir,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }, // 2 MB hard limit
});

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Create a new user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: alice
 *               email:
 *                 type: string
 *                 example: alice@example.com
 *               password:
 *                 type: string
 *                 example: hunter2hunter2
 *     responses:
 *       201:
 *         description: Account created. Returns token and user profile.
 *       400:
 *         description: Validation error.
 *       409:
 *         description: Username or email already taken.
 */
router.post('/register', registerLimiter, register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate and receive an API token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful. Returns fresh token and user profile.
 *       401:
 *         description: Invalid credentials.
 */
router.post('/login', loginLimiter, login);

/** GitHub OAuth: redirect to GitHub authorize URL (sets signed state cookie). */
router.get('/github/start', githubOAuthStartLimiter, (req, res) => {
  void githubOAuthStart(req, res);
});

/** GitHub OAuth: provider redirects here; validates state, creates session, redirects to SITE_URL/login?oauth_code=… */
router.get('/github/callback', (req, res) => {
  void githubOAuthCallback(req, res);
});

/** Google OAuth: redirect to Google authorization URL (sets signed state cookie). */
router.get('/google/start', googleOAuthStartLimiter, (req, res) => {
  void googleOAuthStart(req, res);
});

/** Google OAuth: provider redirects here; same handoff as GitHub (`oauth_code` + POST /auth/oauth/exchange). */
router.get('/google/callback', (req, res) => {
  void googleOAuthCallback(req, res);
});

/** Exchange one-time oauth_code from redirect for { token, user } (same shape as POST /auth/login). */
router.post('/oauth/exchange', oauthBrowserExchangeLimiter, (req, res) => {
  void oauthBrowserExchange(req, res);
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Invalidate the current API token
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out. Token is immediately invalid.
 *       401:
 *         description: Not authenticated.
 */
router.post('/logout', requireAuth, logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Return the authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile (no password hash, no token).
 *       401:
 *         description: Not authenticated.
 */
router.get('/me', requireAuth, me);
router.get('/me/orgs', requireAuth, getMyOrgs);

/**
 * @swagger
 * /auth/me:
 *   patch:
 *     summary: Update the authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bio:
 *                 type: string
 *                 maxLength: 300
 *                 nullable: true
 *                 example: "RISC-V enthusiast and open hardware contributor"
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *                 maxLength: 500
 *                 nullable: true
 *                 example: "https://avatars.githubusercontent.com/u/1234"
 *     responses:
 *       200:
 *         description: Updated user profile.
 *       400:
 *         description: Validation error (bio too long, invalid URL, nothing to update).
 *       401:
 *         description: Not authenticated.
 */
router.patch('/me', requireAuth, updateMe);

/**
 * @swagger
 * /auth/me/password:
 *   patch:
 *     summary: Change the authenticated user's password
 *     description: >
 *       Verifies the current password, replaces the password hash, and rotates
 *       the API token. All existing sessions (other devices/CLI) are immediately
 *       invalidated. The response includes the new token so the calling client
 *       can update its stored credential without logging out.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "hunter2hunter2"
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 example: "correcthorsebatterystaple"
 *     responses:
 *       200:
 *         description: Password changed. Returns new API token and updated user profile.
 *       400:
 *         description: Validation error (too short, same as current, missing fields).
 *       401:
 *         description: Current password is incorrect, or not authenticated.
 */
router.patch('/me/password', requireAuth, changePassword);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     description: >
 *       Sends a one-time reset link to the address if it is registered.
 *       Always returns 200 to prevent email enumeration.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: alice@example.com
 *     responses:
 *       200:
 *         description: Reset email queued (or silently skipped if address not found).
 */
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Complete a password reset using the emailed token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Raw token received in the reset email
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset. All sessions invalidated; please sign in.
 *       400:
 *         description: Token invalid/expired, or password too short.
 */
router.post('/reset-password', resetPassword);

/**
 * @swagger
 * /auth/me/avatar:
 *   post:
 *     summary: Upload or replace the authenticated user's avatar
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Image file (JPEG, PNG, WebP, or GIF — max 2 MB)
 *     responses:
 *       200:
 *         description: Avatar saved. Returns updated user profile with new avatarUrl.
 *       400:
 *         description: No file, unsupported type, or file too large.
 *       401:
 *         description: Not authenticated.
 */
router.post('/me/avatar', requireAuth, avatarUpload.single('avatar'), uploadAvatar);

export default router;
