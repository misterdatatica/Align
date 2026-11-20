import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { GestureDetector, Pressable, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icone, type NomeIcone } from '@/components/Icone';

import type { Area } from '@/db/schema';
import { formatarHoras } from '@/domain/regras';
import { fontes, useTema } from '@/theme';

/** Espaço entre cartões, como no design. */
const INTERVALO = 10;

export type AreaNaLista = { area: Area; tarefas: unknown[]; minutosPlaneados: number };

type Props = {
  itens: AreaNaLista[];
  aoAbrir: (areaId: number) => void;
  /** Recebe os ids das áreas pela ordem nova. */
  aoReordenar: (ids: number[]) => void;
  /** A semana mostrada, no meio de uma frase: "esta semana", "na semana seguinte"… */
  quando: string;
};

/**
 * A lista de áreas do ecrã inicial. Tocar abre a área; manter premido e arrastar muda a ordem.
 * O cartão segue o dedo na thread da interface e os outros afastam-se para lhe dar lugar; a ordem
 * só é guardada quando se larga. Com leitor de ecrã, usam-se as ações "Mover para cima / baixo".
 */
export function ListaDeAreas({ itens, aoAbrir, aoReordenar, quando }: Props) {
  const [alturas, setAlturas] = useState<Record<number, number>>({});
  /** Altura de cada cartão pela ordem da lista, para a thread da interface saber onde cai o arrasto. */
  const alturasNaOrdem = useSharedValue<number[]>([]);
  const ativo = useSharedValue(-1);
  const destino = useSharedValue(-1);
  const deslocamento = useSharedValue(0);

  useEffect(() => {
    alturasNaOrdem.set(itens.map((item) => alturas[item.area.id] ?? 0));
  }, [itens, alturas, alturasNaOrdem]);

  function mover(de: number, para: number) {
    if (de !== para && de >= 0 && para >= 0 && de < itens.length && para < itens.length) {
      const ids = itens.map((item) => item.area.id);
      ids.splice(para, 0, ...ids.splice(de, 1));
      aoReordenar(ids);
    }
    // Só depois de a lista aparecer na ordem nova é que os cartões voltam ao sítio (sem saltos).
    requestAnimationFrame(() => {
      ativo.set(-1);
      destino.set(-1);
      deslocamento.set(0);
    });
  }

  return (
    <View style={{ gap: INTERVALO }}>
      {itens.map((item, indice) => (
        <CartaoDeArea
          key={item.area.id}
          item={item}
          indice={indice}
          total={itens.length}
          alturasNaOrdem={alturasNaOrdem}
          ativo={ativo}
          destino={destino}
          deslocamento={deslocamento}
          aoMedir={(altura) => setAlturas((atuais) => (atuais[item.area.id] === altura ? atuais : { ...atuais, [item.area.id]: altura }))}
          aoAbrir={aoAbrir}
          aoMover={mover}
          quando={quando}
        />
      ))}
    </View>
  );
}

type CartaoProps = {
  item: AreaNaLista;
  indice: number;
  total: number;
  alturasNaOrdem: SharedValue<number[]>;
  ativo: SharedValue<number>;
  destino: SharedValue<number>;
  deslocamento: SharedValue<number>;
  aoMedir: (altura: number) => void;
  aoAbrir: (areaId: number) => void;
  aoMover: (de: number, para: number) => void;
  quando: string;
};

function CartaoDeArea({ item, indice, total, alturasNaOrdem, ativo, destino, deslocamento, aoMedir, aoAbrir, aoMover, quando }: CartaoProps) {
  const { cores, estilos, corDaArea } = useTema();
  const { area, tarefas, minutosPlaneados } = item;
  const cor = corDaArea(area.cor);
  const n = tarefas.length;

  const arrastar = usePanGesture({
    activateAfterLongPress: 350,
    onActivate: () => {
      if (ativo.get() !== -1) return;
      ativo.set(indice);
      destino.set(indice);
      deslocamento.set(0);
    },
    onUpdate: (e) => {
      if (ativo.get() !== indice) return;
      deslocamento.set(e.translationY);
      // O cartão passa para o lugar de outro quando o seu centro entra nesse lugar.
      const alturasAtuais = alturasNaOrdem.get();
      let topo = 0;
      for (let i = 0; i < indice; i++) topo += alturasAtuais[i] + INTERVALO;
      const centro = topo + alturasAtuais[indice] / 2 + e.translationY;
      let novo = alturasAtuais.length - 1;
      let fim = 0;
      for (let i = 0; i < alturasAtuais.length; i++) {
        fim += alturasAtuais[i] + INTERVALO;
        if (centro < fim) {
          novo = i;
          break;
        }
      }
      destino.set(novo);
    },
    onDeactivate: (e) => {
      if (ativo.get() !== indice) return;
      scheduleOnRN(aoMover, indice, e.canceled ? indice : destino.get());
    },
    onFinalize: () => {
      // Arrasto que não chegou a terminar bem (interrompido pelo sistema): tudo volta ao sítio.
      if (ativo.get() === indice && destino.get() === -1) ativo.set(-1);
    },
  });

  const estilo = useAnimatedStyle(() => {
    const emArrasto = ativo.get();
    if (emArrasto === -1) return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0 };
    if (emArrasto === indice) return { transform: [{ translateY: deslocamento.get() }, { scale: 1.02 }], zIndex: 1 };
    // Os cartões entre a origem e o destino afastam-se a altura do cartão arrastado.
    const passo = (alturasNaOrdem.get()[emArrasto] ?? 0) + INTERVALO;
    const alvo = destino.get();
    let desvio = 0;
    if (emArrasto < alvo && indice > emArrasto && indice <= alvo) desvio = -passo;
    else if (emArrasto > alvo && indice >= alvo && indice < emArrasto) desvio = passo;
    return { transform: [{ translateY: withTiming(desvio, { duration: 150 }) }, { scale: 1 }], zIndex: 0 };
  });

  return (
    <GestureDetector gesture={arrastar} touchAction="pan-y">
      <Animated.View style={estilo} onLayout={(e) => aoMedir(e.nativeEvent.layout.height)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${area.nome}. ${area.missao || 'Sem missão'}. ${n === 0 ? `Sem tarefas ${quando}` : `${n} ${n === 1 ? 'tarefa' : 'tarefas'} ${quando}`}`}
          accessibilityHint="Abre a área. Mantenha premido e arraste para mudar a ordem."
          accessibilityActions={[
            ...(indice > 0 ? [{ name: 'subir', label: 'Mover para cima' }] : []),
            ...(indice < total - 1 ? [{ name: 'descer', label: 'Mover para baixo' }] : []),
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'subir') aoMover(indice, indice - 1);
            if (e.nativeEvent.actionName === 'descer') aoMover(indice, indice + 1);
          }}
          onPress={() => aoAbrir(area.id)}
          style={({ pressed }) => [estilos.cartao, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: cor.tinta, alignItems: 'center', justifyContent: 'center' }}>
            <Icone nome={area.icone as NomeIcone} cor={cor.texto} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: fontes.textoForte, fontSize: 17, lineHeight: 22, color: cores.tinta }}>{area.nome}</Text>
            <Text style={{ fontFamily: fontes.texto, fontSize: 14, lineHeight: 20, color: area.missao ? cores.texto2 : cores.texto3, marginTop: 2 }} numberOfLines={2}>
              {area.missao || 'Sem missão — toque para definir'}
            </Text>
            <Text style={[estilos.pequeno, { marginTop: 6 }]}>
              {n === 0 ? `Sem tarefas ${quando}` : `${n} ${n === 1 ? 'tarefa' : 'tarefas'}${minutosPlaneados > 0 ? ` · ${formatarHoras(minutosPlaneados / 60)}` : ''} ${quando}`}
            </Text>
          </View>
          <Icone nome="seta-direita" tamanho={16} cor={cores.texto3} espessura={2} />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}
