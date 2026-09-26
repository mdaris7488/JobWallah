import crypto from 'node:crypto';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { TOOLS_DIR } from '../utils/tmpFiles.js';

// Uploads go to a private temp folder under a random name. The client's file name is never used on disk.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TOOLS_DIR),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.upload`),
});

const typeFilter = (test, label) => (req, file, cb) =>
  (test(file.mimetype) ? cb(null, true) : cb(new ApiError(415, `Unsupported file type. Please upload ${label}.`)));

const isImage = (m) => /^image\/(jpeg|png|webp|gif|avif|tiff)$/.test(m);
const isPdf = (m) => m === 'application/pdf';
const isVideo = (m) => /^video\//.test(m) || m === 'application/octet-stream'; // mkv/avi are often unlabeled; bytes are verified later

const make = (test, label, { fileMb, files }) =>
  multer({
    storage,
    fileFilter: typeFilter(test, label),
    limits: { fileSize: fileMb * 1024 * 1024, files, fields: 12, fieldSize: 2048, parts: files + 14 },
  }).array('files', files);

// Hard ceilings (the per-plan limits are enforced on top of these in the controller).
export const uploadImages = make(isImage, 'JPG, PNG, WebP, GIF, AVIF or TIFF images', { fileMb: 30, files: 20 });
export const uploadImagesForPdf = make(isImage, 'JPG, PNG, WebP, GIF, AVIF or TIFF images', { fileMb: 30, files: 50 });
export const uploadPdfs = make(isPdf, 'PDF files', { fileMb: 50, files: 20 });
export const uploadVideo = make(isVideo, 'an MP4, MOV, WebM, MKV or AVI video', { fileMb: 300, files: 1 });
