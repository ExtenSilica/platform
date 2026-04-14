import { Request, Response } from 'express';
import { prisma } from '../db';

function mapReview(r: {
  id: number;
  packageId: number;
  userId: number;
  rating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { id: number; username: string; avatarUrl: string | null };
}) {
  return {
    id: r.id,
    packageId: r.packageId,
    userId: r.userId,
    username: r.user.username,
    avatarUrl: r.user.avatarUrl,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// GET /packages/:name/reviews
export const getReviews = async (req: Request, res: Response) => {
  const { name } = req.params;
  const pkg = await prisma.extension.findUnique({ where: { slug: name } });
  if (!pkg) {
    res.status(404).json({ error: 'Package not found.' });
    return;
  }
  const reviews = await prisma.review.findMany({
    where: { packageId: pkg.id },
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(reviews.map(mapReview));
};

// POST /packages/:name/reviews  (create or update — one per user per package)
export const upsertReview = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { name } = req.params;
  const { rating, comment } = req.body;

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    res.status(400).json({ error: 'rating must be an integer between 1 and 5.' });
    return;
  }
  if (comment !== undefined && comment !== null && typeof comment !== 'string') {
    res.status(400).json({ error: 'comment must be a string.' });
    return;
  }
  const sanitizedComment: string | null =
    typeof comment === 'string' && comment.trim().length > 0 ? comment.trim().slice(0, 1000) : null;

  const pkg = await prisma.extension.findUnique({ where: { slug: name } });
  if (!pkg) {
    res.status(404).json({ error: 'Package not found.' });
    return;
  }

  const review = await prisma.review.upsert({
    where: { packageId_userId: { packageId: pkg.id, userId: user.id } },
    update: { rating: ratingNum, comment: sanitizedComment },
    create: { packageId: pkg.id, userId: user.id, rating: ratingNum, comment: sanitizedComment },
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
  });

  res.status(200).json(mapReview(review));
};

// DELETE /packages/:name/reviews/me
export const deleteMyReview = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { name } = req.params;
  const pkg = await prisma.extension.findUnique({ where: { slug: name } });
  if (!pkg) {
    res.status(404).json({ error: 'Package not found.' });
    return;
  }

  await prisma.review.deleteMany({ where: { packageId: pkg.id, userId: user.id } });
  res.status(204).send();
};
