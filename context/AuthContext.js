import React, { createContext, useState, useContext, useEffect } from 'react';
import { useClerk } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const clerk = useClerk();

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        const response = await authAPI.verifyToken();
        if (response.success && response.user) {
          setUser(response.user);
        } else {
          await AsyncStorage.removeItem('userToken');
        }
      }
    } catch (err) {
      console.error('Error checking login status:', err);
      await AsyncStorage.removeItem('userToken');
    } finally {
      setLoading(false);
    }
  };

  // login() and register() used to live here. Both were dead — no screen ever
  // called them (sign-in and sign-up both go through Clerk in Login.js /
  // Register.js), and their backend routes have been removed: POST
  // /api/auth/login was an unauthenticated NoSQL-injection surface, and the
  // email+password half of /api/auth/register created accounts that could
  // never authenticate because the User model has no password field.
  // Re-adding either here without a server route would fail at runtime.

  // UPDATE PROFILE
  // Expects: { displayName, username, email, phone, bio, photoURL, currentPassword?, newPassword? }
  const updateProfile = async (profileData) => {
    try {
      setError(null);
      const response = await authAPI.updateProfile(profileData);

      if (response.success && response.user) {
        // Merge updated fields into the current user state
        setUser((prev) => ({ ...prev, ...response.user }));
        return { success: true };
      }

      const message = response.message || 'Failed to update profile';
      setError(message);
      return { success: false, message };
    } catch (err) {
      const errorMessage = err?.response?.data?.message || err.message || 'Failed to update profile';
      setError(errorMessage);
      // Re-throw so EditProfile can catch it and show an Alert
      throw new Error(errorMessage);
    }
  };

  // LOGOUT
  const logout = async () => {
    try {
      try {
        if (clerk && typeof clerk.signOut === 'function') {
          await clerk.signOut();
        }
      } catch (clerkErr) {
        console.warn('Clerk signOut failed:', clerkErr);
      }
      await AsyncStorage.removeItem('userToken');
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, logout, updateProfile, loading, error }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};