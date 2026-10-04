import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useClerk } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// What is left of the app's own auth layer: signing out. Sign-in, sign-up and
// the session itself are Clerk's (Login.js, Register.js, useAuth from
// @clerk/clerk-expo).
//
// This context used to restore a "user" from an app token in AsyncStorage
// ('userToken') via GET /api/auth/verify, and offered updateProfile(). Both
// were dead: nothing has stored that token since sign-in moved to Clerk, so
// the user was always null, and updateProfile called an authAPI method that
// did not exist. The route is gone from the backend too (2026-10-04).

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const clerk = useClerk();

  const logout = useCallback(async () => {
    try {
      if (clerk && typeof clerk.signOut === 'function') await clerk.signOut();
    } catch (clerkErr) {
      console.warn('Clerk signOut failed:', clerkErr);
    }
    // A phone that once ran a pre-Clerk build may still hold that token.
    AsyncStorage.removeItem('userToken').catch(() => {});
  }, [clerk]);

  const value = useMemo(() => ({ logout }), [logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
