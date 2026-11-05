import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useClerk } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
