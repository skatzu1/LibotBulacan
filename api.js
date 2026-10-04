import axios from 'axios';
import { readStarted } from './utils/serverActivity';

// ─── Single source of truth for the backend URL ───────────────────────────────
// EXPO_PUBLIC_API_URL lets a build profile point at a different server (a
// staging backend for preview builds, or your machine during development —
// see eas.json and .env.example). Unset means production, so existing builds
// and anyone running the app without extra setup behave exactly as before.
const PRODUCTION_API_URL = 'https://libotbackend.onrender.com';
export const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/+$/, '');

// Only the endpoints the helpers below use. Screens and contexts build their
// URLs from BASE_URL directly; the ~20 entries here that nothing read were
// removed on 2026-10-04.
export const API_ENDPOINTS = {
  spots:        `${BASE_URL}/api/spots`,
  categories:   `${BASE_URL}/api/categories`,
  spotVisit:    (spotId) => `${BASE_URL}/api/spots/${spotId}/visit`,
  appeals:      `${BASE_URL}/api/appeals/me`,
  moderationStatus: `${BASE_URL}/api/reviews/user/moderation-status`,
  auth: {
    // login and check-user were removed server-side (2026-09-28): /login was an
    // unauthenticated NoSQL-injection surface with no caller, /check-user was an
    // unauthenticated account-existence oracle; /verify (a pre-Clerk app
    // token) went on 2026-10-04. register only accepts a verified Clerk session.
    register:    `${BASE_URL}/api/auth/register`,
    // Says only whether an address is a temp-mail one — nothing about
    // whether it has an account.
    checkEmail:  `${BASE_URL}/api/auth/check-email`,
  },
};

// ─── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // Without a timeout a request on a dead connection never settles, and the
  // screen waiting on it spins forever instead of showing its retry state.
  // 60 s still outlasts a sleeping free-tier Render instance waking up
  // (30–60 s), so a cold start is slow but not an error.
  timeout: 60_000,
});

// ─── Clerk Token Injector ─────────────────────────────────────────────────────
// The interceptor is registered ONCE, synchronously, at module load — not
// inside a React effect. This guarantees it exists before any component
// (e.g. ReviewProvider) can mount and fire off a request. setupClerkInterceptor
// is now just a cheap, idempotent assignment to a mutable holder, so it's safe
// to call directly from a component's render body on every render, with no
// ordering dependency on other useEffect calls.
//
//   import { setupClerkInterceptor } from './api';
//   if (isLoaded) setupClerkInterceptor(getToken);   // call in render body
const tokenGetterRef = { current: null };

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

// Reads through this instance count toward the "waking up the server" notice
// too (utils/serverActivity.js); plain fetch calls are counted in App.js.
api.interceptors.request.use((config) => {
  if ((config.method || "get").toLowerCase() === "get") config.readEnded = readStarted();
  return config;
});
api.interceptors.response.use(
  (res) => { res.config?.readEnded?.(); return res; },
  (err) => { err?.config?.readEnded?.(); return Promise.reject(err); },
);

export const setupClerkInterceptor = (getToken) => {
  tokenGetterRef.current = getToken;
};

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authAPI = {
  register: async (payload) => {
    try {
      const response = await api.post(API_ENDPOINTS.auth.register, payload);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },

  // Is this a temp-mail address? Asked before a sign-up starts. Never throws:
  // offline, slow or erroring, it answers "no" and the sign-up goes ahead —
  // Clerk's emailed code still has to be read from a real inbox.
  isDisposableEmail: async (email) => {
    try {
      const response = await api.post(API_ENDPOINTS.auth.checkEmail, { email }, { timeout: 5000 });
      return response.data?.disposable === true;
    } catch {
      return false;
    }
  },

  // checkUserExists() removed with its route — it was an unauthenticated
  // "is this email registered?" oracle and nothing in the app called it.
};

// fetchUsers() and spotAPI (getAllSpots, getSpotsByCategory) were removed on
// 2026-10-04: nothing called them. The spot list comes from ArrivalContext and
// the leaderboard from Screens/Leaderboard.js.

// ─── Categories API ───────────────────────────────────────────────────────────
// The four categories used to be a hardcoded array in Screens/Categories.js,
// which meant adding or renaming one required an app store release. They now
// live in the database and an admin can edit them through /api/categories.
// Public endpoint — no auth, same as the spots list.
export const categoryAPI = {
  getAll: async () => {
    const response = await api.get(API_ENDPOINTS.categories);
    return response.data.categories || [];
  },
};

// ─── Appeals API ──────────────────────────────────────────────────────────────
export const appealAPI = {
  getMyStatus: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.appeals);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },

  submit: async (appealText) => {
    const response = await api.post(API_ENDPOINTS.appeals, { appealText });
    return response.data;
  },
};

// ─── Moderation API ───────────────────────────────────────────────────────────
// Mute / suspension / ban status for the signed-in user — powers the
// SuspendedNotice popup and the comment-bar notice in InformationScreen.
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