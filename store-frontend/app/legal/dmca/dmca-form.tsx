"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function DmcaForm() {
  const [fields, setFields] = useState({
    reporterName: "",
    reporterEmail: "",
    reporterCompany: "",
    packageSlug: "",
    infringingUrl: "",
    originalWorkDescription: "",
    originalWorkUrl: "",
    infringementDescription: "",
    signature: "",
  });
  const [goodFaith, setGoodFaith] = useState(false);
  const [accuracy, setAccuracy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof typeof fields) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setFields((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!goodFaith || !accuracy) {
      setError("You must check both declaration checkboxes before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/legal/dmca`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, goodFaithStatement: goodFaith, accuracyStatement: accuracy }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center dark:border-green-900 dark:bg-green-950/30">
        <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-green-600" />
        <p className="text-lg font-semibold text-green-800 dark:text-green-300">
          Request received
        </p>
        <p className="mt-2 text-sm text-green-700 dark:text-green-400">
          Your takedown request has been submitted. We will review it and respond
          to <strong>{fields.reporterEmail}</strong> within 5 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Reporter info */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Your contact information</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="reporterName">Full name <span className="text-destructive">*</span></Label>
            <Input id="reporterName" value={fields.reporterName} onChange={set("reporterName")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reporterEmail">Email address <span className="text-destructive">*</span></Label>
            <Input id="reporterEmail" type="email" value={fields.reporterEmail} onChange={set("reporterEmail")} required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reporterCompany">Company / organization <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input id="reporterCompany" value={fields.reporterCompany} onChange={set("reporterCompany")} />
        </div>
      </fieldset>

      <hr />

      {/* Infringing content */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Infringing content</legend>
        <div className="space-y-1.5">
          <Label htmlFor="packageSlug">Package name <span className="text-destructive">*</span></Label>
          <Input id="packageSlug" placeholder="e.g. rvx-demo or @org/pkgname" value={fields.packageSlug} onChange={set("packageSlug")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="infringingUrl">URL of infringing content <span className="text-destructive">*</span></Label>
          <Input id="infringingUrl" type="url" placeholder="https://extensilica.com/package/…" value={fields.infringingUrl} onChange={set("infringingUrl")} required />
        </div>
      </fieldset>

      <hr />

      {/* Original work */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Your original work</legend>
        <div className="space-y-1.5">
          <Label htmlFor="originalWorkDescription">
            Description of original work <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="originalWorkDescription"
            rows={3}
            placeholder="Describe the copyrighted work or IP you own that is being infringed."
            value={fields.originalWorkDescription}
            onChange={set("originalWorkDescription")}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="originalWorkUrl">URL of original work <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input id="originalWorkUrl" type="url" placeholder="https://…" value={fields.originalWorkUrl} onChange={set("originalWorkUrl")} />
        </div>
      </fieldset>

      <hr />

      {/* Infringement description */}
      <div className="space-y-1.5">
        <Label htmlFor="infringementDescription">
          How is your work being infringed? <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="infringementDescription"
          rows={4}
          placeholder="Explain clearly how the identified package infringes your rights."
          value={fields.infringementDescription}
          onChange={set("infringementDescription")}
          required
        />
      </div>

      <hr />

      {/* Declarations */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-foreground">Declarations</legend>
        <div className="flex items-start gap-3">
          <Checkbox
            id="goodFaith"
            checked={goodFaith}
            onCheckedChange={(v) => setGoodFaith(Boolean(v))}
          />
          <Label htmlFor="goodFaith" className="text-sm leading-snug font-normal cursor-pointer">
            I have a good faith belief that the use of the material in the manner
            complained of is not authorized by the copyright owner, its agent, or the law.
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="accuracy"
            checked={accuracy}
            onCheckedChange={(v) => setAccuracy(Boolean(v))}
          />
          <Label htmlFor="accuracy" className="text-sm leading-snug font-normal cursor-pointer">
            The information in this notification is accurate, and under penalty of perjury,
            I am the owner or authorized to act on behalf of the owner of an exclusive right
            that is allegedly infringed.
          </Label>
        </div>
      </fieldset>

      {/* Signature */}
      <div className="space-y-1.5">
        <Label htmlFor="signature">
          Electronic signature <span className="text-destructive">*</span>
        </Label>
        <Input
          id="signature"
          placeholder="Type your full legal name"
          value={fields.signature}
          onChange={set("signature")}
          required
        />
        <p className="text-xs text-muted-foreground">
          Typing your name constitutes an electronic signature under 17 U.S.C. § 512.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Submitting…" : "Submit takedown request"}
      </Button>
    </form>
  );
}
