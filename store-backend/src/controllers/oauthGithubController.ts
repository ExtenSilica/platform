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
  buildGithubAuthorizeUrl,
  githubExchangeCodeForToken,
  resolveGithubCanonicalIdentity,
} from "../services/providers/githubOAuthHttp";

/**
 * GET /auth/github/start
 */
export async function githubOAuthStart(_req: Request, res: Response): Promise<void> {
  const gh = oauthConfig.github;
  if (!gh.enabled) {
    res.status(503).json({ error: "GitHub OAuth is not configured." });
    return;
  }
  if (!isOAuthStateSecretConfigured()) {
    res.status(503).json({
      error: "GitHub OAuth state signing is not configured. Set OAUTH_STATE_SECRET (min 16 characters).",
    });
    return;
  }

  const state = createOAuthStateNonce();
  try {
    setOAuthStateCookie(res, "github", state);
  } catch (e) {
    console.error("[oauth/github/start] cookie", e);
    res.status(500).json({ error: "OAuth initialization failed." });
    return;
  }

  res.redirect(
    302,
    buildGithubAuthorizeUrl({ clientId: gh.clientId, callbackUrl: gh.callbackUrl, state }),
  );
}

/**
 * GET /auth/github/callback
 */
export async function githubOAuthCallback(req: Request, res: Response): Promise<void> {
  const gh = oauthConfig.github;
  if (!gh.enabled || !isOAuthStateSecretConfigured()) {
    clearOAuthStateCookie(res, "github");
    redirectOAuthLoginError(res, "github_disabled");
    return;
  }

  const err = typeof req.query.error === "string" ? req.query.error : undefined;
  if (err) {
    clearOAuthStateCookie(res, "github");
    redirectOAuthLoginError(res, "github_denied");
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
  if (!code || !verifyOAuthStateCookie(req, "github")) {
    clearOAuthStateCookie(res, "github");
    redirectOAuthLoginError(res, "invalid_state");
    return;
  }

  clearOAuthStateCookie(res, "github");

  let accessToken: string | null;
  try {
    accessToken = await githubExchangeCodeForToken(code, gh.clientId, gh.clientSecret, gh.callbackUrl);
  } catch (e) {
    console.error("[oauth/github/callback] token exchange", e);
    redirectOAuthLoginError(res, "github_token_exchange");
    return;
  }
  if (!accessToken) {
    redirectOAuthLoginError(res, "github_token_exchange");
    return;
  }

  let resolved;
  try {
    resolved = await resolveGithubCanonicalIdentity(accessToken);
  } catch (e) {
    console.error("[oauth/github/callback] identity", e);
    redirectOAuthLoginError(res, "github_profile");
    return;
  }
  if (!resolved.ok) {
    redirectOAuthLoginError(res, resolved.reason === "no_email" ? "github_no_email" : "github_profile");
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
