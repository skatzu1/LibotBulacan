import axios from 'axios';
import { readStarted } from './utils/serverActivity';
import { addConditionalGets } from './utils/etagCache';

const PRODUCTION_API_URL = 'https://libotbackend.onrender.com';
export const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/+$/, '');

export const API_ENDPOINTS = {
  spots:        `${BASE_URL}/api/spots`,
  categories:   `${BASE_URL}/api/categories`,
  spotVisit:    (spotId) => `${BASE_URL}/api/spots/${spotId}/visit`,
  appeals:      `${BASE_URL}/api/appeals/me`,
  moderationStatus: `${BASE_URL}/api/reviews/user/moderation-status`,
  auth: {
    register:    `${BASE_URL}/api/auth/register`,
    checkEmail:  `${BASE_URL}/api/auth/check-email`,
  },
};

// ─── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // A 60-second timeout so requests don't hang forever on a slow connection
  timeout: 60_000,
});

// ─── Clerk Token Injector ─────────────────────────────────────────────────────
// A container that holds the Clerk token getter function.
const tokenGetterRef = { current: null };

// This is how the backend knows who the logged-in user is.
api.interceptors.request.use(async (config) => {
  try {
    if (tokenGetterRef.current) {
      const token = await tokenGetterRef.current();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.warn('Could not get Clerk token:', e);
  }
  return config;
});

api.interceptors.request.use((config) => {
  if ((config.method || "get").toLowerCase() === "get") config.readEnded = readStarted();
  return config;
});
api.interceptors.response.use(
  (res) => { res.config?.readEnded?.(); return res; },
  (err) => { err?.config?.readEnded?.(); return Promise.reject(err); },
);
// A repeat read the server says hasn't changed comes back without its body.
addConditionalGets(api);

export const setupClerkInterceptor = (getToken) => {
  tokenGetterRef.current = getToken;
};

// ─── Auth API ─────────────────────────────────────────────────────────────────
// Handles Account creation and Temp-Mail rejection. Login is handled by Clerk.
export const authAPI = {
  register: async (payload) => {
    try {
      const response = await api.post(API_ENDPOINTS.auth.register, payload);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },

  isDisposableEmail: async (email) => {
    try {
      const response = await api.post(API_ENDPOINTS.auth.checkEmail, { email }, { timeout: 5000 });
      return response.data?.disposable === true;
    } catch {
      return false;
    }
  },
};

// Fetches all spot categories (History, Nature, Festival, Religious).
export const categoryAPI = {
  getAll: async () => {
    const response = await api.get(API_ENDPOINTS.categories);
    return response.data.categories || [];
  },
};

// ─── Appeals API ──────────────────────────────────────────────────────────────
// Fetch Current User's appeal
export const appealAPI = {
  getMyStatus: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.appeals);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },
// Submit an appeal
  submit: async (appealText) => {
    const response = await api.post(API_ENDPOINTS.appeals, { appealText });
    return response.data;
  },
};

// ─── Moderation API ───────────────────────────────────────────────────────────
// Fetch current user status (Banned, Muted, Suspended).
export const moderationAPI = {
  getStatus: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.moderationStatus);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },
};

export default api;