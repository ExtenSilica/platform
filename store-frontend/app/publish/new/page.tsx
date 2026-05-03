"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { apiCreatePackage, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, AlertCircle } from "lucide-react";

const LICENSES = [
  "Apache-2.0", "MIT", "GPL-2.0", "GPL-3.0", "LGPL-2.1",
  "LGPL-3.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0",
  "CC-BY-4.0", "CC0-1.0", "Unlicense", "CERN-OHL-W-2.0",
  "CERN-OHL-S-2.0", "CERN-OHL-P-2.0",
];

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CreatePackagePage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [license, setLicense] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?next=/publish/new");
  }, [user, isLoading, router]);

  const slug = slugify(name);
  const slugValid = slug.length >= 2;
  const keywordList = keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    setSubmitting(true);
    try {
      const pkg = await apiCreatePackage(token, {
        name: name.trim(),
        description: description.trim(),
        shortDescription: shortDescription.trim() || undefined,
        longDescription: longDescription.trim() || undefined,
        keywords: keywords.trim() || undefined,
        license: license || undefined,
        repositoryUrl: repositoryUrl.trim() || undefined,
        homepageUrl: homepageUrl.trim() || undefined,
      });
      router.push(`/publish/${pkg.slug}/version`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create package.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !user) return null;

  return (
    <div className="container max-w-5xl px-4 py-10">
      <Link
        href="/dashboard"
        className="-ml-1 mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">Create a new package</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register a package name and metadata. You&apos;ll upload the{" "}
          <code className="font-mono text-xs">.xsil</code> file in the next
          step.
        </p>
      </div>

      <Alert className="mb-6 border-muted bg-muted/30">
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
        <AlertDescription className="text-muted-foreground">
          You can publish versions with any supported{" "}
          <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-xs">resolution.mode</code>{" "}
          (<code className="font-mono text-xs">bundled</code>,{" "}
          <code className="font-mono text-xs">resolved</code>,{" "}
          <code className="font-mono text-xs">host-dependent</code>). The publish flow may offer an optional registry
          artifact check for resolved tool dependencies.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-6">
          <section className="space-y-4 rounded-xl border bg-background p-6">
            <h2 className="font-semibold">Identity</h2>

            <Field
              label="Package name"
              htmlFor="name"
              required
              hint="Lowercase letters, digits, hyphens only. This becomes the registry slug."
              error={
                name && !slugValid
                  ? "Name must produce a valid slug (at least 2 chars, a-z 0-9 - _)."
                  : undefined
              }
            >
              <Input
                id="name"
                placeholder="my-riscv-extension"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              {slug && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Registry slug:{" "}
                  <span className={slugValid ? "text-foreground font-mono" : "text-destructive font-mono"}>
                    {slug}
                  </span>
                </p>
              )}
            </Field>

            <Field
              label="Short description"
              htmlFor="description"
              required
              hint="One sentence. Shown in search results and cards."
            >
              <Input
                id="description"
                placeholder="A reproducible RISC-V vector extension for Spike"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={160}
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {description.length}/160
              </p>
            </Field>

            <Field
              label="Tagline"
              htmlFor="shortDescription"
              hint="Optional. Shorter subtitle shown on the package page."
            >
              <Input
                id="shortDescription"
                placeholder="RVV 1.0 crypto extension"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                maxLength={80}
              />
            </Field>
          </section>

          <section className="space-y-4 rounded-xl border bg-background p-6">
            <h2 className="font-semibold">README</h2>
            <Field
              label="README / extended description"
              htmlFor="longDescription"
              hint="Markdown supported. Rendered on the package page."
            >
              <Textarea
                id="longDescription"
                placeholder="## Overview&#10;&#10;Describe your package in detail…"
                value={longDescription}
                onChange={(e) => setLongDescription(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
            </Field>
          </section>

          <section className="space-y-4 rounded-xl border bg-background p-6">
            <h2 className="font-semibold">Discovery</h2>

            <Field
              label="Keywords"
              htmlFor="keywords"
              hint="Comma-separated. e.g. risc-v, rvv, vector, spike"
            >
              <Input
                id="keywords"
                placeholder="risc-v, rvv, vector"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
              {keywordList.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {keywordList.map((k) => (
                    <Badge key={k} variant="muted">{k}</Badge>
                  ))}
                </div>
              )}
            </Field>

            <Field label="License" htmlFor="license" hint="SPDX identifier preferred.">
              <div className="flex gap-2">
                <Input
                  id="license"
                  list="license-list"
                  placeholder="Apache-2.0"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  className="flex-1"
                />
                <datalist id="license-list">
                  {LICENSES.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </div>
            </Field>
          </section>

          <section className="space-y-4 rounded-xl border bg-background p-6">
            <h2 className="font-semibold">Links</h2>

            <Field label="Repository URL" htmlFor="repositoryUrl" hint="GitHub, Gitea, or any git forge.">
              <Input
                id="repositoryUrl"
                type="url"
                placeholder="https://github.com/you/my-extension"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
              />
            </Field>

            <Field label="Homepage URL" htmlFor="homepageUrl">
              <Input
                id="homepageUrl"
                type="url"
                placeholder="https://example.com/my-extension"
                value={homepageUrl}
                onChange={(e) => setHomepageUrl(e.target.value)}
              />
            </Field>
          </section>

          <div className="flex justify-end gap-3">
            <Link href="/dashboard">
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={submitting || !slugValid}>
              {submitting ? "Creating…" : "Create package →"}
            </Button>
          </div>
        </form>

        {/* ── Live preview ── */}
        <aside className="w-full shrink-0 lg:w-72">
          <div className="sticky top-20 rounded-xl border bg-background p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Preview
            </p>
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-start gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">
                    {name || <span className="text-muted-foreground">package-name</span>}
                  </p>
                  {slug && slugValid && (
                    <p className="font-mono text-xs text-muted-foreground">{slug}</p>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {description || "Package description will appear here."}
              </p>
              {keywordList.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {keywordList.slice(0, 4).map((k) => (
                    <Badge key={k} variant="muted" className="text-[10px]">{k}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="flex justify-between">
                <span>Author</span>
                <span className="font-medium text-foreground">
                  @{user.username}
                </span>
              </p>
              {license && (
                <p className="flex justify-between">
                  <span>License</span>
                  <span className="font-medium text-foreground">{license}</span>
                </p>
              )}
            </div>
            <div className="rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
              xsil install {slug || "package-name"}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
