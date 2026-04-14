"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Edit2, MessageSquare, Star, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiDeleteReview, ApiError, apiSubmitReview } from "@/lib/api";
import type { Review } from "@/lib/types";
import { StarPicker, StarRating, RatingBar } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function computeAvg(reviews: Review[]) {
  if (!reviews.length) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

function computeCounts(reviews: Review[]) {
  const map: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    const key = Math.min(5, Math.max(1, Math.round(r.rating)));
    map[key] = (map[key] ?? 0) + 1;
  }
  return map;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ─── Single review card ─────────────────────────────────────────────────── */

function ReviewCard({ review }: { review: Review }) {
  const initial = (review.username ?? "?").charAt(0).toUpperCase();
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-bold text-muted-foreground">
            {initial}
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">
              {review.username ?? "Anonymous"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fmtDate(review.createdAt)}
            </p>
          </div>
        </div>
        <StarRating rating={review.rating} size="sm" />
      </div>
      {review.comment && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {review.comment}
        </p>
      )}
    </div>
  );
}

/* ─── Main section ───────────────────────────────────────────────────────── */

interface ReviewsSectionProps {
  slug: string;
  initialReviews: Review[];
}

export function ReviewsSection({ slug, initialReviews }: ReviewsSectionProps) {
  const { user, token } = useAuth();
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const myReview = user
    ? reviews.find((r) => r.username === user.username) ?? null
    : null;

  // Pre-fill form when entering edit mode
  useEffect(() => {
    if (myReview && editing) {
      setRating(myReview.rating);
      setComment(myReview.comment ?? "");
    }
    if (!myReview) {
      setRating(0);
      setComment("");
      setEditing(false);
    }
  }, [myReview, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || rating === 0) return;
    setError("");
    setSubmitting(true);
    try {
      const updated = await apiSubmitReview(token, slug, rating, comment || undefined);
      setReviews((prev) => {
        const idx = prev.findIndex((r) => r.userId === updated.userId);
        return idx >= 0
          ? prev.map((r, i) => (i === idx ? updated : r))
          : [updated, ...prev];
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!token || !user) return;
    setDeleting(true);
    setError("");
    try {
      await apiDeleteReview(token, slug);
      setReviews((prev) => prev.filter((r) => r.username !== user.username));
      setRating(0);
      setComment("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete review.");
    } finally {
      setDeleting(false);
    }
  }

  const avg = computeAvg(reviews);
  const counts = computeCounts(reviews);
  const total = reviews.length;
  const otherReviews = reviews.filter(
    (r) => !user || r.username !== user.username
  );

  return (
    <section id="reviews" className="scroll-mt-20 border-t pt-10">
      <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
        <Star className="h-4 w-4 text-muted-foreground" />
        Reviews
        {total > 0 && (
          <span className="text-sm font-normal text-muted-foreground">
            ({total})
          </span>
        )}
      </h2>

      {/* Rating summary */}
      {total > 0 && (
        <div className="mb-6 flex flex-col gap-6 rounded-lg border bg-muted/20 p-5 sm:flex-row sm:items-center">
          <div className="text-center">
            <p className="text-5xl font-extrabold tracking-tight">
              {avg.toFixed(1)}
            </p>
            <StarRating rating={avg} />
            <p className="mt-1 text-xs text-muted-foreground">
              {total} review{total !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => (
              <RatingBar
                key={star}
                label={String(star)}
                count={counts[star] ?? 0}
                total={total}
              />
            ))}
          </div>
        </div>
      )}

      {/* Auth gate / form */}
      {user ? (
        myReview && !editing ? (
          /* Own review – read mode */
          <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-primary">Your review</p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setEditing(true)}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
            <StarRating rating={myReview.rating} />
            {myReview.comment && (
              <p className="mt-2 text-sm text-muted-foreground">
                {myReview.comment}
              </p>
            )}
          </div>
        ) : (
          /* Write / edit form */
          <div className="mb-6 rounded-lg border bg-background p-5">
            <p className="mb-4 text-sm font-semibold">
              {myReview ? "Edit your review" : "Write a review"}
            </p>
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Rating <span className="text-destructive">*</span>
                </p>
                <StarPicker value={rating} onChange={setRating} />
              </div>
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Comment (optional)
                </p>
                <Textarea
                  placeholder="Share your experience with this package…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {comment.length}/1000
                </p>
              </div>
              <div className="flex gap-2">
                {editing && (
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                )}
                <Button type="submit" disabled={submitting || rating === 0}>
                  {submitting
                    ? "Submitting…"
                    : myReview
                      ? "Update review"
                      : "Submit review"}
                </Button>
              </div>
            </form>
          </div>
        )
      ) : (
        /* Unauthenticated prompt */
        <div className="mb-6 rounded-lg border border-dashed bg-muted/20 px-5 py-4 text-center">
          <p className="text-sm text-muted-foreground">
            <a href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </a>{" "}
            to leave a review.
          </p>
        </div>
      )}

      {/* Reviews list */}
      {total === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 py-12 text-center">
          <MessageSquare className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">
            No reviews yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Be the first to leave a review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {otherReviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
          {otherReviews.length === 0 && myReview && (
            <p className="text-sm text-muted-foreground">
              No other reviews yet.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
