import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const PRIMARY = '#1A237E';
const ACCENT = '#FFB300';
const BACKGROUND = '#F9F7F2';
const INK = '#1A1A2E';
const MUTED = '#9E9E9E';
const WHITE = '#FFFFFF';
const SAGE = '#81C784';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function EditProfileScreen() {
  const { user, profileName, updateName } = useAuthStore();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Pre-fill name from store so it appears instantly
    if (profileName) setName(profileName);
    // Fetch name, location and avatar_url from DB
    supabase
      .from('users')
      .select('name, location, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (!profileName && data.name) setName(data.name);
          setLocation(data.location ?? '');
          setAvatarUrl(data.avatar_url ?? null);
        }
      });
  }, [user]);

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Kebenaran diperlukan', 'Sila benarkan akses galeri foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadAvatar(result.assets[0]);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Kebenaran diperlukan', 'Sila benarkan akses kamera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadAvatar(result.assets[0]);
  };

  const uploadAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const filePath = `${user.id}/avatar.jpeg`; // always store as jpeg
      const { decode } = await import('base64-arraybuffer');
      
      if (!asset.base64) throw new Error('Data gambar (base64) tidak ditemui.');
      
      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, decode(asset.base64), { contentType: mimeType, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('user-avatars').getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id);
      setAvatarUrl(publicUrl);
    } catch (err: any) {
      Alert.alert('Ralat', err?.message ?? 'Gagal memuat naik gambar profil.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const showAvatarOptions = () => {
    Alert.alert('Gambar Profil', 'Pilih sumber gambar', [
      { text: 'Kamera', onPress: handleTakePhoto },
      { text: 'Galeri', onPress: handlePickAvatar },
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!user) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Ralat', 'Nama diperlukan.');
      return;
    }
    setSaving(true);
    try {
      await updateName(trimmedName);
      const { error } = await supabase
        .from('users')
        .update({ location: location.trim() || null })
        .eq('id', user.id);
      if (error) throw error;
      router.back();
    } catch {
      Alert.alert('Ralat', 'Gagal menyimpan profil. Sila cuba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const initials = getInitials(name || profileName || 'U');

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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Avatar picker ── */}
          <View style={s.avatarSection}>
            <TouchableOpacity
              style={s.avatarWrap}
              onPress={showAvatarOptions}
              activeOpacity={0.85}
              disabled={uploadingAvatar}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Text style={s.avatarInitials}>{initials}</Text>
                </View>
              )}
              {/* Loading overlay */}
              {uploadingAvatar && (
                <View style={s.avatarOverlay}>
                  <ActivityIndicator color={WHITE} size="small" />
                </View>
              )}
              {/* Camera badge */}
              {!uploadingAvatar && (
                <View style={s.cameraBadge}>
                  <Ionicons name="camera" size={14} color={WHITE} />
                </View>
              )}
            </TouchableOpacity>
            <Text style={s.avatarHint}>
              {uploadingAvatar ? 'Memuat naik...' : 'Ketik untuk tukar gambar'}
            </Text>
          </View>

          {/* ── Email (read-only) ── */}
          <Text style={s.label}>E-mel</Text>
          <View style={s.readonlyInput}>
            <Ionicons name="mail-outline" size={16} color={MUTED} style={{ marginRight: 8 }} />
            <Text style={s.readonlyText} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
            <View style={s.lockedBadge}>
              <Ionicons name="lock-closed" size={11} color={MUTED} />
            </View>
          </View>

          {/* ── Name ── */}
          <Text style={s.label}>Nama</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Nama penuh"
            placeholderTextColor={MUTED}
            returnKeyType="next"
          />

          {/* ── Location ── */}
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
            style={[s.saveBtn, (saving || uploadingAvatar) && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving || uploadingAvatar}
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: WHITE },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  body: {
    flex: 1,
    backgroundColor: BACKGROUND,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },
  bodyContent: { padding: 24, paddingTop: 28 },

  // ── Avatar
  avatarSection: { alignItems: 'center', marginBottom: 24, marginTop: 4 },
  avatarWrap: { position: 'relative', marginBottom: 10 },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: ACCENT,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: PRIMARY,
    borderWidth: 3,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 32, fontWeight: '800', color: WHITE },
  avatarOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2, right: 2,
    width: 26, height: 26,
    borderRadius: 13,
    backgroundColor: PRIMARY,
    borderWidth: 2, borderColor: WHITE,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarHint: { fontSize: 12, color: MUTED, fontWeight: '500' },

  // ── Form fields
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
  readonlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEEAE3',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  readonlyText: { flex: 1, fontSize: 15, color: MUTED },
  lockedBadge: { marginLeft: 6 },

  // ── Buttons
  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnText: { color: WHITE, fontSize: 15, fontWeight: '700' },
  cancelBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: { color: MUTED, fontSize: 15, fontWeight: '600' },
});
