import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
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
import { router } from 'expo-router';
import * as Location from 'expo-location';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const PRIMARY = '#1A237E';
const ACCENT = '#FFB300';
const BACKGROUND = '#F9F7F2';
const SAGE = '#81C784';
const INK = '#1A1A2E';
const MUTED = '#9E9E9E';
const WHITE = '#FFFFFF';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Clinic {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  type?: string;
  phone?: string;
  distanceKm?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatAddress(clinic: Clinic): string {
  const parts: string[] = [];
  // Display name often has the address as comma-separated parts
  const nameParts = clinic.display_name.split(',');
  if (nameParts.length > 1) {
    return nameParts.slice(1, 4).join(',').trim();
  }
  return clinic.display_name;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonClinic() {
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
    <Animated.View style={[s.clinicCard, { opacity: anim }]}>
      <View style={{ gap: 10 }}>
        <View style={{ height: 14, width: '60%', backgroundColor: '#E0E0E0', borderRadius: 6 }} />
        <View style={{ height: 11, width: '80%', backgroundColor: '#E0E0E0', borderRadius: 6 }} />
        <View style={{ height: 32, width: 100, backgroundColor: '#E0E0E0', borderRadius: 8 }} />
      </View>
    </Animated.View>
  );
}

// ─── Clinic Card ──────────────────────────────────────────────────────────────
function ClinicCard({ clinic }: { clinic: Clinic }) {
  const openMaps = () => {
    const url =
      Platform.OS === 'ios'
        ? `maps://app?daddr=${clinic.lat},${clinic.lon}`
        : `geo:${clinic.lat},${clinic.lon}?q=${encodeURIComponent(clinic.display_name.split(',')[0])}`;
    Linking.openURL(url).catch(() => {
      // Fallback to Google Maps web
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${clinic.lat},${clinic.lon}`
      );
    });
  };

  const openDialer = () => {
    if (clinic.phone) {
      Linking.openURL(`tel:${clinic.phone}`);
    }
  };

  const name = clinic.display_name.split(',')[0].trim();
  const address = formatAddress(clinic);

  return (
    <View style={s.clinicCard}>
      <View style={s.clinicHeader}>
        <View style={s.clinicIconBox}>
          <Ionicons name="business-outline" size={22} color={PRIMARY} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.clinicName} numberOfLines={2}>{name}</Text>
          <Text style={s.clinicAddress} numberOfLines={2}>{address}</Text>
        </View>
        {clinic.distanceKm !== undefined && (
          <View style={s.distanceBadge}>
            <Ionicons name="location-outline" size={12} color={SAGE} />
            <Text style={s.distanceText}>{formatDistance(clinic.distanceKm)}</Text>
          </View>
        )}
      </View>

      <View style={s.clinicActions}>
        <TouchableOpacity style={s.actionBtn} onPress={openMaps} activeOpacity={0.8}>
          <Ionicons name="navigate-outline" size={15} color={WHITE} style={{ marginRight: 5 }} />
          <Text style={s.actionBtnText}>Dapatkan Arah</Text>
        </TouchableOpacity>
        {clinic.phone ? (
          <TouchableOpacity style={s.actionBtnOutline} onPress={openDialer} activeOpacity={0.8}>
            <Ionicons name="call-outline" size={15} color={PRIMARY} style={{ marginRight: 5 }} />
            <Text style={s.actionBtnOutlineText}>Hubungi</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function VetFinderScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    requestLocationAndSearch();
  }, []);

  const requestLocationAndSearch = async () => {
    setLoading(true);
    setLocationDenied(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDenied(true);
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setUserLat(latitude);
      setUserLon(longitude);
      await searchClinics('klinik haiwan veterinar', latitude, longitude);
    } catch {
      Alert.alert('Ralat', 'Gagal mendapatkan lokasi semasa. Sila cuba lagi.');
      setLocationDenied(true);
    } finally {
      setLoading(false);
    }
  };

  const searchClinics = async (query: string, lat: number, lon: number) => {
    setSearching(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '15',
        lat: String(lat),
        lon: String(lon),
        addressdetails: '1',
      });
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            'Accept-Language': 'ms,en',
            'User-Agent': 'MyPetsApp/1.0',
          },
        }
      );
      if (!res.ok) throw new Error('Network error');
      const data: Clinic[] = await res.json();

      // Calculate distance and sort
      const withDistance = data
        .map((c) => ({
          ...c,
          distanceKm: haversine(lat, lon, parseFloat(c.lat), parseFloat(c.lon)),
        }))
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

      setClinics(withDistance);
    } catch {
      Alert.alert('Ralat', 'Gagal mencari klinik. Sila periksa sambungan internet anda.');
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = () => {
    if (!userLat || !userLon) return;
    const q = searchQuery.trim() || 'klinik haiwan veterinar';
    searchClinics(q, userLat, userLon);
  };

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: PRIMARY }}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color={WHITE} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Cari Klinik Vet</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      {/* ── Body ── */}
      <View style={s.body}>
        {/* Search bar */}
        <View style={s.searchContainer}>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={18} color={MUTED} style={{ marginRight: 8 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Cari klinik berhampiran..."
              placeholderTextColor={MUTED}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={MUTED} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={s.searchBtn}
            onPress={handleSearch}
            activeOpacity={0.8}
            disabled={!userLat || searching}
          >
            <Ionicons name="search" size={18} color={WHITE} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {locationDenied ? (
          <View style={s.permissionBox}>
            <Ionicons name="location-outline" size={56} color="#D1C9B8" />
            <Text style={s.permissionTitle}>Lokasi Diperlukan</Text>
            <Text style={s.permissionText}>
              Sila benarkan akses lokasi untuk mencari klinik berhampiran
            </Text>
            <TouchableOpacity style={s.retryBtn} onPress={requestLocationAndSearch} activeOpacity={0.8}>
              <Text style={s.retryBtnText}>Cuba Semula</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={s.loadingText}>Mendapatkan lokasi anda...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.listContent}
          >
            {searching ? (
              <>
                <SkeletonClinic />
                <SkeletonClinic />
                <SkeletonClinic />
              </>
            ) : clinics.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="business-outline" size={48} color="#D1C9B8" />
                <Text style={s.emptyTitle}>Tiada klinik dijumpai</Text>
                <Text style={s.emptySubtitle}>Cuba carian yang berbeza</Text>
              </View>
            ) : (
              <>
                <Text style={s.resultCount}>{clinics.length} klinik dijumpai berhampiran anda</Text>
                {clinics.map((clinic) => (
                  <ClinicCard key={clinic.place_id} clinic={clinic} />
                ))}
              </>
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
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

  body: {
    flex: 1,
    backgroundColor: BACKGROUND,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },

  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 14,
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
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },

  resultCount: {
    fontSize: 13,
    color: MUTED,
    marginBottom: 4,
  },

  // Clinic Card
  clinicCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  clinicHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  clinicIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF0FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicName: {
    fontSize: 15,
    fontWeight: '700',
    color: INK,
    marginBottom: 3,
  },
  clinicAddress: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 16,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginLeft: 8,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D32',
  },

  clinicActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 10,
  },
  actionBtnText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  actionBtnOutlineText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '600',
  },

  // States
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: MUTED,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: INK,
    marginTop: 8,
  },
  permissionText: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  retryBtnText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
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
  },
});
