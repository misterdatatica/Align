import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { db } from '@/db/client';
import { cores } from '@/theme';
import migrations from '../../drizzle/migrations';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontesProntas] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
  });
  const { success: bdPronta, error: erroBd } = useMigrations(db, migrations);
  const pronto = fontesProntas && (bdPronta || !!erroBd);

  useEffect(() => {
    if (pronto) SplashScreen.hideAsync();
  }, [pronto]);

  if (!pronto) return null;

  if (erroBd) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text>Não foi possível preparar a base de dados: {erroBd.message}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: cores.fundo }, headerShadowVisible: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="area/[id]" options={{ title: '', headerBackTitle: 'Áreas', headerStyle: { backgroundColor: cores.fundo } }} />
        <Stack.Screen name="area/nova" options={{ title: 'Nova área', presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
