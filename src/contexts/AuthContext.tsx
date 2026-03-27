import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

const DEV_MODE = import.meta.env.DEV;

const DEV_USER = {
  id: '49b10aa4-baf1-4eb6-9545-ed5a571d2aac',
  email: 'demo@vinculodorado.com',
} as User;

const DEV_PROFILE: Profile = {
  id: '49b10aa4-baf1-4eb6-9545-ed5a571d2aac',
  nombre_completo: 'Usuario Demo',
  email: 'demo@vinculodorado.com',
  rol: 'administrador',
  activo: true,
  telefono: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isEjecutivo: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(DEV_MODE ? DEV_USER : null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(DEV_MODE ? DEV_PROFILE : null);
  const [loading, setLoading] = useState(!DEV_MODE);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data ?? null);
  };

  useEffect(() => {
    if (DEV_MODE) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const isAdmin = profile?.rol === 'administrador';
  const isEjecutivo = profile?.rol === 'ejecutivo_comercial';

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isAdmin, isEjecutivo, signIn, signOut }}>
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
