import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { VarioData } from '../../shared/types';

interface Props {
  totalDistanceM: number;
  durationSec: number | null;
  totalAscentM: number;
  totalDescentM: number;
  maxAltitudeM: number;
  minAltitudeM: number;
  avgSpeedMs: number | null;
  maxSpeedMs: number;
  varioData?: VarioData;
  onClose?: () => void;
}

function StatItem({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}{unit ? <Text style={styles.statUnit}> {unit}</Text> : null}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function TrackStats({
  totalDistanceM,
  durationSec,
  totalAscentM,
  totalDescentM,
  maxAltitudeM,
  minAltitudeM,
  avgSpeedMs,
  maxSpeedMs,
  varioData,
  onClose,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Track Statistics</Text>
        {onClose && (
          <Text style={styles.close} onPress={onClose}>✕</Text>
        )}
      </View>

      <View style={styles.grid}>
        <StatItem label="Distance" value={(totalDistanceM / 1000).toFixed(1)} unit="km" />
        {durationSec != null && (
          <StatItem label="Duration" value={formatDuration(durationSec)} />
        )}
        <StatItem label="Ascent" value={`+${Math.round(totalAscentM)}`} unit="m" />
        <StatItem label="Descent" value={`-${Math.round(totalDescentM)}`} unit="m" />
        <StatItem label="Max Alt" value={String(Math.round(maxAltitudeM))} unit="m" />
        <StatItem label="Min Alt" value={String(Math.round(minAltitudeM))} unit="m" />
        {avgSpeedMs != null && (
          <StatItem label="Avg Speed" value={(avgSpeedMs * 3.6).toFixed(1)} unit="km/h" />
        )}
        {maxSpeedMs > 0 && (
          <StatItem label="Max Speed" value={(maxSpeedMs * 3.6).toFixed(1)} unit="km/h" />
        )}
      </View>

      {varioData && (
        <View style={styles.varioSection}>
          <Text style={styles.sectionTitle}>Variometer Data</Text>
          <View style={styles.grid}>
            <StatItem label="Max Climb" value={`+${varioData.maxClimbRate.toFixed(1)}`} unit="m/s" />
            <StatItem label="Max Sink" value={varioData.maxSinkRate.toFixed(1)} unit="m/s" />
            <StatItem label="Avg Climb" value={`+${varioData.avgClimbRate.toFixed(1)}`} unit="m/s" />
            {varioData.glideRatio != null && (
              <StatItem label="Glide Ratio" value={`1:${varioData.glideRatio.toFixed(1)}`} />
            )}
            <StatItem label="Thermals" value={String(varioData.thermals.length)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a2035',
    borderRadius: 12,
    margin: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { color: '#e8eaf6', fontWeight: '700', fontSize: 14 },
  close: { color: '#6b7a99', fontSize: 18, paddingHorizontal: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  statItem: {
    width: '23%',
    backgroundColor: '#0d1428',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: { color: '#7eb8f7', fontSize: 14, fontWeight: '700' },
  statUnit: { color: '#6b7a99', fontSize: 10, fontWeight: '400' },
  statLabel: { color: '#6b7a99', fontSize: 9, marginTop: 2, textAlign: 'center' },
  varioSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#2a3050',
  },
  sectionTitle: {
    color: '#6b7a99',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
});
