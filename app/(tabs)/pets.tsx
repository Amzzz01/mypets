import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

// ─── Design tokens ────────────────────────────────────────────────────────────
const PRIMARY = '#1A237E';
const ACCENT = '#FFB300';
const BACKGROUND = '#F9F7F2';
const SAGE = '#81C784';
const INK = '#1A1A2E';
const INDIGO_LIGHT = '#EEF0FA';
const MUTED = '#9E9E9E';
const DANGER = '#EF5350';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 44) / 2;

// ─── Types ────────────────────────────────────────────────────────────────────
type HealthStatus = 'Sihat' | 'Kurang Sihat' | 'Sakit';
type Species = 'Anjing' | 'Kucing' | 'Arnab' | 'Burung' | 'Ikan' | 'Lain-lain';
type Gender = 'Jantan' | 'Betina';
type TabKey = 'Kesihatan' | 'Perbelanjaan' | 'Galeri' | 'Dokumen';

interface Pet {
  id: string;
  user_id: string;
  name: string;
  species: Species;
  breed: string;
  dob: string;
  gender: Gender;
  weight: number;
  health_status: HealthStatus;
}

interface HealthRecord {
  id: string;
  pet_id: string;
  title: string;
  date: string;
  status: string;
  notes: string;
  type: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SPECIES_EMOJI: Record<Species, string> = {
  Anjing: '🐕',
  Kucing: '🐱',
  Arnab: '🐰',
  Burung: '🐦',
  Ikan: '🐟',
  'Lain-lain': '🐾',
};

const SPECIES_LIST: Species[] = ['Anjing', 'Kucing', 'Arnab', 'Burung', 'Ikan', 'Lain-lain'];

function getHealthBadgeColor(status: HealthStatus): string {
  switch (status) {
    case 'Sihat':
      return SAGE;
    case 'Kurang Sihat':
      return ACCENT;
    case 'Sakit':
      return DANGER;
    default:
      return SAGE;
  }
}

function getRecordStatusColor(status: string): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'sihat' || s === 'sembuh') return SAGE;
  if (s === 'rawatan') return ACCENT;
  if (s === 'kritikal') return DANGER;
  return MUTED;
}

function getRecordTypeColor(type: string): string {
  const t = (type ?? '').toLowerCase();
  if (t === 'vaksin') return PRIMARY;
  if (t === 'rawatan') return ACCENT;
  if (t === 'pembedahan') return DANGER;
  return MUTED;
}

function calcAge(dob: string): string {
  if (!dob) return '—';
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years >= 1) return `${years} tahun`;
  if (months >= 1) return `${months} bulan`;
  return '< 1 bulan';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonCard, { width: CARD_WIDTH, opacity }]} />
  );
}

// ─── Add Pet Modal ────────────────────────────────────────────────────────────
interface AddPetModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (pet: Pet) => void;
  userId: string;
}

function AddPetModal({ visible, onClose, onSuccess, userId }: AddPetModalProps) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('Anjing');
  const [breed, setBreed] = useState('');
  const [dob, setDob] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [gender, setGender] = useState<Gender>('Jantan');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName('');
    setSpecies('Anjing');
    setBreed('');
    setDob(new Date());
    setShowPicker(false);
    setGender('Jantan');
    setWeight('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Ralat', 'Sila masukkan nama haiwan.');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('pets')
        .insert({
          user_id: userId,
          name: name.trim(),
          species,
          breed: breed.trim(),
          dob: dob.toISOString().split('T')[0],
          gender,
          weight: weight ? parseFloat(weight) : null,
          health_status: 'Sihat',
        })
        .select()
        .single();

      if (error) throw error;
      resetForm();
      onSuccess(data as Pet);
    } catch {
      Alert.alert('Ralat', 'Ralat menyimpan haiwan. Cuba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selected) setDob(selected);
  };

  const today = new Date();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          {/* Handle bar */}
          <View style={styles.modalHandle} />

          <Text style={styles.modalTitle}>Tambah Haiwan Baru</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <Text style={styles.fieldLabel}>Nama</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Nama haiwan"
              placeholderTextColor={MUTED}
              value={name}
              onChangeText={setName}
            />

            {/* Species */}
            <Text style={styles.fieldLabel}>Spesies</Text>
            <View style={styles.pillGrid}>
              {SPECIES_LIST.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.pillButton, species === s && styles.pillButtonActive]}
                  onPress={() => setSpecies(s)}
                >
                  <Text style={[styles.pillText, species === s && styles.pillTextActive]}>
                    {SPECIES_EMOJI[s]} {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Breed */}
            <Text style={styles.fieldLabel}>Baka</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Baka"
              placeholderTextColor={MUTED}
              value={breed}
              onChangeText={setBreed}
            />

            {/* DOB */}
            <Text style={styles.fieldLabel}>Tarikh Lahir</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowPicker(!showPicker)}
            >
              <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
              <Text style={styles.dateButtonText}>{formatDate(dob.toISOString())}</Text>
            </TouchableOpacity>

            {showPicker && (
              <DateTimePicker
                value={dob}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                maximumDate={today}
                onChange={onDateChange}
              />
            )}

            {/* Gender */}
            <Text style={styles.fieldLabel}>Jantina</Text>
            <View style={styles.genderToggle}>
              {(['Jantan', 'Betina'] as Gender[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderButton, gender === g && styles.genderButtonActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Weight */}
            <Text style={styles.fieldLabel}>Berat (kg)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Berat (kg)"
              placeholderTextColor={MUTED}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Pet Detail ───────────────────────────────────────────────────────────────
interface PetDetailProps {
  pet: Pet;
  onAddRecord: () => void;
}

function PetDetail({ pet, onAddRecord }: PetDetailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('Kesihatan');
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [vaccinCount, setVaccinCount] = useState<number | null>(null);
  const [expense, setExpense] = useState<number | null>(null);
  const [appointmentCount, setAppointmentCount] = useState<number | null>(null);

  const TABS: TabKey[] = ['Kesihatan', 'Perbelanjaan', 'Galeri', 'Dokumen'];

  const fetchStats = useCallback(async () => {
    try {
      const { count: vc } = await supabase
        .from('health_records')
        .select('id', { count: 'exact', head: true })
        .eq('pet_id', pet.id)
        .eq('type', 'vaksin');
      setVaccinCount(vc ?? 0);

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const { data: expData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('pet_id', pet.id)
        .gte('date', firstDay)
        .lte('date', lastDay);
      const total = (expData ?? []).reduce(
        (sum: number, r: { amount: number }) => sum + (r.amount ?? 0),
        0
      );
      setExpense(total);

      const todayStr = new Date().toISOString().split('T')[0];
      const { count: rc } = await supabase
        .from('reminders')
        .select('id', { count: 'exact', head: true })
        .eq('pet_id', pet.id)
        .gte('date', todayStr);
      setAppointmentCount(rc ?? 0);
    } catch {
      // silently fail — stats are non-critical
    }
  }, [pet.id]);

  const fetchHealthRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const { data, error } = await supabase
        .from('health_records')
        .select('*')
        .eq('pet_id', pet.id)
        .order('date', { ascending: false });
      if (error) throw error;
      setHealthRecords(data ?? []);
    } catch {
      setHealthRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [pet.id]);

  useEffect(() => {
    fetchStats();
    fetchHealthRecords();
  }, [fetchStats, fetchHealthRecords]);

  const emoji = SPECIES_EMOJI[pet.species] ?? '🐾';

  return (
    <View style={styles.detailCard}>
      {/* Top row */}
      <View style={styles.detailTopRow}>
        <View style={styles.detailAvatar}>
          <Text style={styles.detailAvatarEmoji}>{emoji}</Text>
        </View>
        <View style={styles.detailInfo}>
          <Text style={styles.detailName}>{pet.name}</Text>
          <Text style={styles.detailBreed}>{pet.breed || '—'}</Text>
          <Text style={styles.detailGender}>{pet.gender}</Text>
        </View>
      </View>

      {/* Tags */}
      <View style={styles.tagsRow}>
        <View style={[styles.tagBadge, { backgroundColor: getHealthBadgeColor(pet.health_status) }]}>
          <Text style={styles.tagBadgeText}>{pet.health_status}</Text>
        </View>
        <View style={[styles.tagBadge, { backgroundColor: INDIGO_LIGHT }]}>
          <Text style={[styles.tagBadgeText, { color: PRIMARY }]}>{calcAge(pet.dob)}</Text>
        </View>
        {!!pet.weight && (
          <View style={[styles.tagBadge, { backgroundColor: INDIGO_LIGHT }]}>
            <Text style={[styles.tagBadgeText, { color: PRIMARY }]}>{pet.weight} kg</Text>
          </View>
        )}
      </View>

      {/* Mini stat boxes */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Vaksin</Text>
          <Text style={styles.statValue}>
            {vaccinCount === null ? '—' : vaccinCount === 0 ? '—' : String(vaccinCount)}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Perbelanjaan</Text>
          <Text style={styles.statValue}>
            {expense === null ? '—' : expense === 0 ? '—' : `RM${expense.toFixed(2)}`}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Temujanji</Text>
          <Text style={styles.statValue}>
            {appointmentCount === null ? '—' : appointmentCount === 0 ? '—' : String(appointmentCount)}
          </Text>
        </View>
      </View>

      {/* 2×2 tab grid */}
      <View style={styles.tabGrid}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      {activeTab === 'Kesihatan' && (
        <View style={styles.tabContent}>
          {loadingRecords ? (
            <Text style={styles.loadingText}>Memuatkan...</Text>
          ) : healthRecords.length === 0 ? (
            <View style={styles.emptyRecords}>
              <Ionicons name="medkit-outline" size={40} color={MUTED} />
              <Text style={styles.emptyRecordsText}>Tiada rekod kesihatan</Text>
            </View>
          ) : (
            healthRecords.map((record) => (
              <View key={record.id} style={styles.recordItem}>
                <View style={[styles.recordBar, { backgroundColor: getRecordTypeColor(record.type) }]} />
                <View style={styles.recordBody}>
                  <Text style={styles.recordTitle}>{record.title}</Text>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
                <View
                  style={[
                    styles.recordStatusBadge,
                    { backgroundColor: getRecordStatusColor(record.status) },
                  ]}
                >
                  <Text style={styles.recordStatusText}>{record.status}</Text>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity style={styles.addRecordButton} onPress={onAddRecord}>
            <Text style={styles.addRecordButtonText}>+ Tambah Rekod</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'Perbelanjaan' && (
        <View style={styles.tabContent}>
          <View style={styles.emptyRecords}>
            <Ionicons name="wallet-outline" size={40} color={MUTED} />
            <Text style={styles.emptyRecordsText}>Tiada rekod perbelanjaan</Text>
          </View>
        </View>
      )}

      {activeTab === 'Galeri' && (
        <View style={styles.tabContent}>
          <View style={styles.emptyRecords}>
            <Ionicons name="images-outline" size={40} color={MUTED} />
            <Text style={styles.emptyRecordsText}>Tiada gambar</Text>
          </View>
        </View>
      )}

      {activeTab === 'Dokumen' && (
        <View style={styles.tabContent}>
          <View style={styles.emptyRecords}>
            <Ionicons name="document-outline" size={40} color={MUTED} />
            <Text style={styles.emptyRecordsText}>Tiada dokumen</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PetsScreen() {
  const { user } = useAuthStore();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchPets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
      if (error) throw error;
      setPets(data ?? []);
    } catch {
      setPets([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPets();
  }, [fetchPets]);

  const handleAddSuccess = (newPet: Pet) => {
    setPets((prev) =>
      [...prev, newPet].sort((a, b) => a.name.localeCompare(b.name))
    );
    setSelectedPet(newPet);
    setShowAddModal(false);
  };

  const handleAddRecord = () => {
    Alert.alert('Tambah Rekod', 'Fungsi ini akan datang.');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pets Saya</Text>
        <TouchableOpacity style={styles.headerAddBtn} onPress={() => setShowAddModal(true)}>
          <Text style={styles.headerAddBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Main scroll area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.petGrid}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </View>
        ) : pets.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="paw-outline" size={60} color="#D1C9B8" />
            <Text style={styles.emptyStateTitle}>Tiada haiwan peliharaan</Text>
            <Text style={styles.emptyStateSubtitle}>Tambah haiwan pertama anda!</Text>
          </View>
        ) : (
          <>
            {/* Pet Grid */}
            <View style={styles.petGrid}>
              {pets.map((pet) => {
                const isSelected = selectedPet?.id === pet.id;
                const emoji = SPECIES_EMOJI[pet.species] ?? '🐾';
                return (
                  <TouchableOpacity
                    key={pet.id}
                    style={[styles.petCard, isSelected && styles.petCardSelected]}
                    onPress={() => setSelectedPet(isSelected ? null : pet)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.petCardEmoji}>
                      <Text style={styles.petCardEmojiText}>{emoji}</Text>
                    </View>
                    <Text style={styles.petCardName} numberOfLines={1}>
                      {pet.name}
                    </Text>
                    <Text style={styles.petCardBreed} numberOfLines={1}>
                      {pet.breed || pet.species}
                    </Text>
                    <View
                      style={[
                        styles.petCardBadge,
                        { backgroundColor: getHealthBadgeColor(pet.health_status) },
                      ]}
                    >
                      <Text style={styles.petCardBadgeText}>{pet.health_status}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Tambah Pet card */}
              <TouchableOpacity
                style={styles.addPetCard}
                onPress={() => setShowAddModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.addPetCardIcon}>+</Text>
                <Text style={styles.addPetCardText}>Tambah Pet</Text>
              </TouchableOpacity>
            </View>

            {/* Selected pet detail */}
            {selectedPet && (
              <PetDetail pet={selectedPet} onAddRecord={handleAddRecord} />
            )}
          </>
        )}
      </ScrollView>

      {/* Add Pet Modal */}
      {user && (
        <AddPetModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
          userId={user.id}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Layout
  safeArea: {
    flex: 1,
    backgroundColor: PRIMARY,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: PRIMARY,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  scrollView: {
    flex: 1,
    backgroundColor: BACKGROUND,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },

  // ── Pet grid
  petGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
  },

  // ── Pet card
  petCard: {
    width: CARD_WIDTH,
    height: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  petCardSelected: {
    borderColor: ACCENT,
  },
  petCardEmoji: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: SAGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  petCardEmojiText: {
    fontSize: 20,
  },
  petCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: INK,
    marginBottom: 2,
  },
  petCardBreed: {
    fontSize: 12,
    color: MUTED,
    flex: 1,
  },
  petCardBadge: {
    alignSelf: 'flex-end',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  petCardBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Add pet card
  addPetCard: {
    width: CARD_WIDTH,
    height: 160,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addPetCardIcon: {
    fontSize: 32,
    fontWeight: '300',
    color: PRIMARY,
  },
  addPetCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },

  // ── Skeleton
  skeletonCard: {
    height: 160,
    backgroundColor: '#E0E0E0',
    borderRadius: 16,
  },

  // ── Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: INK,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: MUTED,
  },

  // ── Pet detail card
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 0,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  detailAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: SAGE,
    borderWidth: 3,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailAvatarEmoji: {
    fontSize: 28,
  },
  detailInfo: {
    flex: 1,
    gap: 2,
  },
  detailName: {
    fontSize: 18,
    fontWeight: '700',
    color: INK,
  },
  detailBreed: {
    fontSize: 13,
    color: MUTED,
  },
  detailGender: {
    fontSize: 12,
    color: MUTED,
  },

  // ── Tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tagBadge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tagBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: INDIGO_LIGHT,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    color: MUTED,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
  },

  // ── Tab grid
  tabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tabButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  // ── Tab content
  tabContent: {
    gap: 10,
  },
  loadingText: {
    color: MUTED,
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyRecords: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyRecordsText: {
    fontSize: 14,
    color: MUTED,
  },

  // ── Health record item
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BACKGROUND,
    borderRadius: 12,
    overflow: 'hidden',
    gap: 10,
  },
  recordBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  recordBody: {
    flex: 1,
    paddingVertical: 10,
    gap: 2,
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: INK,
  },
  recordDate: {
    fontSize: 12,
    color: MUTED,
  },
  recordStatusBadge: {
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginRight: 10,
  },
  recordStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Add record button
  addRecordButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  addRecordButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1C9B8',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: PRIMARY,
    marginBottom: 20,
  },

  // ── Form fields
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: INK,
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: INK,
    backgroundColor: BACKGROUND,
  },

  // ── Species pills
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  pillButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  pillText: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },

  // ── Date button
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: BACKGROUND,
  },
  dateButtonText: {
    fontSize: 15,
    color: INK,
  },

  // ── Gender toggle
  genderToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  genderButtonActive: {
    backgroundColor: PRIMARY,
  },
  genderText: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
  },
  genderTextActive: {
    color: '#FFFFFF',
  },

  // ── Save / Cancel
  saveButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  cancelButtonText: {
    fontSize: 15,
    color: MUTED,
    fontWeight: '500',
  },
});
