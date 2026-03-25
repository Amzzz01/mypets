import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type Role = 'Owner' | 'Breeder';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: Role | null;
  loading: boolean;
  googleLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  finalizeGoogleSession: (session: Session) => Promise<{ needsRole: boolean }>;
  updateRole: (role: Role) => Promise<void>;
  setGoogleLoading: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  role: null,
  loading: false,
  googleLoading: false,

  setGoogleLoading: (val) => set({ googleLoading: val }),

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      set({ user: data.user, session: data.session });
    } finally {
      set({ loading: false });
    }
  },

  register: async (name, email, password, role) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        await supabase.from('users').insert({ id: data.user.id, name, role });
        set({ user: data.user, session: data.session, role });
      }
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await supabase.auth.signOut();
      set({ user: null, session: null, role: null });
    } finally {
      set({ loading: false });
    }
  },

  restoreSession: async () => {
    set({ loading: true });
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        set({ session: data.session, user: data.session.user });
      }
    } finally {
      set({ loading: false });
    }
  },

  // Called after the OAuth browser session returns and we have a valid Supabase session.
  // Checks the users table and inserts a row if this is a new Google user.
  // Returns { needsRole: true } if the user still needs to pick a role.
  finalizeGoogleSession: async (session: Session) => {
    set({ user: session.user, session });

    const { data: existing } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!existing) {
      const name =
        session.user.user_metadata?.full_name ??
        session.user.user_metadata?.name ??
        session.user.email ??
        '';
      await supabase.from('users').insert({ id: session.user.id, name, role: null });
      set({ role: null });
      return { needsRole: true };
    }

    set({ role: existing.role ?? null });
    return { needsRole: !existing.role };
  },

  updateRole: async (role: Role) => {
    const user = get().user;
    if (!user) return;
    await supabase.from('users').update({ role }).eq('id', user.id);
    set({ role });
  },
}));
