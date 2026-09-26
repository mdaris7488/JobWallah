import axios from 'axios';

// Access token lives ONLY in memory (never localStorage) -> XSS can't steal a long-lived credential.
// The refresh token is an httpOnly cookie the browser sends automatically to /api/v1/auth/*.
let accessToken = null;
let onAuthFailure = () => {};

export const setAccessToken = (token) => { accessToken = token; };
export const registerAuthFailureHandler = (fn) => { onAuthFailure = fn; };

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
const http = axios.create({ baseURL: BASE_URL, withCredentials: true, timeout: 20000 });

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Single-flight refresh: many parallel 401s (or React StrictMode double effects) share ONE refresh call,
// otherwise the rotating refresh token would be "re-used" and the server would end the session.
let refreshing = null;
export function refreshSession() {
  if (!refreshing) {
    refreshing = axios
      .post(`${BASE_URL}/auth/refresh`, null, { withCredentials: true })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthCall = original?.url?.startsWith('/auth/');
    if (status === 401 && original && !original._retry && !isAuthCall && accessToken) {
      original._retry = true;
      try {
        const { data } = await refreshSession();
        setAccessToken(data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return http(original);
      } catch {
        setAccessToken(null);
        onAuthFailure();
      }
    }
    return Promise.reject(error);
  }
);

export default http;

export function getErrorMessage(error) {
  const data = error?.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => `${e.field}: ${e.message}`).join(' | ');
  return data?.message || (error?.code === 'ECONNABORTED' ? 'Request timed out. Please retry.' : 'Something went wrong. Please try again.');
}
