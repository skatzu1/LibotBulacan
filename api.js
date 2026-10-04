import axios from 'axios';

// ─── Single source of truth for the backend URL ───────────────────────────────
// EXPO_PUBLIC_API_URL lets a build profile point at a different server (a
// staging backend for preview builds, or your machine during development —
// see eas.json and .env.example). Unset means production, so existing builds
// and anyone running the app without extra setup behave exactly as before.
const PRODUCTION_API_URL = 'https://libotbackend.onrender.com';
export const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/+$/, '');

export const API_ENDPOINTS = {
  spots:        `${BASE_URL}/api/spots`,
  spotById:     (id)  => `${BASE_URL}/api/spots/${id}`,
  topVisited:   `${BASE_URL}/api/spots/top/visited`,
  spotCategory: (cat) => `${BASE_URL}/api/spots/category/${cat}`,
  categories:   `${BASE_URL}/api/categories`,
  reviews:      (spotId)    => `${BASE_URL}/api/reviews/${spotId}`,
  addReview:    `${BASE_URL}/api/reviews`,
  deleteReview: (reviewId)  => `${BASE_URL}/api/reviews/${reviewId}`,
  missions:     (spotId)    => `${BASE_URL}/api/missions/${spotId}`,
  verify:       (missionId) => `${BASE_URL}/api/verify/${missionId}`,
  bookmarks:    `${BASE_URL}/api/bookmarks`,
  bookmarkById: (spotId) => `${BASE_URL}/api/bookmarks/${spotId}`,
  users:        `${BASE_URL}/api/users`,
  userMe:       `${BASE_URL}/api/users/me`,
  userPoints:   `${BASE_URL}/api/users/points`,
  userBadges:   `${BASE_URL}/api/users/badges`,
  userClaims:   `${BASE_URL}/api/users/claimed-spots`,
  visitLogs:    `${BASE_URL}/api/visitlogs`,
  spotVisit:    (spotId) => `${BASE_URL}/api/spots/${spotId}/visit`,
  appeals:      `${BASE_URL}/api/appeals/me`,
  moderationStatus: `${BASE_URL}/api/reviews/user/moderation-status`,
  reports:      `${BASE_URL}/api/reports`,
  uploadProfile:`${BASE_URL}/api/upload/profile`,
  leaderboard:  `${BASE_URL}/api/leaderboard`,
  auth: {
    // login and check-user were removed server-side (2026-09-28): /login was an
    // unauthenticated NoSQL-injection surface with no caller, /check-user was an
    // unauthenticated account-existence oracle. register now only accepts a
    // verified Clerk session.
    register:    `${BASE_URL}/api/auth/register`,
    verify:      `${BASE_URL}/api/auth/verify`,
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

  verifyToken: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.auth.verify);
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

// ─── Users API ────────────────────────────────────────────────────────────────
export const fetchUsers = async () => {
  try {
    const response = await api.get(API_ENDPOINTS.users);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Network error' };
  }
};

// ─── Spots API ────────────────────────────────────────────────────────────────
export const spotAPI = {
  getAllSpots: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.spots);
      return response.data.spots;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },

  getSpotsByCategory: async (category) => {
    try {
      const response = await api.get(API_ENDPOINTS.spotCategory(category));
      return response.data.spots;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },
};

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