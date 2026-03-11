import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';

function TabIcon({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.dot, active && styles.dotActive]} />
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
          height: 60,
          paddingBottom: 8,
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
          title: 'Globe',
          headerTitle: 'Mountain Explorer',
          tabBarIcon: ({ focused }) => <TabIcon label="globe" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="tracks"
        options={{
          title: 'Tracks',
          tabBarIcon: ({ focused }) => <TabIcon label="tracks" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon label="settings" active={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4a5568' },
  dotActive: { backgroundColor: '#7eb8f7' },
});
