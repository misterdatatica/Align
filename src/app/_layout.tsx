import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { prepararBaseDeDados } from '@/db/preparar';
import { configurarLembretes, useAbrirRevisaoPeloLembrete } from '@/lembrete';
import { cores } from '@/theme';

SplashScreen.preventAutoHideAsync();
configurarLembretes();

/** Só existe depois de a navegação estar montada, para o toque no lembrete ter para onde ir. */
function AbrirRevisaoPeloLembrete() {
  useAbrirRevisaoPeloLembrete();
  return null;
}

/** Abre a base de dados e aplica as migrações antes de mostrar qualquer ecrã. */
function useBaseDeDados() {
  const [estado, setEstado] = useState<{ pronta: boolean; erro: Error | null }>({ pronta: false, erro: null });
  useEffect(() => {
    let ativo = true;
    prepararBaseDeDados().then(
      () => {
        if (ativo) setEstado({ pronta: true, erro: null });
      },
      (erro: unknown) => {
        if (ativo) setEstado({ pronta: false, erro: erro instanceof Error ? erro : new Error(String(erro)) });
      },
    );
    return () => {
      ativo = false;
    };
  }, []);
  return estado;
}

export default function RootLayout() {
  const [fontesProntas] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
  });
  const { pronta: bdPronta, erro: erroBd } = useBaseDeDados();
  const pronto = fontesProntas && (bdPronta || !!erroBd);

  useEffect(() => {
    if (pronto) SplashScreen.hideAsync();
  }, [pronto]);

  if (!pronto) return null;

  if (erroBd) {
    // A causa (o erro original do SQLite) ajuda a perceber o que falhou.
    const causa = erroBd.cause instanceof Error ? erroBd.cause.message : null;
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 8, backgroundColor: cores.fundo }}>
        <Text style={{ fontSize: 17, fontWeight: '600', color: cores.tinta }}>Não foi possível preparar a base de dados.</Text>
        <Text style={{ fontSize: 14, color: cores.texto2 }}>Feche a app e volte a abrir. Se continuar, os seus dados não foram apagados.</Text>
        <Text style={{ fontSize: 12, color: cores.texto3 }}>{causa ? `${erroBd.message} (${causa})` : erroBd.message}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AbrirRevisaoPeloLembrete />
      <Stack screenOptions={{ contentStyle: { backgroundColor: cores.fundo }, headerShadowVisible: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="area/[id]" options={{ title: '', headerBackTitle: 'Áreas', headerStyle: { backgroundColor: cores.fundo } }} />
        <Stack.Screen name="area/nova" options={{ title: 'Nova área', presentation: 'modal' }} />
        <Stack.Screen name="meta/nova" options={{ title: 'Nova meta', presentation: 'modal' }} />
        <Stack.Screen name="meta/[id]" options={{ title: '', headerBackTitle: 'Área', headerStyle: { backgroundColor: cores.fundo } }} />
        <Stack.Screen name="tarefa/nova" options={{ title: 'Nova tarefa', presentation: 'modal' }} />
        <Stack.Screen name="tarefa/[id]" options={{ title: 'Alterar tarefa', presentation: 'modal' }} />
        <Stack.Screen name="boas-vindas" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="definicoes" options={{ title: 'Definições', headerBackTitle: 'Áreas', headerStyle: { backgroundColor: cores.fundo } }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
