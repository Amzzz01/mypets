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
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

// ─── Design Tokens ───────────────────────────────────────────────────────────
const PRIMARY = '#1A237E';
const ACCENT = '#FFB300';
const BACKGROUND = '#F9F7F2';
const SAGE = '#81C784';
const INK = '#1A1A2E';
const MUTED = '#9E9E9E';
const WHITE = '#FFFFFF';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// ─── Types ────────────────────────────────────────────────────────────────────
type BuyerStatus = 'belum_bayar' | 'selesai';

interface PetInfo {
  name: string;
  breed: string | null;
}

interface BuyerPet {
  pet_id: string;
  pets: PetInfo | null;
}

interface Buyer {
  id: string;
  user_id: string;
  name: string;
  contact: string | null;
  price: number;
  date: string;
  status: BuyerStatus;
  created_at: string;
  buyer_pets: BuyerPet[];
}

interface Pet {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
}

type FilterType = 'all' | 'belum_bayar' | 'selesai';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
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
    <Animated.View style={[styles.card, { opacity: anim }]}>
      <View style={styles.cardRow}>
        <View style={[styles.avatar, { backgroundColor: '#E0E0E0' }]} />
        <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
          <View style={{ height: 14, width: '55%', backgroundColor: '#E0E0E0', borderRadius: 6 }} />
          <View style={{ height: 11, width: '35%', backgroundColor: '#E0E0E0', borderRadius: 6 }} />
          <View style={{ height: 20, width: '70%', backgroundColor: '#E0E0E0', borderRadius: 6, marginTop: 4 }} />
        </View>
        <View style={{ height: 26, width: 72, backgroundColor: '#E0E0E0', borderRadius: 8 }} />
      </View>
    </Animated.View>
  );
}

// ─── Buyer Card ───────────────────────────────────────────────────────────────
function BuyerCard({ buyer }: { buyer: Buyer }) {
  const avatarBg = buyer.status === 'belum_bayar' ? ACCENT : SAGE;
  const initials = getInitials(buyer.name);

  const petName = buyer.buyer_pets?.[0]?.pets?.name ?? null;
  const petBreed = buyer.buyer_pets?.[0]?.pets?.breed ?? null;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* Middle info */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.buyerName} numberOfLines={1}>{buyer.name}</Text>
          <Text style={styles.buyerDate}>{formatDate(buyer.date)}</Text>

          {/* Tag row */}
          <View style={styles.tagRow}>
            {petName && (
              <View style={styles.tagIndigo}>
                <Text style={styles.tagIndigoText}>{petName}</Text>
              </View>
            )}
            <View style={styles.tagAmber}>
              <Text style={styles.tagAmberText}>RM {buyer.price.toFixed(2)}</Text>
            </View>
            {petBreed && (
              <View style={styles.tagSage}>
                <Text style={styles.tagSageText}>{petBreed}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Status badge */}
        {buyer.status === 'belum_bayar' ? (
          <View style={styles.badgeAmber}>
            <Text style={styles.badgeAmberText}>Belum Bayar</Text>
          </View>
        ) : (
          <View style={styles.badgeSage}>
            <Text style={styles.badgeSageText}>Selesai</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Summary Row ──────────────────────────────────────────────────────────────
function SummaryRow({ buyers }: { buyers: Buyer[] }) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthTotal = buyers.reduce((sum, b) => {
    if (b.status !== 'selesai') return sum;
    const d = new Date(b.date);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      return sum + b.price;
    }
    return sum;
  }, 0);

  const totalCount = buyers.length;

  return (
    <View style={styles.summaryCard}>
      {/* Left: jualan bulan ini */}
      <View style={styles.summaryBoxIndigo}>
        <Ionicons name="cash-outline" size={20} color={PRIMARY} />
        <Text style={styles.summaryLabel}>Jualan Bulan Ini</Text>
        <Text style={styles.summaryValueIndigo}>RM {monthTotal.toFixed(2)}</Text>
      </View>

      {/* Right: jumlah pembeli */}
      <View style={styles.summaryBoxAmber}>
        <Ionicons name="people-outline" size={20} color={ACCENT} />
        <Text style={styles.summaryLabel}>Jumlah Pembeli</Text>
        <Text style={styles.summaryValueAmber}>{totalCount}</Text>
      </View>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={60} color="#D1C9B8" />
      <Text style={styles.emptyTitle}>Tiada pembeli</Text>
      <Text style={styles.emptySubtitle}>Belum ada rekod pembeli</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RecordsScreen() {
  const { user } = useAuthStore();

  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [modalVisible, setModalVisible] = useState(false);

  // ── Add Buyer Form State ──
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDate, setFormDate] = useState(new Date());
  const [formStatus, setFormStatus] = useState<BuyerStatus>('belum_bayar');
  const [formSelectedPetId, setFormSelectedPetId] = useState<string | null>(null);
  const [availablePets, setAvailablePets] = useState<Pet[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Fetch Buyers ──────────────────────────────────────────────────────────
  const fetchBuyers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('buyers')
        .select('*, buyer_pets(pet_id, pets(name, breed))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBuyers((data as Buyer[]) ?? []);
    } catch (err) {
      Alert.alert('Ralat', 'Gagal memuatkan senarai pembeli.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBuyers();
  }, [fetchBuyers]);

  // ── Fetch User Pets (for modal) ───────────────────────────────────────────
  const fetchPets = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('pets')
        .select('id, name, species, breed')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setAvailablePets((data as Pet[]) ?? []);
    } catch {
      // non-critical; pet selector just stays empty
    }
  }, [user]);

  // ── Filtered Buyers ───────────────────────────────────────────────────────
  const filteredBuyers = buyers.filter((b) => {
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      (filter === 'belum_bayar' && b.status === 'belum_bayar') ||
      (filter === 'selesai' && b.status === 'selesai');
    return matchSearch && matchFilter;
  });

  // ── Open Modal ────────────────────────────────────────────────────────────
  const openModal = () => {
    resetForm();
    fetchPets();
    setModalVisible(true);
  };

  // ── Reset Form ────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormName('');
    setFormContact('');
    setFormPrice('');
    setFormDate(new Date());
    setFormStatus('belum_bayar');
    setFormSelectedPetId(null);
    setShowDatePicker(false);
  };

  // ── Close Modal ───────────────────────────────────────────────────────────
  const closeModal = () => {
    resetForm();
    setModalVisible(false);
  };

  // ── Save Buyer ────────────────────────────────────────────────────────────
  const saveBuyer = async () => {
    if (!user) return;

    const trimmedName = formName.trim();
    if (!trimmedName) {
      Alert.alert('Ralat', 'Nama pembeli diperlukan.');
      return;
    }

    const parsedPrice = parseFloat(formPrice);
    if (isNaN(parsedPrice)) {
      Alert.alert('Ralat', 'Harga mesti nombor yang sah.');
      return;
    }

    setSaving(true);
    try {
      const { data: insertedData, error: insertError } = await supabase
        .from('buyers')
        .insert({
          user_id: user.id,
          name: trimmedName,
          contact: formContact.trim() || null,
          price: parsedPrice,
          date: toYMD(formDate),
          status: formStatus,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (formSelectedPetId && insertedData?.id) {
        const { error: bpError } = await supabase.from('buyer_pets').insert({
          buyer_id: insertedData.id,
          pet_id: formSelectedPetId,
        });
        if (bpError) throw bpError;
      }

      await fetchBuyers();
      closeModal();
    } catch (err) {
      Alert.alert('Ralat menyimpan pembeli.', 'Sila cuba lagi.');
    } finally {
      setSaving(false);
    }
  };

  // ── Date Picker Handler ───────────────────────────────────────────────────
  const onDateChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selected) {
      setFormDate(selected);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Header area with primary bg */}
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pembeli</Text>
          <TouchableOpacity style={styles.addButton} onPress={openModal} activeOpacity={0.8}>
            <Ionicons name="add" size={22} color={INK} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Body with rounded top */}
      <View style={styles.body}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={MUTED} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari pembeli..."
              placeholderTextColor={MUTED}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={MUTED} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
        >
          {([
            { key: 'all', label: 'Semua' },
            { key: 'belum_bayar', label: 'Belum Bayar' },
            { key: 'selesai', label: 'Selesai' },
          ] as { key: FilterType; label: string }[]).map(({ key, label }) => {
            const active = filter === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setFilter(key)}
                style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
                activeOpacity={0.75}
              >
                <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextInactive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Main scroll content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filteredBuyers.length === 0 ? (
            <EmptyState />
          ) : (
            filteredBuyers.map((buyer) => (
              <BuyerCard key={buyer.id} buyer={buyer} />
            ))
          )}

          {/* Summary Row — always shows totals from unfiltered buyers */}
          {!loading && <SummaryRow buyers={buyers} />}
        </ScrollView>
      </View>

      {/* Add Buyer Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalKAV}
            >
              <TouchableWithoutFeedback>
                <View style={[styles.modalSheet, { maxHeight: SCREEN_HEIGHT * 0.85 }]}>
                  {/* Handle Bar */}
                  <View style={styles.handleBar} />

                  {/* Modal Title */}
                  <Text style={styles.modalTitle}>Tambah Pembeli</Text>

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.modalFormContent}
                  >
                    {/* Nama Pembeli */}
                    <Text style={styles.fieldLabel}>Nama Pembeli</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="Nama penuh"
                      placeholderTextColor={MUTED}
                      value={formName}
                      onChangeText={setFormName}
                      returnKeyType="next"
                    />

                    {/* No. Telefon */}
                    <Text style={styles.fieldLabel}>No. Telefon</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="Contoh: 0123456789"
                      placeholderTextColor={MUTED}
                      value={formContact}
                      onChangeText={setFormContact}
                      keyboardType="phone-pad"
                      returnKeyType="next"
                    />

                    {/* Pet Selector */}
                    <Text style={styles.fieldLabel}>Pilih Haiwan</Text>
                    {availablePets.length === 0 ? (
                      <Text style={styles.noPetsText}>Tiada haiwan berdaftar.</Text>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.petPillRow}
                      >
                        {/* None option */}
                        <TouchableOpacity
                          onPress={() => setFormSelectedPetId(null)}
                          style={[
                            styles.petPill,
                            formSelectedPetId === null ? styles.petPillActive : styles.petPillInactive,
                          ]}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.petPillText,
                              formSelectedPetId === null ? styles.petPillTextActive : styles.petPillTextInactive,
                            ]}
                          >
                            Tiada
                          </Text>
                        </TouchableOpacity>

                        {availablePets.map((pet) => {
                          const selected = formSelectedPetId === pet.id;
                          return (
                            <TouchableOpacity
                              key={pet.id}
                              onPress={() => setFormSelectedPetId(pet.id)}
                              style={[
                                styles.petPill,
                                selected ? styles.petPillActive : styles.petPillInactive,
                              ]}
                              activeOpacity={0.75}
                            >
                              <Text
                                style={[
                                  styles.petPillText,
                                  selected ? styles.petPillTextActive : styles.petPillTextInactive,
                                ]}
                              >
                                {pet.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}

                    {/* Harga */}
                    <Text style={styles.fieldLabel}>Harga (RM)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="Harga (RM)"
                      placeholderTextColor={MUTED}
                      value={formPrice}
                      onChangeText={setFormPrice}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                    />

                    {/* Tarikh */}
                    <Text style={styles.fieldLabel}>Tarikh</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowDatePicker(!showDatePicker)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calendar-outline" size={18} color={PRIMARY} style={{ marginRight: 8 }} />
                      <Text style={styles.dateButtonText}>{formatDate(toYMD(formDate))}</Text>
                    </TouchableOpacity>

                    {showDatePicker && (
                      <DateTimePicker
                        value={formDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateChange}
                        maximumDate={new Date(2100, 11, 31)}
                      />
                    )}

                    {/* Status Toggle */}
                    <Text style={styles.fieldLabel}>Status</Text>
                    <View style={styles.toggleRow}>
                      <TouchableOpacity
                        style={[
                          styles.toggleBtn,
                          formStatus === 'belum_bayar' ? styles.toggleBtnActive : styles.toggleBtnInactive,
                        ]}
                        onPress={() => setFormStatus('belum_bayar')}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.toggleBtnText,
                            formStatus === 'belum_bayar' ? styles.toggleBtnTextActive : styles.toggleBtnTextInactive,
                          ]}
                        >
                          Belum Bayar
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.toggleBtn,
                          formStatus === 'selesai' ? styles.toggleBtnActive : styles.toggleBtnInactive,
                        ]}
                        onPress={() => setFormStatus('selesai')}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.toggleBtnText,
                            formStatus === 'selesai' ? styles.toggleBtnTextActive : styles.toggleBtnTextInactive,
                          ]}
                        >
                          Selesai
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Simpan */}
                    <TouchableOpacity
                      style={[styles.saveButton, saving && { opacity: 0.7 }]}
                      onPress={saveBuyer}
                      disabled={saving}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.saveButtonText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
                    </TouchableOpacity>

                    {/* Batal */}
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={closeModal}
                      disabled={saving}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.cancelButtonText}>Batal</Text>
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
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PRIMARY,
  },

  // ── Header ──
  safeTop: {
    backgroundColor: PRIMARY,
  },
  header: {
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Body ──
  body: {
    flex: 1,
    backgroundColor: BACKGROUND,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },

  // ── Search ──
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: INK,
    padding: 0,
  },

  // ── Pills ──
  pillsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  pill: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  pillActive: {
    backgroundColor: ACCENT,
  },
  pillInactive: {
    backgroundColor: WHITE,
  },
  pillText: {
    fontSize: 13,
  },
  pillTextActive: {
    color: PRIMARY,
    fontWeight: '700',
  },
  pillTextInactive: {
    color: MUTED,
    fontWeight: '500',
  },

  // ── List ──
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 10,
  },

  // ── Buyer Card ──
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: WHITE,
    fontWeight: '700',
    fontSize: 16,
  },
  buyerName: {
    fontSize: 15,
    fontWeight: '700',
    color: INK,
  },
  buyerDate: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagIndigo: {
    backgroundColor: '#EEF0FA',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  tagIndigoText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '600',
  },
  tagAmber: {
    backgroundColor: '#FFF8E1',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  tagAmberText: {
    color: '#B8860B',
    fontSize: 11,
    fontWeight: '600',
  },
  tagSage: {
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  tagSageText: {
    color: '#2E7D32',
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Badges ──
  badgeAmber: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  badgeAmberText: {
    color: '#B8860B',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeSage: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  badgeSageText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Summary ──
  summaryCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryBoxIndigo: {
    flex: 1,
    backgroundColor: '#EEF0FA',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  summaryBoxAmber: {
    flex: 1,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  summaryValueIndigo: {
    fontSize: 20,
    fontWeight: '700',
    color: PRIMARY,
  },
  summaryValueAmber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#B8860B',
  },

  // ── Empty State ──
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalKAV: {
    justifyContent: 'flex-end',
  },
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
  modalFormContent: {
    paddingBottom: 8,
    gap: 4,
  },

  // ── Form Fields ──
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

  // ── Pet Pills ──
  petPillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  petPill: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  petPillActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  petPillInactive: {
    backgroundColor: WHITE,
    borderColor: '#E0E0E0',
  },
  petPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  petPillTextActive: {
    color: WHITE,
  },
  petPillTextInactive: {
    color: MUTED,
  },
  noPetsText: {
    fontSize: 13,
    color: MUTED,
    fontStyle: 'italic',
    marginBottom: 4,
  },

  // ── Date Button ──
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
  dateButtonText: {
    fontSize: 14,
    color: INK,
  },

  // ── Status Toggle ──
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  toggleBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  toggleBtnInactive: {
    backgroundColor: WHITE,
    borderColor: '#E0E0E0',
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: WHITE,
  },
  toggleBtnTextInactive: {
    color: MUTED,
  },

  // ── Action Buttons ──
  saveButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: MUTED,
    fontSize: 15,
    fontWeight: '600',
  },
});
