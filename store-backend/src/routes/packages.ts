import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  listPackages,
  getPackageBySlug,
  getPackageVersion,
  listVersions,
  createPackage,
  publishVersion,
  updatePackage,
  yankVersion,
  listMaintainers,
  addMaintainer,
  removeMaintainer,
  getMyPackages,
} from '../controllers/packagesController';
import { getReviews, upsertReview, deleteMyReview } from '../controllers/reviewsController';
import { requireAuth } from '../middleware/auth';

/* ─── multer ─────────────────────────────────────────────────────────────── */
//
// Files are always written to uploads/tmp/ first.  The publishVersion handler
// then calls storage.put(key, tmpPath) which moves the file to its final
// location — either uploads/<key> (local driver) or an S3 bucket (s3 driver).
// The temp file is deleted by the storage driver after a successful transfer.

const multerDisk = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/tmp'));
  },
  filename: (_req, _file, cb) => {
    cb(null, `${uuidv4()}.xsil`);
  },
});

const upload = multer({
  storage: multerDisk,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (
      file.originalname.endsWith('.xsil') ||
      file.mimetype === 'application/octet-stream' ||
      file.mimetype === 'application/x-tar' ||
      file.mimetype === 'application/gzip'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .xsil files are accepted.'));
    }
  },
});

const router = Router();

/* ─── Scope normalisation middleware ────────────────────────────────────────
 *
 * Scoped package routes have the form:  /packages/@scope/name[/sub-path]
 * Express cannot match a slash inside a :param, so we register scoped variants
 * for every endpoint and use `normalizePkgName` to merge scope + name into
 * req.params.name before the controller runs.  Controllers are unchanged.
 */
function normalizePkgName(req: Request, _res: Response, next: NextFunction): void {
  const scope = (req.params as Record<string, string>).scope;
  if (scope) {
    req.params.name = `@${scope}/${req.params.name}`;
  }
  next();
}

/* ─── Public read endpoints ──────────────────────────────────────────────── */

router.get('/', listPackages);
// /me/packages must come before /:name to avoid "me" being treated as a slug
router.get('/me/packages', requireAuth, getMyPackages);

// ── Scoped variants ───────────────────────────────────────────────────────
// Order matters: more-specific (sub-resource) routes before the bare name route.

// GET /packages/@scope/name/versions
router.get('/@:scope/:name/versions', normalizePkgName, listVersions);
// GET /packages/@scope/name/:version
router.get('/@:scope/:name/:version', normalizePkgName, getPackageVersion);
// GET /packages/@scope/name
router.get('/@:scope/:name', normalizePkgName, getPackageBySlug);

// ── Unscoped variants ─────────────────────────────────────────────────────

// /:name/versions before /:name/:version so "versions" is not parsed as a version tag
router.get('/:name/versions', listVersions);
router.get('/:name/:version', getPackageVersion); // also handles "latest" tag
router.get('/:name', getPackageBySlug);

/* ─── Authenticated write endpoints ──────────────────────────────────────── */

router.post('/', requireAuth, createPackage);

// Scoped publish
router.post('/@:scope/:name/versions', requireAuth, normalizePkgName, upload.single('file'), publishVersion);
router.patch('/@:scope/:name/versions/:version', requireAuth, normalizePkgName, yankVersion);
router.patch('/@:scope/:name', requireAuth, normalizePkgName, updatePackage);

// Unscoped publish
router.post('/:name/versions', requireAuth, upload.single('file'), publishVersion);
router.patch('/:name/versions/:version', requireAuth, yankVersion);
router.patch('/:name', requireAuth, updatePackage);

/* ─── Maintainers ─────────────────────────────────────────────────────────── */

// Scoped
router.get('/@:scope/:name/maintainers', normalizePkgName, listMaintainers);
router.post('/@:scope/:name/maintainers', requireAuth, normalizePkgName, addMaintainer);
router.delete('/@:scope/:name/maintainers/:userId', requireAuth, normalizePkgName, removeMaintainer);

// Unscoped
router.get('/:name/maintainers', listMaintainers);
router.post('/:name/maintainers', requireAuth, addMaintainer);
router.delete('/:name/maintainers/:userId', requireAuth, removeMaintainer);

/* ─── Reviews ──────────────────────────────────────────────────────────────── */

// Scoped (reviews/me must come before reviews/:id)
router.delete('/@:scope/:name/reviews/me', requireAuth, normalizePkgName, deleteMyReview);
router.get('/@:scope/:name/reviews', normalizePkgName, getReviews);
router.post('/@:scope/:name/reviews', requireAuth, normalizePkgName, upsertReview);

// Unscoped
router.get('/:name/reviews', getReviews);
router.post('/:name/reviews', requireAuth, upsertReview);
router.delete('/:name/reviews/me', requireAuth, deleteMyReview);

export default router;
