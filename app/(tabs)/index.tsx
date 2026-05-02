import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pet {
  id: string;
  name: string;
}

interface Reminder {
  id: string;
  title: string;
  time?: string;
  repeat?: string;
  is_done?: boolean;
}

interface Stats {
  totalPets: number;
  monthlyExpenses: number;
  upcomingCount: number;
  activeLitters: number;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBox({
  width,
  height,
  style,
}: {
  width?: number | string;
  height: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={[
        { width: width ?? '100%', height, borderRadius: 8, backgroundColor: '#D1C9B8', opacity },
        style,
      ]}
    />
  );
}

function DashboardSkeleton() {
  return (
    <View style={sk.container}>
      <SkeletonBox height={14} width={120} style={{ marginBottom: 16 }} />
      <View style={sk.row}>
        {[0, 1, 2].map((i) => (
          <SkeletonBox key={i} width={72} height={88} style={{ marginRight: 12, borderRadius: 16 }} />
        ))}
      </View>
      <SkeletonBox height={14} width={160} style={{ marginTop: 28, marginBottom: 14 }} />
      {[0, 1].map((i) => (
        <SkeletonBox key={i} height={72} style={{ marginBottom: 10, borderRadius: 14 }} />
      ))}
      <SkeletonBox height={14} width={100} style={{ marginTop: 28, marginBottom: 14 }} />
      <View style={sk.grid}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBox key={i} width={CARD_WIDTH} height={88} style={{ borderRadius: 14 }} />
        ))}
      </View>
    </View>
  );
}

const sk = StyleSheet.create({
  container: { padding: 24, paddingTop: 28 },
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreetingKey(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'dashboard.greeting.morning';
  if (h >= 12 && h < 18) return 'dashboard.greeting.afternoon';
  if (h >= 18 && h < 21) return 'dashboard.greeting.evening';
  return 'dashboard.greeting.night';
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PetChip({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={chip.container} onPress={onPress} activeOpacity={0.75}>
      <View style={chip.avatar}>
        <Ionicons name="paw" size={22} color="#FFFFFF" />
      </View>
      <Text style={chip.name} numberOfLines={1}>
        {name}
      </Text>
    </TouchableOpacity>
  );
}

function AddPetChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={chip.addContainer} onPress={onPress} activeOpacity={0.75}>
      <View style={chip.addCircle}>
        <Ionicons name="add" size={24} color="#1A237E" />
      </View>
      <Text style={chip.addName}>{label}</Text>
    </TouchableOpacity>
  );
}

const chip = StyleSheet.create({
  container: { alignItems: 'center', marginRight: 14, width: 68 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#81C784',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  name: { fontSize: 11, color: '#1A1A2E', fontWeight: '600', textAlign: 'center' },
  addContainer: { alignItems: 'center', marginRight: 14, width: 68 },
  addCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#1A237E',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  addName: { fontSize: 11, color: '#1A237E', fontWeight: '600', textAlign: 'center' },
});

function ReminderCard({
  reminder,
  onMarkDone,
}: {
  reminder: Reminder;
  onMarkDone: (id: string) => void;
}) {
  const { t } = useTranslation();
  const isDone = reminder.is_done === true;
  const statusLabel = isDone ? t('dashboard.done') : t('dashboard.active');
  const statusColor = isDone ? '#81C784' : '#FFB300';

  return (
    <View style={rc.card}>
      <View style={rc.iconBox}>
        <Ionicons
          name={isDone ? 'checkmark-circle' : 'notifications-outline'}
          size={20}
          color={isDone ? '#81C784' : '#1A237E'}
        />
      </View>
      <View style={rc.content}>
        <Text style={[rc.title, isDone && rc.titleDone]} numberOfLines={1}>
          {reminder.title}
        </Text>
        <Text style={rc.sub} numberOfLines={1}>
          {[reminder.time, reminder.repeat].filter(Boolean).join(' · ') || '—'}
        </Text>
      </View>
      <View style={rc.right}>
        <View style={[rc.badge, { backgroundColor: statusColor + '22' }]}>
          <Text style={[rc.badgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        {!isDone && (
          <TouchableOpacity
            style={rc.doneBtn}
            onPress={() => onMarkDone(reminder.id)}
            activeOpacity={0.75}
          >
            <Ionicons name="checkmark" size={14} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const rc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#1A237E',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF0FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 2 },
  titleDone: { textDecorationLine: 'line-through', color: '#9E9E9E' },
  sub: { fontSize: 12, color: '#9E9E9E' },
  right: { alignItems: 'flex-end', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  doneBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#81C784',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function QuickActionCard({
  icon,
  label,
  accent,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[qa.card, { borderColor: accent + '40' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[qa.iconBox, { backgroundColor: accent + '22' }]}>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <Text style={[qa.label, { color: accent }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const qa = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginRight: 12,
    width: 88,
    borderWidth: 1.5,
    shadowColor: '#1A237E',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
});

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={[sc.card, { width: CARD_WIDTH }]}>
      <View style={[sc.iconBox, { backgroundColor: accent + '22' }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <Text style={sc.value}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#1A237E',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  value: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  label: { fontSize: 11, color: '#9E9E9E', fontWeight: '500' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user, role, profileName, fetchUserProfile, updateName } = useAuthStore();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPets: 0,
    monthlyExpenses: 0,
    upcomingCount: 0,
    activeLitters: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // One-time name check: fetch from store/DB once on mount, show modal only if still missing
  useEffect(() => {
    if (!user) return;
    if (profileName) return; // already have name in store, skip
    fetchUserProfile().then(() => {
      // Check the updated store state
      const { profileName: name } = useAuthStore.getState();
      if (!name) setShowNameModal(true);
    });
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];

    const [profileRes, petsRes, remindersRes, expensesRes, littersRes, upcomingRes] =
      await Promise.all([
        supabase.from('users').select('avatar_url').eq('id', user.id).maybeSingle(),
        supabase.from('pets').select('id, name').eq('user_id', user.id).is('deleted_at', null),
        supabase
          .from('reminders')
          .select('id, title, time, repeat, is_done')
          .eq('user_id', user.id)
          .eq('date', today)
          .is('deleted_at', null),
        supabase.from('expenses').select('amount').eq('user_id', user.id).gte('date', startOfMonth),
        supabase.from('litters').select('id').eq('user_id', user.id),
        supabase
          .from('reminders')
          .select('id')
          .eq('user_id', user.id)
          .gte('date', today)
          .is('deleted_at', null),
      ]);

    setAvatarUrl(profileRes.data?.avatar_url ?? null);
    setPets(petsRes.data ?? []);
    setReminders(remindersRes.data ?? []);

    const monthlyExpenses = (expensesRes.data ?? []).reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    );
    setStats({
      totalPets: petsRes.data?.length ?? 0,
      monthlyExpenses,
      upcomingCount: upcomingRes.data?.length ?? 0,
      activeLitters: littersRes.data?.length ?? 0,
    });

    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) fetchData();
    }, [user, fetchData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleMarkDone = useCallback(async (id: string) => {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, is_done: true } : r)));
    try {
      const { error } = await supabase.from('reminders').update({ is_done: true }).eq('id', id);
      if (error) throw error;
    } catch {
      setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, is_done: false } : r)));
      Alert.alert('Ralat', 'Gagal mengemaskini peringatan.');
    }
  }, []);

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Alert.alert('Nama diperlukan', 'Sila masukkan nama anda.');
      return;
    }
    if (!user) return;
    setSavingName(true);
    try {
      await updateName(trimmed);  // saves to DB via upsert + updates store
      setShowNameModal(false);
      setNameInput('');
    } catch {
      Alert.alert('Ralat', 'Gagal menyimpan nama. Cuba lagi.');
    } finally {
      setSavingName(false);
    }
  };

  const roleLabel =
    role === 'Breeder' ? t('register.breeder') : role === 'Owner' ? t('register.owner') : null;
  const pendingRemindersCount = reminders.filter((r) => !r.is_done).length;

  return (
    <View style={styles.root}>
      {/* ── Indigo Header ── */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{t(getGreetingKey())},</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {profileName || '—'}
            </Text>
            <View style={styles.pillRow}>
              {roleLabel && (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{roleLabel}</Text>
                </View>
              )}
              <View style={styles.pill}>
                <Ionicons name="paw" size={10} color="#FFB300" style={{ marginRight: 4 }} />
                <Text style={styles.pillText}>{stats.totalPets}</Text>
              </View>
              <View style={styles.pill}>
                <Ionicons name="notifications" size={10} color="#FFB300" style={{ marginRight: 4 }} />
                <Text style={styles.pillText}>{pendingRemindersCount}</Text>
              </View>
            </View>
          </View>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: 52, height: 52, borderRadius: 26 }}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(profileName || 'U')}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* ── Parchment Body ── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1A237E"
            colors={['#1A237E']}
          />
        }
      >
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <Text style={styles.sectionTitle}>{t('dashboard.pets')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.petsRow}
            >
              {pets.map((pet) => (
                <PetChip key={pet.id} name={pet.name} onPress={() => router.push('/(tabs)/pets')} />
              ))}
              <AddPetChip label={t('dashboard.addPet')} onPress={() => router.push('/(tabs)/pets')} />
            </ScrollView>

            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Tindakan Pantas</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.petsRow}
            >
              <QuickActionCard
                icon="business-outline"
                label="Cari Vet"
                accent="#EF5350"
                onPress={() => router.push('/vet-finder')}
              />
              <QuickActionCard
                icon="cash-outline"
                label="Perbelanjaan"
                accent="#FFB300"
                onPress={() => router.push('/expenses')}
              />
              {role === 'Breeder' && (
                <QuickActionCard
                  icon="heart-outline"
                  label="Litter"
                  accent="#AB47BC"
                  onPress={() => router.push('/litter')}
                />
              )}
            </ScrollView>

            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>
              {t('dashboard.reminders')}
            </Text>
            {reminders.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="notifications-off-outline" size={28} color="#9E9E9E" />
                <Text style={styles.emptyText}>{t('dashboard.noReminders')}</Text>
              </View>
            ) : (
              reminders.map((r) => (
                <ReminderCard key={r.id} reminder={r} onMarkDone={handleMarkDone} />
              ))
            )}

            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>{t('dashboard.summary')}</Text>
            <View style={styles.statGrid}>
              <StatCard icon="paw" label={t('dashboard.totalPets')} value={String(stats.totalPets)} accent="#1A237E" />
              <StatCard icon="cash-outline" label={t('dashboard.monthlyExpenses')} value={`RM ${stats.monthlyExpenses.toFixed(2)}`} accent="#FFB300" />
              <StatCard icon="calendar-outline" label={t('dashboard.upcoming')} value={String(stats.upcomingCount)} accent="#81C784" />
              <StatCard icon="heart-outline" label={t('dashboard.activeLitters')} value={String(stats.activeLitters)} accent="#EF9A9A" />
            </View>

            <View style={{ height: 24 }} />
          </>
        )}
      </ScrollView>

      {/* ── Name Prompt Modal ── */}
      <Modal visible={showNameModal} transparent animationType="fade" onRequestClose={() => {}}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={nm.overlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={nm.card}>
                <View style={nm.iconBox}>
                  <Ionicons name="person-circle-outline" size={48} color="#1A237E" />
                </View>
                <Text style={nm.title}>Selamat Datang!</Text>
                <Text style={nm.subtitle}>
                  Sila masukkan nama anda untuk mula menggunakan MyPets.
                </Text>
                <TextInput
                  style={nm.input}
                  placeholder="Nama anda"
                  placeholderTextColor="#9E9E9E"
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                />
                <TouchableOpacity
                  style={[nm.btn, savingName && { opacity: 0.7 }]}
                  onPress={handleSaveName}
                  disabled={savingName}
                  activeOpacity={0.85}
                >
                  <Text style={nm.btnText}>{savingName ? 'Menyimpan...' : 'Teruskan'}</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

// ─── Name Modal Styles ────────────────────────────────────────────────────────

const nm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  iconBox: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#1A237E', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#9E9E9E', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  input: {
    width: '100%',
    backgroundColor: '#F9F7F2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#E8E4DC',
    marginBottom: 16,
  },
  btn: { width: '100%', backgroundColor: '#1A237E', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A237E' },
  headerSafe: { backgroundColor: '#1A237E' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
  },
  headerLeft: { flex: 1, marginRight: 16 },
  greeting: { fontSize: 14, color: '#AABAD4', fontWeight: '500', marginBottom: 2 },
  userName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 10 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { color: '#FFB300', fontSize: 11, fontWeight: '700' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFB300',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#1A237E' },
  body: {
    flex: 1,
    backgroundColor: '#F9F7F2',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },
  bodyContent: { paddingHorizontal: 24, paddingTop: 44 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 14 },
  petsRow: { paddingBottom: 4 },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    gap: 8,
  },
  emptyText: { color: '#9E9E9E', fontSize: 13 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});