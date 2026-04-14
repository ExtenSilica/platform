"use client";

import { useState } from "react";

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: "sm" | "md";
}

export function StarRating({ rating, max = 5, size = "md" }: StarRatingProps) {
  const sz = size === "sm" ? "text-sm" : "text-base";
  return (
    <span className={`${sz} leading-none`} aria-label={`${rating} out of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.floor(rating);
        const half = !filled && i < rating;
        return (
          <span
            key={i}
            className={
              filled
                ? "text-amber-400"
                : half
                  ? "text-amber-300"
                  : "text-muted-foreground/30"
            }
          >
            ★
          </span>
        );
      })}
    </span>
  );
}

/* ─── Interactive star picker (for review forms) ────────────────────────── */

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"] as const;

interface StarPickerProps {
  value: number; // 0 = unset
  onChange: (v: number) => void;
  size?: "sm" | "md" | "lg";
}

export function StarPicker({ value, onChange, size = "md" }: StarPickerProps) {
  const [hovered, setHovered] = useState(0);
  const sz =
    size === "sm" ? "text-xl" : size === "lg" ? "text-4xl" : "text-2xl";
  const active = hovered || value;

  return (
    <div className="space-y-1">
      <div
        className="flex"
        onMouseLeave={() => setHovered(0)}
        aria-label="Select a star rating"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onClick={() => onChange(star)}
            className={`${sz} leading-none px-0.5 transition-colors focus:outline-none ${
              star <= active ? "text-amber-400" : "text-muted-foreground/25"
            }`}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
      {active > 0 && (
        <p className="text-xs text-muted-foreground">{LABELS[active]}</p>
      )}
    </div>
  );
}

/* ─── Rating distribution bar ───────────────────────────────────────────── */

interface RatingBarProps {
  label: string;
  count: number;
  total: number;
}

export function RatingBar({ label, count, total }: RatingBarProps) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-4 shrink-0 text-right text-muted-foreground">{label}</span>
      <span className="text-amber-400 text-[10px]">★</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-amber-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right text-muted-foreground">{count}</span>
    </div>
  );
}
