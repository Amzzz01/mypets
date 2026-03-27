import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import type { Role } from '../../store/authStore';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const PRIMARY = '#1A237E';
const ACCENT = '#FFB300';
const BACKGROUND = '#F9F7F2';
const SAGE = '#81C784';
const INK = '#1A1A2E';
const MUTED = '#9E9E9E';
const WHITE = '#FFFFFF';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Settings Row ─────────────────────────────────────────────────────────────
interface SettingsRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  labelColor?: string;
  isLast?: boolean;
}

function SettingsRow({
  icon,
  iconBg,
  label,
  value,
  onPress,
  rightElement,
  labelColor,
  isLast,
}: SettingsRowProps) {
  return (
    <>
      <TouchableOpacity
        style={s.row}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        <View style={[s.rowIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={WHITE} />
        </View>
        <Text style={[s.rowLabel, labelColor ? { color: labelColor } : {}]}>{label}</Text>
        <View style={s.rowRight}>
          {rightElement ?? (
            <>
              {value ? <Text style={s.rowValue}>{value}</Text> : null}
              {onPress && <Ionicons name="chevron-forward" size={16} color={MUTED} />}
            </>
          )}
        </View>
      </TouchableOpacity>
      {!isLast && <View style={s.divider} />}
    </>
  );
}

// ─── Settings Group ───────────────────────────────────────────────────────────
function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.group}>
      <Text style={s.groupTitle}>{title}</Text>
      <View style={s.groupCard}>{children}</View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, role, updateRole } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [location, setLocation] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      loadPreferences();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('users')
      .select('name, location')
      .eq('id', user.id)
      .maybeSingle();
    setDisplayName(data?.name ?? user.email ?? '');
    setLocation(data?.location ?? '');
    setLoading(false);
  };

  const loadPreferences = async () => {
    const [notif, savedTheme] = await Promise.all([
      AsyncStorage.getItem('notifications_enabled'),
      AsyncStorage.getItem('app_theme'),
    ]);
    if (notif !== null) setNotificationsEnabled(notif === 'true');
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
  };

  const toggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    await AsyncStorage.setItem('notifications_enabled', String(val));
  };

  const toggleLanguage = () => {
    const next = i18n.language === 'bm' ? 'en' : 'bm';
    i18n.changeLanguage(next);
  };

  const toggleTheme = async () => {
    const next: 'light' | 'dark' = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    await AsyncStorage.setItem('app_theme', next);
  };

  const handleChangeRole = () => {
    const newRole: Role = role === 'Breeder' ? 'Owner' : 'Breeder';
    const newLabel = newRole === 'Breeder' ? 'Penternak' : 'Pemilik Haiwan';
    Alert.alert(
      'Tukar Jenis Akaun',
      `Tukar kepada "${newLabel}"?\n\nIni akan mengubah ciri-ciri yang tersedia untuk anda.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Tukar',
          onPress: async () => {
            try {
              await updateRole(newRole);
            } catch {
              Alert.alert('Ralat', 'Gagal menukar jenis akaun. Cuba lagi.');
            }
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    if (!user || exporting) return;
    setExporting(true);
    try {
      const [{ data: pets }, { data: remindersData }, { data: expensesData }] = await Promise.all([
        supabase.from('pets').select('name,species,breed,dob,gender,weight,health_status').eq('user_id', user.id).is('deleted_at', null),
        supabase.from('reminders').select('title,date,time,type,repeat,is_done').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('expenses').select('category,amount,date,notes').eq('user_id', user.id).order('date', { ascending: false }),
      ]);

      const petIds: string[] = [];
      const { data: petsWithId } = await supabase
        .from('pets').select('id,name,species,breed,dob,gender,weight,health_status')
        .eq('user_id', user.id).is('deleted_at', null);
      (petsWithId ?? []).forEach((p: any) => petIds.push(p.id));

      let healthData: any[] = [];
      if (petIds.length > 0) {
        const { data: h } = await supabase
          .from('health_records').select('title,date,type,status,notes')
          .in('pet_id', petIds).order('date', { ascending: false });
        healthData = h ?? [];
      }

      const lines: string[] = [
        `=== EKSPORT DATA MYPETS ===`,
        `Tarikh Eksport: ${new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' })}`,
        `Pengguna: ${displayName}`,
        '',
      ];

      lines.push('--- HAIWAN PELIHARAAN ---');
      lines.push('Nama,Spesies,Baka,Tarikh Lahir,Jantina,Berat (kg),Status Kesihatan');
      (petsWithId ?? []).forEach((p: any) => {
        lines.push([p.name, p.species, p.breed || '', p.dob || '', p.gender, p.weight || '', p.health_status].join(','));
      });

      lines.push('');
      lines.push('--- REKOD KESIHATAN ---');
      lines.push('Tajuk,Tarikh,Jenis,Status,Nota');
      healthData.forEach((h: any) => {
        lines.push([h.title, h.date || '', h.type || '', h.status || '', (h.notes || '').replace(/,/g, ';')].join(','));
      });

      lines.push('');
      lines.push('--- PERBELANJAAN ---');
      lines.push('Kategori,Jumlah (RM),Tarikh,Nota');
      (expensesData ?? []).forEach((e: any) => {
        lines.push([e.category, e.amount, e.date || '', (e.notes || '').replace(/,/g, ';')].join(','));
      });

      lines.push('');
      lines.push('--- PERINGATAN ---');
      lines.push('Tajuk,Tarikh,Masa,Jenis,Ulang,Selesai');
      (remindersData ?? []).forEach((r: any) => {
        lines.push([r.title, r.date, r.time || '', r.type, r.repeat, r.is_done ? 'Ya' : 'Tidak'].join(','));
      });

      const csv = lines.join('\n');
      await Share.share({
        message: csv,
        title: 'MyPets — Eksport Data',
      });
    } catch {
      Alert.alert('Ralat', 'Gagal mengeksport data. Cuba lagi.');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Keluar', 'Adakah anda pasti ingin log keluar?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Log Keluar',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const roleBadge = role === 'Breeder' ? 'Penternak' : 'Pemilik Haiwan';
  const langLabel = i18n.language === 'bm' ? 'BM / EN' : 'EN / BM';
  const themeLabel = theme === 'light' ? 'Terang' : 'Gelap';
  const themeIcon: React.ComponentProps<typeof Ionicons>['name'] = theme === 'light' ? 'sunny-outline' : 'moon-outline';

  return (
    <View style={s.root}>
      {/* ── Indigo Header ── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: PRIMARY }}>
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>Tetapan</Text>
        </View>
      </SafeAreaView>

      {/* ── Body ── */}
      <ScrollView
        style={s.body}
        contentContainerStyle={s.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <View style={s.userCard}>
          <View style={s.userAvatar}>
            <Text style={s.userAvatarText}>
              {loading ? '?' : getInitials(displayName || 'U')}
            </Text>
          </View>
          <Text style={s.userName}>{loading ? '...' : displayName}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleBadgeText}>{roleBadge}</Text>
          </View>
          {location ? <Text style={s.userLocation}>{location}</Text> : null}
          <TouchableOpacity
            style={s.editProfileBtn}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.8}
          >
            <Text style={s.editProfileBtnText}>Edit Profil</Text>
          </TouchableOpacity>
        </View>

        {/* AKAUN */}
        <SettingsGroup title="AKAUN">
          <SettingsRow
            icon="person-outline"
            iconBg="#5C6BC0"
            label="Maklumat Peribadi"
            onPress={() => router.push('/edit-profile')}
          />
          <SettingsRow
            icon="shield-checkmark-outline"
            iconBg="#7986CB"
            label="Jenis Akaun"
            value={roleBadge}
            onPress={handleChangeRole}
          />
          <SettingsRow
            icon="star-outline"
            iconBg={SAGE}
            label="Langganan"
            rightElement={
              <View style={s.sageBadge}>
                <Text style={s.sageBadgeText}>Percuma</Text>
              </View>
            }
            isLast
          />
        </SettingsGroup>

        {/* APLIKASI */}
        <SettingsGroup title="APLIKASI">
          <SettingsRow
            icon="notifications-outline"
            iconBg="#EF5350"
            label="Notifikasi"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: '#E0E0E0', true: PRIMARY }}
                thumbColor={WHITE}
              />
            }
          />
          <SettingsRow
            icon="language-outline"
            iconBg="#42A5F5"
            label="Bahasa"
            value={langLabel}
            onPress={toggleLanguage}
          />
          <SettingsRow
            icon={themeIcon}
            iconBg="#FFA726"
            label="Tema"
            value={themeLabel}
            onPress={toggleTheme}
            isLast
          />
        </SettingsGroup>

        {/* DATA */}
        <SettingsGroup title="DATA">
          <SettingsRow
            icon="download-outline"
            iconBg="#66BB6A"
            label={exporting ? 'Mengeksport...' : 'Eksport Data'}
            onPress={handleExportData}
          />
          <SettingsRow
            icon="log-out-outline"
            iconBg="#EF5350"
            label="Log Keluar"
            labelColor="#EF5350"
            onPress={handleLogout}
            isLast
          />
        </SettingsGroup>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: PRIMARY },

  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 56,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: WHITE,
    letterSpacing: 0.3,
  },

  body: {
    flex: 1,
    backgroundColor: BACKGROUND,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  // User Card
  userCard: {
    backgroundColor: PRIMARY,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  userAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  userAvatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: PRIMARY,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: WHITE,
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 6,
  },
  roleBadgeText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
  },
  userLocation: {
    color: '#AABAD4',
    fontSize: 13,
    marginBottom: 12,
  },
  editProfileBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 6,
  },
  editProfileBtnText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },

  // Groups
  group: { marginBottom: 20 },
  groupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: INK,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontSize: 13,
    color: MUTED,
    marginRight: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0EDE6',
    marginLeft: 64,
  },
  sageBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sageBadgeText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '700',
  },
});
