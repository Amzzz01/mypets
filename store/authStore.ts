import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type Role = 'Owner' | 'Breeder';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: Role | null;
  profileName: string | null;   // shared display name across all screens
  avatarUrl: string | null;     // shared profile picture across all screens
  loading: boolean;
  googleLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  finalizeGoogleSession: (session: Session) => Promise<{ needsRole: boolean }>;
  updateRole: (role: Role) => Promise<void>;
  fetchUserProfile: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  updateAvatar: (url: string) => Promise<void>;
  setGoogleLoading: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  role: null,
  profileName: null,
  avatarUrl: null,
  loading: false,
  googleLoading: false,

  setGoogleLoading: (val) => set({ googleLoading: val }),

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      set({ user: data.user, session: data.session });
      // Load profile name, role, avatar right after login so all tabs have it immediately
      if (data.user) {
        const { data: profile } = await supabase
          .from('users').select('name, role, avatar_url').eq('id', data.user.id).maybeSingle();
        set({
          profileName: profile?.name?.trim() || null,
          role: (profile?.role as Role) ?? null,
          avatarUrl: profile?.avatar_url ?? null,
        });
      }
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
        const { error: insertError } = await supabase.from('users').insert({ id: data.user.id, name, role });
        if (insertError) {
           console.error('Insert user error:', insertError);
           // if it fails to insert, we can't easily undo the auth signup on client side, but we should definitely log it.
           throw insertError;
        }
        set({ user: data.user, session: data.session, role, profileName: name });
      }
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await supabase.auth.signOut();
      set({ user: null, session: null, role: null, profileName: null, avatarUrl: null });
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
      .select('id, role, name')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!existing) {
      const name =
        session.user.user_metadata?.full_name ??
        session.user.user_metadata?.name ??
        session.user.email ??
        '';
      await supabase.from('users').insert({ id: session.user.id, name, role: null });
      set({ role: null, profileName: name || null });
      return { needsRole: true };
    }

    const metaName =
      session.user.user_metadata?.full_name?.trim() ||
      session.user.user_metadata?.name?.trim() ||
      null;
    set({ role: existing.role ?? null, profileName: existing.name?.trim() || metaName || null });
    return { needsRole: !existing.role };
  },

  updateRole: async (role: Role) => {
    const user = get().user;
    if (!user) return;
    await supabase.from('users').update({ role }).eq('id', user.id);
    set({ role });
  },

  // Loads name, role, avatar from DB (and falls back to OAuth metadata).
  fetchUserProfile: async () => {
    const user = get().user;
    if (!user) return;
    const { data } = await supabase
      .from('users')
      .select('name, role, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    const nameFromDb = data?.name?.trim() || null;
    const nameFromMeta =
      user.user_metadata?.full_name?.trim() ||
      user.user_metadata?.name?.trim() ||
      null;
    const resolved = nameFromDb ?? nameFromMeta ?? null;
    // If we got a name from OAuth metadata but DB is empty, persist it
    if (!nameFromDb && nameFromMeta) {
      await supabase
        .from('users')
        .upsert({ id: user.id, name: nameFromMeta }, { onConflict: 'id' });
    }
    const updates: Partial<AuthState> = {
      profileName: resolved,
      avatarUrl: data?.avatar_url ?? null,
    };
    if (data?.role) updates.role = data.role as Role;
    set(updates);
  },

  // Saves a new display name to DB and updates the store.
  updateName: async (name: string) => {
    const user = get().user;
    if (!user) return;
    const trimmed = name.trim();
    await supabase
      .from('users')
      .upsert({ id: user.id, name: trimmed }, { onConflict: 'id' });
    set({ profileName: trimmed });
  },

  // Saves a new avatar URL to DB and updates the store.
  updateAvatar: async (url: string) => {
    const user = get().user;
    if (!user) return;
    await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
    set({ avatarUrl: url });
  },
}));
