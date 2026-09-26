import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import http, { getErrorMessage, refreshSession, setAccessToken } from '../api/http';
import { authApi } from '../api';

const HINT = 'rs_session_hint'; // non-sensitive flag: "this browser had a session" -> avoids a pointless refresh call for guests

export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async (_, { rejectWithValue }) => {
  if (!localStorage.getItem(HINT)) return null;
  try {
    const { data } = await refreshSession();
    setAccessToken(data.data.accessToken);
    return data.data.user;
  } catch {
    localStorage.removeItem(HINT);
    return rejectWithValue(null);
  }
});

const sessionThunk = (name, call) =>
  createAsyncThunk(name, async (payload, { rejectWithValue }) => {
    try {
      const { data } = await call(payload);
      setAccessToken(data.data.accessToken);
      localStorage.setItem(HINT, '1');
      return data.data.user;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err));
    }
  });

export const login = sessionThunk('auth/login', authApi.login);
export const register = sessionThunk('auth/register', authApi.register);

export const logout = createAsyncThunk('auth/logout', async () => {
  try { await authApi.logout(); } catch { /* cookie may already be gone */ }
  setAccessToken(null);
  localStorage.removeItem(HINT);
});

export const saveProfile = createAsyncThunk('auth/saveProfile', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await http.patch('/me', payload);
    return data.data.user;
  } catch (err) {
    return rejectWithValue(getErrorMessage(err));
  }
});

const slice = createSlice({
  name: 'auth',
  initialState: { user: null, ready: false, error: null, busy: false },
  reducers: {
    sessionExpired(state) { state.user = null; localStorage.removeItem(HINT); },
    clearAuthError(state) { state.error = null; },
  },
  extraReducers: (b) => {
    b.addCase(bootstrapAuth.fulfilled, (s, a) => { s.user = a.payload; s.ready = true; });
    b.addCase(bootstrapAuth.rejected, (s) => { s.user = null; s.ready = true; });
    for (const t of [login, register]) {
      b.addCase(t.pending, (s) => { s.busy = true; s.error = null; });
      b.addCase(t.fulfilled, (s, a) => { s.busy = false; s.user = a.payload; });
      b.addCase(t.rejected, (s, a) => { s.busy = false; s.error = a.payload || 'Something went wrong'; });
    }
    b.addCase(logout.fulfilled, (s) => { s.user = null; });
    b.addCase(saveProfile.fulfilled, (s, a) => { s.user = a.payload; });
  },
});

export const { sessionExpired, clearAuthError } = slice.actions;
export default slice.reducer;
