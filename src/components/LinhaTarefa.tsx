import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Pressable as PressableDeGestos } from 'react-native-gesture-handler';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { comDesfazer } from '@/components/AvisoTemporario';
import { avisarErro } from '@/components/dialogos';
import { Icone } from '@/components/Icone';
import { BotaoIcone } from '@/components/ui';
import { apagarTarefa, marcarVez } from '@/data/tarefas';
import { descreverRecorrencia } from '@/domain/recorrencia';
import { detalheDaLinha, estadoDaLinha, type EstadoLinha, type ResumoTarefa } from '@/domain/tarefas';
import { fontes, useTema } from '@/theme';
import { t } from '@/i18n';

type Props = {
  tarefa: ResumoTarefa;
  semana: string;
  /** No detalhe da área o design escreve "7/7 no calendário" em vez de "7/7". */
  porExtenso?: boolean;
  /** Primeira linha de um cartão sem cabeçalho: não leva a linha de separação por cima. */
  semLinha?: boolean;
};

/** Uma tarefa na lista da semana: tocar abre-a para alterar, deslizar para a esquerda apaga-a. */
export function LinhaTarefa({ tarefa, semana, porExtenso, semLinha }: Props) {
  const { cores } = useTema();
  const router = useRouter();
  const deslizante = useRef<SwipeableMethods>(null);
  const estado = estadoDaLinha(tarefa);
  const detalhe = detalheDaLinha(tarefa, descreverRecorrencia(tarefa.recorrencia));

  function abrir() {
    router.push({ pathname: '/tarefa/[id]', params: { id: String(tarefa.id), semana } });
  }

  /** Sai desta semana e das seguintes (as anteriores ficam no histórico), com uns segundos para desfazer. */
  function apagar() {
    if (!comDesfazer(t('“{nome}” apagada', { nome: tarefa.nome }), () => apagarTarefa(tarefa.id, semana), t('Não foi possível apagar a tarefa'))) deslizante.current?.close();
  }

  function contar(feita: boolean) {
    try {
      marcarVez(tarefa.id, semana, feita);
    } catch (erro) {
      avisarErro(t('Não foi possível marcar a tarefa'), erro);
    }
  }

  return (
    <Swipeable
      ref={deslizante}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(progresso) => <AcaoApagar progresso={progresso} nome={tarefa.nome} aoApagar={apagar} />}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 52,
          paddingLeft: 16,
          paddingRight: estado.tipo === 'contagem' ? 4 : 16,
          backgroundColor: cores.superficie,
          borderTopWidth: semLinha ? 0 : 1,
          borderTopColor: cores.linhaSuave,
        }}
      >
        {/* Pressable da biblioteca de gestos: o toque é cancelado quando o deslize começa (o do React Native disparava na mesma no navegador). */}
        <PressableDeGestos
          accessibilityRole="button"
          accessibilityLabel={`${tarefa.nome}, ${detalhe}${estado.tipo === 'contagem' ? '' : `, ${textoDoEstado(estado, porExtenso)}`}`}
          accessibilityHint={t('Abre a tarefa para a alterar')}
          accessibilityActions={[{ name: 'apagar', label: t('Apagar') }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'apagar') apagar();
          }}
          onPress={abrir}
          style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: fontes.textoMedio, fontSize: 15, lineHeight: 20, color: cores.tinta }} numberOfLines={2}>
              {tarefa.nome}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {tarefa.recorrencia ? <Icone nome="repetir" tamanho={12} cor={cores.texto3} espessura={2} /> : null}
              <Text style={{ flexShrink: 1, fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }} numberOfLines={1}>
                {detalhe}
              </Text>
            </View>
          </View>
          {estado.tipo === 'contagem' ? null : <Estado estado={estado} porExtenso={porExtenso} />}
        </PressableDeGestos>
        {estado.tipo === 'contagem' ? <Contagem nome={tarefa.nome} feitas={estado.feitas} total={estado.total} aoContar={contar} /> : null}
      </View>
    </Swipeable>
  );
}

/** O botão vermelho por trás da linha. Fica invisível enquanto a linha está fechada, para não espreitar nos cantos do cartão. */
function AcaoApagar({ progresso, nome, aoApagar }: { progresso: SharedValue<number>; nome: string; aoApagar: () => void }) {
  const { cores } = useTema();
  const visivel = useAnimatedStyle(() => ({ opacity: progresso.value > 0.01 ? 1 : 0 }));
  return (
    <Animated.View style={[{ width: 88, backgroundColor: cores.perigo }, visivel]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Apagar {nome}', { nome })} onPress={aoApagar} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <Icone nome="lixo" tamanho={18} cor={cores.sobreTinta} />
        <Text style={{ fontFamily: fontes.textoForte, fontSize: 12, color: cores.sobreTinta }}>{t('Apagar')}</Text>
      </Pressable>
    </Animated.View>
  );
}

function textoDoEstado(estado: Exclude<EstadoLinha, { tipo: 'contagem' }>, porExtenso?: boolean): string {
  return porExtenso && /^\d+\/\d+$/.test(estado.texto) ? t('{n} no calendário', { n: estado.texto }) : estado.texto;
}

function Estado({ estado, porExtenso }: { estado: Exclude<EstadoLinha, { tipo: 'contagem' }>; porExtenso?: boolean }) {
  const { cores } = useTema();
  const texto = textoDoEstado(estado, porExtenso);
  if (estado.tipo === 'por_alocar') {
    return (
      <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: cores.tinta }}>
        <Text style={{ fontFamily: fontes.textoForte, fontSize: 12, lineHeight: 16, color: cores.tinta }}>{texto}</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {estado.tipo === 'completa' ? <Icone nome="certo" tamanho={14} cor={cores.texto2} espessura={2.2} /> : null}
      <Text style={{ fontFamily: fontes.textoForte, fontSize: 12, lineHeight: 16, color: estado.tipo === 'completa' ? cores.texto2 : cores.texto3 }}>{texto}</Text>
    </View>
  );
}

/** Tarefas sem duração: uma caixa de visto (1 vez) ou menos / contagem / mais (várias vezes). */
function Contagem({ nome, feitas, total, aoContar }: { nome: string; feitas: number; total: number; aoContar: (feita: boolean) => void }) {
  const { cores } = useTema();
  if (total === 1) {
    const feita = feitas === 1;
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`${nome}, feita`}
        accessibilityState={{ checked: feita }}
        onPress={() => aoContar(!feita)}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: feita ? 0 : 1.5,
            borderColor: cores.tracejado,
            backgroundColor: feita ? cores.tinta : 'transparent',
          }}
        >
          {feita ? <Icone nome="certo" tamanho={14} cor={cores.sobreTinta} espessura={2.4} /> : null}
        </View>
      </Pressable>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <BotaoIcone icone="menos" rotulo={t('Desfazer uma vez de {nome}', { nome })} tamanho={18} disabled={feitas === 0} onPress={() => aoContar(false)} style={{ width: 36 }} />
      <Text
        accessibilityLabel={t('{n} de {total} feitas', { n: feitas, total })}
        style={{ minWidth: 34, textAlign: 'center', fontFamily: fontes.textoForte, fontSize: 13, lineHeight: 18, color: feitas === total ? cores.tinta : cores.texto2, fontVariant: ['tabular-nums'] }}
      >
        {`${feitas}/${total}`}
      </Text>
      <BotaoIcone icone="mais" rotulo={t('Marcar mais uma vez de {nome}', { nome })} tamanho={18} disabled={feitas === total} onPress={() => aoContar(true)} style={{ width: 36 }} />
    </View>
  );
}
