import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { GestureDetector, Pressable, ScrollView, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { BlocoCalendario, CalendarioDaSemana } from '@/data/calendario';
import { type CorArea, fontes, useTema } from '@/theme';

import { LARGURA_HORAS, MEIA_HORA_MAXIMA, MEIA_HORA_MINIMA, MODO_NENHUM, TOPO_GRELHA, type Arrasto, type RefDeVista } from './arrasto';
import { Bloco } from './Bloco';

type Props = {
  calendario: CalendarioDaSemana;
  arrasto: Arrasto;
  /** Referência que o arrasto usa para medir onde a grelha está no ecrã. */
  grelhaRef: RefDeVista;
  /** Id do bloco que está a ser arrastado (fica esbatido), ou null. */
  blocoArrastado: number | null;
  /** Cor da tarefa arrastada, para o contorno tracejado do destino; null = "Ocupado". */
  corDoArrasto: CorArea | null;
  /** Ids dos blocos a destacar por se sobreporem a outros. */
  blocosEmAtencao?: ReadonlySet<number>;
  /** Os dias visíveis: `numDias` (1, 3 ou 7) a partir de `primeiroDia` (0 = segunda). */
  primeiroDia: number;
  numDias: number;
  aoTocarBloco: (bloco: BlocoCalendario) => void;
  /** Toque numa zona livre: dia (0 = segunda) e minutos desde a meia-noite, já na meia hora tocada. */
  aoTocarVazio: (dia: number, minutos: number) => void;
};

/** Altura de meia hora escolhida com dois dedos; null = a que enche o ecrã. Fica entre visitas ao separador. */
let zoomGuardado: number | null = null;
function guardarZoom(altura: number) {
  zoomGuardado = altura;
}

/** A grelha dos dias visíveis: linhas de hora, blocos e o destino tracejado enquanto se arrasta. */
export function Grelha({ calendario, arrasto, grelhaRef, blocoArrastado, corDoArrasto, blocosEmAtencao, primeiroDia, numDias, aoTocarBloco, aoTocarVazio }: Props) {
  const { cores } = useTema();
  const { inicioMin, fimMin } = calendario;
  const [largura, setLargura] = useState(0);
  const [alturaVisivel, setAlturaVisivel] = useState(0);
  const [zoom, setZoom] = useState<number | null>(zoomGuardado);

  const meiasHoras = (fimMin - inicioMin) / 30;
  // Design: 14 px por meia hora. Se o ecrã tiver espaço para mais, a grelha estica até o encher; com
  // dois dedos amplia-se ou reduz-se.
  const aEncher = Math.max(MEIA_HORA_MINIMA, Math.floor((alturaVisivel - TOPO_GRELHA - 10) / meiasHoras));
  const meiaHora = zoom ?? aEncher;
  const alturaTotal = meiasHoras * meiaHora;
  const larguraColuna = Math.max(0, (largura - LARGURA_HORAS) / numDias);
  const horas = Array.from({ length: meiasHoras / 2 + 1 }, (_, i) => inicioMin / 60 + i);
  const blocos = calendario.blocos.filter((b) => b.dia >= primeiroDia && b.dia < primeiroDia + numDias);

  const { larguraColuna: larguraPartilhada, alturaMeiaHora, primeiroDia: primeiroPartilhado, numDias: numPartilhado, grelhaInicio, modo, naGrelha, aPousar, alvoDia, alvoInicio, alvoFim } = arrasto;
  useEffect(() => {
    larguraPartilhada.set(larguraColuna);
    alturaMeiaHora.set(meiaHora);
    primeiroPartilhado.set(primeiroDia);
    numPartilhado.set(numDias);
  }, [larguraColuna, meiaHora, primeiroDia, numDias, larguraPartilhada, alturaMeiaHora, primeiroPartilhado, numPartilhado]);

  // Dois dedos: afastar amplia as horas, aproximar reduz. Só avisa o ecrã quando muda um píxel.
  const alturaNoInicio = useSharedValue(meiaHora);
  const ultimaAltura = useSharedValue(meiaHora);
  const mudarZoom = (altura: number) => {
    guardarZoom(altura);
    setZoom(altura);
  };
  const pinca = usePinchGesture({
    onActivate: () => {
      alturaNoInicio.set(alturaMeiaHora.get());
      ultimaAltura.set(alturaMeiaHora.get());
    },
    onUpdate: (e) => {
      if (modo.get() !== MODO_NENHUM) return;
      const altura = Math.min(MEIA_HORA_MAXIMA, Math.max(MEIA_HORA_MINIMA, Math.round(alturaNoInicio.get() * e.scale)));
      if (altura === ultimaAltura.get()) return;
      ultimaAltura.set(altura);
      scheduleOnRN(mudarZoom, altura);
    },
  });
  const gestos = useSimultaneousGestures(arrasto.gestoGrelha, pinca);

  // O destino do arrasto, encaixado na meia hora (calculado na thread da interface).
  const estiloDestino = useAnimatedStyle(() => {
    const coluna = larguraPartilhada.get();
    const altura = alturaMeiaHora.get();
    return {
      opacity: (modo.get() !== MODO_NENHUM && naGrelha.get()) || aPousar.get() ? 1 : 0,
      left: LARGURA_HORAS + (alvoDia.get() - primeiroPartilhado.get()) * coluna + 1,
      top: TOPO_GRELHA + ((alvoInicio.get() - grelhaInicio.get()) / 30) * altura + 1,
      width: Math.max(0, coluna - 2),
      height: Math.max(0, ((alvoFim.get() - alvoInicio.get()) / 30) * altura - 2),
    };
  });

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} onLayout={(e) => setAlturaVisivel(e.nativeEvent.layout.height)}>
      {/* No navegador, "pan-y" deixa a grelha deslizar na vertical com o dedo. */}
      <GestureDetector gesture={gestos} touchAction="pan-y">
        <Animated.View
          ref={grelhaRef}
          collapsable={false}
          onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
          style={{ height: TOPO_GRELHA + alturaTotal + 1 }}
        >
          <View
            style={{
              position: 'absolute',
              left: LARGURA_HORAS,
              right: 0,
              top: TOPO_GRELHA,
              height: alturaTotal + 1,
              backgroundColor: cores.superficie,
            }}
          />
          {horas.map((hora, i) => (
            <View key={`h${hora}`} style={{ position: 'absolute', left: LARGURA_HORAS, right: 0, top: TOPO_GRELHA + i * 2 * meiaHora, height: 1, backgroundColor: cores.grelha }} />
          ))}
          {Array.from({ length: numDias + 1 }, (_, dia) => (
            <View
              key={`d${dia}`}
              style={{ position: 'absolute', left: LARGURA_HORAS + Math.min(dia * larguraColuna, Math.max(0, largura - LARGURA_HORAS - 1)), top: TOPO_GRELHA, width: 1, height: alturaTotal, backgroundColor: cores.grelha }}
            />
          ))}
          {horas.slice(0, -1).map((hora, i) => (
            <Text
              key={`e${hora}`}
              style={{ position: 'absolute', left: 0, top: TOPO_GRELHA + i * 2 * meiaHora - 7, fontFamily: fontes.texto, fontSize: 10, lineHeight: 14, color: cores.texto3, fontVariant: ['tabular-nums'] }}
            >
              {`${hora}h`}
            </Text>
          ))}

          {/* Toques nas zonas livres (alocar com toques, sem arrastar). Os leitores de ecrã usam "Escolher dia e hora". */}
          <Pressable
            accessible={false}
            onPress={(e) => {
              if (larguraColuna <= 0) return;
              const dia = primeiroDia + Math.min(numDias - 1, Math.max(0, Math.floor(e.nativeEvent.locationX / larguraColuna)));
              const meias = Math.min(meiasHoras - 1, Math.max(0, Math.floor(e.nativeEvent.locationY / meiaHora)));
              aoTocarVazio(dia, inicioMin + meias * 30);
            }}
            style={{ position: 'absolute', left: LARGURA_HORAS, right: 0, top: TOPO_GRELHA, height: alturaTotal }}
          />

          {larguraColuna > 0
            ? blocos.map((b) => (
                <Bloco
                  key={b.id}
                  bloco={b}
                  esquerda={LARGURA_HORAS + (b.dia - primeiroDia) * larguraColuna + (b.coluna * larguraColuna) / b.colunas}
                  topo={TOPO_GRELHA + ((b.inicioMin - inicioMin) / 30) * meiaHora}
                  largura={larguraColuna / b.colunas}
                  altura={((b.fimMin - b.inicioMin) / 30) * meiaHora}
                  esbatido={b.id === blocoArrastado}
                  atencao={blocosEmAtencao?.has(b.id)}
                  aoTocar={aoTocarBloco}
                />
              ))
            : null}

          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                borderRadius: 6,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: corDoArrasto ? corDoArrasto.forte : cores.texto2,
                backgroundColor: corDoArrasto ? corDoArrasto.tinta : cores.ocupadoClaro,
              },
              estiloDestino,
            ]}
          />
        </Animated.View>
      </GestureDetector>
    </ScrollView>
  );
}
