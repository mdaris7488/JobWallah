import fsp from 'node:fs/promises';

async function head(filePath, n = 16) {
  const fh = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await fh.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

export async function isPdfFile(filePath) {
  return (await head(filePath, 5)).toString('latin1') === '%PDF-';
}

/** mp4/mov (ftyp), webm/mkv (EBML), avi (RIFF....AVI ) - checked on real bytes, not on the client's mimetype. */
export async function isVideoFile(filePath) {
  const b = await head(filePath, 16);
  if (b.length < 12) return false;
  if (b.subarray(4, 8).toString('latin1') === 'ftyp') return true;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return true;
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'AVI ') return true;
  return false;
}
