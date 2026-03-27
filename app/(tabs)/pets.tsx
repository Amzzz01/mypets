import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

// ─── Design tokens ────────────────────────────────────────────────────────────
const PRIMARY = '#1A237E';
const ACCENT = '#FFB300';
const BACKGROUND = '#FFFFFF';
const SAGE = '#81C784';
const INK = '#1A1A2E';
const INDIGO_LIGHT = '#EEF0FA';
const MUTED = '#9E9E9E';
const DANGER = '#EF5350';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 44) / 2;

// ─── Types ────────────────────────────────────────────────────────────────────
type HealthStatus = 'Sihat' | 'Kurang Sihat' | 'Sakit';
type Species = 'Anjing' | 'Kucing' | 'Arnab' | 'Burung' | 'Ikan' | 'Ayam Serama' | 'Lain-lain';
type Gender = 'Jantan' | 'Betina';
type TabKey = 'Kesihatan' | 'Pertandingan' | 'Telur' | 'Perbelanjaan' | 'Galeri' | 'Dokumen';

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
  feather_colour?: string;
  posture_class?: string;
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

interface ShowRecord {
  id: string;
  pet_id: string;
  user_id: string;
  name: string;
  location?: string;
  date: string;
  award?: string;
  notes?: string;
}

interface EggBatch {
  id: string;
  pet_id: string;
  user_id: string;
  batch_number: number;
  egg_count: number;
  start_date: string;
  hatched_count: number;
  status: 'incubating' | 'hatched' | 'failed';
  notes?: string;
}

interface PetExpense {
  id: string;
  pet_id: string;
  user_id: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
}

interface PetDocument {
  id: string;
  pet_id: string;
  user_id: string;
  title: string;
  type: string;
  date?: string;
  notes?: string;
}

interface PetPhoto {
  id: string;
  pet_id: string;
  user_id: string;
  url: string;
  caption?: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SPECIES_EMOJI: Record<Species, string> = {
  Anjing: '🐕',
  Kucing: '🐱',
  Arnab: '🐰',
  Burung: '🐦',
  Ikan: '🐟',
  'Ayam Serama': '🐓',
  'Lain-lain': '🐾',
};

const SPECIES_LIST: Species[] = ['Anjing', 'Kucing', 'Arnab', 'Burung', 'Ikan', 'Ayam Serama', 'Lain-lain'];

function getHealthBadgeColor(status: HealthStatus): string {
  switch (status) {
    case 'Sihat': return SAGE;
    case 'Kurang Sihat': return ACCENT;
    case 'Sakit': return DANGER;
    default: return SAGE;
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
  if (months < 0) { years -= 1; months += 12; }
  if (years >= 1) return `${years} tahun`;
  if (months >= 1) return `${months} bulan`;
  return '< 1 bulan';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
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
  return <Animated.View style={[styles.skeletonCard, { width: CARD_WIDTH, opacity }]} />;
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
  const [featherColour, setFeatherColour] = useState('');
  const [postureClass, setPostureClass] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName('');
    setSpecies('Anjing');
    setBreed('');
    setDob(new Date());
    setShowPicker(false);
    setGender('Jantan');
    setWeight('');
    setFeatherColour('');
    setPostureClass('');
  };

  const handleClose = () => { resetForm(); onClose(); };

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
          feather_colour: species === 'Ayam Serama' ? featherColour || null : null,
          posture_class: species === 'Ayam Serama' ? postureClass || null : null,
        })
        .select()
        .single();
      if (error) throw error;
      resetForm();
      onSuccess(data as Pet);
    } catch (err: any) {
      Alert.alert('Ralat', err?.message ?? 'Ralat menyimpan haiwan. Cuba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setDob(selected);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
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

            {/* Serama-specific fields */}
            {species === 'Ayam Serama' && (
              <>
                <Text style={styles.fieldLabel}>Warna Bulu</Text>
                <View style={styles.pillGrid}>
                  {['Merah Emas', 'Putih', 'Hitam', 'Belang', 'Lain-lain'].map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.pillButton, featherColour === c && styles.pillButtonActive]}
                      onPress={() => setFeatherColour(c)}
                    >
                      <Text style={[styles.pillText, featherColour === c && styles.pillTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Kelas Postur</Text>
                <View style={styles.pillGrid}>
                  {['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D'].map((k) => (
                    <TouchableOpacity
                      key={k}
                      style={[styles.pillButton, postureClass === k && styles.pillButtonActive]}
                      onPress={() => setPostureClass(k)}
                    >
                      <Text style={[styles.pillText, postureClass === k && styles.pillTextActive]}>{k}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* DOB */}
            <Text style={styles.fieldLabel}>Tarikh Lahir</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(!showPicker)}>
              <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
              <Text style={styles.dateButtonText}>{formatDate(dob.toISOString())}</Text>
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker
                value={dob}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                maximumDate={new Date()}
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
                  <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>{g}</Text>
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

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Edit Pet Modal ───────────────────────────────────────────────────────────
interface EditPetModalProps {
  visible: boolean;
  pet: Pet | null;
  onClose: () => void;
  onSuccess: (updated: Pet) => void;
}

function EditPetModal({ visible, pet, onClose, onSuccess }: EditPetModalProps) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('Anjing');
  const [breed, setBreed] = useState('');
  const [dob, setDob] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [gender, setGender] = useState<Gender>('Jantan');
  const [weight, setWeight] = useState('');
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('Sihat');
  const [featherColour, setFeatherColour] = useState('');
  const [postureClass, setPostureClass] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pet) {
      setName(pet.name ?? '');
      setSpecies(pet.species ?? 'Anjing');
      setBreed(pet.breed ?? '');
      setDob(pet.dob ? new Date(pet.dob) : new Date());
      setGender(pet.gender ?? 'Jantan');
      setWeight(pet.weight != null ? String(pet.weight) : '');
      setHealthStatus(pet.health_status ?? 'Sihat');
      setFeatherColour(pet.feather_colour ?? '');
      setPostureClass(pet.posture_class ?? '');
    }
  }, [pet]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Ralat', 'Sila masukkan nama haiwan.'); return; }
    if (!pet) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('pets')
        .update({
          name: name.trim(),
          species,
          breed: breed.trim(),
          dob: dob.toISOString().split('T')[0],
          gender,
          weight: weight ? parseFloat(weight) : null,
          health_status: healthStatus,
          feather_colour: species === 'Ayam Serama' ? featherColour || null : null,
          posture_class: species === 'Ayam Serama' ? postureClass || null : null,
        })
        .eq('id', pet.id)
        .select()
        .single();
      if (error) throw error;
      onSuccess(data as Pet);
      onClose();
    } catch (err: any) {
      Alert.alert('Ralat', err?.message ?? 'Gagal mengemaskini haiwan.');
    } finally {
      setSaving(false);
    }
  };

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setDob(selected);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Kemaskini Haiwan</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Nama</Text>
            <TextInput style={styles.textInput} placeholder="Nama haiwan" placeholderTextColor={MUTED} value={name} onChangeText={setName} />

            <Text style={styles.fieldLabel}>Spesies</Text>
            <View style={styles.pillGrid}>
              {SPECIES_LIST.map((s) => (
                <TouchableOpacity key={s} style={[styles.pillButton, species === s && styles.pillButtonActive]} onPress={() => setSpecies(s)}>
                  <Text style={[styles.pillText, species === s && styles.pillTextActive]}>{SPECIES_EMOJI[s]} {s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Baka</Text>
            <TextInput style={styles.textInput} placeholder="Baka" placeholderTextColor={MUTED} value={breed} onChangeText={setBreed} />

            {species === 'Ayam Serama' && (
              <>
                <Text style={styles.fieldLabel}>Warna Bulu</Text>
                <View style={styles.pillGrid}>
                  {['Merah Emas', 'Putih', 'Hitam', 'Belang', 'Lain-lain'].map((c) => (
                    <TouchableOpacity key={c} style={[styles.pillButton, featherColour === c && styles.pillButtonActive]} onPress={() => setFeatherColour(c)}>
                      <Text style={[styles.pillText, featherColour === c && styles.pillTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Kelas Postur</Text>
                <View style={styles.pillGrid}>
                  {['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D'].map((k) => (
                    <TouchableOpacity key={k} style={[styles.pillButton, postureClass === k && styles.pillButtonActive]} onPress={() => setPostureClass(k)}>
                      <Text style={[styles.pillText, postureClass === k && styles.pillTextActive]}>{k}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>Status Kesihatan</Text>
            <View style={styles.pillGrid}>
              {(['Sihat', 'Kurang Sihat', 'Sakit'] as HealthStatus[]).map((h) => (
                <TouchableOpacity key={h} style={[styles.pillButton, healthStatus === h && styles.pillButtonActive]} onPress={() => setHealthStatus(h)}>
                  <Text style={[styles.pillText, healthStatus === h && styles.pillTextActive]}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Tarikh Lahir</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(!showPicker)}>
              <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
              <Text style={styles.dateButtonText}>{formatDate(dob.toISOString())}</Text>
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker value={dob} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} maximumDate={new Date()} onChange={onDateChange} />
            )}

            <Text style={styles.fieldLabel}>Jantina</Text>
            <View style={styles.genderToggle}>
              {(['Jantan', 'Betina'] as Gender[]).map((g) => (
                <TouchableOpacity key={g} style={[styles.genderButton, gender === g && styles.genderButtonActive]} onPress={() => setGender(g)}>
                  <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Berat (kg)</Text>
            <TextInput style={styles.textInput} placeholder="Berat (kg)" placeholderTextColor={MUTED} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />

            <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Show Record Modal ────────────────────────────────────────────────────
interface AddShowRecordModalProps {
  visible: boolean;
  petId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddShowRecordModal({ visible, petId, userId, onClose, onSuccess }: AddShowRecordModalProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [award, setAward] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(''); setLocation(''); setDate(new Date());
    setShowPicker(false); setAward(''); setNotes('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Ralat', 'Sila masukkan nama pertandingan.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('show_records').insert({
        pet_id: petId,
        user_id: userId,
        name: name.trim(),
        location: location.trim() || null,
        date: toYMD(date),
        award: award.trim() || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
      reset();
      onSuccess();
    } catch {
      Alert.alert('Ralat', 'Gagal menyimpan rekod pertandingan.');
    } finally {
      setSaving(false);
    }
  };

  const onDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setDate(selected);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Tambah Rekod Pertandingan</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Nama Pertandingan *</Text>
            <TextInput style={styles.textInput} placeholder="Contoh: Kejohanan Serama KL" placeholderTextColor={MUTED} value={name} onChangeText={setName} />

            <Text style={styles.fieldLabel}>Lokasi</Text>
            <TextInput style={styles.textInput} placeholder="Contoh: Dewan Komuniti Cheras" placeholderTextColor={MUTED} value={location} onChangeText={setLocation} />

            <Text style={styles.fieldLabel}>Tarikh</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(!showPicker)}>
              <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
              <Text style={styles.dateButtonText}>{formatDate(toYMD(date))}</Text>
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={onDateChange} />
            )}

            <Text style={styles.fieldLabel}>Anugerah</Text>
            <TextInput style={styles.textInput} placeholder="Contoh: Juara 1, Naib Johan" placeholderTextColor={MUTED} value={award} onChangeText={setAward} />

            <Text style={styles.fieldLabel}>Nota</Text>
            <TextInput style={[styles.textInput, { height: 72, textAlignVertical: 'top' }]} placeholder="Nota tambahan..." placeholderTextColor={MUTED} value={notes} onChangeText={setNotes} multiline />

            <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Egg Batch Modal ──────────────────────────────────────────────────────
interface AddEggBatchModalProps {
  visible: boolean;
  petId: string;
  userId: string;
  nextBatchNumber: number;
  onClose: () => void;
  onSuccess: () => void;
}

function AddEggBatchModal({ visible, petId, userId, nextBatchNumber, onClose, onSuccess }: AddEggBatchModalProps) {
  const [eggCount, setEggCount] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setEggCount(''); setStartDate(new Date()); setShowPicker(false); setNotes(''); };
  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    const count = parseInt(eggCount);
    if (isNaN(count) || count < 1) { Alert.alert('Ralat', 'Sila masukkan bilangan telur yang sah.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('egg_batches').insert({
        pet_id: petId,
        user_id: userId,
        batch_number: nextBatchNumber,
        egg_count: count,
        start_date: toYMD(startDate),
        hatched_count: 0,
        status: 'incubating',
        notes: notes.trim() || null,
      });
      if (error) throw error;
      reset();
      onSuccess();
    } catch {
      Alert.alert('Ralat', 'Gagal menyimpan rekod telur.');
    } finally {
      setSaving(false);
    }
  };

  const onDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setStartDate(selected);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Rekod Batch Telur Baru</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Bilangan Telur *</Text>
            <TextInput style={styles.textInput} placeholder="Bilangan telur" placeholderTextColor={MUTED} value={eggCount} onChangeText={setEggCount} keyboardType="number-pad" />

            <Text style={styles.fieldLabel}>Tarikh Mula Pengeraman</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(!showPicker)}>
              <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
              <Text style={styles.dateButtonText}>{formatDate(toYMD(startDate))}</Text>
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker value={startDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={onDateChange} />
            )}

            <Text style={styles.fieldLabel}>Nota</Text>
            <TextInput style={[styles.textInput, { height: 72, textAlignVertical: 'top' }]} placeholder="Nota tambahan..." placeholderTextColor={MUTED} value={notes} onChangeText={setNotes} multiline />

            <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Health Record Modal ──────────────────────────────────────────────────
const HEALTH_TYPES = ['Vaksin', 'Rawatan', 'Pembedahan', 'Pemeriksaan', 'Lain-lain'];
const HEALTH_STATUSES = ['Sihat', 'Rawatan', 'Kritikal', 'Sembuh'];

function AddHealthRecordModal({ visible, petId, userId, onClose, onSuccess }: { visible: boolean; petId: string; userId: string; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Pemeriksaan');
  const [status, setStatus] = useState('Sihat');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setType('Pemeriksaan'); setStatus('Sihat'); setDate(new Date()); setNotes(''); };
  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Ralat', 'Sila masukkan tajuk rekod.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('health_records').insert({
        pet_id: petId,
        title: title.trim(),
        type,
        status,
        date: toYMD(date),
        notes: notes.trim() || null,
      });
      if (error) throw error;
      reset(); onSuccess();
    } catch (err: any) {
      Alert.alert('Ralat', err?.message ?? 'Gagal menyimpan rekod kesihatan.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Tambah Rekod Kesihatan</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Tajuk *</Text>
            <TextInput style={styles.textInput} placeholder="cth: Vaksin Rabies" placeholderTextColor={MUTED} value={title} onChangeText={setTitle} />

            <Text style={styles.fieldLabel}>Jenis</Text>
            <View style={styles.pillGrid}>
              {HEALTH_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.pillButton, type === t && styles.pillButtonActive]} onPress={() => setType(t)}>
                  <Text style={[styles.pillText, type === t && styles.pillTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.pillGrid}>
              {HEALTH_STATUSES.map((s) => (
                <TouchableOpacity key={s} style={[styles.pillButton, status === s && styles.pillButtonActive]} onPress={() => setStatus(s)}>
                  <Text style={[styles.pillText, status === s && styles.pillTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Tarikh</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(!showPicker)}>
              <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
              <Text style={styles.dateButtonText}>{formatDate(toYMD(date))}</Text>
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(_: any, s?: Date) => { if (Platform.OS === 'android') setShowPicker(false); if (s) setDate(s); }} />
            )}

            <Text style={styles.fieldLabel}>Nota</Text>
            <TextInput style={[styles.textInput, { height: 72, textAlignVertical: 'top' }]} placeholder="Nota tambahan..." placeholderTextColor={MUTED} value={notes} onChangeText={setNotes} multiline />

            <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Pet Expense Modal ────────────────────────────────────────────────────
const EXPENSE_CATEGORIES: { label: string; color: string }[] = [
  { label: 'Makanan', color: '#66BB6A' },
  { label: 'Ubatan', color: '#42A5F5' },
  { label: 'Grooming', color: '#AB47BC' },
  { label: 'Vet', color: '#EF5350' },
  { label: 'Lain-lain', color: '#9E9E9E' },
];

function AddPetExpenseModal({ visible, petId, userId, onClose, onSuccess }: { visible: boolean; petId: string; userId: string; onClose: () => void; onSuccess: () => void }) {
  const [category, setCategory] = useState('Makanan');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setCategory('Makanan'); setAmount(''); setDate(new Date()); setNotes(''); };
  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Ralat', 'Sila masukkan jumlah yang sah.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('expenses').insert({
        user_id: userId,
        pet_id: petId,
        category,
        amount: amt,
        date: toYMD(date),
        notes: notes.trim() || null,
      });
      if (error) throw error;
      reset(); onSuccess();
    } catch (err: any) {
      Alert.alert('Ralat', err?.message ?? 'Gagal menyimpan perbelanjaan.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Tambah Perbelanjaan</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Kategori</Text>
            <View style={styles.pillGrid}>
              {EXPENSE_CATEGORIES.map((c) => (
                <TouchableOpacity key={c.label} style={[styles.pillButton, category === c.label && { backgroundColor: c.color, borderColor: c.color }]} onPress={() => setCategory(c.label)}>
                  <Text style={[styles.pillText, category === c.label && { color: '#fff' }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Jumlah (RM) *</Text>
            <TextInput style={styles.textInput} placeholder="0.00" placeholderTextColor={MUTED} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>Tarikh</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(!showPicker)}>
              <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
              <Text style={styles.dateButtonText}>{formatDate(toYMD(date))}</Text>
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(_: any, s?: Date) => { if (Platform.OS === 'android') setShowPicker(false); if (s) setDate(s); }} />
            )}

            <Text style={styles.fieldLabel}>Nota</Text>
            <TextInput style={[styles.textInput, { height: 72, textAlignVertical: 'top' }]} placeholder="Nota tambahan..." placeholderTextColor={MUTED} value={notes} onChangeText={setNotes} multiline />

            <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Document Modal ────────────────────────────────────────────────────────
const DOC_TYPES = ['Kad Vaksin', 'Lesen', 'Sijil Kesihatan', 'Resit Vet', 'Lain-lain'];

function AddDocumentModal({ visible, petId, userId, onClose, onSuccess }: { visible: boolean; petId: string; userId: string; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Kad Vaksin');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setType('Kad Vaksin'); setDate(new Date()); setNotes(''); };
  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Ralat', 'Sila masukkan nama dokumen.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('pet_documents').insert({
        pet_id: petId,
        user_id: userId,
        title: title.trim(),
        type,
        date: toYMD(date),
        notes: notes.trim() || null,
      });
      if (error) throw error;
      reset(); onSuccess();
    } catch (err: any) {
      Alert.alert('Ralat', err?.message ?? 'Gagal menyimpan dokumen.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Tambah Dokumen</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Nama Dokumen *</Text>
            <TextInput style={styles.textInput} placeholder="cth: Kad Vaksin 2025" placeholderTextColor={MUTED} value={title} onChangeText={setTitle} />

            <Text style={styles.fieldLabel}>Jenis</Text>
            <View style={styles.pillGrid}>
              {DOC_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.pillButton, type === t && styles.pillButtonActive]} onPress={() => setType(t)}>
                  <Text style={[styles.pillText, type === t && styles.pillTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Tarikh Dokumen</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(!showPicker)}>
              <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
              <Text style={styles.dateButtonText}>{formatDate(toYMD(date))}</Text>
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(_: any, s?: Date) => { if (Platform.OS === 'android') setShowPicker(false); if (s) setDate(s); }} />
            )}

            <Text style={styles.fieldLabel}>Nota</Text>
            <TextInput style={[styles.textInput, { height: 72, textAlignVertical: 'top' }]} placeholder="Nota tambahan..." placeholderTextColor={MUTED} value={notes} onChangeText={setNotes} multiline />

            <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Photo Modal ───────────────────────────────────────────────────────────
function AddPhotoModal({ visible, petId, userId, onClose, onSuccess }: { visible: boolean; petId: string; userId: string; onClose: () => void; onSuccess: () => void }) {
  const [caption, setCaption] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => { setCaption(''); setImageUri(null); };
  const handleClose = () => { reset(); onClose(); };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Kebenaran diperlukan', 'Sila benarkan akses galeri foto.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.7 });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!imageUri) { Alert.alert('Ralat', 'Sila pilih gambar terlebih dahulu.'); return; }
    setSaving(true);
    try {
      // Upload to Supabase Storage bucket "pet-photos"
      const ext = imageUri.split('.').pop() ?? 'jpg';
      const fileName = `${userId}/${petId}/${Date.now()}.${ext}`;
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage.from('pet-photos').upload(fileName, blob, { contentType: `image/${ext}` });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('pet-photos').getPublicUrl(fileName);
      const { error: insertError } = await supabase.from('pet_photos').insert({
        pet_id: petId, user_id: userId, url: urlData.publicUrl, caption: caption.trim() || null,
      });
      if (insertError) throw insertError;
      reset(); onSuccess();
    } catch (err: any) {
      Alert.alert('Ralat', err?.message ?? 'Gagal memuat naik gambar.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Tambah Gambar</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={styles.photoPickerBox} onPress={pickImage} activeOpacity={0.8}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.photoPreview} resizeMode="cover" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={36} color={MUTED} />
                  <Text style={{ color: MUTED, marginTop: 8 }}>Pilih Gambar</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Kapsyen (pilihan)</Text>
            <TextInput style={styles.textInput} placeholder="Tulis kapsyen..." placeholderTextColor={MUTED} value={caption} onChangeText={setCaption} />

            <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Memuat naik...' : 'Simpan'}</Text>
            </TouchableOpacity>
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
  onEdit: () => void;
}

function PetDetail({ pet, onEdit }: PetDetailProps) {
  const { user } = useAuthStore();
  const isSerama = pet.species === 'Ayam Serama';

  const TABS: TabKey[] = isSerama
    ? ['Kesihatan', 'Pertandingan', 'Telur', 'Perbelanjaan']
    : ['Kesihatan', 'Perbelanjaan', 'Galeri', 'Dokumen'];

  const [activeTab, setActiveTab] = useState<TabKey>('Kesihatan');
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Stats
  const [vaccinCount, setVaccinCount] = useState<number | null>(null);
  const [expense, setExpense] = useState<number | null>(null);
  const [appointmentCount, setAppointmentCount] = useState<number | null>(null);
  const [showCount, setShowCount] = useState<number | null>(null);
  const [awardCount, setAwardCount] = useState<number | null>(null);

  // Show records
  const [showRecords, setShowRecords] = useState<ShowRecord[]>([]);
  const [loadingShows, setLoadingShows] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Egg batches
  const [eggBatches, setEggBatches] = useState<EggBatch[]>([]);
  const [loadingEggs, setLoadingEggs] = useState(false);

  // Health records modal
  const [healthModal, setHealthModal] = useState(false);

  // Pet expenses
  const [petExpenses, setPetExpenses] = useState<PetExpense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<PetDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docModal, setDocModal] = useState(false);

  // Photos
  const [photos, setPhotos] = useState<PetPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoModal, setPhotoModal] = useState(false);
  const [eggModal, setEggModal] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      if (isSerama) {
        const { count: sc } = await supabase
          .from('show_records')
          .select('id', { count: 'exact', head: true })
          .eq('pet_id', pet.id);
        setShowCount(sc ?? 0);

        const { count: ac } = await supabase
          .from('show_records')
          .select('id', { count: 'exact', head: true })
          .eq('pet_id', pet.id)
          .not('award', 'is', null);
        setAwardCount(ac ?? 0);
      } else {
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
          (sum: number, r: { amount: number }) => sum + (r.amount ?? 0), 0
        );
        setExpense(total);

        const todayStr = new Date().toISOString().split('T')[0];
        const { count: rc } = await supabase
          .from('reminders')
          .select('id', { count: 'exact', head: true })
          .eq('pet_id', pet.id)
          .gte('date', todayStr);
        setAppointmentCount(rc ?? 0);
      }
    } catch {
      // non-critical
    }
  }, [pet.id, isSerama]);

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

  const fetchShowRecords = useCallback(async () => {
    setLoadingShows(true);
    try {
      const { data } = await supabase
        .from('show_records')
        .select('*')
        .eq('pet_id', pet.id)
        .order('date', { ascending: false });
      setShowRecords(data ?? []);
    } finally {
      setLoadingShows(false);
    }
  }, [pet.id]);

  const fetchEggBatches = useCallback(async () => {
    setLoadingEggs(true);
    try {
      const { data } = await supabase
        .from('egg_batches')
        .select('*')
        .eq('pet_id', pet.id)
        .order('created_at', { ascending: false });
      setEggBatches(data ?? []);
    } finally {
      setLoadingEggs(false);
    }
  }, [pet.id]);

  const fetchPetExpenses = useCallback(async () => {
    setLoadingExpenses(true);
    try {
      const { data } = await supabase.from('expenses').select('*').eq('pet_id', pet.id).order('date', { ascending: false });
      setPetExpenses(data ?? []);
    } finally { setLoadingExpenses(false); }
  }, [pet.id]);

  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const { data } = await supabase.from('pet_documents').select('*').eq('pet_id', pet.id).order('created_at', { ascending: false });
      setDocuments(data ?? []);
    } finally { setLoadingDocs(false); }
  }, [pet.id]);

  const fetchPhotos = useCallback(async () => {
    setLoadingPhotos(true);
    try {
      const { data } = await supabase.from('pet_photos').select('*').eq('pet_id', pet.id).order('created_at', { ascending: false });
      setPhotos(data ?? []);
    } finally { setLoadingPhotos(false); }
  }, [pet.id]);

  useEffect(() => {
    fetchStats();
    fetchHealthRecords();
  }, [fetchStats, fetchHealthRecords]);

  useEffect(() => {
    if (activeTab === 'Pertandingan') fetchShowRecords();
    if (activeTab === 'Telur') fetchEggBatches();
    if (activeTab === 'Perbelanjaan') fetchPetExpenses();
    if (activeTab === 'Dokumen') fetchDocuments();
    if (activeTab === 'Galeri') fetchPhotos();
  }, [activeTab, fetchShowRecords, fetchEggBatches, fetchPetExpenses, fetchDocuments, fetchPhotos]);

  const emoji = SPECIES_EMOJI[pet.species] ?? '🐾';
  const nextBatchNumber = eggBatches.length > 0
    ? Math.max(...eggBatches.map((b) => b.batch_number)) + 1
    : 1;

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
        <TouchableOpacity onPress={onEdit} style={{ padding: 6 }} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={22} color={PRIMARY} />
        </TouchableOpacity>
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
        {isSerama && !!pet.posture_class && (
          <View style={[styles.tagBadge, { backgroundColor: ACCENT }]}>
            <Text style={styles.tagBadgeText}>{pet.posture_class}</Text>
          </View>
        )}
        {isSerama && !!pet.feather_colour && (
          <View style={[styles.tagBadge, { backgroundColor: PRIMARY }]}>
            <Text style={styles.tagBadgeText}>{pet.feather_colour}</Text>
          </View>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {isSerama ? (
          <>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Pertandingan</Text>
              <Text style={styles.statValue}>{showCount === null ? '—' : String(showCount)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Anugerah</Text>
              <Text style={styles.statValue}>{awardCount === null ? '—' : String(awardCount)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Berat</Text>
              <Text style={styles.statValue}>{pet.weight ? `${pet.weight}kg` : '—'}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Vaksin</Text>
              <Text style={styles.statValue}>{vaccinCount === null ? '—' : vaccinCount === 0 ? '—' : String(vaccinCount)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Perbelanjaan</Text>
              <Text style={styles.statValue}>{expense === null ? '—' : expense === 0 ? '—' : `RM${expense.toFixed(2)}`}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Temujanji</Text>
              <Text style={styles.statValue}>{appointmentCount === null ? '—' : appointmentCount === 0 ? '—' : String(appointmentCount)}</Text>
            </View>
          </>
        )}
      </View>

      {/* Tab grid */}
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

      {/* ── Kesihatan ── */}
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
                <View style={[styles.recordStatusBadge, { backgroundColor: getRecordStatusColor(record.status) }]}>
                  <Text style={styles.recordStatusText}>{record.status}</Text>
                </View>
              </View>
            ))
          )}
          <TouchableOpacity style={styles.addRecordButton} onPress={() => setHealthModal(true)}>
            <Text style={styles.addRecordButtonText}>+ Tambah Rekod</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Pertandingan (Serama only) ── */}
      {activeTab === 'Pertandingan' && (
        <View style={styles.tabContent}>
          {loadingShows ? (
            <Text style={styles.loadingText}>Memuatkan...</Text>
          ) : showRecords.length === 0 ? (
            <View style={styles.emptyRecords}>
              <Ionicons name="trophy-outline" size={40} color={MUTED} />
              <Text style={styles.emptyRecordsText}>Tiada rekod pertandingan</Text>
            </View>
          ) : (
            showRecords.map((rec) => (
              <View key={rec.id} style={styles.showItem}>
                <View style={styles.showItemLeft}>
                  <Text style={styles.showItemName}>{rec.name}</Text>
                  <Text style={styles.showItemMeta}>
                    {formatDate(rec.date)}{rec.location ? ` · ${rec.location}` : ''}
                  </Text>
                </View>
                {rec.award ? (
                  <View style={styles.awardBadge}>
                    <Ionicons name="trophy" size={11} color={ACCENT} style={{ marginRight: 3 }} />
                    <Text style={styles.awardBadgeText}>{rec.award}</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
          <TouchableOpacity style={styles.addRecordButton} onPress={() => setShowModal(true)}>
            <Text style={styles.addRecordButtonText}>+ Tambah Rekod Pertandingan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Telur (Serama only) ── */}
      {activeTab === 'Telur' && (
        <View style={styles.tabContent}>
          {/* Summary metrics */}
          <View style={styles.eggSummaryRow}>
            <View style={styles.eggSummaryBox}>
              <Text style={styles.eggSummaryValue}>
                {eggBatches
                  .filter((b) => b.status === 'incubating')
                  .reduce((s, b) => s + b.egg_count, 0)}
              </Text>
              <Text style={styles.eggSummaryLabel}>Telur Aktif</Text>
            </View>
            <View style={[styles.eggSummaryBox, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[styles.eggSummaryValue, { color: '#2E7D32' }]}>
                {eggBatches.reduce((s, b) => s + b.hatched_count, 0)}
              </Text>
              <Text style={styles.eggSummaryLabel}>Telah Menetas</Text>
            </View>
          </View>

          {loadingEggs ? (
            <Text style={styles.loadingText}>Memuatkan...</Text>
          ) : eggBatches.length === 0 ? (
            <View style={styles.emptyRecords}>
              <Text style={{ fontSize: 36 }}>🥚</Text>
              <Text style={styles.emptyRecordsText}>Tiada rekod telur</Text>
            </View>
          ) : (
            eggBatches.map((batch) => {
              const daysElapsed = Math.floor(
                (Date.now() - new Date(batch.start_date).getTime()) / (1000 * 60 * 60 * 24)
              );
              const hatchDate = addDays(batch.start_date, 21);
              const daysRemaining = 21 - daysElapsed;
              const progress = Math.min(Math.max(daysElapsed / 21, 0), 1);

              return (
                <View key={batch.id} style={styles.eggBatchCard}>
                  <View style={styles.eggBatchHeader}>
                    <Text style={styles.eggBatchTitle}>
                      Batch #{batch.batch_number} — {batch.egg_count} biji
                    </Text>
                    {batch.status === 'hatched' ? (
                      <View style={styles.hatchedBadge}>
                        <Text style={styles.hatchedBadgeText}>Menetas</Text>
                      </View>
                    ) : daysRemaining <= 3 && daysRemaining >= 0 ? (
                      <View style={[styles.eggProgressBadge, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.eggProgressBadgeText, { color: '#2E7D32' }]}>
                          Menetas {daysRemaining} hari lagi
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.eggProgressBadge, { backgroundColor: INDIGO_LIGHT }]}>
                        <Text style={[styles.eggProgressBadgeText, { color: PRIMARY }]}>
                          Hari ke-{Math.min(daysElapsed, 21)} / 21
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.eggBatchMeta}>
                    Mula: {formatDate(batch.start_date)} · Jangka menetas: {formatDate(hatchDate.toISOString())}
                  </Text>

                  {/* Progress bar */}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                  </View>

                  {batch.notes ? (
                    <Text style={styles.eggBatchNotes}>{batch.notes}</Text>
                  ) : null}
                </View>
              );
            })
          )}

          <TouchableOpacity style={styles.addRecordButton} onPress={() => setEggModal(true)}>
            <Text style={styles.addRecordButtonText}>+ Rekod Batch Telur Baru</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Perbelanjaan ── */}
      {activeTab === 'Perbelanjaan' && (
        <View style={styles.tabContent}>
          {loadingExpenses ? (
            <Text style={styles.loadingText}>Memuatkan...</Text>
          ) : petExpenses.length === 0 ? (
            <View style={styles.emptyRecords}>
              <Ionicons name="wallet-outline" size={40} color={MUTED} />
              <Text style={styles.emptyRecordsText}>Tiada rekod perbelanjaan</Text>
            </View>
          ) : (
            petExpenses.map((exp) => {
              const cat = EXPENSE_CATEGORIES.find((c) => c.label === exp.category);
              return (
                <View key={exp.id} style={styles.recordItem}>
                  <View style={[styles.recordBar, { backgroundColor: cat?.color ?? MUTED }]} />
                  <View style={styles.recordBody}>
                    <Text style={styles.recordTitle}>{exp.category}</Text>
                    <Text style={styles.recordDate}>{formatDate(exp.date)}{exp.notes ? ` · ${exp.notes}` : ''}</Text>
                  </View>
                  <View style={[styles.recordStatusBadge, { backgroundColor: INDIGO_LIGHT }]}>
                    <Text style={[styles.recordStatusText, { color: PRIMARY }]}>RM {exp.amount.toFixed(2)}</Text>
                  </View>
                </View>
              );
            })
          )}
          <TouchableOpacity style={styles.addRecordButton} onPress={() => setExpenseModal(true)}>
            <Text style={styles.addRecordButtonText}>+ Tambah Perbelanjaan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Galeri ── */}
      {activeTab === 'Galeri' && (
        <View style={styles.tabContent}>
          {loadingPhotos ? (
            <Text style={styles.loadingText}>Memuatkan...</Text>
          ) : photos.length === 0 ? (
            <View style={styles.emptyRecords}>
              <Ionicons name="images-outline" size={40} color={MUTED} />
              <Text style={styles.emptyRecordsText}>Tiada gambar</Text>
            </View>
          ) : (
            <View style={styles.photoGrid}>
              {photos.map((p) => (
                <View key={p.id} style={styles.photoThumb}>
                  <Image source={{ uri: p.url }} style={{ width: '100%', height: '100%', borderRadius: 10 }} resizeMode="cover" />
                  {!!p.caption && <Text style={styles.photoCaption} numberOfLines={1}>{p.caption}</Text>}
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.addRecordButton} onPress={() => setPhotoModal(true)}>
            <Text style={styles.addRecordButtonText}>+ Tambah Gambar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Dokumen ── */}
      {activeTab === 'Dokumen' && (
        <View style={styles.tabContent}>
          {loadingDocs ? (
            <Text style={styles.loadingText}>Memuatkan...</Text>
          ) : documents.length === 0 ? (
            <View style={styles.emptyRecords}>
              <Ionicons name="document-outline" size={40} color={MUTED} />
              <Text style={styles.emptyRecordsText}>Tiada dokumen</Text>
            </View>
          ) : (
            documents.map((doc) => (
              <View key={doc.id} style={styles.recordItem}>
                <View style={[styles.recordBar, { backgroundColor: PRIMARY }]} />
                <View style={styles.recordBody}>
                  <Text style={styles.recordTitle}>{doc.title}</Text>
                  <Text style={styles.recordDate}>{doc.type}{doc.date ? ` · ${formatDate(doc.date)}` : ''}</Text>
                </View>
                {!!doc.notes && (
                  <View style={[styles.recordStatusBadge, { backgroundColor: INDIGO_LIGHT }]}>
                    <Text style={[styles.recordStatusText, { color: PRIMARY }]} numberOfLines={1}>{doc.notes}</Text>
                  </View>
                )}
              </View>
            ))
          )}
          <TouchableOpacity style={styles.addRecordButton} onPress={() => setDocModal(true)}>
            <Text style={styles.addRecordButtonText}>+ Tambah Dokumen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Modals ── */}
      {user && (
        <AddShowRecordModal
          visible={showModal}
          petId={pet.id}
          userId={user.id}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchShowRecords(); fetchStats(); }}
        />
      )}
      {user && (
        <AddEggBatchModal
          visible={eggModal}
          petId={pet.id}
          userId={user.id}
          nextBatchNumber={nextBatchNumber}
          onClose={() => setEggModal(false)}
          onSuccess={() => { setEggModal(false); fetchEggBatches(); }}
        />
      )}
      {user && (
        <AddHealthRecordModal
          visible={healthModal}
          petId={pet.id}
          userId={user.id}
          onClose={() => setHealthModal(false)}
          onSuccess={() => { setHealthModal(false); fetchHealthRecords(); fetchStats(); }}
        />
      )}
      {user && (
        <AddPetExpenseModal
          visible={expenseModal}
          petId={pet.id}
          userId={user.id}
          onClose={() => setExpenseModal(false)}
          onSuccess={() => { setExpenseModal(false); fetchPetExpenses(); fetchStats(); }}
        />
      )}
      {user && (
        <AddDocumentModal
          visible={docModal}
          petId={pet.id}
          userId={user.id}
          onClose={() => setDocModal(false)}
          onSuccess={() => { setDocModal(false); fetchDocuments(); }}
        />
      )}
      {user && (
        <AddPhotoModal
          visible={photoModal}
          petId={pet.id}
          userId={user.id}
          onClose={() => setPhotoModal(false)}
          onSuccess={() => { setPhotoModal(false); fetchPhotos(); }}
        />
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
        .is('deleted_at', null)
        .order('name', { ascending: true });
      if (error) throw error;
      setPets(data ?? []);
    } catch {
      setPets([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchPets(); }, [fetchPets]);

  const handleAddSuccess = (newPet: Pet) => {
    setPets((prev) => [...prev, newPet].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedPet(newPet);
    setShowAddModal(false);
  };

  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleEditSuccess = (updated: Pet) => {
    setPets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)).sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedPet(updated);
    setShowEditModal(false);
    setEditingPet(null);
  };

  const handleDeletePet = (pet: Pet) => {
    Alert.alert(
      'Padam Haiwan',
      `Adakah anda pasti ingin memadam "${pet.name}"? Tindakan ini tidak boleh dibatalkan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Padam', style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('pets').update({ deleted_at: new Date().toISOString() }).eq('id', pet.id);
              if (error) throw error;
              setPets((prev) => prev.filter((p) => p.id !== pet.id));
              if (selectedPet?.id === pet.id) setSelectedPet(null);
            } catch (err: any) {
              Alert.alert('Ralat', err?.message ?? 'Gagal memadam haiwan.');
            }
          },
        },
      ]
    );
  };


  return (
    <View style={styles.safeArea}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: PRIMARY }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pets Saya</Text>
        <TouchableOpacity style={styles.headerAddBtn} onPress={() => setShowAddModal(true)}>
          <Text style={styles.headerAddBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.petGrid}>
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </View>
        ) : pets.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="paw-outline" size={60} color="#D1C9B8" />
            <Text style={styles.emptyStateTitle}>Tiada haiwan peliharaan</Text>
            <Text style={styles.emptyStateSubtitle}>Tambah haiwan pertama anda!</Text>
          </View>
        ) : (
          <>
            <View style={styles.petGrid}>
              {pets.map((pet) => {
                const isSelected = selectedPet?.id === pet.id;
                const emoji = SPECIES_EMOJI[pet.species] ?? '🐾';
                return (
                  <TouchableOpacity
                    key={pet.id}
                    style={[styles.petCard, isSelected && styles.petCardSelected]}
                    onPress={() => setSelectedPet(isSelected ? null : pet)}
                    onLongPress={() => handleDeletePet(pet)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.petCardEmoji}>
                      <Text style={styles.petCardEmojiText}>{emoji}</Text>
                    </View>
                    <Text style={styles.petCardName} numberOfLines={1}>{pet.name}</Text>
                    <Text style={styles.petCardBreed} numberOfLines={1}>
                      {pet.breed || pet.species}
                    </Text>
                    <View style={[styles.petCardBadge, { backgroundColor: getHealthBadgeColor(pet.health_status) }]}>
                      <Text style={styles.petCardBadgeText}>{pet.health_status}</Text>
                    </View>
                    {pet.species === 'Ayam Serama' && !!pet.posture_class && (
                      <View style={[styles.petCardBadge, { backgroundColor: ACCENT, marginTop: 3 }]}>
                        <Text style={styles.petCardBadgeText}>{pet.posture_class}</Text>
                      </View>
                    )}
                    {pet.species === 'Ayam Serama' && !!pet.feather_colour && (
                      <View style={[styles.petCardBadge, { backgroundColor: PRIMARY, marginTop: 3 }]}>
                        <Text style={styles.petCardBadgeText}>{pet.feather_colour}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.addPetCard}
                onPress={() => setShowAddModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.addPetCardIcon}>+</Text>
                <Text style={styles.addPetCardText}>Tambah Pet</Text>
              </TouchableOpacity>
            </View>

            {selectedPet && (
              <PetDetail
                pet={selectedPet}
                onEdit={() => { setEditingPet(selectedPet); setShowEditModal(true); }}
              />
            )}
          </>
        )}
      </ScrollView>

      {user && (
        <AddPetModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
          userId={user.id}
        />
      )}
      <EditPetModal
        visible={showEditModal}
        pet={editingPet}
        onClose={() => { setShowEditModal(false); setEditingPet(null); }}
        onSuccess={handleEditSuccess}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Layout
  safeArea: { flex: 1, backgroundColor: PRIMARY },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 56,
    backgroundColor: PRIMARY,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  headerAddBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
  },
  headerAddBtnText: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 28 },
  scrollView: {
    flex: 1, backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28,
  },
  scrollContent: { paddingTop: 16, paddingBottom: 40 },

  // ── Pet grid
  petGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },

  // ── Pet card
  petCard: {
    width: CARD_WIDTH, minHeight: 160, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    borderWidth: 2, borderColor: 'transparent',
  },
  petCardSelected: { borderColor: ACCENT },
  petCardEmoji: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: SAGE, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  petCardEmojiText: { fontSize: 20 },
  petCardName: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 2 },
  petCardBreed: { fontSize: 12, color: MUTED, flex: 1 },
  petCardBadge: {
    alignSelf: 'flex-end', borderRadius: 8,
    paddingVertical: 3, paddingHorizontal: 8, marginTop: 4,
  },
  petCardBadgeText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },

  // ── Add pet card
  addPetCard: {
    width: CARD_WIDTH, height: 160, borderRadius: 16,
    borderWidth: 2, borderStyle: 'dashed', borderColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addPetCardIcon: { fontSize: 32, fontWeight: '300', color: PRIMARY },
  addPetCardText: { fontSize: 13, fontWeight: '600', color: PRIMARY },

  // ── Skeleton
  skeletonCard: { height: 160, backgroundColor: '#E0E0E0', borderRadius: 16 },

  // ── Empty state
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  emptyStateTitle: { fontSize: 18, fontWeight: '600', color: INK },
  emptyStateSubtitle: { fontSize: 14, color: MUTED },

  // ── Pet detail card
  detailCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    marginHorizontal: 16, marginTop: 8, marginBottom: 0, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  detailTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  detailAvatar: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: SAGE,
    borderWidth: 3, borderColor: ACCENT, alignItems: 'center', justifyContent: 'center',
  },
  detailAvatarEmoji: { fontSize: 28 },
  detailInfo: { flex: 1, gap: 2 },
  detailName: { fontSize: 18, fontWeight: '700', color: INK },
  detailBreed: { fontSize: 13, color: MUTED },
  detailGender: { fontSize: 12, color: MUTED },

  // ── Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tagBadge: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  tagBadgeText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },

  // ── Stats row
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: {
    flex: 1, backgroundColor: INDIGO_LIGHT, borderRadius: 12,
    padding: 10, alignItems: 'center', gap: 4,
  },
  statLabel: { fontSize: 10, color: MUTED, textAlign: 'center' },
  statValue: { fontSize: 14, fontWeight: '700', color: PRIMARY },

  // ── Tab grid
  tabGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tabButton: {
    width: '48%', backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0',
  },
  tabButtonActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  tabText: { fontSize: 12, fontWeight: '600', color: MUTED },
  tabTextActive: { color: '#FFFFFF' },

  // ── Tab content
  tabContent: { gap: 10 },
  loadingText: { color: MUTED, textAlign: 'center', paddingVertical: 20 },
  emptyRecords: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyRecordsText: { fontSize: 14, color: MUTED },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: '47%', aspectRatio: 1, borderRadius: 10, backgroundColor: INDIGO_LIGHT, overflow: 'hidden' },
  photoCaption: { position: 'absolute', bottom: 4, left: 4, right: 4, fontSize: 10, color: '#fff', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 4, paddingHorizontal: 4 },
  photoPickerBox: { height: 180, borderRadius: 14, borderWidth: 2, borderColor: INDIGO_LIGHT, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%' },

  // ── Health record item
  recordItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: BACKGROUND, borderRadius: 12, overflow: 'hidden', gap: 10,
  },
  recordBar: { width: 4, alignSelf: 'stretch' },
  recordBody: { flex: 1, paddingVertical: 10, gap: 2 },
  recordTitle: { fontSize: 14, fontWeight: '600', color: INK },
  recordDate: { fontSize: 12, color: MUTED },
  recordStatusBadge: { borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, marginRight: 10 },
  recordStatusText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },

  // ── Add record button
  addRecordButton: {
    backgroundColor: PRIMARY, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 6,
  },
  addRecordButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // ── Show record item
  showItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: BACKGROUND, borderRadius: 12, padding: 12,
  },
  showItemLeft: { flex: 1, gap: 3 },
  showItemName: { fontSize: 14, fontWeight: '600', color: INK },
  showItemMeta: { fontSize: 12, color: MUTED },
  awardBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF8E1', borderRadius: 8,
    paddingVertical: 4, paddingHorizontal: 8, marginLeft: 8,
  },
  awardBadgeText: { fontSize: 11, fontWeight: '700', color: '#B8860B' },

  // ── Egg batch card
  eggSummaryRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  eggSummaryBox: {
    flex: 1, backgroundColor: INDIGO_LIGHT, borderRadius: 12,
    padding: 12, alignItems: 'center', gap: 4,
  },
  eggSummaryValue: { fontSize: 22, fontWeight: '800', color: PRIMARY },
  eggSummaryLabel: { fontSize: 11, color: MUTED, textAlign: 'center' },
  eggBatchCard: {
    backgroundColor: BACKGROUND, borderRadius: 12, padding: 12, gap: 8,
  },
  eggBatchHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  eggBatchTitle: { fontSize: 14, fontWeight: '700', color: INK, flex: 1 },
  eggBatchMeta: { fontSize: 11, color: MUTED },
  eggBatchNotes: { fontSize: 12, color: MUTED, fontStyle: 'italic' },
  progressTrack: {
    height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: SAGE, borderRadius: 3 },
  eggProgressBadge: {
    borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, marginLeft: 6,
  },
  eggProgressBadgeText: { fontSize: 11, fontWeight: '700' },
  hatchedBadge: {
    backgroundColor: '#E8F5E9', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, marginLeft: 6,
  },
  hatchedBadgeText: { fontSize: 11, fontWeight: '700', color: '#2E7D32' },

  // ── Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, maxHeight: '90%',
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#D1C9B8',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: PRIMARY, marginBottom: 20 },

  // ── Form fields
  fieldLabel: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 6, marginTop: 12 },
  textInput: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK, backgroundColor: BACKGROUND,
  },

  // ── Species / option pills
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillButton: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
    borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFFFFF',
  },
  pillButtonActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  pillText: { fontSize: 13, color: MUTED, fontWeight: '500' },
  pillTextActive: { color: '#FFFFFF' },

  // ── Date button
  dateButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: BACKGROUND,
  },
  dateButtonText: { fontSize: 15, color: INK },

  // ── Gender toggle
  genderToggle: {
    flexDirection: 'row', backgroundColor: '#F0F0F0', borderRadius: 12, padding: 4, gap: 4,
  },
  genderButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  genderButtonActive: { backgroundColor: PRIMARY },
  genderText: { fontSize: 14, fontWeight: '600', color: MUTED },
  genderTextActive: { color: '#FFFFFF' },

  // ── Save / Cancel
  saveButton: {
    backgroundColor: PRIMARY, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  cancelButton: { padding: 14, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  cancelButtonText: { fontSize: 15, color: MUTED, fontWeight: '500' },
});
