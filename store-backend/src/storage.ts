/**
 * Storage abstraction for .xsil package blobs.
 *
 * Two drivers are supported, selected via the STORAGE_DRIVER environment variable:
 *
 *   STORAGE_DRIVER=local  (default)
 *     Files are stored in <project>/uploads/ on the local filesystem.
 *     Suitable for development and single-server production deployments.
 *
 *   STORAGE_DRIVER=s3
 *     Files are stored in an S3-compatible object store (AWS S3, Cloudflare R2,
 *     Backblaze B2, MinIO, DigitalOcean Spaces, …).
 *     Required env vars: S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.
 *     Optional:          S3_ENDPOINT (for non-AWS providers), S3_FORCE_PATH_STYLE.
 *
 * In both drivers all downloads are proxied through GET /uploads/:key so that
 * download events are recorded transparently — clients never contact S3 directly.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StorageResult {
  stream: Readable;
  contentLength?: number;
  contentType?: string;
}

export interface StorageProvider {
  /**
   * Persist a file identified by `key`.
   * The temp file at `tmpPath` is removed after a successful upload.
   */
  put(key: string, tmpPath: string): Promise<void>;

  /** Open a readable stream for the object identified by `key`. */
  get(key: string): Promise<StorageResult>;

  /** Remove the object identified by `key`. No-op if it does not exist. */
  delete(key: string): Promise<void>;

  /** Return true if the object exists. */
  exists(key: string): Promise<boolean>;

  /** Human-readable driver name, used in health and startup logs. */
  readonly name: string;
}

// ── Local driver ──────────────────────────────────────────────────────────────

class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  private dir: string;

  constructor(uploadsDir: string) {
    this.dir = uploadsDir;
  }

  private resolve(key: string): string {
    return path.join(this.dir, key);
  }

  async put(key: string, tmpPath: string): Promise<void> {
    const dest = this.resolve(key);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    // Prefer rename (atomic, same fs); fall back to copy+delete (cross-device).
    try {
      await fs.promises.rename(tmpPath, dest);
    } catch {
      await fs.promises.copyFile(tmpPath, dest);
      await fs.promises.unlink(tmpPath).catch(() => {});
    }
  }

  async get(key: string): Promise<StorageResult> {
    const filePath = this.resolve(key);
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      const err = new Error(`Object not found: ${key}`);
      (err as NodeJS.ErrnoException).code = 'ENOENT';
      throw err;
    }
    return {
      stream: fs.createReadStream(filePath),
      contentLength: stat.size,
      contentType: 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    await fs.promises.unlink(this.resolve(key)).catch(() => {});
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(this.resolve(key));
  }
}

// ── S3 driver ─────────────────────────────────────────────────────────────────

class S3StorageProvider implements StorageProvider {
  readonly name: string;

  private client: S3Client;
  private bucket: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!bucket) throw new Error('[storage] S3_BUCKET is required when STORAGE_DRIVER=s3');
    if (!accessKeyId) throw new Error('[storage] S3_ACCESS_KEY_ID is required when STORAGE_DRIVER=s3');
    if (!secretAccessKey) throw new Error('[storage] S3_SECRET_ACCESS_KEY is required when STORAGE_DRIVER=s3');

    this.bucket = bucket;
    const endpoint = process.env.S3_ENDPOINT;    // e.g. https://account.r2.cloudflarestorage.com
    const region   = process.env.S3_REGION ?? 'auto';

    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      credentials: { accessKeyId, secretAccessKey },
      // Required for providers that use path-style URLs (MinIO, some R2 configs)
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    });

    this.name = `s3(${endpoint ?? `aws/${region}`}/${bucket})`;
  }

  async put(key: string, tmpPath: string): Promise<void> {
    const body = fs.createReadStream(tmpPath);
    const stat  = await fs.promises.stat(tmpPath);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'application/octet-stream',
        ContentLength: stat.size,
      })
    );

    // Remove the temp file after a successful upload.
    await fs.promises.unlink(tmpPath).catch(() => {});
  }

  async get(key: string): Promise<StorageResult> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );

    if (!res.Body) {
      throw new Error(`Object not found: ${key}`);
    }

    return {
      stream: res.Body as Readable,
      contentLength: res.ContentLength,
      contentType: res.ContentType ?? 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    ).catch(() => {});
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}

// ── Exported singleton ────────────────────────────────────────────────────────

const _uploadsDir = path.join(__dirname, '../uploads');

// Default to local so controllers can import `storage` at module load time.
// Call initStorage() early in server startup to swap the driver if STORAGE_DRIVER=s3.
export let storage: StorageProvider = new LocalStorageProvider(_uploadsDir);

/**
 * Initialize the storage provider from environment variables.
 * Must be called before the server starts accepting requests.
 */
export async function initStorage(): Promise<void> {
  const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();

  if (driver === 's3') {
    storage = new S3StorageProvider();
    console.log(`[storage] driver: ${storage.name}`);
    // Smoke-test: try to HEAD a non-existent object — if credentials are wrong
    // this will throw and crash the process before accepting any traffic.
    await storage.exists('__healthcheck__').catch((err: Error) => {
      throw new Error(`[storage] S3 connectivity check failed: ${err.message}`);
    });
  } else {
    storage = new LocalStorageProvider(_uploadsDir);
    console.log(`[storage] driver: local (${_uploadsDir})`);
  }
}
