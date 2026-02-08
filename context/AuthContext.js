import React, { createContext, useState, useContext, useEffect } from 'react';
import { useClerk } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);         // Logged-in user
  const [loading, setLoading] = useState(true);   // Loading state for startup
  const [error, setError] = useState(null);       // Any login/register errors
  const clerk = useClerk();

  // Check login status when app starts
  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        const response = await authAPI.verifyToken();
        if (response.success && response.user) {
          setUser(response.user);  // User is logged in
        } else {
          await AsyncStorage.removeItem('userToken'); // Token invalid, remove it
        }
      }
    } catch (err) {
      console.error('Error checking login status:', err);
      await AsyncStorage.removeItem('userToken');
    } finally {
      setLoading(false);
    }
  };

  // LOGIN function
  const login = async (email, password) => {
    try {
      setError(null);
      const response = await authAPI.login(email, password);

      if (response.success && response.token) {
        await AsyncStorage.setItem('userToken', response.token); // Store JWT
        setUser(response.user); // Store user in context
        return { success: true };
      }

      // If backend returns error
      setError(response.message || 'Invalid credentials');
      return { success: false, message: response.message || 'Invalid credentials' };

    } catch (err) {
      const errorMessage = err?.response?.data?.message || err.message || 'Login failed';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    }
  };

  // REGISTER function (optional, keeps JWT flow consistent)
  const register = async (email, password, name) => {
    try {
      setError(null);
      // Support backend expecting separate name fields
      const [firstName, ...lastNameParts] = (name || '').trim().split(' ');
      const lastName = lastNameParts.join(' ');
      const response = await authAPI.register({ email, password, firstName, lastName });

      if (response.success && response.token) {
        await AsyncStorage.setItem('userToken', response.token);
        setUser(response.user);
        return { success: true };
      }

      setError(response.message || 'Registration failed');
      return { success: false, message: response.message || 'Registration failed' };

    } catch (err) {
      const errorMessage = err?.response?.data?.message || err.message || 'Registration failed';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    }
  };

  // LOGOUT function
  const logout = async () => {
    try {
      // If Clerk is available, sign out the Clerk session as well
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
    <AuthContext.Provider value={{ user, login, register, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};