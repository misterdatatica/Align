import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import { DarkTheme, DefaultTheme, router, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { useLocales } from 'expo-localization';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Appearance, Platform, Pressable, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AvisoTemporario } from '@/components/AvisoTemporario';
import { useConsulta } from '@/data/consulta';
import { carregarDefinicoes, type PreferenciaDeTema } from '@/data/definicoes';
import { prepararBaseDeDados } from '@/db/preparar';
import { deveReabrirDefinicoes } from '@/estado/reabrir';
import { definirIdioma, escolherIdioma, t, type Idioma } from '@/i18n';
import { configurarLembretes, useAbrirRevisaoPeloLembrete } from '@/lembrete';
import { ContextoDoTema, TEMAS, type Esquema } from '@/theme';

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

/**
 * Só no navegador: ao recarregar a página depressa, a página anterior ainda pode ter a base de dados
 * presa, e tentar outra vez na mesma página não resolve (o worker do SQLite fica num estado inválido).
 * Recarregar a página resolve. Faz-se sozinho até 3 vezes seguidas; o contador vive na sessão do
 * separador e volta a zero quando a base de dados abre.
 */
const TENTATIVAS_NO_NAVEGADOR = 3;
const CHAVE_TENTATIVAS = 'align-tentativas-de-abrir';

function lerTentativas(): number {
  try {
    return Number(window.sessionStorage.getItem(CHAVE_TENTATIVAS) ?? 0) || 0;
  } catch {
    return TENTATIVAS_NO_NAVEGADOR;
  }
}

function guardarTentativas(n: number) {
  try {
    if (n === 0) window.sessionStorage.removeItem(CHAVE_TENTATIVAS);
    else window.sessionStorage.setItem(CHAVE_TENTATIVAS, String(n));
  } catch {
    // Sem armazenamento (navegação privada): mostra-se o erro, com "Tentar outra vez".
  }
}

/** O erro é o do ficheiro preso pela página anterior (só acontece no navegador). */
function basePresaNoNavegador(erro: Error | null): boolean {
  if (Platform.OS !== 'web' || !erro) return false;
  const causa = erro.cause instanceof Error ? erro.cause.message : '';
  return /Access Handle|createSyncAccessHandle|Invalid VFS state/i.test(`${erro.message} ${causa}`);
}

/** O esquema que o telemóvel (ou o navegador) está a usar. */
function useEsquemaDoSistema(): Esquema {
  return useColorScheme() === 'dark' ? 'escuro' : 'claro';
}

/**
 * Aplica a preferência de aparência aos componentes do sistema (alertas, teclado, seletores). No
 * telemóvel, "Claro" ou "Escuro" sobrepõem-se ao do sistema; "Automático" volta a segui-lo.
 */
function aplicarAoSistema(preferencia: PreferenciaDeTema) {
  if (Platform.OS === 'web') return;
  Appearance.setColorScheme(preferencia === 'claro' ? 'light' : preferencia === 'escuro' ? 'dark' : 'unspecified');
}

export default function RootLayout() {
  const esquemaDoSistema = useEsquemaDoSistema();
  // Português para quem tem o telemóvel em português; inglês para todos os outros (a não ser que se
  // escolha outro nas Definições: ver AppComTema).
  const idiomaDoSistema = escolherIdioma(useLocales().map((l) => l.languageTag));
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

  // No navegador, uma base de dados presa pela página anterior resolve-se a recarregar (ver acima).
  const recarregarSozinho = basePresaNoNavegador(erroBd) && lerTentativas() < TENTATIVAS_NO_NAVEGADOR;
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (bdPronta) {
      guardarTentativas(0);
      return;
    }
    if (!recarregarSozinho) return;
    guardarTentativas(lerTentativas() + 1);
    const temporizador = setTimeout(() => window.location.reload(), 700);
    return () => clearTimeout(temporizador);
  }, [bdPronta, recarregarSozinho]);

  if (!pronto || recarregarSozinho) return null;

  if (erroBd) {
    // A causa (o erro original do SQLite) ajuda a perceber o que falhou.
    const causa = erroBd.cause instanceof Error ? erroBd.cause.message : null;
    const { cores } = TEMAS[esquemaDoSistema];
    definirIdioma(idiomaDoSistema);
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 8, backgroundColor: cores.fundo }}>
        <Text style={{ fontSize: 17, fontWeight: '600', color: cores.tinta }}>{t('Não foi possível preparar a base de dados.')}</Text>
        <Text style={{ fontSize: 14, color: cores.texto2 }}>{t('Feche a app e volte a abrir. Se continuar, os seus dados não foram apagados.')}</Text>
        <Text style={{ fontSize: 12, color: cores.texto3 }}>{causa ? `${erroBd.message} (${causa})` : erroBd.message}</Text>
        {Platform.OS === 'web' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              guardarTentativas(0);
              window.location.reload();
            }}
            style={{ alignSelf: 'flex-start', marginTop: 8, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, backgroundColor: cores.tinta }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: cores.sobreTinta }}>{t('Tentar outra vez')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return <AppComTema idiomaDoSistema={idiomaDoSistema} />;
}

/** Depois de mudar o idioma nas Definições, a app volta a desenhar-se e reabre as Definições. */
function ReabrirDefinicoes() {
  useEffect(() => {
    if (!deveReabrirDefinicoes()) return;
    // Por cima das Áreas, de onde as Definições se abrem: voltar leva para lá, como antes.
    const temporizador = setTimeout(() => {
      router.navigate('/areas');
      router.push('/definicoes');
    }, 0);
    return () => clearTimeout(temporizador);
  }, []);
  return null;
}

/** A app depois de a base de dados estar pronta: o tema vem das definições e do sistema. */
function AppComTema({ idiomaDoSistema }: { idiomaDoSistema: Idioma }) {
  const esquemaDoSistema = useEsquemaDoSistema();
  const preferencia = useConsulta(() => carregarDefinicoes().tema, ['definicoes']);
  const preferenciaDeIdioma = useConsulta(() => carregarDefinicoes().idioma, ['definicoes']);
  const idioma: Idioma = preferenciaDeIdioma === 'automatico' ? idiomaDoSistema : preferenciaDeIdioma;
  definirIdioma(idioma);
  useEffect(() => aplicarAoSistema(preferencia), [preferencia]);
  const tema = TEMAS[preferencia === 'automatico' ? esquemaDoSistema : preferencia];
  const { cores } = tema;

  // Cabeçalhos e fundos da navegação com as cores do tema.
  const temaDaNavegacao = useMemo(() => {
    const base = tema.escuro ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, primary: cores.tinta, background: cores.fundo, card: cores.fundo, text: cores.tinta, border: cores.linha } };
  }, [tema, cores]);

  return (
    // Mudar de idioma volta a desenhar tudo (key), para os textos já mostrados também mudarem.
    <ContextoDoTema.Provider key={idioma} value={tema}>
      <ThemeProvider value={temaDaNavegacao}>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: cores.fundo }}>
          <StatusBar style={tema.escuro ? 'light' : 'dark'} />
          <AbrirRevisaoPeloLembrete />
          <Stack screenOptions={{ contentStyle: { backgroundColor: cores.fundo }, headerShadowVisible: false, headerStyle: { backgroundColor: cores.fundo }, headerTintColor: cores.tinta }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="area/[id]" options={{ title: '', headerBackTitle: t('Áreas'), headerStyle: { backgroundColor: cores.fundo } }} />
            <Stack.Screen name="area/nova" options={{ title: t('Nova área'), presentation: 'modal' }} />
            <Stack.Screen name="meta/nova" options={{ title: t('Nova meta'), presentation: 'modal' }} />
            <Stack.Screen name="meta/alterar" options={{ title: t('Alterar meta'), presentation: 'modal' }} />
            <Stack.Screen name="meta/[id]" options={{ title: '', headerBackTitle: t('Área'), headerStyle: { backgroundColor: cores.fundo } }} />
            <Stack.Screen name="tarefa/nova" options={{ title: t('Nova tarefa'), presentation: 'modal' }} />
            <Stack.Screen name="tarefa/[id]" options={{ title: t('Alterar tarefa'), presentation: 'modal' }} />
            <Stack.Screen name="boas-vindas" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="pesquisa" options={{ title: t('Pesquisar') }} />
            <Stack.Screen name="metas" options={{ title: t('As minhas metas') }} />
            <Stack.Screen name="definicoes" options={{ title: t('Definições'), headerBackTitle: t('Áreas'), headerStyle: { backgroundColor: cores.fundo } }} />
          </Stack>
          <AvisoTemporario />
          <ReabrirDefinicoes />
        </GestureHandlerRootView>
      </ThemeProvider>
    </ContextoDoTema.Provider>
  );
}
