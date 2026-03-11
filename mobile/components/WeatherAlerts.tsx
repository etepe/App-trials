import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface WeatherAlert {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  icon: string;
}

interface AvalancheRisk {
  level: number;
  label: string;
  description: string;
  risk_score: number;
}

interface Props {
  alerts: WeatherAlert[];
  avalancheRisk?: AvalancheRisk | null;
  onClose: () => void;
}

const ICON_MAP: Record<string, string> = {
  thunderstorm: '⛈',
  rain: '🌧',
  wind: '💨',
  snowflake: '❄',
  sun: '☀',
  fog: '🌫',
  snow: '🌨',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#e74c3c',
  warning: '#f39c12',
  info: '#7eb8f7',
};

const AVALANCHE_COLORS: Record<number, string> = {
  1: '#2ecc71',
  2: '#f1c40f',
  3: '#f39c12',
  4: '#e74c3c',
  5: '#c0392b',
};

export default function WeatherAlerts({ alerts, avalancheRisk, onClose }: Props) {
  if (alerts.length === 0 && (!avalancheRisk || avalancheRisk.level <= 1)) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Güvenlik Uyarıları</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.closeBtn}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Alert cards */}
      {alerts.map((alert, i) => (
        <View
          key={i}
          style={[styles.alertCard, { borderLeftColor: SEVERITY_COLORS[alert.severity] }]}
        >
          <View style={styles.alertHeader}>
            <Text style={styles.alertIcon}>{ICON_MAP[alert.icon] ?? '⚠'}</Text>
            <Text style={[styles.alertTitle, { color: SEVERITY_COLORS[alert.severity] }]}>
              {alert.title}
            </Text>
            <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLORS[alert.severity] + '33' }]}>
              <Text style={[styles.severityText, { color: SEVERITY_COLORS[alert.severity] }]}>
                {alert.severity === 'critical' ? 'KRİTİK' : alert.severity === 'warning' ? 'UYARI' : 'BİLGİ'}
              </Text>
            </View>
          </View>
          <Text style={styles.alertMessage}>{alert.message}</Text>
        </View>
      ))}

      {/* Avalanche risk card */}
      {avalancheRisk && avalancheRisk.level >= 2 && (
        <View style={[styles.avalancheCard, { borderLeftColor: AVALANCHE_COLORS[avalancheRisk.level] }]}>
          <View style={styles.avalancheHeader}>
            <Text style={styles.alertIcon}>🏔</Text>
            <Text style={[styles.alertTitle, { color: AVALANCHE_COLORS[avalancheRisk.level] }]}>
              Çığ Riski: {avalancheRisk.label}
            </Text>
          </View>
          <View style={styles.avalancheScale}>
            {[1, 2, 3, 4, 5].map((level) => (
              <View
                key={level}
                style={[
                  styles.scaleBar,
                  {
                    backgroundColor: level <= avalancheRisk.level
                      ? AVALANCHE_COLORS[level]
                      : '#2a3050',
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.avalancheDesc}>{avalancheRisk.description}</Text>
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
    marginBottom: 10,
  },
  title: { color: '#e8eaf6', fontWeight: '700', fontSize: 14 },
  closeBtn: { padding: 6, borderRadius: 12, backgroundColor: '#242d45' },
  close: { color: '#6b7a99', fontSize: 16, lineHeight: 18, width: 18, textAlign: 'center' },
  alertCard: {
    backgroundColor: '#0d1428',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  alertIcon: { fontSize: 16 },
  alertTitle: { fontWeight: '700', fontSize: 13, flex: 1 },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  alertMessage: {
    color: '#8899bb',
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 22,
  },
  avalancheCard: {
    backgroundColor: '#0d1428',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
  },
  avalancheHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  avalancheScale: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 6,
    marginLeft: 22,
  },
  scaleBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  avalancheDesc: {
    color: '#8899bb',
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 22,
  },
});
