import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { useAuthStore, Role } from '../../store/authStore';

export default function RoleSelectScreen() {
  const { t } = useTranslation();
  const { updateRole } = useAuthStore();
  const router = useRouter();

  const [role, setRole] = useState<Role>('Owner');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);
    try {
      await updateRole(role);
      router.replace('/(tabs)');
    } catch {
      Alert.alert(t('errors.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.appName}>{t('appName')}</Text>
      <Text style={styles.title}>{t('roleSelect.title')}</Text>
      <Text style={styles.subtitle}>{t('roleSelect.subtitle')}</Text>

      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleOption, role === 'Owner' && styles.toggleActive]}
          onPress={() => setRole('Owner')}
        >
          <Text style={[styles.toggleText, role === 'Owner' && styles.toggleTextActive]}>
            {t('register.owner')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleOption, role === 'Breeder' && styles.toggleActive]}
          onPress={() => setRole('Breeder')}
        >
          <Text style={[styles.toggleText, role === 'Breeder' && styles.toggleTextActive]}>
            {t('register.breeder')}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.buttonText}>{t('roleSelect.button')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    marginBottom: 40,
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    overflow: 'hidden',
    marginBottom: 32,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#1A1A2E',
    fontSize: 16,
    fontWeight: '700',
  },
});
