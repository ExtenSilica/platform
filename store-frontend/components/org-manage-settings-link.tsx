"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiGetMyOrgs } from "@/lib/api";

/**
 * On the public org profile: if the viewer is logged in as an owner or admin
 * of this org, show a link to the dashboard where icon URL and other fields
 * can be edited.
 */
export function OrgManageSettingsLink({ orgSlug }: { orgSlug: string }) {
  const { token } = useAuth();
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    if (!token) {
      setCanManage(false);
      return;
    }
    let cancelled = false;
    apiGetMyOrgs(token)
      .then((orgs) => {
        if (cancelled) return;
        const m = orgs.find((o) => o.slug === orgSlug);
        setCanManage(!!m && (m.role === "owner" || m.role === "admin"));
      })
      .catch(() => {
        if (!cancelled) setCanManage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, orgSlug]);

  if (!canManage) return null;

  return (
    <Link
      href="/dashboard?tab=orgs"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Settings className="h-3.5 w-3.5 shrink-0" />
      Manage organization
    </Link>
  );
}
