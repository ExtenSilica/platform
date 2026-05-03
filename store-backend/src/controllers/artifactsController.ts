import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db';
import { storage } from '../storage';
import {
  extractDeclaredToolDependencies,
  isValidSha256,
  normalizeSha256,
} from '../lib/toolDependencies';

function baseUrl(): string {
  return process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
}

function downloadUrlForSha(sha256: string): string {
  return `${baseUrl()}/api/artifacts/tools/${sha256}`;
}

function guessContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'application/gzip';
  if (lower.endsWith('.tar.zst') || lower.endsWith('.tzst')) return 'application/zstd';
  if (lower.endsWith('.tar')) return 'application/x-tar';
  return 'application/octet-stream';
}

export const uploadToolArtifact = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const file = req.file;
  const { name, version, platform, sourceUrl } = req.body as Record<string, string | undefined>;
  if (!file) {
    res.status(400).json({ error: 'File is required.' });
    return;
  }
  if (!name?.trim() || !version?.trim() || !platform?.trim()) {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: 'name, version, and platform are required.' });
    return;
  }

  try {
    const bytes = fs.readFileSync(file.path);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');

    const existing = await prisma.toolArtifact.findUnique({ where: { sha256 } });
    if (existing) {
      fs.unlinkSync(file.path);
      res.status(200).json({
        artifact: {
          id: existing.id,
          name: existing.name,
          version: existing.version,
          platform: existing.platform,
          sha256: existing.sha256,
          size: existing.size,
          sourceUrl: existing.sourceUrl,
          downloadUrl: downloadUrlForSha(existing.sha256),
          deduped: true,
        },
      });
      return;
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    const storageKey = `tools/${sha256}-${uuidv4()}${ext}`;
    await storage.put(storageKey, file.path);

    const created = await prisma.toolArtifact.create({
      data: {
        name: name.trim(),
        version: version.trim(),
        platform: platform.trim(),
        sha256,
        size: file.size,
        storageKey,
        sourceUrl: sourceUrl?.trim() || null,
        createdById: user.id,
      },
    });

    res.status(201).json({
      artifact: {
        id: created.id,
        name: created.name,
        version: created.version,
        platform: created.platform,
        sha256: created.sha256,
        size: created.size,
        sourceUrl: created.sourceUrl,
        downloadUrl: downloadUrlForSha(created.sha256),
        deduped: false,
      },
    });
  } catch (error) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    console.error('[artifacts/upload]', error);
    res.status(500).json({ error: 'Failed to upload artifact.' });
  }
};

export const resolveToolArtifacts = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const depsInput = body.dependencies;
  const deps = depsInput && typeof depsInput === 'object'
    ? extractDeclaredToolDependencies({ dependencies: depsInput })
    : [];

  if (deps.length === 0) {
    res.status(400).json({ error: 'No tool dependencies provided.' });
    return;
  }

  const ors = deps.map((d) => ({
    sha256: normalizeSha256(d.sha256),
    name: d.toolName,
    version: d.toolVersion,
    platform: d.platform,
  }));

  try {
    const artifacts = await prisma.toolArtifact.findMany({ where: { OR: ors } });
    const index = new Map(artifacts.map((a) => [`${a.sha256}:${a.name}:${a.version}:${a.platform}`, a]));

    const resolved = [];
    const missing = [];

    for (const d of deps) {
      const sha = normalizeSha256(d.sha256);
      const key = `${sha}:${d.toolName}:${d.toolVersion}:${d.platform}`;
      const found = index.get(key);
      if (!found) {
        missing.push({
          name: d.toolName,
          version: d.toolVersion,
          platform: d.platform,
          sha256: sha,
        });
        continue;
      }
      resolved.push({
        name: d.toolName,
        version: d.toolVersion,
        platform: d.platform,
        sha256: found.sha256,
        url: downloadUrlForSha(found.sha256),
      });
    }

    res.json({ resolved, missing });
  } catch (error) {
    console.error('[artifacts/resolve]', error);
    res.status(500).json({ error: 'Failed to resolve artifacts.' });
  }
};

export const downloadToolArtifact = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const sha = normalizeSha256(req.params.sha256 || '');
  if (!isValidSha256(sha)) {
    res.status(400).json({ error: 'Invalid sha256.' });
    return;
  }

  const artifact = await prisma.toolArtifact.findUnique({ where: { sha256: sha } });
  if (!artifact) {
    res.status(404).json({ error: 'Artifact not found.' });
    return;
  }

  try {
    const { stream, contentLength, contentType } = await storage.get(artifact.storageKey);
    res.setHeader('Content-Type', contentType ?? guessContentType(artifact.storageKey));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${artifact.name}-${artifact.version}-${artifact.platform}.tar"`
    );
    if (contentLength !== undefined) res.setHeader('Content-Length', contentLength);
    stream.on('error', (err) => {
      console.error('[artifacts/download] stream error', err);
      if (!res.headersSent) res.status(500).json({ error: 'Download failed.' });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (error) {
    console.error('[artifacts/download]', error);
    res.status(404).json({ error: 'Artifact blob not found.' });
  }
};

