import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getMountain, Mountain } from '../../services/api';

export default function MountainDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mountain, setMountain] = useState<Mountain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getMountain(id)
      .then(setMountain)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7eb8f7" size="large" />
      </View>
    );
  }

  if (error || !mountain) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Dağ bulunamadı'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroName}>{mountain.name}</Text>
        {mountain.elevation && (
          <Text style={styles.heroElevation}>{Math.round(mountain.elevation)}m</Text>
        )}
        <Text style={styles.heroType}>{mountain.type}</Text>
      </View>

      {/* Coordinates */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Konum</Text>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Enlem</Text>
          <Text style={styles.cardValue}>{mountain.lat.toFixed(6)}°</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Boylam</Text>
          <Text style={styles.cardValue}>{mountain.lon.toFixed(6)}°</Text>
        </View>
        {mountain.elevation && (
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Yükseklik</Text>
            <Text style={styles.cardValue}>{Math.round(mountain.elevation)}m / {Math.round(mountain.elevation * 3.28084)}ft</Text>
          </View>
        )}
      </View>

      {/* OSM tags */}
      {mountain.tags && Object.keys(mountain.tags).length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>OSM Etiketleri</Text>
          {Object.entries(mountain.tags).map(([k, v]) => (
            <View key={k} style={styles.cardRow}>
              <Text style={styles.cardLabel}>{k}</Text>
              <Text style={styles.cardValue} numberOfLines={2}>{v}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => {
          router.push({
            pathname: '/(tabs)/globe',
            params: { flyLat: mountain.lat, flyLon: mountain.lon, flyAlt: (mountain.elevation ?? 1000) + 3000 },
          });
        }}
      >
        <Text style={styles.actionBtnText}>3D Kürede Görüntüle</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { color: '#e74c3c', fontSize: 15 },
  backBtn: { backgroundColor: '#2d4a7a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  backBtnText: { color: '#7eb8f7', fontWeight: '700' },
  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  heroName: { color: '#e8eaf6', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  heroElevation: { color: '#7eb8f7', fontSize: 22, fontWeight: '700' },
  heroType: { color: '#6b7a99', fontSize: 13, textTransform: 'capitalize' },
  card: {
    backgroundColor: '#1a2035',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a3050',
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardTitle: {
    color: '#7eb8f7',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3050',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#242d45',
  },
  cardLabel: { color: '#6b7a99', fontSize: 13 },
  cardValue: { color: '#e8eaf6', fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  actionBtn: {
    backgroundColor: '#2d4a7a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  actionBtnText: { color: '#7eb8f7', fontSize: 15, fontWeight: '700' },
});
