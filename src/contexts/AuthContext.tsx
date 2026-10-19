import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { legacyClient, legacyEnabled } from '@/integrations/supabase/legacy';
import { Profile, UserRole, AuthUser } from '@/types/database';
import { safeReturnPath, rememberAuthReturn } from '@/lib/auth-navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  authUser: AuthUser | null;
  loading: boolean;
  userDataLoading: boolean;
  userDataError: string | null;
  retryUserData: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string, returnTo?: string) => Promise<{ error: Error | null }>;
  resendVerification: (email: string, returnTo?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (returnTo?: string) => Promise<{ error: Error | null }>;
  /** After a failed V2 sign-in: does this account still live on the old project? */
  checkLegacyAccount: (
    email: string,
    password: string
  ) => Promise<
    { found: true; v1AccessToken: string; alreadyMigrated: boolean } | { found: false }
  >;
  migrateLegacyAccount: (
    email: string,
    v1AccessToken: string,
    newPassword: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [userDataError, setUserDataError] = useState<string | null>(null);
  const currentUserId = useRef<string | null>(null);
  const authEventVersion = useRef(0);
  const profileRequestVersion = useRef(0);

  const fetchUserData = async (userId: string, email: string) => {
    const requestVersion = ++profileRequestVersion.current;
    const isCurrentRequest = () => currentUserId.current === userId
      && profileRequestVersion.current === requestVersion;
    setUserDataLoading(true);
    setUserDataError(null);
    try {
      // Fetch profile and roles in parallel
      const [profileResult, rolesResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('*').eq('user_id', userId)
      ]);

      if (!isCurrentRequest()) return;
      if (rolesResult.error) throw new Error('Could not verify your account permissions. Check your connection and retry.');
      if (profileResult.error) throw new Error('Could not load your account profile. Check your connection and retry.');

      const profile = profileResult.data as Profile | null;
      const roles = (rolesResult.data || []) as UserRole[];
      const isAdmin = roles.some(r => r.role === 'admin');
      if (!isCurrentRequest()) return;

      setAuthUser({
        id: userId,
        email,
        profile,
        roles,
        isAdmin
      });
    } catch (error) {
      if (!isCurrentRequest()) return;
      setUserDataError(error instanceof Error ? error.message : 'Could not verify your account permissions. Check your connection and retry.');
    } finally {
      if (isCurrentRequest()) setUserDataLoading(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        authEventVersion.current += 1;
        currentUserId.current = session?.user.id ?? null;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Mark auth as ready immediately, fetch profile/roles in background.
          setUserDataLoading(true);
          setAuthUser(previous => previous?.id === session.user.id ? previous : {
            id: session.user.id,
            email: session.user.email || '',
            profile: null,
            roles: [],
            isAdmin: false,
          });

          fetchUserData(session.user.id, session.user.email || '');
        } else {
          profileRequestVersion.current += 1;
          setAuthUser(null);
          setUserDataLoading(false);
          setUserDataError(null);
        }
        setLoading(false);
      }
    );

    // Then check for existing session
    (async () => {
      const startedAtVersion = authEventVersion.current;
      const { data: { session } } = await supabase.auth.getSession();
      if (authEventVersion.current !== startedAtVersion) return;
      currentUserId.current = session?.user.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setUserDataLoading(true);
        setAuthUser(previous => previous?.id === session.user.id ? previous : {
          id: session.user.id,
          email: session.user.email || '',
          profile: null,
          roles: [],
          isAdmin: false,
        });

        fetchUserData(session.user.id, session.user.email || '');
      } else {
        profileRequestVersion.current += 1;
        setAuthUser(null);
        setUserDataLoading(false);
        setUserDataError(null);
      }

      setLoading(false);
    })();

    return () => {
      currentUserId.current = null;
      authEventVersion.current += 1;
      profileRequestVersion.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, returnTo = '/courses') => {
    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('next', safeReturnPath(returnTo, '/courses'));
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Follow whichever origin the user actually signed up on, so the link in
        // the email works from localhost and preview deploys too. Every origin used
        // here must be listed in Supabase > Authentication > URL Configuration.
        emailRedirectTo: callback.toString(),
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const resendVerification = async (email: string, returnTo = '/courses') => {
    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('next', safeReturnPath(returnTo, '/courses'));
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: callback.toString() },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithGoogle = async (returnTo = '/home') => {
    const destination = safeReturnPath(returnTo);
    rememberAuthReturn(destination);
    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('next', destination);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callback.toString(),
        queryParams: { prompt: 'select_account' },
      },
    });
    return { error };
  };

  /**
   * Is this a V1 account that has not moved to V2 yet?
   *
   * Called only after a V2 sign-in fails. Their old password still works against V1,
   * and that session is what lets us rebuild them here — but it is deliberately not
   * persisted, so it can never become the app's session.
   */
  const checkLegacyAccount = async (email: string, password: string) => {
    if (!legacyEnabled) return { found: false as const };

    const legacy = legacyClient();
    const { data, error } = await legacy.auth.signInWithPassword({ email, password });

    if (error || !data.session) return { found: false as const };

    const v1AccessToken = data.session.access_token;

    // The old password still works on V1 forever, so a user who has ALREADY moved —
    // and whose browser autofills that old password — would otherwise be shown the
    // "we've moved" screen on every login and silently have their password reset each
    // time. Ask the server which case this is before deciding what to show them.
    let alreadyMigrated = false;
    try {
      const response = await fetch('/api/migrate-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ v1_access_token: v1AccessToken, check_only: true }),
      });
      const result = await response.json();
      alreadyMigrated = Boolean(result?.already_migrated);
    } catch {
      // If the check itself fails, fall through and offer migration. Worst case the
      // user sets a password they already had; better than blocking them entirely.
    }

    return { found: true as const, v1AccessToken, alreadyMigrated };
  };

  /**
   * Rebuilds a V1 user in V2, then signs them in here.
   *
   * The server re-verifies the V1 token against V1 before it trusts any of this —
   * the browser is not believed about who it is.
   */
  const migrateLegacyAccount = async (
    email: string,
    v1AccessToken: string,
    newPassword: string
  ) => {
    const response = await fetch('/api/migrate-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ v1_access_token: v1AccessToken, new_password: newPassword }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result?.ok === false) {
      return { error: new Error(result?.error ?? 'Migration failed.') };
    }

    // Their account now exists here, with the password they just chose.
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: newPassword,
    });

    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    currentUserId.current = null;
    authEventVersion.current += 1;
    profileRequestVersion.current += 1;
    setUser(null);
    setSession(null);
    setAuthUser(null);
    setUserDataLoading(false);
    setUserDataError(null);
  };

  const retryUserData = async () => {
    if (user && currentUserId.current === user.id) await fetchUserData(user.id, user.email || '');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        authUser,
        loading,
        userDataLoading,
        userDataError,
        retryUserData,
        signUp,
        resendVerification,
        signIn,
        signInWithGoogle,
        checkLegacyAccount,
        migrateLegacyAccount,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
