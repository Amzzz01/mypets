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
    const name = clinic.display_name.split(',')[0];
    const lat = clinic.lat;
    const lon = clinic.lon;

    // Deep links for Maps Apps
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lon}`,
      android: `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(name)})`,
    }) || `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Web Fallback
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`);
      }
    });
  };

  const openDialer = () => {
    if (clinic.phone) Linking.openURL(`tel:${clinic.phone}`);
  };

  const name = clinic.display_name.split(',')[0].trim();
  const address = clinic.display_name.split(',').slice(1, 4).join(',').trim();

  return (
    <View style={s.clinicCard}>
      <View style={s.clinicHeader}>
        <View style={s.clinicIconBox}>
          <Ionicons name="business-outline" size={22} color={PRIMARY} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.clinicName} numberOfLines={1}>{name}</Text>
          <Text style={s.clinicAddress} numberOfLines={2}>{address}</Text>
        </View>
        {clinic.distanceKm !== undefined && (
          <View style={s.distanceBadge}>
            <Text style={s.distanceText}>{formatDistance(clinic.distanceKm)}</Text>
          </View>
        )}
      </View>

      <View style={s.clinicActions}>
        <TouchableOpacity style={s.actionBtn} onPress={openMaps}>
          <Ionicons name="navigate" size={15} color={WHITE} style={{ marginRight: 5 }} />
          <Text style={s.actionBtnText}>Arah</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtnOutline} onPress={openDialer}>
          <Ionicons name="call" size={15} color={PRIMARY} style={{ marginRight: 5 }} />
          <Text style={s.actionBtnOutlineText}>Hubungi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function VetFinderScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number, lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    initLocation();
  }, []);

  const initLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need location to find clinics near you.');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      setUserCoords(coords);
      // AUTO SEARCH ON LOAD
      fetchClinics('veterinary clinic', coords.lat, coords.lon);
    } catch (e) {
      setLoading(false);
    }
  };

  const fetchClinics = async (query: string, lat: number, lon: number) => {
    setSearching(true);
    try {
      // Nominatim search with Viewbox bounding for "Near Me" accuracy
      const delta = 0.15; // Roughly 15km radius
      const viewbox = `${lon - delta},${lat + delta},${lon + delta},${lat - delta}`;

      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=20&lat=${lat}&lon=${lon}&viewbox=${viewbox}&bounded=1&addressdetails=1`;

      const res = await fetch(url, {
        headers: { 'User-Agent': 'MyVetApp/1.0', 'Accept-Language': 'ms' }
      });
      const data: Clinic[] = await res.json();

      const sorted = data
        .map(c => ({
          ...c,
          distanceKm: haversine(lat, lon, parseFloat(c.lat), parseFloat(c.lon))
        }))
        .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

      setClinics(sorted);
    } catch (e) {
      Alert.alert('Error', 'Failed to fetch clinics.');
    } finally {
      setSearching(false);
      setLoading(false);
    }
  };

  const handleManualSearch = () => {
    if (userCoords) fetchClinics(searchQuery || 'veterinary clinic', userCoords.lat, userCoords.lon);
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: PRIMARY }}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={WHITE} /></TouchableOpacity>
          <Text style={s.headerTitle}>Klinik Haiwan Terdekat</Text>
          <TouchableOpacity onPress={initLocation}><Ionicons name="refresh" size={20} color={WHITE} /></TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={s.body}>
        <View style={s.searchContainer}>
          <View style={s.searchBox}>
            <TextInput
              style={s.searchInput}
              placeholder="Cari nama klinik..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleManualSearch}
            />
            <TouchableOpacity onPress={handleManualSearch}>
              <Ionicons name="search" size={20} color={PRIMARY} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.suggestionScroll}
          >
            {['Klinik Haiwan', 'Klinik Veterinar', 'Pet Shop', 'Kedai Burung'].map((term) => (
              <TouchableOpacity
                key={term}
                style={s.suggestionChip}
                onPress={() => {
                  setSearchQuery(term);
                  if (userCoords) fetchClinics(term, userCoords.lat, userCoords.lon);
                }}
              >
                <Text style={s.suggestionText}>{term}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 50 }} color={PRIMARY} />
        ) : (
          <ScrollView contentContainerStyle={s.listContent}>
            {searching ? <ActivityIndicator color={PRIMARY} /> :
              clinics.map(item => <ClinicCard key={item.place_id} clinic={item} />)
            }
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: PRIMARY },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: WHITE },
  body: { flex: 1, backgroundColor: BACKGROUND, borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: 10 },
  searchContainer: { padding: 20 },
  searchBox: { flexDirection: 'row', backgroundColor: WHITE, borderRadius: 15, paddingHorizontal: 15, height: 50, alignItems: 'center', elevation: 2 },
  searchInput: { flex: 1, fontSize: 16 },
  suggestionScroll: { marginTop: 15, paddingRight: 20, gap: 10 },
  suggestionChip: { backgroundColor: '#E8EAF6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#C5CAE9' },
  suggestionText: { color: PRIMARY, fontWeight: '600', fontSize: 13 },
  listContent: { padding: 20, gap: 15 },
  clinicCard: { backgroundColor: WHITE, borderRadius: 20, padding: 15, elevation: 3 },
  clinicHeader: { flexDirection: 'row', alignItems: 'center' },
  clinicIconBox: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#E8EAF6', justifyContent: 'center', alignItems: 'center' },
  clinicName: { fontSize: 16, fontWeight: 'bold', color: INK },
  clinicAddress: { fontSize: 12, color: MUTED, marginTop: 2 },
  distanceBadge: { backgroundColor: '#E8F5E9', padding: 5, borderRadius: 8 },
  distanceText: { color: '#2E7D32', fontWeight: 'bold', fontSize: 10 },
  clinicActions: { flexDirection: 'row', marginTop: 15, gap: 10 },
  actionBtn: { flex: 1, backgroundColor: PRIMARY, height: 40, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { color: WHITE, fontWeight: '600' },
  actionBtnOutline: { flex: 1, borderWidth: 1, borderColor: PRIMARY, height: 40, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  actionBtnOutlineText: { color: PRIMARY, fontWeight: '600' },
});