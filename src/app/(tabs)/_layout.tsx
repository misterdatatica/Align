import { Tabs } from 'expo-router/js-tabs';
import { View, type ColorValue } from 'react-native';

import { Icone, type NomeIcone } from '@/components/Icone';
import { cores, fontes } from '@/theme';

function iconeTab(nome: NomeIcone) {
  return function IconeTab({ focused, color }: { focused: boolean; color: ColorValue }) {
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.tinta,
        tabBarInactiveTintColor: cores.texto3,
        tabBarLabelStyle: { fontFamily: fontes.textoForte, fontSize: 11 },
        tabBarStyle: { backgroundColor: cores.superficie, borderTopColor: cores.linha },
        sceneStyle: { backgroundColor: cores.fundo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Áreas', tabBarIcon: iconeTab('grelha') }} />
      <Tabs.Screen name="semana" options={{ title: 'Semana', tabBarIcon: iconeTab('lista') }} />
      <Tabs.Screen name="calendario" options={{ title: 'Calendário', tabBarIcon: iconeTab('calendario') }} />
      <Tabs.Screen name="revisao" options={{ title: 'Revisão', tabBarIcon: iconeTab('grafico') }} />
    </Tabs>
  );
}
