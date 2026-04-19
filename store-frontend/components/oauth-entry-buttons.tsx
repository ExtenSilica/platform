"use client";

import { Github } from "lucide-react";
import { getRegistryOrigin } from "@/lib/api";
import { cn } from "@/lib/utils";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={cn("shrink-0", className)}
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const oauthLinkClass =
  "inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background";

/** Horizontal rule with centered label (e.g. between SSO and email form). */
export function AuthMethodDivider({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn("relative py-3", className)}
      role="separator"
      aria-label={children}
    >
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs font-medium">
        <span className="bg-background px-3 text-muted-foreground">{children}</span>
      </div>
    </div>
  );
}

export type OauthProviderLinksProps = {
  className?: string;
};

/** GitHub + Google registry OAuth start links (no divider). */
export function OauthProviderLinks({ className }: OauthProviderLinksProps) {
  const origin = getRegistryOrigin();

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <a
        href={`${origin}/auth/github/start`}
        className={cn(
          oauthLinkClass,
          "bg-zinc-900 text-zinc-50 shadow-sm hover:bg-zinc-800",
          "dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-50"
        )}
      >
        <Github className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
        GitHub
      </a>
      <a
        href={`${origin}/auth/google/start`}
        className={cn(
          oauthLinkClass,
          "border border-input bg-background text-foreground shadow-sm",
          "hover:bg-muted/50 dark:hover:bg-muted/30"
        )}
      >
        <GoogleMark />
        Google
      </a>
    </div>
  );
}
