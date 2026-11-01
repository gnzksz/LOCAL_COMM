import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from './errors.js';

fs.mkdirSync(config.uploadDir, { recursive: true });

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

export const photoUpload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ALLOWED[file.mimetype]}`),
  }),
  limits: { fileSize: config.maxPhotoBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED[file.mimetype]) cb(null, true);
    else cb(new HttpError(400, 'Photo must be a JPEG, PNG or WEBP image'));
  },
});

export function removeUpload(filename) {
  if (filename) fs.rm(path.join(config.uploadDir, filename), { force: true }, () => {});
}
