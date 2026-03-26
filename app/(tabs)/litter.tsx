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
const SAGE = '#81C784';
const INK = '#1A1A2E';
const MUTED = '#9E9E9E';
const WHITE = '#FFFFFF';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Pet {
  id: string;
  name: string;
  gender: string | null;
}

interface Litter {
  id: string;
  user_id: string;
  mother_id: string | null;
  father_id: string | null;
  birth_date: string;
  offspring_count: number;
  notes: string | null;
  mother?: { name: string } | null;
  father?: { name: string } | null;
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

function daysOld(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  return Math.floor((today.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
}

function getLitterStatus(days: number): { label: string; color: string; bg: string } {
  if (days <= 30) return { label: 'Baru Lahir', color: '#B8860B', bg: '#FFF8E1' };
  if (days <= 90) return { label: 'Membesar', color: PRIMARY, bg: '#EEF0FA' };
  return { label: 'Sedia Jual', color: '#2E7D32', bg: '#E8F5E9' };
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
      <View style={{ gap: 10 }}>
        <View style={{ height: 14, width: '60%', backgroundColor: '#E0E0E0', borderRadius: 6 }} />
        <View style={{ height: 11, width: '40%', backgroundColor: '#E0E0E0', borderRadius: 6 }} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ height: 22, width: 64, backgroundColor: '#E0E0E0', borderRadius: 6 }} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Litter Card ──────────────────────────────────────────────────────────────
function LitterCard({ litter, onDelete }: { litter: Litter; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const days = daysOld(litter.birth_date);
  const status = getLitterStatus(days);

  const motherName = litter.mother?.name ?? 'Tidak diketahui';
  const fatherName = litter.father?.name ?? 'Tidak diketahui';

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => setExpanded((e) => !e)}
      activeOpacity={0.85}
    >
      {/* Parents row */}
      <View style={s.parentsRow}>
        <Text style={s.parentName}>{motherName}</Text>
        <Ionicons name="heart" size={14} color="#EF5350" style={{ marginHorizontal: 6 }} />
        <Text style={s.parentName}>{fatherName}</Text>
        <View style={{ flex: 1 }} />
        <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Ionicons name="calendar-outline" size={14} color={MUTED} />
          <Text style={s.statText}>{formatDate(litter.birth_date)}</Text>
        </View>
        <View style={s.statItem}>
          <Ionicons name="paw-outline" size={14} color={MUTED} />
          <Text style={s.statText}>{litter.offspring_count} anak</Text>
        </View>
        <View style={s.statItem}>
          <Ionicons name="time-outline" size={14} color={MUTED} />
          <Text style={s.statText}>{days} hari</Text>
        </View>
      </View>

      {/* Expanded: notes + actions */}
      {expanded && (
        <View style={s.expandedSection}>
          {litter.notes ? (
            <Text style={s.notesText}>{litter.notes}</Text>
          ) : null}
          <View style={s.cardActions}>
            <TouchableOpacity
              style={s.cardActionBtn}
              onPress={() => router.push('/records')}
              activeOpacity={0.8}
            >
              <Ionicons name="receipt-outline" size={15} color={PRIMARY} style={{ marginRight: 5 }} />
              <Text style={s.cardActionBtnText}>Rekod Jualan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.cardActionBtn, s.cardActionBtnRed]}
              onPress={onDelete}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={15} color="#EF5350" style={{ marginRight: 5 }} />
              <Text style={[s.cardActionBtnText, { color: '#EF5350' }]}>Padam</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Summary Bar ──────────────────────────────────────────────────────────────
function SummaryBar({ litters }: { litters: Litter[] }) {
  const totalOffspring = litters.reduce((s, l) => s + l.offspring_count, 0);
  return (
    <View style={s.summaryBar}>
      <View style={s.summaryItem}>
        <Text style={s.summaryValue}>{litters.length}</Text>
        <Text style={s.summaryLabel}>Litter Aktif</Text>
      </View>
      <View style={s.summaryDivider} />
      <View style={s.summaryItem}>
        <Text style={s.summaryValue}>{totalOffspring}</Text>
        <Text style={s.summaryLabel}>Jumlah Anak</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LitterScreen() {
  const { user, role } = useAuthStore();

  const [litters, setLitters] = useState<Litter[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Form state
  const [formMotherId, setFormMotherId] = useState<string | null>(null);
  const [formFatherId, setFormFatherId] = useState<string | null>(null);
  const [formBirthDate, setFormBirthDate] = useState(new Date());
  const [formOffspringCount, setFormOffspringCount] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('pets')
      .select('id, name, gender')
      .eq('user_id', user.id)
      .order('name');
    setPets((data as Pet[]) ?? []);
  }, [user]);

  const fetchLitters = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('litters')
        .select('*, mother:mother_id(name), father:father_id(name)')
        .eq('user_id', user.id)
        .order('birth_date', { ascending: false });
      if (error) throw error;
      setLitters((data as Litter[]) ?? []);
    } catch {
      Alert.alert('Ralat', 'Gagal memuatkan rekod litter.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPets();
    fetchLitters();
  }, [fetchPets, fetchLitters]);

  const openModal = () => {
    setFormMotherId(null);
    setFormFatherId(null);
    setFormBirthDate(new Date());
    setFormOffspringCount('');
    setFormNotes('');
    setShowDatePicker(false);
    setModalVisible(true);
  };

  const saveLitter = async () => {
    if (!user) return;
    const count = parseInt(formOffspringCount);
    if (!formMotherId) {
      Alert.alert('Ralat', 'Sila pilih ibu.');
      return;
    }
    if (isNaN(count) || count < 1) {
      Alert.alert('Ralat', 'Sila masukkan bilangan anak yang sah.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('litters').insert({
        user_id: user.id,
        mother_id: formMotherId,
        father_id: formFatherId || null,
        birth_date: toYMD(formBirthDate),
        offspring_count: count,
        notes: formNotes.trim() || null,
      });
      if (error) throw error;
      setModalVisible(false);
      fetchLitters();
    } catch {
      Alert.alert('Ralat', 'Gagal menyimpan rekod litter.');
    } finally {
      setSaving(false);
    }
  };

  const deleteLitter = (litter: Litter) => {
    Alert.alert('Padam Litter', 'Adakah anda pasti ingin memadamkan rekod litter ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Padam',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('litters').delete().eq('id', litter.id);
          fetchLitters();
        },
      },
    ]);
  };

  const onDateChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) setFormBirthDate(selected);
  };

  const femalePets = pets.filter((p) => p.gender === 'betina' || p.gender === 'female');
  const malePets = pets.filter((p) => p.gender === 'jantan' || p.gender === 'male');

  // Not a breeder
  if (role !== 'Breeder') {
    return (
      <View style={s.root}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: PRIMARY }}>
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={22} color={WHITE} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Pengurusan Litter</Text>
            <View style={{ width: 36 }} />
          </View>
        </SafeAreaView>
        <View style={[s.body, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]}>
          <Ionicons name="lock-closed-outline" size={56} color="#D1C9B8" />
          <Text style={[s.emptyTitle, { marginTop: 16 }]}>Akses Penternak Sahaja</Text>
          <Text style={s.emptySubtitle}>Ciri ini hanya tersedia untuk akaun Penternak.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: PRIMARY }}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color={WHITE} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Pengurusan Litter</Text>
          <TouchableOpacity style={s.addButton} onPress={openModal} activeOpacity={0.8}>
            <Ionicons name="add" size={22} color={INK} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Body ── */}
      <View style={s.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
        >
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <SummaryBar litters={litters} />
              {litters.length === 0 ? (
                <View style={s.emptyBox}>
                  <Ionicons name="heart-outline" size={48} color="#D1C9B8" />
                  <Text style={s.emptyTitle}>Tiada rekod litter</Text>
                  <Text style={s.emptySubtitle}>Ketik "+" untuk menambah rekod litter baharu</Text>
                </View>
              ) : (
                litters.map((litter) => (
                  <LitterCard
                    key={litter.id}
                    litter={litter}
                    onDelete={() => deleteLitter(litter)}
                  />
                ))
              )}
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>

      {/* ── Add Litter Modal ── */}
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
                <View style={[s.modalSheet, { maxHeight: SCREEN_HEIGHT * 0.88 }]}>
                  <View style={s.handleBar} />
                  <Text style={s.modalTitle}>Tambah Litter</Text>

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={s.formContent}
                  >
                    {/* Mother selector */}
                    <Text style={s.fieldLabel}>Ibu (betina) *</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                    >
                      {femalePets.length === 0 ? (
                        <Text style={s.noPetsText}>Tiada haiwan betina.</Text>
                      ) : (
                        femalePets.map((p) => {
                          const sel = formMotherId === p.id;
                          return (
                            <TouchableOpacity
                              key={p.id}
                              style={[s.pill, sel ? s.pillActive : s.pillInactive]}
                              onPress={() => setFormMotherId(p.id)}
                              activeOpacity={0.75}
                            >
                              <Text style={[s.pillText, sel ? s.pillTextActive : s.pillTextInactive]}>
                                {p.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>

                    {/* Father selector */}
                    <Text style={s.fieldLabel}>Bapa (jantan)</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                    >
                      <TouchableOpacity
                        style={[s.pill, formFatherId === null ? s.pillActive : s.pillInactive]}
                        onPress={() => setFormFatherId(null)}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.pillText, formFatherId === null ? s.pillTextActive : s.pillTextInactive]}>
                          Tiada
                        </Text>
                      </TouchableOpacity>
                      {malePets.map((p) => {
                        const sel = formFatherId === p.id;
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={[s.pill, sel ? s.pillActive : s.pillInactive]}
                            onPress={() => setFormFatherId(p.id)}
                            activeOpacity={0.75}
                          >
                            <Text style={[s.pillText, sel ? s.pillTextActive : s.pillTextInactive]}>
                              {p.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* Birth date */}
                    <Text style={s.fieldLabel}>Tarikh Lahir</Text>
                    <TouchableOpacity
                      style={s.dateButton}
                      onPress={() => setShowDatePicker(!showDatePicker)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calendar-outline" size={18} color={PRIMARY} style={{ marginRight: 8 }} />
                      <Text style={s.dateButtonText}>{formatDate(toYMD(formBirthDate))}</Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={formBirthDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateChange}
                        maximumDate={new Date()}
                      />
                    )}

                    {/* Offspring count */}
                    <Text style={s.fieldLabel}>Bilangan Anak *</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={formOffspringCount}
                      onChangeText={setFormOffspringCount}
                      placeholder="Bilangan anak"
                      placeholderTextColor={MUTED}
                      keyboardType="number-pad"
                      returnKeyType="next"
                    />

                    {/* Notes */}
                    <Text style={s.fieldLabel}>Nota (pilihan)</Text>
                    <TextInput
                      style={[s.fieldInput, { height: 72, textAlignVertical: 'top' }]}
                      value={formNotes}
                      onChangeText={setFormNotes}
                      placeholder="Tulis nota..."
                      placeholderTextColor={MUTED}
                      multiline
                    />

                    <TouchableOpacity
                      style={[s.saveBtn, saving && { opacity: 0.7 }]}
                      onPress={saveLitter}
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
    fontSize: 20,
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

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },

  // Summary bar
  summaryBar: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: PRIMARY,
  },
  summaryLabel: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#F0EDE6',
  },

  // Litter Card
  card: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  parentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  parentName: {
    fontSize: 15,
    fontWeight: '700',
    color: INK,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: MUTED,
  },
  expandedSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0EDE6',
    paddingTop: 12,
    gap: 10,
  },
  notesText: {
    fontSize: 13,
    color: INK,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF0FA',
    borderRadius: 10,
    paddingVertical: 9,
  },
  cardActionBtnRed: {
    backgroundColor: '#FFF0F0',
  },
  cardActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Empty
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
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
    textAlign: 'center',
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
  noPetsText: {
    fontSize: 13,
    color: MUTED,
    fontStyle: 'italic',
  },

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
