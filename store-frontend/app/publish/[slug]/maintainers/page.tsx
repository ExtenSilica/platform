"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { fetchPackage, fetchMaintainers, apiAddMaintainer, apiRemoveMaintainer, ApiError } from "@/lib/api";
import type { RegistryPackage } from "@/lib/types";
import type { Maintainer } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft, ChevronRight, UserPlus, Trash2,
  Shield, AlertCircle, User,
} from "lucide-react";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function MaintainersPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [pkg, setPkg] = useState<RegistryPackage | null>(null);
  const [maintainers, setMaintainers] = useState<Maintainer[]>([]);
  const [loading, setLoading] = useState(true);

  const [addUsername, setAddUsername] = useState("");
  const [addError, setAddError] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [removeId, setRemoveId] = useState<number | null>(null);
  const [removeError, setRemoveError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?next=/publish/${slug}/maintainers`);
    }
  }, [user, isLoading, router, slug]);

  useEffect(() => {
    Promise.all([fetchPackage(slug), fetchMaintainers(slug)])
      .then(([p, ms]) => {
        if (!p) { router.replace("/dashboard"); return; }
        setPkg(p);
        setMaintainers(ms);
      })
      .catch(() => router.replace("/dashboard"))
      .finally(() => setLoading(false));
  }, [slug, router]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !addUsername.trim()) return;
    setAddError("");
    setAddSubmitting(true);
    try {
      const m = await apiAddMaintainer(token, slug, addUsername.trim());
      setMaintainers((ms) => [...ms, m]);
      setAddUsername("");
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : "Failed to add maintainer.");
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleRemove(userId: number) {
    if (!token) return;
    setRemoveError("");
    setRemoveId(userId);
    try {
      await apiRemoveMaintainer(token, slug, userId);
      setMaintainers((ms) => ms.filter((m) => m.userId !== userId));
    } catch (err) {
      setRemoveError(err instanceof ApiError ? err.message : "Failed to remove maintainer.");
    } finally {
      setRemoveId(null);
    }
  }

  const isOwner = pkg?.ownerId === user?.id;

  if (isLoading || loading || !user || !pkg) {
    return (
      <div className="container max-w-2xl px-4 py-10 animate-pulse space-y-4">
        <div className="h-6 w-40 rounded bg-muted" />
        <div className="h-40 rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl px-4 py-10">
      <Link
        href="/dashboard"
        className="-ml-1 mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/package/${slug}`} className="hover:text-foreground">
            {pkg.name}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Maintainers</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Maintainers can publish new versions and edit package metadata. Only
          the owner can add or remove maintainers.
        </p>
      </div>

      {/* Owner */}
      <section className="mb-6 rounded-xl border bg-background p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Owner
        </p>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-primary text-xs font-bold uppercase text-primary-foreground">
            {pkg.author?.charAt(0) ?? "?"}
          </div>
          <div>
            <p className="font-medium">@{pkg.author}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              Package owner
            </div>
          </div>
        </div>
      </section>

      {/* Maintainer list */}
      <section className="mb-6 rounded-xl border bg-background p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Maintainers ({maintainers.length})
        </p>

        {removeError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{removeError}</AlertDescription>
          </Alert>
        )}

        {maintainers.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 py-10 text-center">
            <User className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No additional maintainers yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {maintainers.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border bg-muted/10 p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-bold uppercase text-muted-foreground">
                  {m.username.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">@{m.username}</p>
                  <p className="text-xs text-muted-foreground">
                    Added {fmt(m.addedAt)}
                  </p>
                </div>
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 text-destructive hover:border-destructive/50 hover:bg-destructive/10"
                    onClick={() => handleRemove(m.userId)}
                    disabled={removeId === m.userId}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {removeId === m.userId ? "Removing…" : "Remove"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add maintainer */}
      {isOwner && (
        <section className="rounded-xl border bg-background p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Add a maintainer
          </p>

          {addError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{addError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleAdd} className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                @
              </span>
              <Input
                placeholder="username"
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value.toLowerCase())}
                className="pl-7"
                required
              />
            </div>
            <Button type="submit" disabled={addSubmitting} className="gap-2 shrink-0">
              <UserPlus className="h-4 w-4" />
              {addSubmitting ? "Adding…" : "Add"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            The user must have an existing ExtenSilica account.
          </p>
        </section>
      )}

      {!isOwner && (
        <Alert className="mt-4">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Only the package owner can add or remove maintainers.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
