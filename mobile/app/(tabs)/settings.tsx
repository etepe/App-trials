import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  CESIUM_TOKEN: '@settings/cesiumToken',
  API_URL: '@settings/apiUrl',
  UNITS_METRIC: '@settings/unitsMetric',
  THERMAL_ALERTS: '@settings/thermalAlerts',
};

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowControl}>{children}</View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const [cesiumToken, setCesiumToken] = useState('');
  const [apiUrl, setApiUrl] = useState('http://localhost:8000');
  const [unitsMetric, setUnitsMetric] = useState(true);
  const [thermalAlerts, setThermalAlerts] = useState(false);
  const [saved, setSaved] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    (async () => {
      const [token, url, units, thermals] = await Promise.all([
        AsyncStorage.getItem(KEYS.CESIUM_TOKEN),
        AsyncStorage.getItem(KEYS.API_URL),
        AsyncStorage.getItem(KEYS.UNITS_METRIC),
        AsyncStorage.getItem(KEYS.THERMAL_ALERTS),
      ]);
      if (token) setCesiumToken(token);
      if (url) setApiUrl(url);
      if (units !== null) setUnitsMetric(units === 'true');
      if (thermals !== null) setThermalAlerts(thermals === 'true');
    })();
  }, []);

  const handleSave = async () => {
    await Promise.all([
      AsyncStorage.setItem(KEYS.CESIUM_TOKEN, cesiumToken),
      AsyncStorage.setItem(KEYS.API_URL, apiUrl),
      AsyncStorage.setItem(KEYS.UNITS_METRIC, String(unitsMetric)),
      AsyncStorage.setItem(KEYS.THERMAL_ALERTS, String(thermalAlerts)),
    ]);
    setSaved(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setSaved(false));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="API ve Servisler">
        <SettingRow label="Cesium Ion Token">
          <TextInput
            style={styles.input}
            value={cesiumToken}
            onChangeText={setCesiumToken}
            placeholder="eyJ…"
            placeholderTextColor="#4a5568"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </SettingRow>
        <SettingRow label="Sunucu URL">
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="http://localhost:8000"
            placeholderTextColor="#4a5568"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </SettingRow>
      </Section>

      <Section title="Birimler ve Görünüm">
        <SettingRow label="Metrik birimler (m, km)">
          <Switch
            value={unitsMetric}
            onValueChange={setUnitsMetric}
            trackColor={{ false: '#2a3050', true: '#2d4a7a' }}
            thumbColor={unitsMetric ? '#7eb8f7' : '#4a5568'}
          />
        </SettingRow>
      </Section>

      <Section title="Yamaç Paraşütü">
        <SettingRow label="Termik durum uyarıları">
          <Switch
            value={thermalAlerts}
            onValueChange={setThermalAlerts}
            trackColor={{ false: '#2a3050', true: '#2d4a7a' }}
            thumbColor={thermalAlerts ? '#7eb8f7' : '#4a5568'}
          />
        </SettingRow>
      </Section>

      <Section title="Hakkında">
        <View style={styles.aboutBox}>
          <Text style={styles.aboutTitle}>Mountain Explorer</Text>
          <Text style={styles.aboutVersion}>Sürüm 1.0.0</Text>
          <Text style={styles.aboutDesc}>
            Doğa sporcuları için 3D arazi gezgini. Dağ yüzlerini görselleştirin, eğim ve bakı analizi yapın, GPS rotalarınızı görüntüleyin.
          </Text>
          <View style={styles.aboutLinks}>
            <Text style={styles.aboutLink}>Veri: Cesium Ion · OpenTopography · Open-Meteo · OSM</Text>
          </View>
        </View>
      </Section>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Ayarları Kaydet</Text>
      </TouchableOpacity>

      {saved && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>✓ Ayarlar kaydedildi</Text>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: '#7eb8f7',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionBody: {
    backgroundColor: '#1a2035',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a3050',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#242d45',
  },
  rowLabel: { color: '#e8eaf6', fontSize: 14, flex: 1 },
  rowControl: { flex: 1, alignItems: 'flex-end' },
  input: {
    color: '#e8eaf6',
    backgroundColor: '#0d1428',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    width: 180,
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  aboutBox: { padding: 16, gap: 4 },
  aboutTitle: { color: '#e8eaf6', fontSize: 16, fontWeight: '700' },
  aboutVersion: { color: '#6b7a99', fontSize: 12 },
  aboutDesc: { color: '#8899bb', fontSize: 13, lineHeight: 19, marginTop: 6 },
  aboutLinks: { marginTop: 8 },
  aboutLink: { color: '#4a5568', fontSize: 11 },
  saveBtn: {
    backgroundColor: '#2d4a7a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#7eb8f7', fontSize: 15, fontWeight: '700' },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 40,
    right: 40,
    backgroundColor: '#2ecc71',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
