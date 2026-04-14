"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { fetchPackage, apiPublishVersion, ApiError } from "@/lib/api";
import type { RegistryPackage } from "@/lib/types";
import {
  parseXsilManifest,
  targetsToString,
  toolchainToString,
  type XsilManifest,
} from "@/lib/xsil-parser";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft, Upload, FileArchive, CheckCircle2,
  AlertCircle, Package, ChevronRight, X,
} from "lucide-react";

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default function PublishVersionPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [pkg, setPkg] = useState<RegistryPackage | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [manifest, setManifest] = useState<XsilManifest | null>(null);
  const [manifestError, setManifestError] = useState("");
  const [dragging, setDragging] = useState(false);

  // Form fields
  const [version, setVersion] = useState("");
  const [isa, setIsa] = useState("");
  const [targets, setTargets] = useState("");
  const [toolchain, setToolchain] = useState("");
  const [changelog, setChangelog] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(false);

  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?next=/publish/${slug}/version`);
    }
  }, [user, isLoading, router, slug]);

  useEffect(() => {
    fetchPackage(slug)
      .then((p) => {
        if (!p) router.replace("/dashboard");
        else setPkg(p);
      })
      .catch(() => router.replace("/dashboard"));
  }, [slug, router]);

  const processFile = useCallback(async (f: File) => {
    setFile(f);
    setManifestError("");
    setManifest(null);

    if (!f.name.endsWith(".xsil")) {
      setManifestError("File must be a .xsil archive.");
      return;
    }

    const parsed = await parseXsilManifest(f);
    if (parsed) {
      setManifest(parsed);
      if (parsed.version) setVersion(parsed.version);
      if (parsed.isa) setIsa(parsed.isa);
      if (parsed.targets) setTargets(targetsToString(parsed.targets));
      if (parsed.toolchain) setToolchain(toolchainToString(parsed.toolchain));
    } else {
      setManifestError("Could not read manifest.json from archive. Fill in details manually.");
    }
  }, []);

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !file) return;
    setApiError("");
    setSubmitting(true);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("version", version.trim());
    if (isa.trim()) fd.append("isa", isa.trim());
    if (targets.trim()) fd.append("targets", targets.trim());
    if (toolchain.trim()) fd.append("toolchain", toolchain.trim());
    if (changelog.trim()) fd.append("changelog", changelog.trim());

    try {
      await apiPublishVersion(token, slug, fd);
      setSuccess(true);
      setTimeout(() => router.push(`/package/${slug}`), 2000);
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : "Publish failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !user || !pkg) return null;

  if (success) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <h2 className="text-xl font-bold">Version published!</h2>
        <p className="text-muted-foreground">
          Redirecting to{" "}
          <code className="font-mono text-sm">{pkg.slug}@{version}</code>…
        </p>
      </div>
    );
  }

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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/package/${slug}`} className="hover:text-foreground transition-colors">
            {pkg.name}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Publish new version</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a{" "}
          <code className="font-mono text-xs">.xsil</code> archive. The
          manifest is read automatically to pre-fill version details.
        </p>
      </div>

      {apiError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        <div className="flex-1 space-y-6">

          {/* ── Upload area ── */}
          <section className="rounded-xl border bg-background p-6 space-y-4">
            <h2 className="font-semibold">1. Upload package file</h2>

            {!file ? (
              <div
                ref={dropRef}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium">
                  Drag &amp; drop your{" "}
                  <code className="font-mono text-sm">.xsil</code> file here
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  or click to browse — max 50 MB
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Build with:{" "}
                  <code className="font-mono">xsil pack ./my-extension/</code>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xsil"
                  className="sr-only"
                  onChange={handleFileInput}
                />
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-4">
                <FileArchive className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{fmtBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setManifest(null);
                    setManifestError("");
                  }}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Manifest preview */}
            {manifest && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  manifest.json detected
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {manifest.name && <ManifestRow label="name" value={manifest.name} />}
                  {manifest.version && <ManifestRow label="version" value={manifest.version} />}
                  {manifest.isa && <ManifestRow label="isa" value={manifest.isa} />}
                  {manifest.targets && (
                    <ManifestRow label="targets" value={targetsToString(manifest.targets)} />
                  )}
                  {manifest.toolchain && (
                    <ManifestRow label="toolchain" value={toolchainToString(manifest.toolchain)} />
                  )}
                  {manifest.license && <ManifestRow label="license" value={manifest.license} />}
                  {manifest.checksums?.payload && (
                    <ManifestRow label="payloadHash" value={manifest.checksums.payload.slice(0, 16) + "…"} />
                  )}
                </div>
              </div>
            )}

            {manifestError && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {manifestError}
              </p>
            )}
          </section>

          {/* ── Version details ── */}
          <section className="rounded-xl border bg-background p-6 space-y-4">
            <h2 className="font-semibold">2. Version details</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Version"
                htmlFor="version"
                required
                hint="Semantic versioning (e.g. 1.0.0, 2.1.0-rc.1)"
              >
                <Input
                  id="version"
                  placeholder="1.0.0"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  required
                  className="font-mono"
                />
              </Field>

              <Field label="ISA" htmlFor="isa" hint="e.g. RV64GCV, RV32IM">
                <Input
                  id="isa"
                  placeholder="RV64GCV"
                  value={isa}
                  onChange={(e) => setIsa(e.target.value)}
                  className="font-mono"
                />
              </Field>

              <Field
                label="Targets"
                htmlFor="targets"
                hint="Comma-separated: spike, qemu, fpga"
              >
                <Input
                  id="targets"
                  placeholder="spike, qemu"
                  value={targets}
                  onChange={(e) => setTargets(e.target.value)}
                />
              </Field>

              <Field
                label="Toolchain"
                htmlFor="toolchain"
                hint="e.g. riscv-gnu-toolchain 13.2.0"
              >
                <Input
                  id="toolchain"
                  placeholder="riscv-gnu-toolchain 13.2.0"
                  value={toolchain}
                  onChange={(e) => setToolchain(e.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Changelog"
              htmlFor="changelog"
              hint="What changed in this version? (optional)"
            >
              <Textarea
                id="changelog"
                placeholder="## v1.0.0&#10;- Initial release"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                rows={4}
              />
            </Field>
          </section>

          <div className="flex justify-end gap-3">
            <Link href="/dashboard">
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={submitting || !file || !version.trim()}>
              {submitting ? "Publishing…" : "Publish version"}
            </Button>
          </div>
        </div>

        {/* ── Right preview ── */}
        <aside className="w-full shrink-0 lg:w-64 space-y-4">
          <div className="sticky top-20 space-y-4">
            <div className="rounded-xl border bg-background p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preview
              </p>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <span className="font-semibold">{pkg.name}</span>
                  {version && (
                    <Badge variant="muted" className="ml-2 font-mono text-[10px]">
                      {version}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {pkg.description}
              </p>
              {(isa || targets) && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  {isa && (
                    <p>
                      ISA:{" "}
                      <code className="font-mono text-foreground">{isa}</code>
                    </p>
                  )}
                  {targets && (
                    <div className="flex flex-wrap gap-1">
                      {targets.split(",").map((t) => {
                        const label = t.trim();
                        return label ? (
                          <Badge key={label} variant="outline" className="font-mono text-[10px]">
                            {label}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              )}
              {file && (
                <p className="text-xs text-muted-foreground">
                  Archive: {fmtBytes(file.size)}
                </p>
              )}
            </div>

            {pkg.versions && pkg.versions.length > 0 && (
              <div className="rounded-xl border bg-background p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Existing versions
                </p>
                <div className="space-y-1">
                  {pkg.versions.slice(0, 5).map((v) => (
                    <div key={v.id} className="flex items-center justify-between text-xs">
                      <code className="font-mono">{v.version}</code>
                      {v.isYanked && (
                        <span className="text-destructive">yanked</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </form>
    </div>
  );
}

function ManifestRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground truncate">{value}</span>
    </>
  );
}
