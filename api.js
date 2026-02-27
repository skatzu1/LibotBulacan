import axios from 'axios';

const API_URL = 'https://libotbackend.onrender.com';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Clerk Token Injector ─────────────────────────────────────────────────────
// Call this once at app startup (e.g. inside your App.js or auth provider)
// after Clerk is loaded, passing in the `getToken` function from useAuth().
//
//   import { setupClerkInterceptor } from './api';
//   const { getToken } = useAuth();
//   setupClerkInterceptor(getToken);
//
export const setupClerkInterceptor = (getToken) => {
  api.interceptors.request.use(async (config) => {
    try {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
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
      const response = await api.post('/api/auth/login', { email, password });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },

  register: async (payload) => {
    try {
      const response = await api.post('/api/auth/register', payload);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },

  // Token is now auto-attached by the interceptor — no manual header needed
  verifyToken: async () => {
    try {
      const response = await api.get('/api/auth/verify');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },

  checkUserExists: async (email) => {
    try {
      const response = await api.get('/api/auth/check-user', { params: { email } });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },
};

// ─── Users API ────────────────────────────────────────────────────────────────
// clerkToken param no longer needed — interceptor handles it automatically.
// Kept for backward compatibility but ignored.
export const fetchUsers = async () => {
  try {
    const response = await api.get('/api/users');
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Network error' };
  }
};

// ─── Spots API ────────────────────────────────────────────────────────────────
export const spotAPI = {
  getAllSpots: async () => {
    try {
      const response = await api.get('/api/spots');
      return response.data.spots;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },

  getSpotsByCategory: async (category) => {
    try {
      const response = await api.get(`/api/spots/category/${category}`);
      return response.data.spots;
    } catch (error) {
      throw error.response?.data || { message: 'Network error' };
    }
  },
};

export default api;