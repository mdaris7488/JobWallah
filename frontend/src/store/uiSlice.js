import { createSlice } from '@reduxjs/toolkit';

const slice = createSlice({
  name: 'ui',
  initialState: { toast: null },
  reducers: {
    showToast(state, a) { state.toast = { id: Date.now(), type: 'info', ...a.payload }; },
    clearToast(state) { state.toast = null; },
  },
});
export const { showToast, clearToast } = slice.actions;
export default slice.reducer;
