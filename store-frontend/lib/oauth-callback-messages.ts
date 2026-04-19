/** Human-readable copy for `?oauth_error=` codes from the registry OAuth callback. */
export function oauthCallbackErrorMessage(code: string): string {
  const map: Record<string, string> = {
    invalid_state: "That sign-in link expired or was invalid. Please try again.",
    email_exists:
      "That email is already registered with a password account. Sign in with email and password, or use a different Google/GitHub account.",
    github_disabled: "GitHub sign-in is not available on this server.",
    google_disabled: "Google sign-in is not available on this server.",
    github_denied: "GitHub sign-in was cancelled.",
    google_denied: "Google sign-in was cancelled.",
    github_token_exchange: "Could not complete GitHub sign-in. Please try again.",
    google_token_exchange: "Could not complete Google sign-in. Please try again.",
    github_profile: "Could not read your GitHub profile. Please try again.",
    google_profile: "Could not read your Google profile. Please try again.",
    github_no_email: "GitHub did not provide a verified email. Grant email access or use another method.",
    google_no_email: "Google did not provide a verified email. Use another method.",
    server_error: "Something went wrong during sign-in. Please try again later.",
  };
  return map[code] ?? "Sign-in could not be completed. Try again or use email and password.";
}
