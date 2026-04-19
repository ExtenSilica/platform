import { Request, Response } from "express";
import { oauthConfig } from "../config/oauth";
import {
  createOAuthStateNonce,
  setOAuthStateCookie,
  clearOAuthStateCookie,
  verifyOAuthStateCookie,
  isOAuthStateSecretConfigured,
} from "../services/oauthStateService";
import {
  redirectOAuthLoginError,
  redirectOAuthLoginSuccess,
  createOAuthBrowserHandoff,
} from "../services/oauthService";
import { signInOrRegisterOAuthUser } from "../services/oauthUserService";
import {
  buildGoogleAuthorizeUrl,
  googleExchangeCodeForToken,
  resolveGoogleCanonicalIdentity,
} from "../services/providers/googleOAuthHttp";

/**
 * GET /auth/google/start
 */
export async function googleOAuthStart(_req: Request, res: Response): Promise<void> {
  const g = oauthConfig.google;
  if (!g.enabled) {
    res.status(503).json({ error: "Google OAuth is not configured." });
    return;
  }
  if (!isOAuthStateSecretConfigured()) {
    res.status(503).json({
      error: "Google OAuth state signing is not configured. Set OAUTH_STATE_SECRET (min 16 characters).",
    });
    return;
  }

  const state = createOAuthStateNonce();
  try {
    setOAuthStateCookie(res, "google", state);
  } catch (e) {
    console.error("[oauth/google/start] cookie", e);
    res.status(500).json({ error: "OAuth initialization failed." });
    return;
  }

  res.redirect(
    302,
    buildGoogleAuthorizeUrl({ clientId: g.clientId, callbackUrl: g.callbackUrl, state }),
  );
}

/**
 * GET /auth/google/callback
 */
export async function googleOAuthCallback(req: Request, res: Response): Promise<void> {
  const g = oauthConfig.google;
  if (!g.enabled || !isOAuthStateSecretConfigured()) {
    clearOAuthStateCookie(res, "google");
    redirectOAuthLoginError(res, "google_disabled");
    return;
  }

  const err = typeof req.query.error === "string" ? req.query.error : undefined;
  if (err) {
    clearOAuthStateCookie(res, "google");
    redirectOAuthLoginError(res, "google_denied");
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
  if (!code || !verifyOAuthStateCookie(req, "google")) {
    clearOAuthStateCookie(res, "google");
    redirectOAuthLoginError(res, "invalid_state");
    return;
  }

  clearOAuthStateCookie(res, "google");

  let accessToken: string | null;
  try {
    accessToken = await googleExchangeCodeForToken(code, g.clientId, g.clientSecret, g.callbackUrl);
  } catch (e) {
    console.error("[oauth/google/callback] token exchange", e);
    redirectOAuthLoginError(res, "google_token_exchange");
    return;
  }
  if (!accessToken) {
    redirectOAuthLoginError(res, "google_token_exchange");
    return;
  }

  let resolved;
  try {
    resolved = await resolveGoogleCanonicalIdentity(accessToken);
  } catch (e) {
    console.error("[oauth/google/callback] identity", e);
    redirectOAuthLoginError(res, "google_profile");
    return;
  }
  if (!resolved.ok) {
    redirectOAuthLoginError(res, resolved.reason === "no_email" ? "google_no_email" : "google_profile");
    return;
  }

  const signIn = await signInOrRegisterOAuthUser(resolved.identity);
  if (!signIn.ok) {
    redirectOAuthLoginError(res, signIn.error === "email_exists" ? "email_exists" : "server_error");
    return;
  }

  const handoff = createOAuthBrowserHandoff(signIn.user.apiToken!, signIn.user);
  redirectOAuthLoginSuccess(res, handoff);
}
