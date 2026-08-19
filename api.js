import axios from 'axios';

// ─── Single source of truth for the backend URL ───────────────────────────────
export const BASE_URL = 'https://libotbackend.onrender.com';

export const API_ENDPOINTS = {
  spots:        `${BASE_URL}/api/spots`,
  spotById:     (id)  => `${BASE_URL}/api/spots/${id}`,
  topVisited:   `${BASE_URL}/api/spots/top/visited`,
  spotCategory: (cat) => `${BASE_URL}/api/spots/category/${cat}`,
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
    login:       `${BASE_URL}/api/auth/login`,
    register:    `${BASE_URL}/api/auth/register`,
    verify:      `${BASE_URL}/api/auth/verify`,
    checkUser:   `${BASE_URL}/api/auth/check-user`,
  },
};

// ─── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Clerk Token Injector ─────────────────────────────────────────────────────
// Call once at app startup after Clerk is loaded:
//   import { setupClerkInterceptor } from './api';
//   setupClerkInterceptor(getToken);
export const setupClerkInterceptor = (getToken) => {
  api.interceptors.request.use(async (config) => {
    try {
      const token = await getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      console.warn('Could not get Clerk token:', e);
    }
    return config;
  });
};

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authAPI = {
  login: async (email, password) => {
    try {
      const response = await api.post(API_ENDPOINTS.auth.login, { email, password });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },

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

  checkUserExists: async (email) => {
    try {
      const response = await api.get(API_ENDPOINTS.auth.checkUser, { params: { email } });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },
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