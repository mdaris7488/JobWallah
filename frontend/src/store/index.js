import { configureStore } from '@reduxjs/toolkit';
import authReducer, { sessionExpired } from './authSlice';
import uiReducer from './uiSlice';
import { registerAuthFailureHandler } from '../api/http';

export const store = configureStore({ reducer: { auth: authReducer, ui: uiReducer } });
registerAuthFailureHandler(() => store.dispatch(sessionExpired()));
