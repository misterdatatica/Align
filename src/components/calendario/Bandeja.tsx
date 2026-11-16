import { Text, View } from 'react-native';
import { GestureDetector, Pressable, ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Icone } from '@/components/Icone';
import { Botao, estilos } from '@/components/ui';
import type { CalendarioDaSemana, TarefaPorAlocar } from '@/data/calendario';
import { formatarHoras } from '@/domain/regras';
import { formatarDuracao } from '@/domain/tarefas';
import { cores, corDaArea, fontes } from '@/theme';

import { MODO_NENHUM, useGestoDaBandeja, type Arrasto, type RefDeVista } from './arrasto';

type Props = {
  calendario: CalendarioDaSemana;
  arrasto: Arrasto;
  /** Referência que o arrasto usa para saber onde a bandeja começa (largar um bloco aqui devolve-o). */
  bandejaRef: RefDeVista;
  /** Tarefa escolhida com um toque, à espera de se tocar numa hora da grelha. */
  escolhida: number | null;
  /** Tarefa que está a ser arrastada neste momento. */
  arrastada: number | null;
  aoEscolher: (tarefa: TarefaPorAlocar) => void;
  aoPlanear: () => void;
};

/** A bandeja "Por alocar": as tarefas da semana que ainda não têm lugar no calendário. */
export function Bandeja({ calendario, arrasto, bandejaRef, escolhida, arrastada, aoEscolher, aoPlanear }: Props) {
  const { porAlocar, minutosPorAlocar, blocos } = calendario;
  return (
    <Animated.View ref={bandejaRef} collapsable={false} style={[estilos.cartao, { padding: 12, gap: 8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, lineHeight: 20, color: cores.tinta }} accessibilityRole="header">
          Por alocar
          {porAlocar.length > 0 ? <Text style={{ fontFamily: fontes.textoMedio, color: cores.texto3 }}>{` · ${formatarHoras(minutosPorAlocar / 60)}`}</Text> : null}
        </Text>
        {porAlocar.length > 0 ? <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>Arraste para o calendário</Text> : null}
      </View>

      {porAlocar.length === 0 ? (
        <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={[estilos.pequeno, { flex: 1 }]}>{blocos.some((b) => b.tipo === 'tarefa') ? 'Está tudo no calendário.' : 'Ainda não há tarefas com duração nesta semana.'}</Text>
          <Botao titulo="Planear" variante="contorno" onPress={aoPlanear} style={{ minHeight: 44, paddingHorizontal: 14 }} />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
          {porAlocar.map((t) => (
            <Ficha key={t.tarefaId} tarefa={t} arrasto={arrasto} escolhida={escolhida === t.tarefaId} arrastada={arrastada === t.tarefaId} aoEscolher={aoEscolher} />
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

type FichaProps = {
  tarefa: TarefaPorAlocar;
  arrasto: Arrasto;
  escolhida: boolean;
  arrastada: boolean;
  aoEscolher: (tarefa: TarefaPorAlocar) => void;
};

/** Uma tarefa por alocar: arrasta-se para a grelha, ou toca-se nela e depois na hora. */
function Ficha({ tarefa, arrasto, escolhida, arrastada, aoEscolher }: FichaProps) {
  const gesto = useGestoDaBandeja(arrasto, tarefa.tarefaId, tarefa.duracaoMin);
  const cor = corDaArea(tarefa.cor);
  const duracao = formatarDuracao(tarefa.duracaoMin);
  return (
    // No navegador, "pan-x" deixa a bandeja deslizar para os lados com o dedo.
    <GestureDetector gesture={gesto} touchAction="pan-x">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${tarefa.nome}, ${duracao}${tarefa.quantas > 1 ? `, ${tarefa.quantas} por alocar` : ''}${tarefa.veioDaSemanaPassada ? ', vem da semana passada' : ''}`}
        accessibilityHint="Escolhe a tarefa para depois tocar na hora do calendário. Também se pode arrastar."
        accessibilityState={{ selected: escolhida }}
        onPress={() => aoEscolher(tarefa)}
        style={{
          height: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          borderRadius: 12,
          borderWidth: escolhida ? 2 : 1.5,
          borderStyle: arrastada ? 'dashed' : 'solid',
          // Contorno do design: a cor forte da área a 45%; escolhida ou arrastada, a cor forte inteira.
          borderColor: escolhida || arrastada ? cor.forte : `${cor.forte}73`,
          backgroundColor: cor.tinta,
        }}
      >
        <Icone nome="pegas" tamanho={14} cor={cor.texto} />
        <View>
          <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, lineHeight: 18, color: cor.texto }} numberOfLines={1}>
            {`${tarefa.nome} · ${duracao}`}
          </Text>
          {tarefa.veioDaSemanaPassada ? <Text style={{ fontFamily: fontes.textoMedio, fontSize: 10, lineHeight: 12, color: cor.texto }}>vem da semana passada</Text> : null}
        </View>
        {tarefa.quantas > 1 ? (
          <View style={{ minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: cor.texto }}>
            <Text style={{ fontFamily: fontes.textoForte, fontSize: 12, lineHeight: 16, color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>{`×${tarefa.quantas}`}</Text>
          </View>
        ) : null}
      </Pressable>
    </GestureDetector>
  );
}

type FantasmaProps = {
  arrasto: Arrasto;
  /** Referência da camada que cobre o ecrã, para converter a posição do dedo. */
  camadaRef: RefDeVista;
  /** O que se está a arrastar e para onde vai, ex.: "Qui 09:00–11:00". */
  nome: string | null;
  destino: string;
};

/** Etiqueta que acompanha o dedo durante o arrasto, com o nome e o destino. Vive numa camada por cima do ecrã. */
export function Fantasma({ arrasto, camadaRef, nome, destino }: FantasmaProps) {
  const { modo, dedoX, dedoY, camadaX, camadaY } = arrasto;
  const estilo = useAnimatedStyle(() => ({
    opacity: modo.get() === MODO_NENHUM ? 0 : 1,
    transform: [{ translateX: dedoX.get() - camadaX.get() }, { translateY: dedoY.get() - camadaY.get() }],
  }));
  return (
    <Animated.View ref={camadaRef} collapsable={false} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      {/* Centrada 64 px acima do dedo, para não ficar tapada por ele. */}
      <Animated.View style={[{ position: 'absolute', left: -80, top: -64, width: 160, alignItems: 'center' }, estilo]}>
        {nome ? (
          <View style={{ maxWidth: 160, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: cores.tinta, alignItems: 'center' }}>
            <Text style={{ fontFamily: fontes.textoForte, fontSize: 12, lineHeight: 16, color: '#FFFFFF' }} numberOfLines={1}>
              {nome}
            </Text>
            {destino ? <Text style={{ fontFamily: fontes.textoMedio, fontSize: 11, lineHeight: 14, color: cores.textoSobreTinta, fontVariant: ['tabular-nums'] }}>{destino}</Text> : null}
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}
