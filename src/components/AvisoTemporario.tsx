import { useSegments } from 'expo-router';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { avisarErro } from '@/components/dialogos';
import { BotaoIcone } from '@/components/ui';
import { recarregarConsultas } from '@/data/consulta';
import { exportarDados, importarDados } from '@/data/copia';
import { fontes, useTema } from '@/theme';
import { t } from '@/i18n';

/*
 * Aviso temporário por cima do fundo do ecrã ("Tarefa apagada · Desfazer"). Em vez de pedir
 * confirmação antes de apagar, faz-se a ação logo e dá-se uns segundos para a desfazer.
 *
 * Desfazer repõe os dados como estavam imediatamente antes da ação (uma fotografia de todas as
 * tabelas, a mesma da cópia de segurança). Por isso o aviso sai assim que outra coisa mudar os
 * dados: desfazer nunca leva consigo uma alteração feita depois.
 */

const DURACAO_MS = 5000;
/** A própria ação também avisa que os dados mudaram; esses avisos chegam logo a seguir e ignoram-se. */
const FOLGA_MS = 600;

type Aviso = { id: number; texto: string; desfazer?: () => void };

let atual: Aviso | null = null;
let proximoId = 1;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let ouvinteDaBd: { remove: () => void } | null = null;
const ouvintes = new Set<() => void>();

function mudar(aviso: Aviso | null) {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  ouvinteDaBd?.remove();
  ouvinteDaBd = null;
  atual = aviso;
  ouvintes.forEach((o) => o());
  if (!aviso) return;
  temporizador = setTimeout(() => fecharAviso(aviso.id), DURACAO_MS);
  if (aviso.desfazer) {
    const desde = Date.now();
    ouvinteDaBd = addDatabaseChangeListener(() => {
      if (Date.now() - desde > FOLGA_MS) fecharAviso(aviso.id);
    });
  }
}

/** Mostra um aviso durante alguns segundos; com `desfazer`, leva o botão "Desfazer". */
export function mostrarAviso(texto: string, desfazer?: () => void) {
  mudar({ id: proximoId++, texto, desfazer });
}

export function fecharAviso(id?: number) {
  if (atual && (id === undefined || atual.id === id)) mudar(null);
}

/**
 * Faz `acao` e mostra `texto` com "Desfazer". Se a ação falhar, nada muda e o erro é mostrado.
 * Devolve true se a ação correu bem.
 */
export function comDesfazer(texto: string, acao: () => void, erro = t('Não foi possível fazer a alteração'), aoDesfazer?: () => void): boolean {
  let antes: ReturnType<typeof exportarDados>;
  try {
    antes = exportarDados();
    acao();
  } catch (e) {
    avisarErro(erro, e);
    return false;
  }
  recarregarConsultas();
  mostrarAviso(texto, () => {
    try {
      importarDados(antes);
      recarregarConsultas();
      aoDesfazer?.();
    } catch (e) {
      avisarErro(t('Não foi possível desfazer'), e);
    }
  });
  return true;
}

function subscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Altura da barra dos separadores (ver app/(tabs)/_layout.tsx), sem a margem do sistema. */
const ALTURA_SEPARADORES = 60;

/** O aviso em si. Vai uma vez no layout principal, por cima de todos os ecrãs. */
export function AvisoTemporario() {
  const { cores } = useTema();
  const aviso = useSyncExternalStore(
    subscrever,
    () => atual,
    () => atual,
  );
  const margens = useSafeAreaInsets();
  const segmentos = useSegments();
  const comSeparadores = segmentos[0] === '(tabs)';

  if (!aviso) return null;
  const fundo = (comSeparadores ? ALTURA_SEPARADORES : 0) + Math.max(margens.bottom, 3) + 8;

  return (
    <Animated.View
      key={aviso.id}
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(150)}
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 12, right: 12, bottom: fundo }}
    >
      <View
        accessibilityLiveRegion="polite"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 16, paddingRight: 4, paddingVertical: 4, minHeight: 52, borderRadius: 14, backgroundColor: cores.tinta, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
      >
        <Text style={{ flex: 1, paddingVertical: 8, fontFamily: fontes.textoMedio, fontSize: 14, lineHeight: 20, color: cores.sobreTinta }}>{aviso.texto}</Text>
        {aviso.desfazer ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const desfazer = aviso.desfazer;
              fecharAviso(aviso.id);
              desfazer?.();
            }}
            style={({ pressed }) => ({ minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, backgroundColor: cores.sobreTinta, opacity: pressed ? 0.8 : 1 })}
          >
            <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, color: cores.tinta }}>{t('Desfazer')}</Text>
          </Pressable>
        ) : null}
        <BotaoIcone icone="fechar" rotulo={t('Fechar aviso')} cor={cores.sobreTinta} tamanho={18} onPress={() => fecharAviso(aviso.id)} />
      </View>
    </Animated.View>
  );
}
