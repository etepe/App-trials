import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

const TAB_ICONS: Record<string, string> = {
  globe: '🌍',
  tracks: '📍',
  settings: '⚙️',
};

function TabIcon({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.iconText, active && styles.iconTextActive]}>
        {TAB_ICONS[label] ?? '●'}
      </Text>
      {active && <View style={styles.activeIndicator} />}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#0d1428',
          borderTopColor: '#1a2035',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 4,
        },
        tabBarActiveTintColor: '#7eb8f7',
        tabBarInactiveTintColor: '#4a5568',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#0a0f1e' },
        headerTintColor: '#e8eaf6',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="globe"
        options={{
          title: 'Küre',
          headerTitle: 'Mountain Explorer',
          tabBarIcon: ({ focused }) => <TabIcon label="globe" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="tracks"
        options={{
          title: 'Rotalar',
          tabBarIcon: ({ focused }) => <TabIcon label="tracks" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ focused }) => <TabIcon label="settings" active={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18, opacity: 0.5 },
  iconTextActive: { opacity: 1 },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#7eb8f7',
  },
});
