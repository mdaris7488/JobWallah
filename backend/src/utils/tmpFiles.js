import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { env } from '../config/env.js';

// Private scratch folder for uploads that are being processed. Files get random names and are always removed.
export const TOOLS_DIR = path.resolve(env.TOOLS_TMP_DIR || path.join(os.tmpdir(), 'jobwallah-tools'));
fs.mkdirSync(TOOLS_DIR, { recursive: true, mode: 0o700 });

export const removeFile = async (filePath) => {
  if (!filePath) return;
  try { await fsp.unlink(filePath); } catch { /* already gone */ }
};
export const removeFiles = (files = []) => Promise.allSettled(files.map((f) => removeFile(f.path)));

/** Safety net: delete anything older than maxAgeMs (crashed requests, abandoned jobs). */
export async function purgeOldFiles(maxAgeMs) {
  let names = [];
  try { names = await fsp.readdir(TOOLS_DIR); } catch { return; }
  const now = Date.now();
  await Promise.allSettled(names.map(async (name) => {
    const p = path.join(TOOLS_DIR, name);
    const st = await fsp.stat(p);
    if (st.isFile() && now - st.mtimeMs > maxAgeMs) await fsp.unlink(p);
  }));
}
