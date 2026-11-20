import { Tabs } from 'expo-router/js-tabs';
import { View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icone, type NomeIcone } from '@/components/Icone';
import { fontes, useTema } from '@/theme';
import { t } from '@/i18n';

function iconeTab(nome: NomeIcone) {
  return function IconeTab({ focused, color }: { focused: boolean; color: ColorValue }) {
    const { cores } = useTema();
    return (
      <View
        style={{
          width: 52,
          height: 28,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? cores.ativoTab : 'transparent',
        }}
      >
        <Icone nome={nome} tamanho={22} cor={String(color)} />
      </View>
    );
  };
}

export default function TabsLayout() {
  const { cores } = useTema();
  // Cada separador precisa de 56 px: 5 de margem interna, 28 do ícone, 4 de intervalo, 14 da etiqueta e mais 5.
  // Com 3 px por cima e por baixo fica com os 8 px do design; em telemóveis com barra de gestos usa-se a margem do sistema.
  const margemInferior = Math.max(useSafeAreaInsets().bottom, 3);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.tinta,
        tabBarInactiveTintColor: cores.texto3,
        tabBarLabelStyle: { fontFamily: fontes.textoForte, fontSize: 11, lineHeight: 14, marginTop: 4 },
        tabBarIconStyle: { width: 52, height: 28 },
        tabBarStyle: {
          backgroundColor: cores.superficie,
          borderTopColor: cores.linha,
          height: 1 + 3 + 56 + margemInferior,
          paddingTop: 3,
          paddingBottom: margemInferior,
        },
        sceneStyle: { backgroundColor: cores.fundo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('Hoje'), tabBarIcon: iconeTab('sol') }} />
      <Tabs.Screen name="areas" options={{ title: t('Áreas'), tabBarIcon: iconeTab('grelha') }} />
      <Tabs.Screen name="semana" options={{ title: t('Semana'), tabBarIcon: iconeTab('lista') }} />
      <Tabs.Screen name="calendario" options={{ title: t('Calendário'), tabBarIcon: iconeTab('calendario') }} />
      <Tabs.Screen name="revisao" options={{ title: t('Revisão'), tabBarIcon: iconeTab('grafico') }} />
    </Tabs>
  );
}
