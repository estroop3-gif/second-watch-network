import { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { api, safeStorage } from '@/lib/api';
import { performanceMetrics } from '@/lib/performanceMetrics';

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

interface SignInResult {
  success: boolean;
  challenge?: {
    name: string;
    session: string;
    parameters?: Record<string, any>;
  };
}

interface AuthContextType {
  session: AuthSession | null;
  user: AuthUser | null;
  profile: any | null;
  profileId: string | null;
  loading: boolean;
  bootstrapError: string | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  completeNewPassword: (email: string, newPassword: string, session: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<SignUpResult>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  retryBootstrap: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const initialCheckComplete = useRef(false);
  const retryCount = useRef(0);

  /**
   * Check if an error is transient (network/timeout/5xx) vs auth error (401/403)
   */
  const isTransientError = (error: any): boolean => {
    const message = error?.message?.toLowerCase() || '';
    // Network errors, timeouts, or server errors are transient
    if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
      return true;
    }
    // 5xx errors are transient
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
      return true;
    }
    // Auth errors (401, 403, "invalid", "unauthorized") are NOT transient
    if (message.includes('401') || message.includes('403') || message.includes('invalid') || message.includes('unauthorized')) {
      return false;
    }
    // Default to transient for unknown errors (be optimistic)
    return true;
  };

  /**
   * Validate session with retry logic for transient errors
   */
  const validateSession = async (token: string, isRetry: boolean = false): Promise<boolean> => {
    api.setToken(token);

    try {
      // Performance: track first API call timing
      const apiCallStart = performanceMetrics.now();
      const userData = await api.getCurrentUser();
      const apiCallEnd = performanceMetrics.now();

      // Report first API call metrics (only on first attempt)
      if (!isRetry) {
        performanceMetrics.markFirstApiCall(
          '/api/v1/auth/me',
          apiCallStart,
          apiCallEnd,
          200
        );
      }

      const refreshToken = safeStorage.getItem('refresh_token') || '';

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
      setBootstrapError(null);

      // Try to load profile (non-blocking)
      try {
        const profileData = await api.getProfile();
        setProfile(profileData);
        if (profileData?.id) {
          safeStorage.setItem('profile_id', profileData.id);
        }
      } catch {
        // Profile may not exist yet - not a fatal error
      }

      return true;
    } catch (error: any) {
      // Check if this is a transient error (network/timeout/5xx)
      if (isTransientError(error)) {
        // For transient errors, keep the token and allow retry
        console.warn('[Auth] Transient error during session validation, will retry:', error.message);
        setBootstrapError('Connection issue - tap to retry');
        return false;
      } else {
        // For auth errors (401/403/invalid), clear the token
        // This is normal when tokens expire - log as info, not warning
        console.log('[Auth] Token expired or invalid, clearing session');
        safeStorage.removeItem('access_token');
        safeStorage.removeItem('refresh_token');
        safeStorage.removeItem('profile_id');
        api.setToken(null);
        setSession(null);
        setUser(null);
        setProfile(null);
        setBootstrapError(null);
        return false;
      }
    }
  };

  /**
   * Retry session validation - can be called by UI components
   */
  const retryBootstrap = async () => {
    const token = safeStorage.getItem('access_token');
    if (!token) return false;

    setLoading(true);
    setBootstrapError(null);
    retryCount.current += 1;
    performanceMetrics.incrementRetry();

    const success = await validateSession(token, true);

    setLoading(false);
    return success;
  };

  // Check for existing session on mount with auto-retry
  useEffect(() => {
    const checkSession = async () => {
      // Performance: mark auth check started
      performanceMetrics.markAuthCheckStarted();

      setLoading(true);
      const token = safeStorage.getItem('access_token');
      const hadToken = !!token;

      if (token) {
        let success = await validateSession(token);

        // Auto-retry once on transient error (helps with cold starts)
        if (!success && bootstrapError && retryCount.current === 0) {
          console.log('[Auth] Auto-retrying after transient error...');
          await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s
          retryCount.current = 1;
          success = await validateSession(token, true);
        }

        // Performance: mark auth check completed
        performanceMetrics.markAuthCheckCompleted(hadToken, success);
      } else {
        // Performance: mark auth check completed (no token)
        performanceMetrics.markAuthCheckCompleted(false, false);
      }

      setLoading(false);
      initialCheckComplete.current = true;
    };

    checkSession();
  }, []);

  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    // Performance: mark Cognito request started
    performanceMetrics.markCognitoStarted();

    try {
      const data = await api.signIn(email, password);

      // Performance: mark Cognito response received
      performanceMetrics.markCognitoCompleted(true);

      // Check if there's a challenge (e.g., NEW_PASSWORD_REQUIRED)
      if (data.challenge) {
        return {
          success: false,
          challenge: {
            name: data.challenge,
            session: data.session || '',
            parameters: data.parameters,
          },
        };
      }

      // Store tokens
      safeStorage.setItem('access_token', data.access_token!);
      if (data.refresh_token) {
        safeStorage.setItem('refresh_token', data.refresh_token);
      }
      // Performance: mark token stored
      performanceMetrics.markTokenStored();

      api.setToken(data.access_token!);

      // Create session
      const authSession: AuthSession = {
        access_token: data.access_token!,
        refresh_token: data.refresh_token || '',
        expires_in: 3600,
        token_type: 'bearer',
        user: data.user as AuthUser,
      };

      setSession(authSession);
      setUser(data.user as AuthUser);

      // Performance: mark bootstrap started
      performanceMetrics.markBootstrapStarted();

      // Use profile data from signin response if available (optimization)
      // The signin endpoint now returns full profile data
      if (data.user?.id && data.user?.role !== undefined) {
        // Full profile data is included in the signin response
        setProfile(data.user);
        if (data.user.id) {
          safeStorage.setItem('profile_id', data.user.id);
        }
      } else {
        // Fallback: fetch profile separately if not included
        try {
          const profileData = await api.getProfile();
          setProfile(profileData);
          if (profileData?.id) {
            safeStorage.setItem('profile_id', profileData.id);
          }
        } catch {
          // Profile may not exist yet
        }
      }

      // Performance: mark bootstrap completed (success)
      performanceMetrics.markBootstrapCompleted(true);

      return { success: true };
    } catch (error) {
      // Performance: mark Cognito completed with error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      performanceMetrics.markCognitoCompleted(false, errorMessage);
      performanceMetrics.markBootstrapCompleted(false, errorMessage);

      console.error('Sign in error:', error);
      throw error;
    }
  };

  const completeNewPassword = async (email: string, newPassword: string, session: string) => {
    try {
      const data = await api.completeNewPassword(email, newPassword, session);

      // Store tokens
      safeStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        safeStorage.setItem('refresh_token', data.refresh_token);
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

      // Use profile data from response if available (like signIn does)
      // This avoids a race condition where components start fetching before we're ready
      if (data.user?.id && data.user?.role !== undefined) {
        // Full profile data is included in the response
        setSession(authSession);
        setUser(data.user as AuthUser);
        setProfile(data.user);
        if (data.user.id) {
          safeStorage.setItem('profile_id', data.user.id);
        }
      } else {
        // Fetch profile BEFORE setting user state to avoid race conditions
        let profileData = null;
        try {
          profileData = await api.getProfile();
        } catch {
          // Profile may not exist yet
        }

        // Set all state together
        setSession(authSession);
        setUser(data.user as AuthUser);
        if (profileData) {
          setProfile(profileData);
          if (profileData.id) {
            safeStorage.setItem('profile_id', profileData.id);
          }
        }
      }
    } catch (error) {
      console.error('Complete new password error:', error);
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
      safeStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        safeStorage.setItem('refresh_token', data.refresh_token);
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
    safeStorage.removeItem('access_token');
    safeStorage.removeItem('refresh_token');
    safeStorage.removeItem('profile_id');
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

  const profileId = profile?.id || safeStorage.getItem('profile_id') || null;

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      profileId,
      loading,
      bootstrapError,
      signIn,
      completeNewPassword,
      signUp,
      confirmSignUp,
      signOut,
      retryBootstrap,
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
