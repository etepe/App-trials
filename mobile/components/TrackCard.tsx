import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Track } from '../services/storage/offlineCache';

interface Props {
  track: Track;
  onPress?: () => void;
  onDelete?: () => void;
  onVisualize?: () => void;
}

export default function TrackCard({ track, onPress, onDelete, onVisualize }: Props) {
  const distKm = track.distanceM ? (track.distanceM / 1000).toFixed(1) : null;
  const durMin = track.durationSec ? Math.round(track.durationSec / 60) : null;
  const maxAlt = track.maxAltM ? `${Math.round(track.maxAltM)}m` : null;
  const durFormatted = durMin ? (durMin >= 60 ? `${Math.floor(durMin / 60)}s ${durMin % 60}dk` : `${durMin} dk`) : null;

  const formatType = (t: string) => t.toUpperCase();
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{formatType(track.fileType)}</Text>
        </View>
        <Text style={styles.date}>{formatDate(track.date)}</Text>
      </View>

      <Text style={styles.name} numberOfLines={1}>{track.name}</Text>

      <View style={styles.stats}>
        {distKm && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{distKm}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
        )}
        {durFormatted && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{durFormatted}</Text>
            <Text style={styles.statLabel}>süre</Text>
          </View>
        )}
        {maxAlt && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{maxAlt}</Text>
            <Text style={styles.statLabel}>maks. irt.</Text>
          </View>
        )}
        <View style={styles.stat}>
          <Text style={styles.statValue}>{track.pointCount}</Text>
          <Text style={styles.statLabel}>nokta</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onVisualize}>
          <Text style={styles.actionText}>3D Görünüm</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={onDelete}>
          <Text style={[styles.actionText, styles.deleteText]}>Sil</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a2035',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    backgroundColor: '#2d4a7a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeText: {
    color: '#7eb8f7',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  date: {
    color: '#6b7a99',
    fontSize: 12,
  },
  name: {
    color: '#e8eaf6',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: '#7eb8f7',
    fontSize: 15,
    fontWeight: '700',
  },
  statLabel: {
    color: '#6b7a99',
    fontSize: 10,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#2d4a7a',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: '#3d1a1a',
  },
  actionText: {
    color: '#7eb8f7',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteText: {
    color: '#e74c3c',
  },
});
