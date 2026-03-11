import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0f1e' },
          headerTintColor: '#e8eaf6',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0a0f1e' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="mountain/[id]"
          options={{ title: 'Dağ Detayı', presentation: 'card' }}
        />
      </Stack>
    </>
  );
}
