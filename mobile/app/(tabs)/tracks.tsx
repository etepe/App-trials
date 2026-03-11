import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';

import TrackCard from '../../components/TrackCard';
import { listTracks, saveTrack, deleteTrack, Track } from '../../services/storage/offlineCache';
import { parseGpx } from '../../services/parsers/gpxParser';
import { parseFit } from '../../services/parsers/fitParser';
import { parseIgc } from '../../services/parsers/igcParser';
import { parseKml, parseKmz } from '../../services/parsers/kmlParser';

export default function TracksScreen() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const loadTracks = useCallback(async () => {
    const stored = await listTracks();
    setTracks(stored);
    setLoading(false);
  }, []);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const ext = asset.name.split('.').pop()?.toLowerCase() ?? '';
      const uri = asset.uri;

      let parsed: Awaited<ReturnType<typeof parseGpx>> | null = null;

      if (ext === 'gpx') {
        const content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
        parsed = await parseGpx(content);
      } else if (ext === 'fit') {
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const buffer = _b64ToArrayBuffer(b64);
        parsed = await parseFit(buffer);
      } else if (ext === 'igc') {
        const content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
        parsed = await parseIgc(content);
      } else if (ext === 'kml') {
        const content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
        parsed = await parseKml(content);
      } else if (ext === 'kmz') {
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const buffer = _b64ToArrayBuffer(b64);
        parsed = await parseKmz(buffer);
      } else {
        Alert.alert('Unsupported format', `Files with .${ext} extension are not supported.\nSupported: GPX, FIT, IGC, KML, KMZ`);
        return;
      }

      if (!parsed) return;

      await saveTrack(parsed);
      await loadTracks();
      Alert.alert('Track imported', `"${parsed.name}" added to your library.`);
    } catch (e) {
      Alert.alert('Import failed', String(e));
    } finally {
      setImporting(false);
    }
  }, [loadTracks]);

  const handleDelete = useCallback(async (trackId: string) => {
    Alert.alert('Delete track', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTrack(trackId);
          await loadTracks();
        },
      },
    ]);
  }, [loadTracks]);

  const handleVisualize = useCallback((track: Track) => {
    // Navigate to globe tab and pass track id via params
    router.push({ pathname: '/(tabs)/globe', params: { trackId: track.id } });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7eb8f7" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Tracks</Text>
        <TouchableOpacity style={styles.importBtn} onPress={handleImport} disabled={importing}>
          {importing ? (
            <ActivityIndicator color="#7eb8f7" size="small" />
          ) : (
            <Text style={styles.importBtnText}>+ Import</Text>
          )}
        </TouchableOpacity>
      </View>

      {tracks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No tracks yet</Text>
          <Text style={styles.emptyDesc}>
            Import a GPX, FIT, IGC, or KML/KMZ file to visualize it on the 3D globe.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={handleImport}>
            <Text style={styles.emptyBtnText}>Import Track</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TrackCard
              track={item}
              onDelete={() => handleDelete(item.id)}
              onVisualize={() => handleVisualize(item)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function _b64ToArrayBuffer(b64: string): ArrayBuffer {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a2035',
  },
  headerTitle: { color: '#e8eaf6', fontSize: 18, fontWeight: '700' },
  importBtn: {
    backgroundColor: '#2d4a7a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  importBtnText: { color: '#7eb8f7', fontWeight: '700', fontSize: 14 },
  list: { padding: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { color: '#e8eaf6', fontSize: 20, fontWeight: '700' },
  emptyDesc: { color: '#6b7a99', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: '#2d4a7a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  emptyBtnText: { color: '#7eb8f7', fontWeight: '700', fontSize: 15 },
});
