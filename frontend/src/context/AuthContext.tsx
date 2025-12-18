import { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { api } from '@/lib/api';

// Custom types to replace Supabase types
interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: AuthUser;
}

interface SignUpResult {
  needsConfirmation: boolean;
  user?: any;
}

interface AuthContextType {
  session: AuthSession | null;
  user: AuthUser | null;
  profile: any | null;
  profileId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<SignUpResult>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const initialCheckComplete = useRef(false);

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

          // Create a session object
          const authSession: AuthSession = {
            access_token: token,
            refresh_token: refreshToken,
            expires_in: 3600,
            token_type: 'bearer',
            user: userData as AuthUser,
          };

          setSession(authSession);
          setUser(userData as AuthUser);

          // Try to load profile
          try {
            const profileData = await api.getProfile();
            setProfile(profileData);
            if (profileData?.id) {
              localStorage.setItem('profile_id', profileData.id);
            }
          } catch {
            // Profile may not exist yet
          }
        } catch (error) {
          // Token is invalid, clear it
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('profile_id');
          api.setToken(null);
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      }

      setLoading(false);
      initialCheckComplete.current = true;
    };

    checkSession();
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

      // Create session
      const authSession: AuthSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
        expires_in: 3600,
        token_type: 'bearer',
        user: data.user as AuthUser,
      };

      setSession(authSession);
      setUser(data.user as AuthUser);

      // Load profile
      try {
        const profileData = await api.getProfile();
        setProfile(profileData);
        if (profileData?.id) {
          localStorage.setItem('profile_id', profileData.id);
        }
      } catch {
        // Profile may not exist yet
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, fullName?: string): Promise<SignUpResult> => {
    try {
      const data = await api.signUp(email, password, fullName);

      // Check if Cognito requires email confirmation
      if (data.access_token === 'pending_confirmation') {
        return {
          needsConfirmation: true,
          user: data.user,
        };
      }

      // Store tokens
      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }

      api.setToken(data.access_token);

      // Create session
      const authSession: AuthSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
        expires_in: 3600,
        token_type: 'bearer',
        user: data.user as AuthUser,
      };

      setSession(authSession);
      setUser(data.user as AuthUser);

      return { needsConfirmation: false, user: data.user };
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const confirmSignUp = async (email: string, code: string) => {
    try {
      await api.confirmSignUp(email, code);
    } catch (error) {
      console.error('Confirm signup error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    // Clear local state first to ensure UI updates immediately
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('profile_id');
    api.setToken(null);
    setSession(null);
    setUser(null);
    setProfile(null);

    // Try to sign out from backend API
    try {
      await api.signOut();
    } catch (error) {
      console.warn('Backend sign out error (non-blocking):', error);
    }
  };

  const profileId = profile?.id || localStorage.getItem('profile_id') || null;

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      profileId,
      loading,
      signIn,
      signUp,
      confirmSignUp,
      signOut
    }}>
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
