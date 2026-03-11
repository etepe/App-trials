import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';

interface HourlyData {
  time: string;
  temperature_c: number;
  wind_speed_ms: number;
  wind_speed_80m_ms?: number | null;
  wind_speed_120m_ms?: number | null;
  wind_direction_deg: number;
  wind_gusts_ms?: number | null;
  precipitation_mm: number;
  precipitation_probability_pct?: number | null;
  snowfall_cm?: number | null;
  cloud_cover_pct: number;
  uv_index?: number | null;
  freezing_level_m?: number | null;
  cape?: number | null;
}

interface Props {
  hourly: HourlyData[];
  onClose: () => void;
}

type ChartMode = 'temp' | 'wind' | 'precip' | 'uv';

const CHART_HEIGHT = 80;
const BAR_WIDTH = 42;
const SCREEN_WIDTH = Dimensions.get('window').width;

function formatHour(timeStr: string): string {
  try {
    const parts = timeStr.split('T');
    return parts[1]?.slice(0, 5) ?? timeStr;
  } catch {
    return timeStr;
  }
}

function formatDay(timeStr: string): string {
  try {
    const date = new Date(timeStr);
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    return days[date.getDay()];
  } catch {
    return '';
  }
}

function windArrow(deg: number): string {
  const arrows = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
  return arrows[Math.round(deg / 45) % 8];
}

export default function HourlyForecastChart({ hourly, onClose }: Props) {
  const [mode, setMode] = useState<ChartMode>('temp');

  // Limit to 48 hours
  const data = hourly.slice(0, 48);
  if (data.length === 0) return null;

  const temps = data.map((h) => h.temperature_c);
  const winds = data.map((h) => h.wind_speed_ms * 3.6); // km/h
  const precips = data.map((h) => h.precipitation_mm);
  const uvs = data.map((h) => h.uv_index ?? 0);

  const getValues = () => {
    switch (mode) {
      case 'temp': return temps;
      case 'wind': return winds;
      case 'precip': return precips;
      case 'uv': return uvs;
    }
  };

  const values = getValues();
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const getColor = (value: number, index: number) => {
    switch (mode) {
      case 'temp':
        if (value < 0) return '#64b5f6';
        if (value < 10) return '#7eb8f7';
        if (value < 20) return '#f39c12';
        if (value < 30) return '#e67e22';
        return '#e74c3c';
      case 'wind':
        if (value < 15) return '#2ecc71';
        if (value < 30) return '#f39c12';
        if (value < 50) return '#e67e22';
        return '#e74c3c';
      case 'precip':
        if (value === 0) return '#2a3050';
        if (value < 1) return '#64b5f6';
        if (value < 5) return '#3498db';
        return '#2980b9';
      case 'uv':
        if (value < 3) return '#2ecc71';
        if (value < 6) return '#f39c12';
        if (value < 8) return '#e67e22';
        return '#e74c3c';
    }
  };

  const getUnit = () => {
    switch (mode) {
      case 'temp': return '°C';
      case 'wind': return 'km/h';
      case 'precip': return 'mm';
      case 'uv': return '';
    }
  };

  const getLabel = (h: HourlyData, i: number) => {
    switch (mode) {
      case 'temp': return `${Math.round(h.temperature_c)}°`;
      case 'wind': return `${Math.round(h.wind_speed_ms * 3.6)}`;
      case 'precip': return h.precipitation_mm > 0 ? `${h.precipitation_mm.toFixed(1)}` : '';
      case 'uv': return h.uv_index != null ? `${Math.round(h.uv_index)}` : '';
    }
  };

  // Track day changes for date separators
  let lastDay = '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Saatlik Tahmin</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.closeBtn}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Mode tabs */}
      <View style={styles.tabs}>
        {([
          { key: 'temp' as ChartMode, label: 'Sıcaklık' },
          { key: 'wind' as ChartMode, label: 'Rüzgar' },
          { key: 'precip' as ChartMode, label: 'Yağış' },
          { key: 'uv' as ChartMode, label: 'UV' },
        ]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, mode === tab.key && styles.tabActive]}
            onPress={() => setMode(tab.key)}
          >
            <Text style={[styles.tabText, mode === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
        <View style={styles.chartRow}>
          {data.map((h, i) => {
            const val = values[i];
            const barH = ((val - minVal) / range) * CHART_HEIGHT;
            const color = getColor(val, i);
            const hour = formatHour(h.time);
            const day = formatDay(h.time);
            const showDaySep = day !== lastDay;
            lastDay = day;

            return (
              <View key={i} style={styles.barCol}>
                {showDaySep && <Text style={styles.dayLabel}>{day}</Text>}
                {!showDaySep && <Text style={styles.dayLabel}> </Text>}
                <Text style={styles.barValue}>{getLabel(h, i)}</Text>
                <View style={styles.barContainer}>
                  <View style={[styles.bar, { height: Math.max(barH, 2), backgroundColor: color }]} />
                </View>
                {mode === 'wind' && (
                  <Text style={styles.windArrow}>{windArrow(h.wind_direction_deg)}</Text>
                )}
                <Text style={styles.hourLabel}>{hour}</Text>
                {mode === 'precip' && h.precipitation_probability_pct != null && (
                  <Text style={styles.probLabel}>{h.precipitation_probability_pct}%</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Wind altitude comparison (only in wind mode) */}
      {mode === 'wind' && (
        <View style={styles.windLegend}>
          <Text style={styles.legendTitle}>Rüzgar Profili (şu an)</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2ecc71' }]} />
              <Text style={styles.legendText}>10m: {Math.round((data[0]?.wind_speed_ms ?? 0) * 3.6)} km/h</Text>
            </View>
            {data[0]?.wind_speed_80m_ms != null && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#f39c12' }]} />
                <Text style={styles.legendText}>80m: {Math.round(data[0].wind_speed_80m_ms * 3.6)} km/h</Text>
              </View>
            )}
            {data[0]?.wind_speed_120m_ms != null && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#e74c3c' }]} />
                <Text style={styles.legendText}>120m: {Math.round(data[0].wind_speed_120m_ms * 3.6)} km/h</Text>
              </View>
            )}
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
    padding: 14,
    margin: 10,
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { color: '#e8eaf6', fontWeight: '700', fontSize: 14 },
  closeBtn: { padding: 6, borderRadius: 12, backgroundColor: '#242d45' },
  close: { color: '#6b7a99', fontSize: 16, lineHeight: 18, width: 18, textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#242d45',
  },
  tabActive: {
    backgroundColor: '#2d4a7a',
  },
  tabText: { color: '#6b7a99', fontSize: 11, fontWeight: '600' },
  tabTextActive: { color: '#7eb8f7' },
  chartScroll: {
    maxHeight: CHART_HEIGHT + 80,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 4,
  },
  barCol: {
    width: BAR_WIDTH,
    alignItems: 'center',
  },
  dayLabel: {
    color: '#7eb8f7',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 2,
  },
  barValue: {
    color: '#e8eaf6',
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
    height: 12,
  },
  barContainer: {
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
    width: 20,
  },
  bar: {
    width: 16,
    borderRadius: 3,
    alignSelf: 'center',
  },
  windArrow: {
    color: '#6b7a99',
    fontSize: 12,
    marginTop: 2,
  },
  hourLabel: {
    color: '#4a5568',
    fontSize: 8,
    marginTop: 2,
  },
  probLabel: {
    color: '#64b5f6',
    fontSize: 8,
  },
  windLegend: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a3050',
  },
  legendTitle: {
    color: '#6b7a99',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#8899bb',
    fontSize: 10,
  },
});
