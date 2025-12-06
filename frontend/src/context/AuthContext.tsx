import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/api';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      const token = localStorage.getItem('access_token');

      if (token) {
        api.setToken(token);
        try {
          const userData = await api.getCurrentUser();
          const refreshToken = localStorage.getItem('refresh_token') || '';

          // Set the session on the Supabase client so supabase.auth.getUser() works
          try {
            await supabase.auth.setSession({
              access_token: token,
              refresh_token: refreshToken,
            });
          } catch (e) {
            // Token might not be a valid Supabase JWT - that's OK for backend-only auth
            console.warn('Could not set Supabase session:', e);
          }

          // Create a session-like object for compatibility
          const mockSession: Session = {
            access_token: token,
            refresh_token: refreshToken,
            expires_in: 3600,
            token_type: 'bearer',
            user: userData as User,
          };

          setSession(mockSession);
          setUser(userData as User);
        } catch (error) {
          // Token is invalid, clear it
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          api.setToken(null);
          setSession(null);
          setUser(null);
        }
      } else {
        // Fallback to Supabase session for backward compatibility
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
      }

      setLoading(false);
    };

    checkSession();

    // Keep Supabase auth listener for OAuth flows
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !localStorage.getItem('access_token')) {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await api.signIn(email, password);

      // Store tokens
      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }

      api.setToken(data.access_token);

      // Set the session on the Supabase client so supabase.auth.getUser() works
      try {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token || '',
        });
      } catch (e) {
        // Token might not be a valid Supabase JWT - that's OK for backend-only auth
        console.warn('Could not set Supabase session:', e);
      }

      // Create mock session for compatibility
      const mockSession: Session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
        expires_in: 3600,
        token_type: 'bearer',
        user: data.user as User,
      };

      setSession(mockSession);
      setUser(data.user as User);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const data = await api.signUp(email, password, fullName);

      // Store tokens
      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }

      api.setToken(data.access_token);

      // Set the session on the Supabase client so supabase.auth.getUser() works
      try {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token || '',
        });
      } catch (e) {
        // Token might not be a valid Supabase JWT - that's OK for backend-only auth
        console.warn('Could not set Supabase session:', e);
      }

      // Create mock session for compatibility
      const mockSession: Session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
        expires_in: 3600,
        token_type: 'bearer',
        user: data.user as User,
      };

      setSession(mockSession);
      setUser(data.user as User);
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    // Clear local state first to ensure UI updates immediately
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    api.setToken(null);
    setSession(null);
    setUser(null);

    // Try to sign out from backend API
    try {
      await api.signOut();
    } catch (error) {
      console.warn('Backend sign out error (non-blocking):', error);
    }

    // Also sign out from Supabase for OAuth sessions
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Supabase sign out error (non-blocking):', error);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};