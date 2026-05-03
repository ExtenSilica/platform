"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { fetchPackage, apiUpdatePackage, apiYankVersion, ApiError } from "@/lib/api";
import type { RegistryPackage, RegistryVersion } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ChevronRight, CheckCircle2, AlertCircle, Ban, RotateCcw } from "lucide-react";

const LICENSES = [
  "Apache-2.0", "MIT", "GPL-2.0", "GPL-3.0", "LGPL-2.1", "LGPL-3.0",
  "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0", "CC-BY-4.0",
  "CC0-1.0", "Unlicense", "CERN-OHL-W-2.0", "CERN-OHL-S-2.0", "CERN-OHL-P-2.0",
];

export default function PackageSettingsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [pkg, setPkg] = useState<RegistryPackage | null>(null);
  const [loading, setLoading] = useState(true);

  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [license, setLicense] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [isDeprecated, setIsDeprecated] = useState(false);
  const [deprecationMessage, setDeprecationMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Per-version yank state: versionTag → { busy, error, reasonInput, showReasonInput }
  const [yankState, setYankState] = useState<Record<string, {
    busy: boolean;
    error: string;
    reasonInput: string;
    showReasonInput: boolean;
  }>>({});

  function yankStateFor(v: string) {
    return yankState[v] ?? { busy: false, error: "", reasonInput: "", showReasonInput: false };
  }

  function patchYankState(v: string, patch: Partial<typeof yankState[string]>) {
    setYankState((prev) => ({ ...prev, [v]: { ...yankStateFor(v), ...patch } }));
  }

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?next=/publish/${slug}/settings`);
    }
  }, [user, isLoading, router, slug]);

  useEffect(() => {
    fetchPackage(slug)
      .then((p) => {
        if (!p) { router.replace("/dashboard"); return; }
        setPkg(p);
        setDescription(p.description ?? "");
        setShortDescription(p.shortDescription ?? "");
        setLongDescription(p.longDescription ?? "");
        setKeywords(p.keywords?.join(", ") ?? "");
        setLicense(p.license ?? "");
        setRepositoryUrl(p.repositoryUrl ?? "");
        setHomepageUrl(p.homepageUrl ?? "");
        setIconUrl(p.iconUrl ?? "");
        setIsDeprecated(p.isDeprecated);
        setDeprecationMessage(p.deprecationMessage ?? "");
      })
      .catch(() => router.replace("/dashboard"))
      .finally(() => setLoading(false));
  }, [slug, router]);

  const keywordList = keywords.split(",").map((k) => k.trim()).filter(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    setSaved(false);
    setSubmitting(true);
    try {
      const updated = await apiUpdatePackage(token, slug, {
        description: description.trim(),
        shortDescription: shortDescription.trim() || undefined,
        longDescription: longDescription.trim() || undefined,
        keywords: keywords.trim(),
        license: license.trim() || undefined,
        repositoryUrl: repositoryUrl.trim() || undefined,
        homepageUrl: homepageUrl.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
        isDeprecated,
        deprecationMessage: isDeprecated ? (deprecationMessage.trim() || null) : null,
      });
      setPkg(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update package.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleYank(ver: RegistryVersion, yanked: boolean) {
    if (!token) return;
    const vs = yankStateFor(ver.version);
    patchYankState(ver.version, { busy: true, error: "" });
    try {
      const result = await apiYankVersion(
        token, slug, ver.version, yanked,
        yanked ? vs.reasonInput : undefined
      );
      // Update local pkg versions list.
      setPkg((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          latestVersion: result.latestVersion ?? prev.latestVersion,
          versions: prev.versions.map((v) =>
            v.version === ver.version
              ? { ...v, isYanked: result.isYanked, yankReason: result.yankReason }
              : v
          ),
        };
      });
      patchYankState(ver.version, { showReasonInput: false, reasonInput: "" });
    } catch (err) {
      patchYankState(ver.version, {
        error: err instanceof ApiError ? err.message : "Action failed.",
      });
    } finally {
      patchYankState(ver.version, { busy: false });
    }
  }

  if (isLoading || loading || !user || !pkg) {
    return (
      <div className="container max-w-3xl px-4 py-10 animate-pulse space-y-4">
        <div className="h-6 w-40 rounded bg-muted" />
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl px-4 py-10">
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
          <span className="text-foreground font-medium">Settings</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Edit package metadata. Version artifacts are immutable and cannot be changed here.
        </p>
      </div>

      <Alert className="mb-6 border-muted bg-muted/30">
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
        <AlertDescription className="text-muted-foreground">
          New versions accept any supported{" "}
          <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-xs">resolution.mode</code>.
          Resolved tool lines can be checked against registry artifacts before publish; that check is optional and does not block bundled or host-dependent packages.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert className="mb-6 border-emerald-500/30 bg-emerald-500/10">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertDescription className="text-emerald-700 dark:text-emerald-400">
            Package metadata saved.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-4 rounded-xl border bg-background p-6">
          <h2 className="font-semibold">Description</h2>

          <Field
            label="Short description"
            htmlFor="description"
            required
            hint="One sentence. Shown in search results and cards."
          >
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={160}
              required
            />
          </Field>

          <Field label="Tagline" htmlFor="shortDescription" hint="Optional. Shorter subtitle.">
            <Input
              id="shortDescription"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              maxLength={80}
            />
          </Field>

          <Field label="README" htmlFor="longDescription" hint="Markdown. Rendered on the package page.">
            <Textarea
              id="longDescription"
              value={longDescription}
              onChange={(e) => setLongDescription(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </Field>
        </section>

        <section className="space-y-4 rounded-xl border bg-background p-6">
          <h2 className="font-semibold">Discovery</h2>

          <Field
            label="Keywords"
            htmlFor="keywords"
            hint="Comma-separated SPDX/free-form tags."
          >
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="risc-v, rvv, vector"
            />
            {keywordList.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {keywordList.map((k) => (
                  <Badge key={k} variant="muted">{k}</Badge>
                ))}
              </div>
            )}
          </Field>

          <Field label="License" htmlFor="license">
            <Input
              id="license"
              list="license-list"
              placeholder="Apache-2.0"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
            />
            <datalist id="license-list">
              {LICENSES.map((l) => <option key={l} value={l} />)}
            </datalist>
          </Field>
        </section>

        <section className="space-y-4 rounded-xl border bg-background p-6">
          <h2 className="font-semibold">Links</h2>

          <Field label="Repository URL" htmlFor="repositoryUrl">
            <Input
              id="repositoryUrl"
              type="url"
              value={repositoryUrl}
              onChange={(e) => setRepositoryUrl(e.target.value)}
              placeholder="https://github.com/you/my-extension"
            />
          </Field>

          <Field label="Homepage URL" htmlFor="homepageUrl">
            <Input
              id="homepageUrl"
              type="url"
              value={homepageUrl}
              onChange={(e) => setHomepageUrl(e.target.value)}
              placeholder="https://example.com/my-extension"
            />
          </Field>

          <Field label="Icon URL" htmlFor="iconUrl" hint="Direct link to a square image.">
            <Input
              id="iconUrl"
              type="url"
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              placeholder="https://example.com/icon.png"
            />
          </Field>
        </section>

        {/* Version yank management */}
        {pkg.versions && pkg.versions.length > 0 && (
          <section className="space-y-3 rounded-xl border bg-background p-6">
            <div>
              <h2 className="font-semibold">Version management</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Yanked versions are hidden from install commands but remain accessible by exact version.
                Yanking the latest version automatically promotes the next highest non-yanked version.
              </p>
            </div>

            <div className="divide-y rounded-lg border text-sm">
              {[...pkg.versions]
                .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
                .map((ver) => {
                  const vs = yankStateFor(ver.version);
                  const isLatest = ver.version === pkg.latestVersion;
                  return (
                    <div key={ver.version} className="px-4 py-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-medium">{ver.version}</span>
                        {isLatest && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            latest
                          </span>
                        )}
                        {ver.isYanked ? (
                          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                            yanked
                          </span>
                        ) : null}
                        {ver.isYanked && ver.yankReason && (
                          <span className="text-xs text-muted-foreground italic truncate max-w-[200px]">
                            &ldquo;{ver.yankReason}&rdquo;
                          </span>
                        )}

                        <div className="ml-auto flex items-center gap-2">
                          {ver.isYanked ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1.5 text-xs"
                              disabled={vs.busy}
                              onClick={() => handleYank(ver, false)}
                            >
                              <RotateCcw className="h-3 w-3" />
                              {vs.busy ? "Restoring…" : "Restore"}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                              disabled={vs.busy}
                              onClick={() =>
                                vs.showReasonInput
                                  ? handleYank(ver, true)
                                  : patchYankState(ver.version, { showReasonInput: true })
                              }
                            >
                              <Ban className="h-3 w-3" />
                              {vs.busy ? "Yanking…" : vs.showReasonInput ? "Confirm yank" : "Yank"}
                            </Button>
                          )}
                          {vs.showReasonInput && !ver.isYanked && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              disabled={vs.busy}
                              onClick={() => patchYankState(ver.version, { showReasonInput: false, reasonInput: "" })}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>

                      {vs.showReasonInput && !ver.isYanked && (
                        <input
                          type="text"
                          placeholder="Reason (optional) — e.g. &quot;critical bug in 1.2.0, use 1.2.1&quot;"
                          value={vs.reasonInput}
                          onChange={(e) => patchYankState(ver.version, { reasonInput: e.target.value })}
                          className="w-full rounded-md border bg-muted/30 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                          maxLength={200}
                          disabled={vs.busy}
                        />
                      )}

                      {vs.error && (
                        <p className="text-xs text-destructive">{vs.error}</p>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-destructive/30 bg-background p-6 space-y-4">
          <h2 className="font-semibold text-destructive">Danger zone</h2>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={isDeprecated}
              onChange={(e) => {
                setIsDeprecated(e.target.checked);
                if (!e.target.checked) setDeprecationMessage("");
              }}
              className="mt-0.5"
            />
            <div>
              <p className="font-medium text-sm">Mark as deprecated</p>
              <p className="text-xs text-muted-foreground">
                Shows a full-width amber banner on the package page and a badge in
                search results. Does not delete the package or its versions.
              </p>
            </div>
          </label>

          {isDeprecated && (
            <div className="ml-6 space-y-1.5">
              <label htmlFor="deprecationMsg" className="text-sm font-medium">
                Deprecation message{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                id="deprecationMsg"
                rows={2}
                maxLength={500}
                placeholder='e.g. "This package has been superseded by @scope/new-package."'
                value={deprecationMessage}
                onChange={(e) => setDeprecationMessage(e.target.value)}
              />
              <p className="text-xs text-muted-foreground text-right">
                {deprecationMessage.length}/500
              </p>
            </div>
          )}
        </section>

        <div className="flex justify-between gap-3">
          <Link href="/dashboard">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
