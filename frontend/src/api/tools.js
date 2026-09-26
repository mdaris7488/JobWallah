import http from './http';

/** Errors of blob requests arrive as a Blob - turn them back into JSON so getErrorMessage() works. */
async function unwrapBlobError(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try { err.response.data = JSON.parse(await data.text()); } catch { /* keep as is */ }
  }
  return err;
}

const filenameOf = (headers, fallback) => /filename="([^"]+)"/.exec(headers['content-disposition'] || '')?.[1] || fallback;

const readMeta = (h) => ({
  originalBytes: Number(h['x-original-bytes']) || 0,
  resultBytes: Number(h['x-result-bytes']) || 0,
  count: Number(h['x-result-count']) || 1,
  targetMet: h['x-target-met'] !== 'false',
});

/** POST multipart -> file (image / pdf / zip). */
export async function runTool(path, formData, { onUploadProgress } = {}) {
  try {
    const res = await http.post(`/tools/${path}`, formData, { responseType: 'blob', timeout: 10 * 60 * 1000, onUploadProgress });
    return { blob: res.data, filename: filenameOf(res.headers, 'result'), contentType: res.headers['content-type'], meta: readMeta(res.headers) };
  } catch (err) {
    throw await unwrapBlobError(err);
  }
}

export const toolsApi = {
  config: () => http.get('/tools/config'),
  startVideo: (formData, onUploadProgress) => http.post('/tools/video/compress', formData, { timeout: 0, onUploadProgress }),
  videoStatus: (id) => http.get(`/tools/jobs/${id}`),
  async videoDownload(id) {
    try {
      const res = await http.get(`/tools/jobs/${id}/download`, { responseType: 'blob', timeout: 10 * 60 * 1000 });
      return { blob: res.data, filename: filenameOf(res.headers, 'video-compressed.mp4'), contentType: 'video/mp4', meta: readMeta(res.headers) };
    } catch (err) {
      throw await unwrapBlobError(err);
    }
  },
};
