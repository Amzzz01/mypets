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
const DANGER = '#EF5350';
const DEPOSIT_COLOR = '#E65100';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// ─── Types ────────────────────────────────────────────────────────────────────
type BuyerStatus = 'belum_bayar' | 'deposit' | 'selesai';

interface PetInfo { name: string; breed: string | null; }
interface BuyerPet { pet_id: string; pets: PetInfo | null; }

interface Buyer {
  id: string;
  user_id: string;
  name: string;
  contact: string | null;
  price: number;
  amount_paid: number;
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

interface AuditLog {
  id: string;
  buyer_id: string;
  user_id: string;
  user_display: string;
  action: string;
  details: Record<string, any> | null;
  created_at: string;
}

type FilterType = 'all' | 'belum_bayar' | 'deposit' | 'selesai';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateTime(isoStr: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${h}:${m}`;
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
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]));
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
function BuyerCard({
  buyer, onDelete, onEdit, onLogDeposit, onViewAudit,
}: {
  buyer: Buyer;
  onDelete: (id: string, name: string) => void;
  onEdit: (buyer: Buyer) => void;
  onLogDeposit: (buyer: Buyer) => void;
  onViewAudit: (buyer: Buyer) => void;
}) {
  const avatarBg =
    buyer.status === 'selesai' ? SAGE :
    buyer.status === 'deposit' ? DEPOSIT_COLOR : ACCENT;

  const initials = getInitials(buyer.name);
  const petName = buyer.buyer_pets?.[0]?.pets?.name ?? null;
  const petBreed = buyer.buyer_pets?.[0]?.pets?.breed ?? null;
  const amountPaid = buyer.amount_paid ?? 0;
  const balance = buyer.price - amountPaid;
  const depositPercent = buyer.price > 0 ? Math.min((amountPaid / buyer.price) * 100, 100) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.buyerName} numberOfLines={1}>{buyer.name}</Text>
          <Text style={styles.buyerDate}>{formatDate(buyer.date)}</Text>
          <View style={styles.tagRow}>
            {petName && <View style={styles.tagIndigo}><Text style={styles.tagIndigoText}>{petName}</Text></View>}
            <View style={styles.tagAmber}><Text style={styles.tagAmberText}>RM {buyer.price.toFixed(2)}</Text></View>
            {petBreed && <View style={styles.tagSage}><Text style={styles.tagSageText}>{petBreed}</Text></View>}
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {buyer.status === 'belum_bayar' && <View style={styles.badgeAmber}><Text style={styles.badgeAmberText}>Belum Bayar</Text></View>}
          {buyer.status === 'deposit' && <View style={styles.badgeDeposit}><Text style={styles.badgeDepositText}>Deposit</Text></View>}
          {buyer.status === 'selesai' && <View style={styles.badgeSage}><Text style={styles.badgeSageText}>Selesai</Text></View>}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity onPress={() => onEdit(buyer)} activeOpacity={0.75}>
              <Ionicons name="create-outline" size={18} color={PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(buyer.id, buyer.name)} activeOpacity={0.75}>
              <Ionicons name="trash-outline" size={18} color={DANGER} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Deposit progress bar */}
      {buyer.status === 'deposit' && (
        <View style={styles.depositBar}>
          <View style={styles.depositInfoRow}>
            <Text style={styles.depositLabel}>Deposit dibayar</Text>
            <Text style={styles.depositPaidValue}>RM {amountPaid.toFixed(2)}</Text>
          </View>
          <View style={styles.depositInfoRow}>
            <Text style={styles.depositLabel}>Baki</Text>
            <Text style={styles.depositBalanceValue}>RM {balance.toFixed(2)}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${depositPercent}%` as any }]} />
          </View>
        </View>
      )}

      {/* Bottom action row */}
      <View style={styles.cardBtnRow}>
        {buyer.status !== 'selesai' && (
          <TouchableOpacity style={styles.tambahBayaranBtn} onPress={() => onLogDeposit(buyer)} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={15} color={DEPOSIT_COLOR} />
            <Text style={styles.tambahBayaranText}>Tambah Bayaran</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.auditBtn} onPress={() => onViewAudit(buyer)} activeOpacity={0.8}>
          <Ionicons name="time-outline" size={15} color={PRIMARY} />
          <Text style={styles.auditBtnText}>Jejak Audit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Summary Row ──────────────────────────────────────────────────────────────
function SummaryRow({ buyers }: { buyers: Buyer[] }) {
  const totalKeseluruhan = buyers.reduce((sum, b) => sum + b.price, 0);
  const totalCount = buyers.length;
  // belum_bayar price + baki deposit dari buyer deposit
  const belumBayarTotal = buyers.reduce((sum, b) => {
    if (b.status === 'belum_bayar') return sum + b.price;
    if (b.status === 'deposit') return sum + (b.price - (b.amount_paid ?? 0));
    return sum;
  }, 0);

  const depositDikutip = buyers.reduce((sum, b) => b.status === 'deposit' ? sum + (b.amount_paid ?? 0) : sum, 0);
  const bakiDeposit = buyers.reduce((sum, b) => b.status === 'deposit' ? sum + (b.price - (b.amount_paid ?? 0)) : sum, 0);

  // selesai price + deposit dikutip dari buyer deposit
  const selesaiTotal = buyers.reduce((sum, b) => {
    if (b.status === 'selesai') return sum + b.price;
    if (b.status === 'deposit') return sum + (b.amount_paid ?? 0);
    return sum;
  }, 0);

  return (
    <View style={styles.summaryGrid}>
      <View style={styles.summaryBoxIndigo}>
        <Ionicons name="cash-outline" size={20} color={PRIMARY} />
        <Text style={styles.summaryLabel}>Jumlah Keseluruhan</Text>
        <Text style={styles.summaryValueIndigo}>RM {totalKeseluruhan.toFixed(2)}</Text>
      </View>
      <View style={styles.summaryBoxAmber}>
        <Ionicons name="people-outline" size={20} color={ACCENT} />
        <Text style={styles.summaryLabel}>Jumlah Pembeli</Text>
        <Text style={styles.summaryValueAmber}>{totalCount}</Text>
      </View>
      <View style={styles.summaryBoxRed}>
        <Ionicons name="time-outline" size={20} color="#C0392B" />
        <Text style={styles.summaryLabel}>Bayaran Belum Bayar</Text>
        <Text style={styles.summaryValueRed}>RM {belumBayarTotal.toFixed(2)}</Text>
      </View>
      <View style={styles.summaryBoxOrange}>
        <Ionicons name="card-outline" size={20} color={DEPOSIT_COLOR} />
        <Text style={styles.summaryLabel}>Deposit Dikutip</Text>
        <Text style={styles.summaryValueOrange}>RM {depositDikutip.toFixed(2)}</Text>
      </View>
      <View style={styles.summaryBoxPurple}>
        <Ionicons name="refresh-outline" size={20} color="#6A1B9A" />
        <Text style={styles.summaryLabel}>Baki Deposit</Text>
        <Text style={styles.summaryValuePurple}>RM {bakiDeposit.toFixed(2)}</Text>
      </View>
      <View style={styles.summaryBoxGreen}>
        <Ionicons name="checkmark-circle-outline" size={20} color="#2E7D52" />
        <Text style={styles.summaryLabel}>Selesai Bayaran</Text>
        <Text style={styles.summaryValueGreen}>RM {selesaiTotal.toFixed(2)}</Text>
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

// ─── Audit Timeline Item ──────────────────────────────────────────────────────
function AuditItem({ log, isLast }: { log: AuditLog; isLast: boolean }) {
  const dotColor =
    log.action === 'bayaran' ? DEPOSIT_COLOR :
    log.action === 'cipta' ? PRIMARY :
    log.action === 'padam' ? DANGER : '#B8860B';

  const actionLabel =
    log.action === 'cipta' ? 'Rekod dicipta' :
    log.action === 'kemaskini' ? 'Kemaskini rekod' :
    log.action === 'bayaran' ? 'Bayaran diterima' :
    log.action === 'padam' ? 'Rekod dipadam' : log.action;

  const amount = log.details?.amount as number | undefined;
  const amountBg = log.action === 'bayaran' ? '#FFF3E0' : '#EEF0FA';
  const amountColor = log.action === 'bayaran' ? DEPOSIT_COLOR : PRIMARY;

  return (
    <View style={styles.auditItem}>
      <View style={styles.auditLineCol}>
        <View style={[styles.auditDot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={styles.auditConnector} />}
      </View>
      <View style={[styles.auditContent, isLast && { paddingBottom: 0 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          <Text style={styles.auditAction}>{actionLabel}</Text>
          {amount !== undefined && (
            <View style={[styles.auditAmountBadge, { backgroundColor: amountBg }]}>
              <Text style={[styles.auditAmountText, { color: amountColor }]}>RM {amount.toFixed(2)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.auditMeta}>{log.user_display} · {formatDateTime(log.created_at)}</Text>
      </View>
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
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);

  // ── Form State ──
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDate, setFormDate] = useState(new Date());
  const [formStatus, setFormStatus] = useState<BuyerStatus>('belum_bayar');
  const [formSelectedPetId, setFormSelectedPetId] = useState<string | null>(null);
  const [availablePets, setAvailablePets] = useState<Pet[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Deposit Modal State ──
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [depositBuyer, setDepositBuyer] = useState<Buyer | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [savingDeposit, setSavingDeposit] = useState(false);

  // ── Audit Modal State ──
  const [auditModalVisible, setAuditModalVisible] = useState(false);
  const [auditBuyer, setAuditBuyer] = useState<Buyer | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // ── Helper: get user display ──────────────────────────────────────────────
  const getUserDisplay = useCallback((): string => {
    if (!user) return 'Unknown';
    return user.email ?? user.id;
  }, [user]);

  // ── Write audit log ───────────────────────────────────────────────────────
  const writeAudit = useCallback(async (
    buyerId: string,
    action: string,
    details?: Record<string, any>
  ) => {
    if (!user) return;
    try {
      await supabase.from('audit_logs').insert({
        buyer_id: buyerId,
        user_id: user.id,
        user_display: getUserDisplay(),
        action,
        details: details ?? null,
      });
    } catch {
      // non-critical — don't block the main action
    }
  }, [user, getUserDisplay]);

  // ── Fetch Buyers ──────────────────────────────────────────────────────────
  const fetchBuyers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('buyers')
        .select('*, buyer_pets(pet_id, pets(name, breed))')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBuyers((data as Buyer[]) ?? []);
    } catch {
      Alert.alert('Ralat', 'Gagal memuatkan senarai pembeli.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchBuyers(); }, [fetchBuyers]);

  // ── Fetch Pets ────────────────────────────────────────────────────────────
  const fetchPets = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('pets').select('id, name, species, breed')
        .eq('user_id', user.id).order('name', { ascending: true });
      if (error) throw error;
      setAvailablePets((data as Pet[]) ?? []);
    } catch { }
  }, [user]);

  // ── Fetch Audit Logs ──────────────────────────────────────────────────────
  const fetchAuditLogs = useCallback(async (buyerId: string) => {
    setLoadingAudit(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAuditLogs((data as AuditLog[]) ?? []);
    } catch {
      Alert.alert('Ralat', 'Gagal memuatkan jejak audit.');
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  // ── Filtered Buyers ───────────────────────────────────────────────────────
  const filteredBuyers = buyers.filter((b) => {
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      (filter === 'belum_bayar' && b.status === 'belum_bayar') ||
      (filter === 'deposit' && b.status === 'deposit') ||
      (filter === 'selesai' && b.status === 'selesai');
    return matchSearch && matchFilter;
  });

  // ── Open Add/Edit Modal ───────────────────────────────────────────────────
  const openModal = () => { setEditingBuyer(null); resetForm(); fetchPets(); setModalVisible(true); };

  const openEditModal = (buyer: Buyer) => {
    setEditingBuyer(buyer);
    setFormName(buyer.name);
    setFormContact(buyer.contact ?? '');
    setFormPrice(String(buyer.price));
    setFormDate(buyer.date ? new Date(buyer.date) : new Date());
    setFormStatus(buyer.status);
    setFormSelectedPetId(buyer.buyer_pets?.[0]?.pet_id ?? null);
    fetchPets();
    setModalVisible(true);
  };

  // ── Open Deposit Modal ────────────────────────────────────────────────────
  const openDepositModal = (buyer: Buyer) => {
    setDepositBuyer(buyer);
    setDepositAmount(buyer.amount_paid > 0 ? String(buyer.amount_paid) : '');
    setDepositModalVisible(true);
  };

  const closeDepositModal = () => {
    setDepositBuyer(null);
    setDepositAmount('');
    setDepositModalVisible(false);
  };

  // ── Open Audit Modal ──────────────────────────────────────────────────────
  const openAuditModal = (buyer: Buyer) => {
    setAuditBuyer(buyer);
    setAuditLogs([]);
    setAuditModalVisible(true);
    fetchAuditLogs(buyer.id);
  };

  const closeAuditModal = () => {
    setAuditBuyer(null);
    setAuditLogs([]);
    setAuditModalVisible(false);
  };

  // ── Save Deposit ──────────────────────────────────────────────────────────
  const saveDeposit = async () => {
    if (!depositBuyer) return;
    const parsed = parseFloat(depositAmount);
    if (isNaN(parsed) || parsed < 0) { Alert.alert('Ralat', 'Amaun deposit tidak sah.'); return; }
    if (parsed > depositBuyer.price) {
      Alert.alert('Ralat', `Deposit tidak boleh melebihi RM ${depositBuyer.price.toFixed(2)}.`);
      return;
    }
    const newStatus: BuyerStatus =
      parsed === 0 ? 'belum_bayar' :
      parsed >= depositBuyer.price ? 'selesai' : 'deposit';

    setSavingDeposit(true);
    try {
      const { error } = await supabase
        .from('buyers')
        .update({ amount_paid: parsed, status: newStatus })
        .eq('id', depositBuyer.id);
      if (error) throw error;

      setBuyers((prev) =>
        prev.map((b) => b.id === depositBuyer.id ? { ...b, amount_paid: parsed, status: newStatus } : b)
      );

      // Write audit
      await writeAudit(depositBuyer.id, 'bayaran', {
        amount: parsed,
        status_baru: newStatus,
        status_lama: depositBuyer.status,
      });

      closeDepositModal();
    } catch (err: any) {
      Alert.alert('Ralat', err?.message ?? 'Gagal menyimpan deposit.');
    } finally {
      setSavingDeposit(false);
    }
  };

  // ── Reset / Close Form ────────────────────────────────────────────────────
  const resetForm = () => {
    setFormName(''); setFormContact(''); setFormPrice('');
    setFormDate(new Date()); setFormStatus('belum_bayar');
    setFormSelectedPetId(null); setShowDatePicker(false);
  };

  const closeModal = () => { resetForm(); setEditingBuyer(null); setModalVisible(false); };

  // ── Save Buyer ────────────────────────────────────────────────────────────
  const saveBuyer = async () => {
    if (!user) return;
    const trimmedName = formName.trim();
    if (!trimmedName) { Alert.alert('Ralat', 'Nama pembeli diperlukan.'); return; }
    const parsedPrice = parseFloat(formPrice);
    if (isNaN(parsedPrice)) { Alert.alert('Ralat', 'Harga mesti nombor yang sah.'); return; }

    setSaving(true);
    try {
      if (editingBuyer) {
        const { error } = await supabase.from('buyers').update({
          name: trimmedName, contact: formContact.trim() || null,
          price: parsedPrice, date: toYMD(formDate), status: formStatus,
        }).eq('id', editingBuyer.id);
        if (error) throw error;

        if (formSelectedPetId !== (editingBuyer.buyer_pets?.[0]?.pet_id ?? null)) {
          await supabase.from('buyer_pets').delete().eq('buyer_id', editingBuyer.id);
          if (formSelectedPetId) {
            await supabase.from('buyer_pets').insert({ buyer_id: editingBuyer.id, pet_id: formSelectedPetId });
          }
        }

        await writeAudit(editingBuyer.id, 'kemaskini', {
          nama: trimmedName, harga: parsedPrice, status: formStatus,
        });
      } else {
        const { data: insertedData, error: insertError } = await supabase
          .from('buyers')
          .insert({
            user_id: user.id, name: trimmedName,
            contact: formContact.trim() || null,
            price: parsedPrice, date: toYMD(formDate),
            status: formStatus, amount_paid: 0,
          })
          .select().single();
        if (insertError) throw insertError;

        if (formSelectedPetId && insertedData?.id) {
          await supabase.from('buyer_pets').insert({ buyer_id: insertedData.id, pet_id: formSelectedPetId });
        }

        await writeAudit(insertedData.id, 'cipta', {
          nama: trimmedName, harga: parsedPrice, status: formStatus,
        });
      }

      await fetchBuyers();
      closeModal();
    } catch {
      Alert.alert('Ralat menyimpan pembeli.', 'Sila cuba lagi.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete Buyer ──────────────────────────────────────────────────────────
  const handleDeleteBuyer = (id: string, name: string) => {
    Alert.alert('Padam Pembeli', `Padam rekod "${name}"? Tindakan ini tidak boleh dibatalkan.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Padam', style: 'destructive',
        onPress: async () => {
          try {
            await writeAudit(id, 'padam', { nama: name });
            const { error } = await supabase.from('buyers')
              .update({ deleted_at: new Date().toISOString() }).eq('id', id);
            if (error) throw error;
            setBuyers((prev) => prev.filter((b) => b.id !== id));
          } catch (err: any) {
            Alert.alert('Ralat', err?.message ?? 'Gagal memadam pembeli.');
          }
        },
      },
    ]);
  };

  const onDateChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) setFormDate(selected);
  };

  // ── Deposit preview ───────────────────────────────────────────────────────
  const depositParsed = parseFloat(depositAmount) || 0;
  const depositBalance = depositBuyer ? Math.max(depositBuyer.price - depositParsed, 0) : 0;
  const depositAutoStatus: BuyerStatus =
    depositParsed === 0 ? 'belum_bayar' :
    depositBuyer && depositParsed >= depositBuyer.price ? 'selesai' : 'deposit';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rekod Pembelian</Text>
          <TouchableOpacity style={styles.addButton} onPress={openModal} activeOpacity={0.8}>
            <Ionicons name="add" size={22} color={INK} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        {/* Search */}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow} style={{ flexGrow: 0 }}>
          {([
            { key: 'all', label: 'Semua' },
            { key: 'belum_bayar', label: 'Belum Bayar' },
            { key: 'deposit', label: 'Deposit' },
            { key: 'selesai', label: 'Selesai' },
          ] as { key: FilterType; label: string }[]).map(({ key, label }) => {
            const active = filter === key;
            return (
              <TouchableOpacity key={key} onPress={() => setFilter(key)} style={[styles.pill, active ? styles.pillActive : styles.pillInactive]} activeOpacity={0.75}>
                <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextInactive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* List */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
          {loading ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : filteredBuyers.length === 0 ? (
            <EmptyState />
          ) : (
            filteredBuyers.map((buyer) => (
              <BuyerCard
                key={buyer.id}
                buyer={buyer}
                onDelete={handleDeleteBuyer}
                onEdit={openEditModal}
                onLogDeposit={openDepositModal}
                onViewAudit={openAuditModal}
              />
            ))
          )}
          {!loading && <SummaryRow buyers={buyers} />}
        </ScrollView>
      </View>

      {/* ── Deposit Modal ── */}
      <Modal visible={depositModalVisible} transparent animationType="slide" onRequestClose={closeDepositModal}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKAV}>
              <TouchableWithoutFeedback>
                <View style={styles.modalSheet}>
                  <View style={styles.handleBar} />
                  <Text style={styles.modalTitle}>Log Pembayaran</Text>

                  {depositBuyer && (
                    <View style={styles.depositInfoCard}>
                      <Text style={styles.depositInfoName}>{depositBuyer.name}</Text>
                      <View style={styles.depositInfoRow2}>
                        <Text style={styles.depositInfoLabel}>Jumlah penuh</Text>
                        <Text style={styles.depositInfoValue}>RM {depositBuyer.price.toFixed(2)}</Text>
                      </View>
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>
                    {depositBuyer?.status === 'belum_bayar' ? 'Amaun Bayaran (RM)' : 'Amaun Deposit (RM)'}
                  </Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="0.00"
                    placeholderTextColor={MUTED}
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />

                  <View style={styles.depositPreviewRow}>
                    <Text style={styles.depositPreviewLabel}>
                      {depositBuyer?.status === 'belum_bayar' ? 'Baki bayaran' : 'Baki selepas deposit'}
                    </Text>
                    <Text style={[styles.depositPreviewValue, { color: depositBalance === 0 ? '#2E7D52' : '#C0392B' }]}>
                      RM {depositBalance.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.depositPreviewRow}>
                    <Text style={styles.depositPreviewLabel}>Status akan jadi</Text>
                    <View style={depositAutoStatus === 'selesai' ? styles.badgeSage : depositAutoStatus === 'deposit' ? styles.badgeDeposit : styles.badgeAmber}>
                      <Text style={depositAutoStatus === 'selesai' ? styles.badgeSageText : depositAutoStatus === 'deposit' ? styles.badgeDepositText : styles.badgeAmberText}>
                        {depositAutoStatus === 'selesai' ? 'Selesai' : depositAutoStatus === 'deposit' ? 'Deposit' : 'Belum Bayar'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity style={[styles.saveButton, savingDeposit && { opacity: 0.7 }]} onPress={saveDeposit} disabled={savingDeposit} activeOpacity={0.85}>
                    <Text style={styles.saveButtonText}>
                      {savingDeposit ? 'Menyimpan...' : depositBuyer?.status === 'belum_bayar' ? 'Simpan Rekod Bayaran' : 'Simpan Deposit'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelButton} onPress={closeDepositModal} disabled={savingDeposit} activeOpacity={0.75}>
                    <Text style={styles.cancelButtonText}>Batal</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Jejak Audit Modal ── */}
      <Modal visible={auditModalVisible} transparent animationType="slide" onRequestClose={closeAuditModal}>
        <TouchableWithoutFeedback onPress={closeAuditModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { maxHeight: SCREEN_HEIGHT * 0.75 }]}>
                <View style={styles.handleBar} />
                <Text style={styles.modalTitle}>Jejak Audit</Text>
                {auditBuyer && (
                  <Text style={styles.auditSubtitle}>{auditBuyer.name} · RM {auditBuyer.price.toFixed(2)}</Text>
                )}

                {loadingAudit ? (
                  <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                    <Text style={{ color: MUTED, fontSize: 13 }}>Memuatkan...</Text>
                  </View>
                ) : auditLogs.length === 0 ? (
                  <View style={{ paddingVertical: 32, alignItems: 'center', gap: 8 }}>
                    <Ionicons name="time-outline" size={40} color="#D1C9B8" />
                    <Text style={{ color: MUTED, fontSize: 13 }}>Tiada rekod audit</Text>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
                    {auditLogs.map((log, idx) => (
                      <AuditItem key={log.id} log={log} isLast={idx === auditLogs.length - 1} />
                    ))}
                    <View style={{ height: 16 }} />
                  </ScrollView>
                )}

                <TouchableOpacity style={[styles.cancelButton, { marginTop: 8 }]} onPress={closeAuditModal} activeOpacity={0.75}>
                  <Text style={styles.cancelButtonText}>Tutup</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Add/Edit Buyer Modal ── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKAV}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalSheet, { maxHeight: SCREEN_HEIGHT * 0.85 }]}>
                  <View style={styles.handleBar} />
                  <Text style={styles.modalTitle}>{editingBuyer ? 'Kemaskini Pembeli' : 'Tambah Pembeli'}</Text>

                  <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalFormContent}>
                    <Text style={styles.fieldLabel}>Nama Pembeli</Text>
                    <TextInput style={styles.fieldInput} placeholder="Nama penuh" placeholderTextColor={MUTED} value={formName} onChangeText={setFormName} returnKeyType="next" />

                    <Text style={styles.fieldLabel}>No. Telefon</Text>
                    <TextInput style={styles.fieldInput} placeholder="Contoh: 0123456789" placeholderTextColor={MUTED} value={formContact} onChangeText={setFormContact} keyboardType="phone-pad" returnKeyType="next" />

                    <Text style={styles.fieldLabel}>Pilih Haiwan</Text>
                    {availablePets.length === 0 ? (
                      <Text style={styles.noPetsText}>Tiada haiwan berdaftar.</Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petPillRow}>
                        <TouchableOpacity onPress={() => setFormSelectedPetId(null)} style={[styles.petPill, formSelectedPetId === null ? styles.petPillActive : styles.petPillInactive]} activeOpacity={0.75}>
                          <Text style={[styles.petPillText, formSelectedPetId === null ? styles.petPillTextActive : styles.petPillTextInactive]}>Tiada</Text>
                        </TouchableOpacity>
                        {availablePets.map((pet) => {
                          const selected = formSelectedPetId === pet.id;
                          return (
                            <TouchableOpacity key={pet.id} onPress={() => setFormSelectedPetId(pet.id)} style={[styles.petPill, selected ? styles.petPillActive : styles.petPillInactive]} activeOpacity={0.75}>
                              <Text style={[styles.petPillText, selected ? styles.petPillTextActive : styles.petPillTextInactive]}>{pet.name}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}

                    <Text style={styles.fieldLabel}>Harga (RM)</Text>
                    <TextInput style={styles.fieldInput} placeholder="Harga (RM)" placeholderTextColor={MUTED} value={formPrice} onChangeText={setFormPrice} keyboardType="decimal-pad" returnKeyType="done" />

                    <Text style={styles.fieldLabel}>Tarikh</Text>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(!showDatePicker)} activeOpacity={0.8}>
                      <Ionicons name="calendar-outline" size={18} color={PRIMARY} style={{ marginRight: 8 }} />
                      <Text style={styles.dateButtonText}>{formatDate(toYMD(formDate))}</Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker value={formDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} maximumDate={new Date(2100, 11, 31)} />
                    )}

                    <Text style={styles.fieldLabel}>Status</Text>
                    <View style={styles.toggleRow}>
                      {(['belum_bayar', 'deposit', 'selesai'] as BuyerStatus[]).map((s) => (
                        <TouchableOpacity key={s} style={[styles.toggleBtn, formStatus === s ? styles.toggleBtnActive : styles.toggleBtnInactive]} onPress={() => setFormStatus(s)} activeOpacity={0.8}>
                          <Text style={[styles.toggleBtnText, formStatus === s ? styles.toggleBtnTextActive : styles.toggleBtnTextInactive]}>
                            {s === 'belum_bayar' ? 'Belum Bayar' : s === 'deposit' ? 'Deposit' : 'Selesai'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.7 }]} onPress={saveBuyer} disabled={saving} activeOpacity={0.85}>
                      <Text style={styles.saveButtonText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton} onPress={closeModal} disabled={saving} activeOpacity={0.75}>
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
  root: { flex: 1, backgroundColor: PRIMARY },
  safeTop: { backgroundColor: PRIMARY },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 56 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: WHITE, letterSpacing: 0.3 },
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },

  body: { flex: 1, backgroundColor: BACKGROUND, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28 },

  searchContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 0 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14, color: INK, padding: 0 },

  pillsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 8, alignItems: 'center' },
  pill: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, alignSelf: 'center', height: 32, justifyContent: 'center', alignItems: 'center' },
  pillActive: { backgroundColor: ACCENT },
  pillInactive: { backgroundColor: WHITE },
  pillText: { fontSize: 13, lineHeight: 18 },
  pillTextActive: { color: PRIMARY, fontWeight: '700' },
  pillTextInactive: { color: MUTED, fontWeight: '500' },

  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 10 },

  card: { backgroundColor: WHITE, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: WHITE, fontWeight: '700', fontSize: 16 },
  buyerName: { fontSize: 15, fontWeight: '700', color: INK },
  buyerDate: { fontSize: 12, color: MUTED, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagIndigo: { backgroundColor: '#EEF0FA', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 },
  tagIndigoText: { color: PRIMARY, fontSize: 11, fontWeight: '600' },
  tagAmber: { backgroundColor: '#FFF8E1', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 },
  tagAmberText: { color: '#B8860B', fontSize: 11, fontWeight: '600' },
  tagSage: { backgroundColor: '#E8F5E9', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 },
  tagSageText: { color: '#2E7D32', fontSize: 11, fontWeight: '600' },

  badgeAmber: { backgroundColor: '#FFF8E1', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, marginLeft: 8, alignSelf: 'flex-start' },
  badgeAmberText: { color: '#B8860B', fontSize: 12, fontWeight: '700' },
  badgeDeposit: { backgroundColor: '#FFF3E0', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, marginLeft: 8, alignSelf: 'flex-start' },
  badgeDepositText: { color: DEPOSIT_COLOR, fontSize: 12, fontWeight: '700' },
  badgeSage: { backgroundColor: '#E8F5E9', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, marginLeft: 8, alignSelf: 'flex-start' },
  badgeSageText: { color: '#2E7D32', fontSize: 12, fontWeight: '700' },

  // ── Card bottom button row ──
  cardBtnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tambahBayaranBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF3E0', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  tambahBayaranText: { fontSize: 12, fontWeight: '600', color: DEPOSIT_COLOR },
  auditBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EEF0FA', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  auditBtnText: { fontSize: 12, fontWeight: '600', color: PRIMARY },

  // ── Deposit bar ──
  depositBar: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0EDE6' },
  depositInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  depositLabel: { fontSize: 12, color: MUTED },
  depositPaidValue: { fontSize: 12, fontWeight: '700', color: DEPOSIT_COLOR },
  depositBalanceValue: { fontSize: 12, fontWeight: '700', color: '#C0392B' },
  progressTrack: { height: 5, backgroundColor: '#F0EDE6', borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: DEPOSIT_COLOR },

  // ── Summary ──
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  summaryBoxIndigo: { width: '48%', flexGrow: 1, backgroundColor: '#EEF0FA', borderRadius: 12, padding: 12, gap: 4 },
  summaryBoxAmber: { width: '48%', flexGrow: 1, backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, gap: 4 },
  summaryBoxRed: { width: '48%', flexGrow: 1, backgroundColor: '#FFF0F0', borderRadius: 12, padding: 12, gap: 4 },
  summaryBoxOrange: { width: '48%', flexGrow: 1, backgroundColor: '#FFF3E0', borderRadius: 12, padding: 12, gap: 4 },
  summaryBoxPurple: { width: '48%', flexGrow: 1, backgroundColor: '#F3E5F5', borderRadius: 12, padding: 12, gap: 4 },
  summaryBoxGreen: { width: '48%', flexGrow: 1, backgroundColor: '#E8F5EC', borderRadius: 12, padding: 12, gap: 4 },
  summaryLabel: { fontSize: 11, color: MUTED, marginTop: 2 },
  summaryValueIndigo: { fontSize: 17, fontWeight: '700', color: PRIMARY },
  summaryValueAmber: { fontSize: 20, fontWeight: '700', color: '#B8860B' },
  summaryValueRed: { fontSize: 17, fontWeight: '700', color: '#C0392B' },
  summaryValueOrange: { fontSize: 17, fontWeight: '700', color: DEPOSIT_COLOR },
  summaryValuePurple: { fontSize: 17, fontWeight: '700', color: '#6A1B9A' },
  summaryValueGreen: { fontSize: 17, fontWeight: '700', color: '#2E7D52' },

  // ── Empty ──
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK, marginTop: 8 },
  emptySubtitle: { fontSize: 13, color: MUTED },

  // ── Modal base ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalKAV: { justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  handleBar: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: PRIMARY, marginBottom: 4, textAlign: 'center' },
  modalFormContent: { paddingBottom: 8, gap: 4 },

  // ── Audit modal ──
  auditSubtitle: { fontSize: 13, color: MUTED, textAlign: 'center', marginBottom: 4 },
  auditItem: { flexDirection: 'row', gap: 12 },
  auditLineCol: { alignItems: 'center', width: 16 },
  auditDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  auditConnector: { width: 2, flex: 1, backgroundColor: '#F0EDE6', marginTop: 3, marginBottom: 0, minHeight: 20 },
  auditContent: { flex: 1, paddingBottom: 16 },
  auditAction: { fontSize: 13, fontWeight: '700', color: INK },
  auditAmountBadge: { borderRadius: 6, paddingVertical: 1, paddingHorizontal: 7 },
  auditAmountText: { fontSize: 11, fontWeight: '700' },
  auditMeta: { fontSize: 11, color: MUTED, marginTop: 3 },

  // ── Deposit modal ──
  depositInfoCard: { backgroundColor: BACKGROUND, borderRadius: 12, padding: 12, marginBottom: 16, gap: 6 },
  depositInfoName: { fontSize: 15, fontWeight: '700', color: INK },
  depositInfoRow2: { flexDirection: 'row', justifyContent: 'space-between' },
  depositInfoLabel: { fontSize: 13, color: MUTED },
  depositInfoValue: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  depositPreviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  depositPreviewLabel: { fontSize: 13, color: MUTED },
  depositPreviewValue: { fontSize: 14, fontWeight: '700' },

  // ── Form ──
  fieldLabel: { fontSize: 13, fontWeight: '600', color: INK, marginTop: 12, marginBottom: 6 },
  fieldInput: { backgroundColor: BACKGROUND, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, borderWidth: 1, borderColor: '#E8E4DC' },
  petPillRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  petPill: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1.5 },
  petPillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  petPillInactive: { backgroundColor: WHITE, borderColor: '#E0E0E0' },
  petPillText: { fontSize: 13, fontWeight: '600' },
  petPillTextActive: { color: WHITE },
  petPillTextInactive: { color: MUTED },
  noPetsText: { fontSize: 13, color: MUTED, fontStyle: 'italic', marginBottom: 4 },
  dateButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: BACKGROUND, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#E8E4DC' },
  dateButtonText: { fontSize: 14, color: INK },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  toggleBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  toggleBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  toggleBtnInactive: { backgroundColor: WHITE, borderColor: '#E0E0E0' },
  toggleBtnText: { fontSize: 12, fontWeight: '600' },
  toggleBtnTextActive: { color: WHITE },
  toggleBtnTextInactive: { color: MUTED },
  saveButton: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: WHITE, fontSize: 15, fontWeight: '700' },
  cancelButton: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  cancelButtonText: { color: MUTED, fontSize: 15, fontWeight: '600' },
});