import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';

function TabIcon({ label, active }: { label: string; active: boolean }) {
  const icons: Record<string, string> = {
    globe: '🌍',
    tracks: '📍',
    settings: '⚙',
  };
  return (
    <View style={iconStyles.container}>
      <Text style={[iconStyles.icon, active && iconStyles.iconActive]}>
        {icons[label] || '●'}
      </Text>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  container: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 18, opacity: 0.5 },
  iconActive: { opacity: 1 },
});

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isWideScreen = Platform.OS === 'web' && width >= 768;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#0d1428',
          borderTopColor: '#1a2035',
          borderTopWidth: 1,
          height: isWideScreen ? 70 : 60,
          paddingBottom: isWideScreen ? 12 : 8,
          ...(isWideScreen ? { paddingHorizontal: 40 } : {}),
        },
        tabBarActiveTintColor: '#7eb8f7',
        tabBarInactiveTintColor: '#4a5568',
        tabBarLabelStyle: {
          fontSize: isWideScreen ? 13 : 11,
          fontWeight: '600',
        },
        headerStyle: { backgroundColor: '#0a0f1e' },
        headerTintColor: '#e8eaf6',
        headerTitleStyle: { fontWeight: '700' },
        ...(isWideScreen ? { headerShown: false } : {}),
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
