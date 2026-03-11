import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { TouchableOpacity } from 'react-native';

interface ElevationPoint {
  distance_m: number;
  elevation_m: number;
}

interface Props {
  profile: ElevationPoint[];
  onClose: () => void;
}

const CHART_WIDTH = Dimensions.get('window').width - 56;
const CHART_HEIGHT = 120;

export default function ElevationProfile({ profile, onClose }: Props) {
  if (!profile || profile.length < 2) return null;

  const elevations = profile.map((p) => p.elevation_m);
  const distances = profile.map((p) => p.distance_m);

  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const maxDist = Math.max(...distances);
  const elevRange = maxElev - minElev || 1;

  // Generate SVG-like path using simple bars
  const barWidth = CHART_WIDTH / profile.length;
  const totalGain = profile.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const diff = p.elevation_m - profile[i - 1].elevation_m;
    return acc + (diff > 0 ? diff : 0);
  }, 0);
  const totalLoss = profile.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const diff = p.elevation_m - profile[i - 1].elevation_m;
    return acc + (diff < 0 ? Math.abs(diff) : 0);
  }, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Yükseklik Profili</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.closeBtn}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Chart area */}
      <View style={styles.chart}>
        <View style={styles.bars}>
          {profile.map((point, i) => {
            const height = ((point.elevation_m - minElev) / elevRange) * CHART_HEIGHT;
            const color = point.elevation_m > (minElev + elevRange * 0.7)
              ? '#e74c3c'
              : point.elevation_m > (minElev + elevRange * 0.4)
                ? '#f39c12'
                : '#2ecc71';
            return (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    width: Math.max(barWidth - 0.5, 1),
                    height: Math.max(height, 1),
                    backgroundColor: color,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          <Text style={styles.axisLabel}>{Math.round(maxElev)}m</Text>
          <Text style={styles.axisLabel}>{Math.round(minElev + elevRange / 2)}m</Text>
          <Text style={styles.axisLabel}>{Math.round(minElev)}m</Text>
        </View>
      </View>

      {/* X-axis */}
      <View style={styles.xAxis}>
        <Text style={styles.axisLabel}>0 km</Text>
        <Text style={styles.axisLabel}>{(maxDist / 1000).toFixed(1)} km</Text>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(minElev)}m</Text>
          <Text style={styles.statLabel}>Min</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(maxElev)}m</Text>
          <Text style={styles.statLabel}>Maks</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: '#2ecc71' }]}>+{Math.round(totalGain)}m</Text>
          <Text style={styles.statLabel}>Tırmanış</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: '#e74c3c' }]}>-{Math.round(totalLoss)}m</Text>
          <Text style={styles.statLabel}>İniş</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a2035',
    borderRadius: 12,
    padding: 14,
    margin: 10,
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
  closeBtn: { padding: 6, borderRadius: 12, backgroundColor: '#242d45' },
  close: { color: '#6b7a99', fontSize: 16, lineHeight: 18, width: 18, textAlign: 'center' },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT + 10,
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#2a3050',
  },
  bar: {
    borderRadius: 1,
  },
  yAxis: {
    width: 42,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingLeft: 4,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginRight: 42,
  },
  axisLabel: { color: '#4a5568', fontSize: 9 },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#2a3050',
  },
  stat: { alignItems: 'center' },
  statValue: { color: '#7eb8f7', fontSize: 14, fontWeight: '700' },
  statLabel: { color: '#6b7a99', fontSize: 10, marginTop: 2 },
});
