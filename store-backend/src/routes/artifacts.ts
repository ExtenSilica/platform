import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import {
  downloadToolArtifact,
  resolveToolArtifacts,
  uploadToolArtifact,
} from '../controllers/artifactsController';

const router = Router();

const multerDisk = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/tmp'));
  },
  filename: (_req, _file, cb) => {
    cb(null, `${uuidv4()}-artifact`);
  },
});

const upload = multer({
  storage: multerDisk,
  limits: { fileSize: 1024 * 1024 * 1024 },
});

router.post('/tools/upload', requireAuth, upload.single('file'), uploadToolArtifact);
router.post('/resolve', requireAuth, resolveToolArtifacts);
router.get('/tools/:sha256', requireAuth, downloadToolArtifact);

export default router;

