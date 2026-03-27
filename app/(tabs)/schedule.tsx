import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Modal,
  Alert,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

// ─── Notification handler (called whenever a notification arrives while app is open) ──
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Notification helpers ──────────────────────────────────────────────────────
async function scheduleReminderNotification(
  reminderId: string,
  title: string,
  dateStr: string,
  timeStr: string,
  petName: string | null
): Promise<void> {
  try {
    const pushEnabled = await AsyncStorage.getItem('notif_push');
    if (pushEnabled === 'false') return;

    const triggerDate = new Date(`${dateStr}T${timeStr}:00`);
    if (isNaN(triggerDate.getTime()) || triggerDate <= new Date()) return;

    const earlyEnabled = await AsyncStorage.getItem('notif_early');
    const silentEnabled = await AsyncStorage.getItem('notif_silent');

    // Silent mode: skip notifications between 22:00–07:00
    if (silentEnabled === 'true') {
      const h = triggerDate.getHours();
      if (h >= 22 || h < 7) return;
    }

    const body = petName ? `${petName} · ${timeStr}` : timeStr;

    const identifier = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
    });
    await AsyncStorage.setItem(`notif_id_${reminderId}`, identifier);

    // 1-hour early reminder
    if (earlyEnabled !== 'false') {
      const earlyDate = new Date(triggerDate.getTime() - 60 * 60 * 1000);
      if (earlyDate > new Date()) {
        const earlyId = await Notifications.scheduleNotificationAsync({
          content: { title: `Peringatan 1 jam: ${title}`, body, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: earlyDate },
        });
        await AsyncStorage.setItem(`notif_early_id_${reminderId}`, earlyId);
      }
    }
  } catch (_) {
    // Non-critical — don't block user flow
  }
}

async function cancelReminderNotification(reminderId: string): Promise<void> {
  try {
    const [id, earlyId] = await Promise.all([
      AsyncStorage.getItem(`notif_id_${reminderId}`),
      AsyncStorage.getItem(`notif_early_id_${reminderId}`),
    ]);
    const cancels: Promise<void>[] = [];
    if (id) cancels.push(Notifications.cancelScheduledNotificationAsync(id));
    if (earlyId) cancels.push(Notifications.cancelScheduledNotificationAsync(earlyId));
    await Promise.all(cancels);
    await AsyncStorage.multiRemove([`notif_id_${reminderId}`, `notif_early_id_${reminderId}`]);
  } catch (_) {}
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const PRIMARY = '#1A237E';
const ACCENT = '#FFB300';
const BG = '#F9F7F2';
const SAGE = '#81C784';
const INK = '#1A1A2E';
const RED = '#EF5350';
const MUTED = '#9E9E9E';
const DIVIDER = '#EEEBE4';
const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

// ─── Malay locale helpers ──────────────────────────────────────────────────────
const MALAY_DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const MALAY_MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
const MALAY_MONTHS_FULL = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const WEEK_LETTERS = ['I', 'S', 'R', 'K', 'J', 'S', 'A'];

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMalayDayName(d: Date): string {
  return MALAY_DAYS[d.getDay()];
}

function getMalayLabel(d: Date): string {
  return `${getMalayDayName(d)}, ${d.getDate()} ${MALAY_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// Returns grid of days for a month, padded for Mon-start
function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
type ReminderType = 'ubat' | 'temujanji' | 'grooming' | 'lain-lain';
type RepeatType = 'Sekali' | 'Harian' | 'Mingguan' | 'Bulanan';

interface Pet {
  id: string;
  name: string;
}

interface Reminder {
  id: string;
  user_id: string;
  pet_id: string | null;
  title: string;
  date: string;
  time: string;
  repeat: RepeatType;
  is_done: boolean;
  type: ReminderType;
  pets?: { name: string } | null;
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, easing: Easing.ease, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonIcon} />
      <View style={styles.skeletonMiddle}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '55%', marginTop: 8 }]} />
      </View>
      <View style={styles.skeletonBadge} />
    </Animated.View>
  );
}

// ─── Reminder card ─────────────────────────────────────────────────────────────
interface ReminderCardProps {
  reminder: Reminder;
  onMarkDone: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
}

function ReminderCard({ reminder, onMarkDone, onDelete, onEdit }: ReminderCardProps) {
  const today = toDateString(new Date());

  const typeConfig: Record<ReminderType, { color: string; icon: string }> = {
    ubat: { color: SAGE, icon: 'medical-outline' },
    temujanji: { color: ACCENT, icon: 'calendar-outline' },
    grooming: { color: PRIMARY, icon: 'cut-outline' },
    'lain-lain': { color: RED, icon: 'alert-circle-outline' },
  };

  const cfg = typeConfig[reminder.type] ?? typeConfig['lain-lain'];
  const petName = reminder.pets?.name ?? null;
  const subtitle = [reminder.time, petName].filter(Boolean).join(' · ');

  let badgeLabel = '';
  let badgeBg = PRIMARY;
  const badgeText = '#fff';

  if (reminder.is_done) {
    badgeLabel = 'Selesai';
    badgeBg = SAGE;
  } else if (reminder.date === today) {
    badgeLabel = reminder.time || 'Hari ini';
    badgeBg = ACCENT;
  } else {
    const d = daysUntil(reminder.date);
    badgeLabel = d > 0 ? `${d} hari lagi` : d === 0 ? 'Hari ini' : `${Math.abs(d)} hari lalu`;
  }

  return (
    <View style={styles.reminderCard}>
      <View style={[styles.reminderIconBox, { backgroundColor: cfg.color + '22' }]}>
        <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
      </View>
      <View style={styles.reminderMiddle}>
        <Text style={styles.reminderTitle} numberOfLines={1}>{reminder.title}</Text>
        {subtitle ? <Text style={styles.reminderSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.reminderRight}>
        <View style={[styles.reminderBadge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.reminderBadgeText, { color: badgeText }]}>{badgeLabel}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
          {!reminder.is_done && (
            <TouchableOpacity style={styles.checkBtn} onPress={() => onMarkDone(reminder.id)} activeOpacity={0.75}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.checkBtn, { backgroundColor: PRIMARY }]} onPress={() => onEdit(reminder)} activeOpacity={0.75}>
            <Ionicons name="create-outline" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.checkBtn, { backgroundColor: RED }]} onPress={() => onDelete(reminder.id)} activeOpacity={0.75}>
            <Ionicons name="trash-outline" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Notification toggles ──────────────────────────────────────────────────────
function NotificationToggles() {
  const [push, setPush] = useState(true);
  const [early, setEarly] = useState(true);
  const [silent, setSilent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, e, s] = await Promise.all([
          AsyncStorage.getItem('notif_push'),
          AsyncStorage.getItem('notif_early'),
          AsyncStorage.getItem('notif_silent'),
        ]);
        if (p !== null) setPush(p === 'true');
        if (e !== null) setEarly(e === 'true');
        if (s !== null) setSilent(s === 'true');
      } catch (_) {}
    })();
  }, []);

  const saveToggle = async (key: string, value: boolean) => {
    try { await AsyncStorage.setItem(key, String(value)); } catch (_) {}
  };

  const rows = [
    {
      key: 'notif_push', icon: 'notifications-outline', label: 'Notifikasi push aktif',
      value: push, setter: (v: boolean) => { setPush(v); saveToggle('notif_push', v); },
    },
    {
      key: 'notif_early', icon: 'time-outline', label: 'Peringatan 1 jam awal',
      value: early, setter: (v: boolean) => { setEarly(v); saveToggle('notif_early', v); },
    },
    {
      key: 'notif_silent', icon: 'moon-outline', label: 'Mod senyap malam',
      value: silent, setter: (v: boolean) => { setSilent(v); saveToggle('notif_silent', v); },
    },
  ];

  return (
    <View style={styles.notifSection}>
      <Text style={styles.sectionTitle}>Tetapan Notifikasi</Text>
      <View style={[styles.card, styles.notifCard]}>
        {rows.map((row, idx) => (
          <React.Fragment key={row.key}>
            <View style={styles.notifRow}>
              <Ionicons name={row.icon as any} size={20} color={PRIMARY} style={{ marginRight: 12 }} />
              <Text style={styles.notifLabel}>{row.label}</Text>
              <Switch
                value={row.value}
                onValueChange={row.setter}
                trackColor={{ false: '#D1C9B8', true: PRIMARY }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1C9B8"
              />
            </View>
            {idx < rows.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ─── Monthly Calendar ──────────────────────────────────────────────────────────
interface MonthlyCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  reminderDates: Set<string>;
  onMonthChange: (year: number, month: number) => void;
}

function MonthlyCalendar({ selectedDate, onSelectDate, reminderDates, onMonthChange }: MonthlyCalendarProps) {
  const todayBase = new Date();
  todayBase.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const grid = getMonthGrid(viewYear, viewMonth);

  const prevMonth = () => {
    const newMonth = viewMonth === 0 ? 11 : viewMonth - 1;
    const newYear = viewMonth === 0 ? viewYear - 1 : viewYear;
    setViewMonth(newMonth);
    setViewYear(newYear);
    onMonthChange(newYear, newMonth);
  };

  const nextMonth = () => {
    const newMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const newYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    setViewMonth(newMonth);
    setViewYear(newYear);
    onMonthChange(newYear, newMonth);
  };

  return (
    <View style={styles.calendarContainer}>
      {/* Month nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{MALAY_MONTHS_FULL[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Day letter headers */}
      <View style={styles.calendarRow}>
        {WEEK_LETTERS.map((l, i) => (
          <Text key={i} style={styles.calDayLetter}>{l}</Text>
        ))}
      </View>

      {/* Date grid */}
      <View style={styles.calendarGrid}>
        {grid.map((day, idx) => {
          if (day === null) {
            return <View key={`empty-${idx}`} style={styles.calDayCell} />;
          }
          const dateObj = new Date(viewYear, viewMonth, day);
          const dateStr = toDateString(dateObj);
          const isToday = dateStr === toDateString(todayBase);
          const isSelected = dateStr === toDateString(selectedDate);
          const hasDot = reminderDates.has(dateStr);

          return (
            <TouchableOpacity
              key={dateStr}
              style={styles.calDayCell}
              onPress={() => onSelectDate(dateObj)}
              activeOpacity={0.75}
            >
              <View style={[
                styles.calDayInner,
                isToday && styles.calDayToday,
                isSelected && !isToday && styles.calDaySelected,
              ]}>
                <Text style={[
                  styles.calDayNumber,
                  isToday && styles.calDayNumberToday,
                  !isToday && !isSelected && styles.calDayNumberMuted,
                ]}>
                  {day}
                </Text>
              </View>
              {hasDot
                ? <View style={styles.calAmberDot} />
                : <View style={styles.calDotPlaceholder} />
              }
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Add Reminder Modal ────────────────────────────────────────────────────────
interface AddReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  defaultDate: Date;
  initialReminder?: Reminder | null;
}

function AddReminderModal({ visible, onClose, onSaved, userId, defaultDate, initialReminder }: AddReminderModalProps) {
  const [title, setTitle] = useState('');
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [selectedPetName, setSelectedPetName] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(defaultDate);
  const [time, setTime] = useState<Date>(new Date());
  const [repeat, setRepeat] = useState<RepeatType>('Sekali');
  const [type, setType] = useState<ReminderType>('ubat');
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPetPicker, setShowPetPicker] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      if (initialReminder) {
        setTitle(initialReminder.title);
        setSelectedPetId(initialReminder.pet_id ?? null);
        setSelectedPetName(initialReminder.pets?.name ?? null);
        setRepeat(initialReminder.repeat);
        setType(initialReminder.type);
        const [h, m] = (initialReminder.time ?? '00:00').split(':').map(Number);
        const t = new Date(); t.setHours(h, m, 0, 0); setTime(t);
        setDate(initialReminder.date ? new Date(initialReminder.date) : defaultDate);
      } else {
        resetForm();
        setDate(defaultDate);
      }
      fetchPets();
    }
  }, [visible]);

  const fetchPets = async () => {
    setPetsLoading(true);
    try {
      const { data, error } = await supabase.from('pets').select('id, name').eq('user_id', userId);
      if (!error && data) setPets(data as Pet[]);
    } catch (_) {
    } finally { setPetsLoading(false); }
  };

  const resetForm = () => {
    setTitle(''); setSelectedPetId(null); setSelectedPetName(null);
    setRepeat('Sekali'); setType('ubat');
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Ralat', 'Sila masukkan tajuk peringatan.'); return; }
    setSaving(true);
    try {
      const dateStr = toDateString(date);
      const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
      if (initialReminder) {
        // Cancel old notification before updating
        await cancelReminderNotification(initialReminder.id);
        const { error } = await supabase.from('reminders')
          .update({ pet_id: selectedPetId, title: title.trim(), date: dateStr, time: timeStr, repeat, type })
          .eq('id', initialReminder.id);
        if (error) throw error;
        await scheduleReminderNotification(initialReminder.id, title.trim(), dateStr, timeStr, selectedPetName);
      } else {
        const { data, error } = await supabase.from('reminders').insert({
          user_id: userId, pet_id: selectedPetId, title: title.trim(),
          date: dateStr, time: timeStr, repeat, type, is_done: false,
        }).select('id').single();
        if (error) throw error;
        await scheduleReminderNotification(data.id, title.trim(), dateStr, timeStr, selectedPetName);
      }
      resetForm(); onSaved(); onClose();
    } catch (_) {
      Alert.alert('Ralat', 'Ralat menyimpan peringatan.');
    } finally { setSaving(false); }
  };

  const handleCancel = () => { resetForm(); onClose(); };

  const repeatOptions: RepeatType[] = ['Sekali', 'Harian', 'Mingguan', 'Bulanan'];
  const typeOptions: { value: ReminderType; label: string }[] = [
    { value: 'ubat', label: 'Ubat' },
    { value: 'temujanji', label: 'Temujanji' },
    { value: 'grooming', label: 'Grooming' },
    { value: 'lain-lain', label: 'Lain-lain' },
  ];

  const dateDisplay = `${date.getDate()} ${MALAY_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  const timeDisplay = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleCancel} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{initialReminder ? 'Kemaskini Peringatan' : 'Tambah Peringatan'}</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Tajuk</Text>
            <TextInput style={styles.textInput} placeholder="Tajuk peringatan" placeholderTextColor={MUTED} value={title} onChangeText={setTitle} />

            <Text style={styles.fieldLabel}>Haiwan Peliharaan</Text>
            <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowPetPicker(true)} activeOpacity={0.8}>
              <Text style={[styles.selectorText, !selectedPetName && { color: MUTED }]}>{selectedPetName ?? 'Pilih haiwan'}</Text>
              <Ionicons name="chevron-down" size={16} color={MUTED} />
            </TouchableOpacity>

            <Modal visible={showPetPicker} transparent animationType="fade" onRequestClose={() => setShowPetPicker(false)}>
              <View style={styles.petPickerOverlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowPetPicker(false)} />
                <View style={styles.petPickerBox}>
                  <Text style={styles.petPickerTitle}>Pilih Haiwan</Text>
                  {petsLoading ? (
                    <ActivityIndicator color={PRIMARY} style={{ marginVertical: 16 }} />
                  ) : pets.length === 0 ? (
                    <Text style={styles.petPickerEmpty}>Tiada haiwan didaftarkan.</Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 220 }}>
                      {pets.map((p) => (
                        <TouchableOpacity key={p.id}
                          style={[styles.petPill, selectedPetId === p.id && styles.petPillActive]}
                          onPress={() => { setSelectedPetId(p.id); setSelectedPetName(p.name); setShowPetPicker(false); }}>
                          <Text style={[styles.petPillText, selectedPetId === p.id && styles.petPillTextActive]}>{p.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                  <TouchableOpacity style={styles.petPickerClose} onPress={() => setShowPetPicker(false)}>
                    <Text style={{ color: PRIMARY, fontWeight: '600' }}>Tutup</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            <Text style={styles.fieldLabel}>Tarikh</Text>
            <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
              <Text style={styles.selectorText}>{dateDisplay}</Text>
              <Ionicons name="calendar-outline" size={16} color={MUTED} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_: any, selected?: Date) => { if (Platform.OS !== 'ios') setShowDatePicker(false); if (selected) setDate(selected); }} />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.pickerDoneBtn}>
                <Text style={styles.pickerDoneText}>Selesai</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.fieldLabel}>Masa</Text>
            <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowTimePicker(true)} activeOpacity={0.8}>
              <Text style={styles.selectorText}>{timeDisplay}</Text>
              <Ionicons name="time-outline" size={16} color={MUTED} />
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker value={time} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_: any, selected?: Date) => { if (Platform.OS !== 'ios') setShowTimePicker(false); if (selected) setTime(selected); }} />
            )}
            {showTimePicker && Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowTimePicker(false)} style={styles.pickerDoneBtn}>
                <Text style={styles.pickerDoneText}>Selesai</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.fieldLabel}>Ulangan</Text>
            <View style={styles.pillRow}>
              {repeatOptions.map((r) => (
                <TouchableOpacity key={r} style={[styles.pill, repeat === r && styles.pillActive]} onPress={() => setRepeat(r)} activeOpacity={0.8}>
                  <Text style={[styles.pillText, repeat === r && styles.pillTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Jenis</Text>
            <View style={styles.pillRow}>
              {typeOptions.map((t) => (
                <TouchableOpacity key={t.value} style={[styles.pill, type === t.value && styles.pillActive]} onPress={() => setType(t.value)} activeOpacity={0.8}>
                  <Text style={[styles.pillText, type === t.value && styles.pillTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Simpan</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.75}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function ScheduleScreen() {
  const { user } = useAuthStore();

  const todayBase = new Date();
  todayBase.setHours(0, 0, 0, 0);

  const [selectedDate, setSelectedDate] = useState<Date>(todayBase);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [reminderDates, setReminderDates] = useState<Set<string>>(new Set());

  const fetchReminders = useCallback(async (date: Date) => {
    if (!user) return;
    setLoading(true);
    try {
      const dateStr = toDateString(date);
      const { data, error } = await supabase
        .from('reminders').select('*, pets(name)')
        .eq('user_id', user.id).eq('date', dateStr).is('deleted_at', null);
      if (!error && data) setReminders(data as Reminder[]);
    } catch (_) {
    } finally { setLoading(false); }
  }, [user]);

  const fetchMonthReminderDates = useCallback(async (year: number, month: number) => {
    if (!user) return;
    try {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const { data } = await supabase
        .from('reminders').select('date')
        .eq('user_id', user.id).is('deleted_at', null)
        .gte('date', from).lte('date', to);
      if (data) setReminderDates(new Set(data.map((r: { date: string }) => r.date)));
    } catch (_) {}
  }, [user]);

  // Request notification permissions once on mount
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        await AsyncStorage.setItem('notif_push', 'false');
      }
    })();
  }, []);

  useEffect(() => {
    fetchReminders(selectedDate);
  }, [selectedDate, fetchReminders]);

  useEffect(() => {
    fetchMonthReminderDates(todayBase.getFullYear(), todayBase.getMonth());
  }, [fetchMonthReminderDates]);

  const handleMarkDone = async (id: string) => {
    try {
      const { error } = await supabase.from('reminders').update({ is_done: true }).eq('id', id);
      if (!error) {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, is_done: true } : r));
        await cancelReminderNotification(id);
      }
    } catch (_) {}
  };

  const handleEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setShowModal(true);
  };

  const handleDeleteReminder = (id: string) => {
    Alert.alert('Padam Peringatan', 'Adakah anda pasti ingin memadam peringatan ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Padam', style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('reminders').update({ deleted_at: new Date().toISOString() }).eq('id', id);
            if (error) throw error;
            setReminders(prev => prev.filter(r => r.id !== id));
            await cancelReminderNotification(id);
            fetchMonthReminderDates(selectedDate.getFullYear(), selectedDate.getMonth());
          } catch (err: any) {
            Alert.alert('Ralat', err?.message ?? 'Gagal memadam peringatan.');
          }
        },
      },
    ]);
  };

  const handleSaved = () => {
    fetchReminders(selectedDate);
    fetchMonthReminderDates(selectedDate.getFullYear(), selectedDate.getMonth());
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
  };

  const handleMonthChange = (year: number, month: number) => {
    fetchMonthReminderDates(year, month);
  };

  const isToday = toDateString(selectedDate) === toDateString(todayBase);
  const selectedLabel = isToday
    ? `Hari Ini — ${getMalayLabel(selectedDate)}`
    : getMalayLabel(selectedDate);

  return (
    <View style={styles.root}>
      {/* ── Indigo header ── */}
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.topBar}>
          <Text style={styles.headerTitle}>Jadual & Peringatan</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <MonthlyCalendar
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          reminderDates={reminderDates}
          onMonthChange={handleMonthChange}
        />

        <Text style={styles.selectedDayLabel}>{selectedLabel}</Text>
      </SafeAreaView>

      {/* ── Content ── */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : reminders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={56} color="#D1C9B8" />
            <Text style={styles.emptyTitle}>Tiada peringatan</Text>
            <Text style={styles.emptySubtitle}>Tiada jadual untuk hari ini</Text>
          </View>
        ) : (
          reminders.map(r => (
            <ReminderCard key={r.id} reminder={r} onMarkDone={handleMarkDone} onDelete={handleDeleteReminder} onEdit={handleEditReminder} />
          ))
        )}

        <NotificationToggles />
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Modal ── */}
      {user && (
        <AddReminderModal
          visible={showModal}
          onClose={() => { setShowModal(false); setEditingReminder(null); }}
          onSaved={handleSaved}
          userId={user.id}
          defaultDate={selectedDate}
          initialReminder={editingReminder}
        />
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PRIMARY },
  safeHeader: { backgroundColor: PRIMARY },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: 0.2 },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 24, fontWeight: '700', lineHeight: 28 },

  // ─── Monthly Calendar ───
  calendarContainer: { paddingHorizontal: 16, paddingBottom: 4 },
  monthNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  monthNavBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8, padding: 6,
  },
  monthTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },

  calendarRow: { flexDirection: 'row', marginBottom: 4 },
  calDayLetter: {
    flex: 1, textAlign: 'center', fontSize: 11,
    fontWeight: '600', color: 'rgba(255,255,255,0.5)', paddingBottom: 4,
  },

  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell: { width: `${100 / 7}%` as any, alignItems: 'center', paddingVertical: 2 },
  calDayInner: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  calDayToday: { backgroundColor: '#fff' },
  calDaySelected: { backgroundColor: 'rgba(255,255,255,0.25)' },
  calDayNumber: { fontSize: 13, fontWeight: '600', color: '#fff' },
  calDayNumberToday: { color: PRIMARY },
  calDayNumberMuted: { color: 'rgba(255,255,255,0.55)' },
  calAmberDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: ACCENT, marginTop: 2,
  },
  calDotPlaceholder: { width: 5, height: 5, marginTop: 2 },

  selectedDayLabel: {
    color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 44,
  },

  contentScroll: {
    flex: 1, backgroundColor: BG,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -24,
  },
  contentContainer: { paddingHorizontal: 16, paddingTop: 24 },

  card: { backgroundColor: '#fff', borderRadius: 16, ...CARD_SHADOW },

  reminderCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center', ...CARD_SHADOW,
  },
  reminderIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  reminderMiddle: { flex: 1, marginRight: 8 },
  reminderTitle: { fontSize: 14, fontWeight: '700', color: INK },
  reminderSubtitle: { fontSize: 12, color: MUTED, marginTop: 2 },
  reminderRight: { alignItems: 'flex-end', gap: 6 },
  reminderBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  reminderBadgeText: { fontSize: 11, fontWeight: '600' },
  checkBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: SAGE, alignItems: 'center', justifyContent: 'center',
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK, marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: MUTED, marginTop: 6 },

  skeletonCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center', ...CARD_SHADOW,
  },
  skeletonIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E8E3DA', marginRight: 12 },
  skeletonMiddle: { flex: 1 },
  skeletonLine: { height: 13, borderRadius: 6, backgroundColor: '#E8E3DA', width: '75%' },
  skeletonBadge: { width: 60, height: 26, borderRadius: 8, backgroundColor: '#E8E3DA' },

  notifSection: { marginTop: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: PRIMARY, marginBottom: 12 },
  notifCard: { padding: 16 },
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  notifLabel: { flex: 1, fontSize: 14, color: INK },
  divider: { height: 1, backgroundColor: DIVIDER },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 0, maxHeight: SCREEN_HEIGHT * 0.92,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D1C9B8', alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: PRIMARY, marginBottom: 20 },

  fieldLabel: {
    fontSize: 11, fontWeight: '600', color: MUTED,
    marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  textInput: {
    borderWidth: 1.5, borderColor: DIVIDER, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK, backgroundColor: BG,
  },
  selectorBtn: {
    borderWidth: 1.5, borderColor: DIVIDER, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BG,
  },
  selectorText: { fontSize: 15, color: INK },
  pickerDoneBtn: { alignItems: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  pickerDoneText: { color: PRIMARY, fontWeight: '600', fontSize: 15 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1.5, borderColor: DIVIDER, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: BG,
  },
  pillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  pillText: { fontSize: 13, color: INK, fontWeight: '500' },
  pillTextActive: { color: '#fff', fontWeight: '600' },

  saveBtn: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: PRIMARY, fontSize: 15, fontWeight: '600' },

  petPickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  petPickerBox: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 },
  petPickerTitle: { fontSize: 16, fontWeight: '700', color: PRIMARY, marginBottom: 14 },
  petPickerEmpty: { color: MUTED, fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  petPill: {
    borderWidth: 1.5, borderColor: DIVIDER, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8, backgroundColor: BG,
  },
  petPillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  petPillText: { fontSize: 14, color: INK },
  petPillTextActive: { color: '#fff', fontWeight: '600' },
  petPickerClose: { alignItems: 'center', marginTop: 12, paddingVertical: 10 },
});