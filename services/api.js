import axios from 'axios';

// Use configured backend URL. Replace or override here if needed.
const API_URL = 'https://libotbackend.onrender.com';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Note: Removed AsyncStorage interceptor since Clerk token is passed explicitly

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

// New function to fetch users, requires Clerk JWT token
export const fetchUsers = async (clerkToken) => {
  try {
    const response = await api.get('/api/users', {
      headers: {
        Authorization: `Bearer ${clerkToken}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Network error' };
  }
};

export const spotAPI = {
  getAllSpots: async () => {
    try {
      const response = await api.get('/api/spots');
      return response.data.spots; // because backend returns { success: true, spots: [...] }
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
