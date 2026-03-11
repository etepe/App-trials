import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
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
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="API & Services">
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
        <SettingRow label="Backend URL">
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

      <Section title="Units & Display">
        <SettingRow label="Metric units (m, km)">
          <Switch
            value={unitsMetric}
            onValueChange={setUnitsMetric}
            trackColor={{ false: '#2a3050', true: '#2d4a7a' }}
            thumbColor={unitsMetric ? '#7eb8f7' : '#4a5568'}
          />
        </SettingRow>
      </Section>

      <Section title="Paragliding / Hang-gliding">
        <SettingRow label="Thermal condition alerts">
          <Switch
            value={thermalAlerts}
            onValueChange={setThermalAlerts}
            trackColor={{ false: '#2a3050', true: '#2d4a7a' }}
            thumbColor={thermalAlerts ? '#7eb8f7' : '#4a5568'}
          />
        </SettingRow>
      </Section>

      <Section title="About">
        <View style={styles.aboutBox}>
          <Text style={styles.aboutTitle}>Mountain Explorer</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          <Text style={styles.aboutDesc}>
            3D terrain explorer for outdoor athletes. Visualize mountain faces, analyze slope and aspect, and overlay your GPS tracks.
          </Text>
          <View style={styles.aboutLinks}>
            <Text style={styles.aboutLink}>Data: Cesium Ion · OpenTopography · Open-Meteo · OSM</Text>
          </View>
        </View>
      </Section>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>{saved ? 'Saved!' : 'Save Settings'}</Text>
      </TouchableOpacity>
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
});
