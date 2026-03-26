import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const PRIMARY = '#1A237E';
const BACKGROUND = '#F9F7F2';
const INK = '#1A1A2E';
const MUTED = '#9E9E9E';
const WHITE = '#FFFFFF';

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function EditProfileScreen() {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('users')
      .select('name, location')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setName(data.name ?? '');
          setLocation(data.location ?? '');
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Ralat', 'Nama diperlukan.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: trimmedName, location: location.trim() || null })
        .eq('id', user.id);
      if (error) throw error;
      router.back();
    } catch {
      Alert.alert('Ralat', 'Gagal menyimpan profil. Sila cuba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: PRIMARY }}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color={WHITE} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Edit Profil</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      {/* ── Body ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.label}>Nama</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Nama penuh"
            placeholderTextColor={MUTED}
            returnKeyType="next"
          />

          <Text style={s.label}>Lokasi</Text>
          <TextInput
            style={s.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Contoh: Kuala Lumpur"
            placeholderTextColor={MUTED}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={s.saveBtnText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.cancelBtn}
            onPress={() => router.back()}
            disabled={saving}
            activeOpacity={0.75}
          >
            <Text style={s.cancelBtnText}>Batal</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: PRIMARY },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: WHITE,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: {
    flex: 1,
    backgroundColor: BACKGROUND,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },
  bodyContent: {
    padding: 24,
    paddingTop: 28,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: INK,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: INK,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: {
    color: MUTED,
    fontSize: 15,
    fontWeight: '600',
  },
});
