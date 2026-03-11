import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';

interface ProfilePoint {
  distanceM: number;
  altitudeM: number;
}

interface Props {
  profile: ProfilePoint[];
  highlightIndex?: number;
  onPointSelect?: (index: number) => void;
  totalAscentM?: number;
  totalDescentM?: number;
  style?: object;
}

/**
 * Elevation profile chart rendered using View elements (no SVG dependency).
 * Works on both web and mobile.
 */
export default function ElevationProfile({
  profile,
  highlightIndex,
  totalAscentM,
  totalDescentM,
  style,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 40; // padding
  const chartHeight = 120;

  const { minAlt, maxAlt, maxDist, normalizedPoints } = useMemo(() => {
    if (profile.length === 0) {
      return { minAlt: 0, maxAlt: 0, maxDist: 0, normalizedPoints: [] };
    }

    const alts = profile.map((p) => p.altitudeM);
    const min = Math.min(...alts);
    const max = Math.max(...alts);
    const dist = profile[profile.length - 1].distanceM;
    const altRange = max - min || 1;

    const points = profile.map((p) => ({
      x: dist > 0 ? (p.distanceM / dist) * chartWidth : 0,
      y: chartHeight - ((p.altitudeM - min) / altRange) * chartHeight,
      alt: p.altitudeM,
      dist: p.distanceM,
    }));

    return { minAlt: min, maxAlt: max, maxDist: dist, normalizedPoints: points };
  }, [profile, chartWidth, chartHeight]);

  if (profile.length < 2) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.noData}>No elevation data available</Text>
      </View>
    );
  }

  const formatDist = (m: number) => {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${Math.round(m)} m`;
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Elevation Profile</Text>
        <View style={styles.statsRow}>
          <Text style={styles.stat}>
            ↑ {totalAscentM != null ? Math.round(totalAscentM) : '—'}m
          </Text>
          <Text style={styles.stat}>
            ↓ {totalDescentM != null ? Math.round(totalDescentM) : '—'}m
          </Text>
          <Text style={styles.stat}>
            Max {Math.round(maxAlt)}m
          </Text>
          <Text style={styles.stat}>
            Min {Math.round(minAlt)}m
          </Text>
        </View>
      </View>

      {/* Chart area */}
      <View style={[styles.chart, { width: chartWidth, height: chartHeight }]}>
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <View
            key={t}
            style={[
              styles.gridLine,
              { top: t * chartHeight, width: chartWidth },
            ]}
          />
        ))}

        {/* Profile bars (simplified — render as vertical bars for each segment) */}
        {normalizedPoints.map((pt, i) => {
          if (i >= normalizedPoints.length - 1) return null;
          const next = normalizedPoints[i + 1];
          const barWidth = Math.max(1, next.x - pt.x);
          const barHeight = chartHeight - pt.y;
          const isHighlighted = highlightIndex === i;

          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: pt.x,
                top: pt.y,
                width: barWidth,
                height: barHeight,
                backgroundColor: isHighlighted ? '#7eb8f7' : '#2d4a7a',
                opacity: isHighlighted ? 1 : 0.6,
              }}
            />
          );
        })}

        {/* Profile line (dots at key points) */}
        {normalizedPoints.filter((_, i) => i % Math.max(1, Math.floor(normalizedPoints.length / 40)) === 0).map((pt, i) => (
          <View
            key={`dot-${i}`}
            style={{
              position: 'absolute',
              left: pt.x - 1,
              top: pt.y - 1,
              width: 2,
              height: 2,
              borderRadius: 1,
              backgroundColor: '#7eb8f7',
            }}
          />
        ))}
      </View>

      {/* X-axis labels */}
      <View style={[styles.xAxis, { width: chartWidth }]}>
        <Text style={styles.axisLabel}>0</Text>
        <Text style={styles.axisLabel}>{formatDist(maxDist / 2)}</Text>
        <Text style={styles.axisLabel}>{formatDist(maxDist)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a2035',
    borderRadius: 12,
    margin: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  noData: { color: '#6b7a99', textAlign: 'center', padding: 20 },
  header: { marginBottom: 8 },
  title: { color: '#e8eaf6', fontWeight: '700', fontSize: 13, marginBottom: 4 },
  statsRow: { flexDirection: 'row', gap: 12 },
  stat: { color: '#7eb8f7', fontSize: 11, fontWeight: '600' },
  chart: {
    backgroundColor: '#0d1428',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#1a2035',
    left: 0,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  axisLabel: { color: '#4a5568', fontSize: 10 },
});
