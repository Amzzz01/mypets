import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2; // 2 cols, 24px side padding, 12px gap

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
  status?: string;
}

interface Stats {
  totalPets: number;
  monthlyExpenses: number;
  upcomingCount: number;
  activeLitters: number;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBox({ width, height, style }: { width?: number | string; height: number; style?: object }) {
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
      style={[{ width: width ?? '100%', height, borderRadius: 8, backgroundColor: '#D1C9B8', opacity }, style]}
    />
  );
}

function DashboardSkeleton() {
  return (
    <View style={sk.container}>
      {/* Pets row */}
      <SkeletonBox height={14} width={120} style={{ marginBottom: 16 }} />
      <View style={sk.row}>
        {[0, 1, 2].map((i) => (
          <SkeletonBox key={i} width={72} height={88} style={{ marginRight: 12, borderRadius: 16 }} />
        ))}
      </View>

      {/* Reminders */}
      <SkeletonBox height={14} width={160} style={{ marginTop: 28, marginBottom: 14 }} />
      {[0, 1].map((i) => (
        <SkeletonBox key={i} height={72} style={{ marginBottom: 10, borderRadius: 14 }} />
      ))}

      {/* Stats */}
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

function PetChip({ name }: { name: string }) {
  const initial = name[0]?.toUpperCase() ?? '?';
  return (
    <View style={chip.container}>
      <View style={chip.avatar}>
        <Ionicons name="paw" size={22} color="#FFFFFF" />
      </View>
      <Text style={chip.name} numberOfLines={1}>{name}</Text>
    </View>
  );
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

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
    <TouchableOpacity style={[qa.card, { borderColor: accent + '40' }]} onPress={onPress} activeOpacity={0.8}>
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
  label: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});

function AddPetChip({ label }: { label: string }) {
  return (
    <TouchableOpacity style={chip.addContainer}>
      <View style={chip.addCircle}>
        <Ionicons name="add" size={24} color="#1A237E" />
      </View>
      <Text style={chip.addName}>{label}</Text>
    </TouchableOpacity>
  );
}

const chip = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: 14,
    width: 68,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#81C784',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 11,
    color: '#1A1A2E',
    fontWeight: '600',
    textAlign: 'center',
  },
  addContainer: {
    alignItems: 'center',
    marginRight: 14,
    width: 68,
  },
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
  addName: {
    fontSize: 11,
    color: '#1A237E',
    fontWeight: '600',
    textAlign: 'center',
  },
});

function ReminderCard({ reminder }: { reminder: Reminder }) {
  const { t } = useTranslation();
  const isDone = reminder.status === 'done' || reminder.status === 'selesai';
  const statusLabel = isDone ? t('dashboard.done') : t('dashboard.active');
  const statusColor = isDone ? '#81C784' : '#FFB300';

  return (
    <View style={rc.card}>
      <View style={rc.iconBox}>
        <Ionicons name="notifications-outline" size={20} color="#1A237E" />
      </View>
      <View style={rc.content}>
        <Text style={rc.title} numberOfLines={1}>{reminder.title}</Text>
        <Text style={rc.sub} numberOfLines={1}>
          {[reminder.time, reminder.repeat].filter(Boolean).join(' · ') || '—'}
        </Text>
      </View>
      <View style={[rc.badge, { backgroundColor: statusColor + '22' }]}>
        <Text style={[rc.badgeText, { color: statusColor }]}>{statusLabel}</Text>
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
  sub: { fontSize: 12, color: '#9E9E9E' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
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
  const { user, role } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [pets, setPets] = useState<Pet[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPets: 0,
    monthlyExpenses: 0,
    upcomingCount: 0,
    activeLitters: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];

    const [profileRes, petsRes, remindersRes, expensesRes, littersRes, upcomingRes] =
      await Promise.all([
        supabase.from('users').select('name').eq('id', user.id).maybeSingle(),
        supabase.from('pets').select('id, name').eq('user_id', user.id),
        supabase.from('reminders').select('id, title, time, repeat, status').eq('user_id', user.id).eq('date', today),
        supabase.from('expenses').select('amount').eq('user_id', user.id).gte('date', startOfMonth),
        supabase.from('litters').select('id').eq('user_id', user.id),
        supabase.from('reminders').select('id').eq('user_id', user.id).gte('date', today),
      ]);

    setDisplayName(profileRes.data?.name ?? user.email ?? '');
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
  };

  const roleLabel =
    role === 'Breeder' ? t('register.breeder') : role === 'Owner' ? t('register.owner') : null;

  return (
    <View style={styles.root}>
      {/* ── Indigo Header ── */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{t(getGreetingKey())},</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName || '—'}
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
                <Text style={styles.pillText}>{reminders.length}</Text>
              </View>
            </View>
          </View>

          {/* Avatar */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(displayName || 'U')}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* ── Parchment Body (overlaps header) ── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Pets Section */}
            <Text style={styles.sectionTitle}>{t('dashboard.pets')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.petsRow}
            >
              {pets.map((pet) => (
                <PetChip key={pet.id} name={pet.name} />
              ))}
              <AddPetChip label={t('dashboard.addPet')} />
            </ScrollView>

            {/* Quick Actions Section */}
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

            {/* Reminders Section */}
            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>{t('dashboard.reminders')}</Text>
            {reminders.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="notifications-off-outline" size={28} color="#9E9E9E" />
                <Text style={styles.emptyText}>{t('dashboard.noReminders')}</Text>
              </View>
            ) : (
              reminders.map((r) => <ReminderCard key={r.id} reminder={r} />)
            )}

            {/* Summary Section */}
            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>{t('dashboard.summary')}</Text>
            <View style={styles.statGrid}>
              <StatCard
                icon="paw"
                label={t('dashboard.totalPets')}
                value={String(stats.totalPets)}
                accent="#1A237E"
              />
              <StatCard
                icon="cash-outline"
                label={t('dashboard.monthlyExpenses')}
                value={`RM ${stats.monthlyExpenses.toFixed(2)}`}
                accent="#FFB300"
              />
              <StatCard
                icon="calendar-outline"
                label={t('dashboard.upcoming')}
                value={String(stats.upcomingCount)}
                accent="#81C784"
              />
              <StatCard
                icon="heart-outline"
                label={t('dashboard.activeLitters')}
                value={String(stats.activeLitters)}
                accent="#EF9A9A"
              />
            </View>

            <View style={{ height: 24 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A237E',
  },
  headerSafe: {
    backgroundColor: '#1A237E',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  greeting: {
    fontSize: 14,
    color: '#AABAD4',
    fontWeight: '500',
    marginBottom: 2,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    color: '#FFB300',
    fontSize: 11,
    fontWeight: '700',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFB300',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A237E',
  },

  // Body
  body: {
    flex: 1,
    backgroundColor: '#F9F7F2',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },
  bodyContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 14,
  },
  petsRow: {
    paddingBottom: 4,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    gap: 8,
  },
  emptyText: {
    color: '#9E9E9E',
    fontSize: 13,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
