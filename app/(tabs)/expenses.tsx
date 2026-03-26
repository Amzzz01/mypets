import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const PRIMARY = '#1A237E';
const ACCENT = '#FFB300';
const BACKGROUND = '#F9F7F2';
const INK = '#1A1A2E';
const MUTED = '#9E9E9E';
const WHITE = '#FFFFFF';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = 'makanan' | 'ubatan' | 'grooming' | 'vet' | 'lain-lain';

interface Pet {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  user_id: string;
  pet_id: string | null;
  category: Category;
  amount: number;
  date: string;
  notes: string | null;
  pets?: { name: string } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS_BM = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember',
];

const CATEGORIES: { key: Category; label: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'makanan', label: 'Makanan', color: '#66BB6A', icon: 'restaurant-outline' },
  { key: 'ubatan', label: 'Ubatan', color: '#42A5F5', icon: 'medkit-outline' },
  { key: 'grooming', label: 'Grooming', color: '#AB47BC', icon: 'cut-outline' },
  { key: 'vet', label: 'Vet', color: '#EF5350', icon: 'fitness-outline' },
  { key: 'lain-lain', label: 'Lain-lain', color: '#9E9E9E', icon: 'ellipsis-horizontal-outline' },
];

function getCategoryInfo(key: Category) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[4];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View style={[s.card, { opacity: anim }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#E0E0E0' }} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ height: 13, width: '50%', backgroundColor: '#E0E0E0', borderRadius: 6 }} />
          <View style={{ height: 11, width: '30%', backgroundColor: '#E0E0E0', borderRadius: 6 }} />
        </View>
        <View style={{ height: 16, width: 60, backgroundColor: '#E0E0E0', borderRadius: 6 }} />
      </View>
    </Animated.View>
  );
}

// ─── Expense Card ─────────────────────────────────────────────────────────────
function ExpenseCard({ expense, onDelete }: { expense: Expense; onDelete: () => void }) {
  const cat = getCategoryInfo(expense.category);
  return (
    <View style={s.card}>
      <View style={s.cardRow}>
        <View style={[s.catIcon, { backgroundColor: cat.color + '22' }]}>
          <Ionicons name={cat.icon} size={20} color={cat.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {expense.notes || cat.label}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {expense.pets?.name ? (
              <View style={s.tagIndigo}>
                <Text style={s.tagIndigoText}>{expense.pets.name}</Text>
              </View>
            ) : null}
            <View style={[s.tagCat, { backgroundColor: cat.color + '22' }]}>
              <Text style={[s.tagCatText, { color: cat.color }]}>{cat.label}</Text>
            </View>
            <Text style={s.cardDate}>{formatDate(expense.date)}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <Text style={s.cardAmount}>RM {Number(expense.amount).toFixed(2)}</Text>
          <TouchableOpacity onPress={onDelete} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={18} color="#EF5350" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({ expenses }: { expenses: Expense[] }) {
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Top 3 categories by spend
  const byCat: Record<string, number> = {};
  expenses.forEach((e) => {
    byCat[e.category] = (byCat[e.category] ?? 0) + Number(e.amount);
  });
  const top3 = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const maxVal = top3[0]?.[1] ?? 1;

  return (
    <View style={s.summaryCard}>
      <Text style={s.summaryTotal}>RM {total.toFixed(2)}</Text>
      <Text style={s.summaryLabel}>Jumlah Perbelanjaan</Text>
      {top3.length > 0 && (
        <View style={{ marginTop: 12, gap: 6 }}>
          {top3.map(([key, val]) => {
            const cat = getCategoryInfo(key as Category);
            const pct = (val / maxVal) * 100;
            return (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.summaryBarLabel, { color: cat.color }]}>{cat.label}</Text>
                <View style={s.summaryBarTrack}>
                  <View style={[s.summaryBarFill, { width: `${pct}%`, backgroundColor: cat.color }]} />
                </View>
                <Text style={s.summaryBarValue}>RM {val.toFixed(0)}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ExpensesScreen() {
  const { user } = useAuthStore();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Form state
  const [formPetId, setFormPetId] = useState<string | null>(null);
  const [formCategory, setFormCategory] = useState<Category>('makanan');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date());
  const [formNotes, setFormNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('pets')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name');
    setPets((data as Pet[]) ?? []);
  }, [user]);

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const endMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
      const endYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
      const endDate = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-01`;

      let query = supabase
        .from('expenses')
        .select('*, pets(name)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lt('date', endDate)
        .order('date', { ascending: false });

      if (selectedPetId) {
        query = query.eq('pet_id', selectedPetId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setExpenses((data as Expense[]) ?? []);
    } catch {
      Alert.alert('Ralat', 'Gagal memuatkan perbelanjaan.');
    } finally {
      setLoading(false);
    }
  }, [user, selectedMonth, selectedYear, selectedPetId]);

  useEffect(() => {
    fetchPets();
  }, [fetchPets]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const openModal = () => {
    setFormPetId(null);
    setFormCategory('makanan');
    setFormAmount('');
    setFormDate(new Date());
    setFormNotes('');
    setShowDatePicker(false);
    setModalVisible(true);
  };

  const saveExpense = async () => {
    if (!user) return;
    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Ralat', 'Sila masukkan jumlah yang sah.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('expenses').insert({
        user_id: user.id,
        pet_id: formPetId || null,
        category: formCategory,
        amount: amt,
        date: toYMD(formDate),
        notes: formNotes.trim() || null,
      });
      if (error) throw error;
      setModalVisible(false);
      fetchExpenses();
    } catch {
      Alert.alert('Ralat', 'Gagal menyimpan perbelanjaan.');
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = (expense: Expense) => {
    Alert.alert('Padam', `Padam perbelanjaan RM ${Number(expense.amount).toFixed(2)}?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Padam',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('expenses').delete().eq('id', expense.id);
          fetchExpenses();
        },
      },
    ]);
  };

  const onDateChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) setFormDate(selected);
  };

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: PRIMARY }}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color={WHITE} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Perbelanjaan</Text>
          <TouchableOpacity style={s.addButton} onPress={openModal} activeOpacity={0.8}>
            <Ionicons name="add" size={22} color={INK} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Body ── */}
      <View style={s.body}>
        {/* Pet filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipRow}
        >
          {[{ id: null, name: 'Semua' }, ...pets].map((p) => {
            const active = selectedPetId === p.id;
            return (
              <TouchableOpacity
                key={p.id ?? 'all'}
                style={[s.chip, active ? s.chipActive : s.chipInactive]}
                onPress={() => setSelectedPetId(p.id)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipText, active ? s.chipTextActive : s.chipTextInactive]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Month selector */}
        <View style={s.monthRow}>
          <TouchableOpacity onPress={prevMonth} activeOpacity={0.7} style={s.monthArrow}>
            <Ionicons name="chevron-back" size={20} color={PRIMARY} />
          </TouchableOpacity>
          <Text style={s.monthLabel}>
            {MONTHS_BM[selectedMonth]} {selectedYear}
          </Text>
          <TouchableOpacity onPress={nextMonth} activeOpacity={0.7} style={s.monthArrow}>
            <Ionicons name="chevron-forward" size={20} color={PRIMARY} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
        >
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : expenses.length === 0 ? (
            <>
              <SummaryCard expenses={[]} />
              <View style={s.emptyBox}>
                <Ionicons name="cash-outline" size={48} color="#D1C9B8" />
                <Text style={s.emptyTitle}>Tiada perbelanjaan</Text>
                <Text style={s.emptySubtitle}>Belum ada rekod perbelanjaan bulan ini</Text>
              </View>
            </>
          ) : (
            <>
              <SummaryCard expenses={expenses} />
              {expenses.map((exp) => (
                <ExpenseCard key={exp.id} expense={exp} onDelete={() => deleteExpense(exp)} />
              ))}
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>

      {/* ── Add Expense Modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={s.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={s.modalKAV}
            >
              <TouchableWithoutFeedback>
                <View style={[s.modalSheet, { maxHeight: SCREEN_HEIGHT * 0.9 }]}>
                  <View style={s.handleBar} />
                  <Text style={s.modalTitle}>Tambah Perbelanjaan</Text>

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={s.formContent}
                  >
                    {/* Pet selector */}
                    <Text style={s.fieldLabel}>Pilih Haiwan</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                    >
                      {[{ id: null, name: 'Tiada' }, ...pets].map((p) => {
                        const sel = formPetId === p.id;
                        return (
                          <TouchableOpacity
                            key={p.id ?? 'none'}
                            style={[s.pill, sel ? s.pillActive : s.pillInactive]}
                            onPress={() => setFormPetId(p.id)}
                            activeOpacity={0.75}
                          >
                            <Text style={[s.pillText, sel ? s.pillTextActive : s.pillTextInactive]}>
                              {p.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* Category */}
                    <Text style={s.fieldLabel}>Kategori</Text>
                    <View style={s.categoryGrid}>
                      {CATEGORIES.map((cat) => {
                        const sel = formCategory === cat.key;
                        return (
                          <TouchableOpacity
                            key={cat.key}
                            style={[
                              s.catBtn,
                              { borderColor: sel ? cat.color : '#E0E0E0' },
                              sel && { backgroundColor: cat.color + '18' },
                            ]}
                            onPress={() => setFormCategory(cat.key)}
                            activeOpacity={0.75}
                          >
                            <Ionicons name={cat.icon} size={18} color={sel ? cat.color : MUTED} />
                            <Text style={[s.catBtnText, { color: sel ? cat.color : MUTED }]}>
                              {cat.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Amount */}
                    <Text style={s.fieldLabel}>Jumlah (RM)</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={formAmount}
                      onChangeText={setFormAmount}
                      placeholder="0.00"
                      placeholderTextColor={MUTED}
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                    />

                    {/* Date */}
                    <Text style={s.fieldLabel}>Tarikh</Text>
                    <TouchableOpacity
                      style={s.dateButton}
                      onPress={() => setShowDatePicker(!showDatePicker)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calendar-outline" size={18} color={PRIMARY} style={{ marginRight: 8 }} />
                      <Text style={s.dateButtonText}>{formatDate(toYMD(formDate))}</Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={formDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateChange}
                        maximumDate={new Date()}
                      />
                    )}

                    {/* Notes */}
                    <Text style={s.fieldLabel}>Nota (pilihan)</Text>
                    <TextInput
                      style={[s.fieldInput, { height: 80, textAlignVertical: 'top' }]}
                      value={formNotes}
                      onChangeText={setFormNotes}
                      placeholder="Tulis nota..."
                      placeholderTextColor={MUTED}
                      multiline
                      returnKeyType="done"
                    />

                    <TouchableOpacity
                      style={[s.saveBtn, saving && { opacity: 0.7 }]}
                      onPress={saveExpense}
                      disabled={saving}
                      activeOpacity={0.85}
                    >
                      <Text style={s.saveBtnText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.cancelBtn}
                      onPress={() => setModalVisible(false)}
                      disabled={saving}
                      activeOpacity={0.75}
                    >
                      <Text style={s.cancelBtnText}>Batal</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 36,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: WHITE,
    letterSpacing: 0.3,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
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

  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipInactive: { backgroundColor: WHITE, borderColor: '#E0E0E0' },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: WHITE },
  chipTextInactive: { color: MUTED },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 16,
  },
  monthArrow: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    minWidth: 150,
    textAlign: 'center',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 10,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryTotal: {
    fontSize: 28,
    fontWeight: '800',
    color: PRIMARY,
  },
  summaryLabel: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  summaryBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    width: 64,
  },
  summaryBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#F0EDE6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  summaryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  summaryBarValue: {
    fontSize: 11,
    color: MUTED,
    width: 56,
    textAlign: 'right',
  },

  // Expense Card
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: INK,
  },
  cardDate: {
    fontSize: 11,
    color: MUTED,
    alignSelf: 'center',
  },
  cardAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY,
  },
  tagIndigo: {
    backgroundColor: '#EEF0FA',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  tagIndigoText: { color: PRIMARY, fontSize: 11, fontWeight: '600' },
  tagCat: {
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  tagCatText: { fontSize: 11, fontWeight: '600' },

  // Empty
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: MUTED,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalKAV: { justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY,
    marginBottom: 16,
    textAlign: 'center',
  },
  formContent: { paddingBottom: 8, gap: 4 },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: INK,
    marginTop: 12,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: BACKGROUND,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: INK,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },

  // Category grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: WHITE,
  },
  catBtnText: { fontSize: 13, fontWeight: '600' },

  // Pet pills
  pill: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  pillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  pillInactive: { backgroundColor: WHITE, borderColor: '#E0E0E0' },
  pillText: { fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: WHITE },
  pillTextInactive: { color: MUTED },

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BACKGROUND,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  dateButtonText: { fontSize: 14, color: INK },

  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
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
