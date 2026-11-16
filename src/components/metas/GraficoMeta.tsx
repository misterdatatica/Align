import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { formatarValor, valorComUnidade, type PontoDaLinha } from '@/domain/metas';
import { deDataISO, descreverData, descreverDataCurta } from '@/domain/semana';
import { cores, fontes } from '@/theme';

type Props = {
  /** O valor inicial seguido das atualizações, por ordem de data (ver `pontosDaLinha`). */
  pontos: PontoDaLinha[];
  alvo: number;
  /** O eixo do tempo vai do primeiro ponto ao prazo. */
  prazo: string;
  unidade: string | null;
  /** Cor forte da área. */
  cor: string;
};

const ALTURA = 132;
const MARGEM = { esquerda: 36, direita: 14, topo: 12, fundo: 22 };
const RAIO = 4;

const dias = (iso: string) => Math.round(deDataISO(iso).getTime() / 86_400_000);

/**
 * Linha de progresso de uma meta de número: os valores ao longo do tempo, com o alvo como linha de
 * referência e o prazo no fim do eixo. Uma só série, por isso não tem legenda; o valor do ponto
 * escolhido (por omissão, o último) lê-se por cima do gráfico, e tocar noutro ponto muda-o.
 */
export function GraficoMeta({ pontos, alvo, prazo, unidade, cor }: Props) {
  const [largura, setLargura] = useState(0);
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const ultimo = pontos.length - 1;
  const indice = escolhido !== null && escolhido <= ultimo ? escolhido : ultimo;
  const ponto = pontos[indice];

  const t0 = dias(pontos[0].data);
  const t1 = Math.max(dias(prazo), dias(pontos[ultimo].data), t0 + 1);
  const valores = [...pontos.map((p) => p.valor), alvo];
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const folga = (maximo - minimo || 1) * 0.12;
  const larguraUtil = Math.max(0, largura - MARGEM.esquerda - MARGEM.direita);
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.fundo;
  const x = (data: string) => MARGEM.esquerda + ((dias(data) - t0) / (t1 - t0)) * larguraUtil;
  const y = (valor: number) => MARGEM.topo + (1 - (valor - (minimo - folga)) / (maximo - minimo + 2 * folga)) * alturaUtil;

  const yAlvo = y(alvo);
  const yInicial = y(pontos[0].valor);
  const resumo = `Linha de progresso. Começou em ${valorComUnidade(pontos[0].valor, unidade)} a ${descreverData(pontos[0].data)}${
    ultimo > 0 ? ` e vai em ${valorComUnidade(pontos[ultimo].valor, unidade)} a ${descreverData(pontos[ultimo].data)}` : ''
  }. Alvo: ${valorComUnidade(alvo, unidade)} até ${descreverData(prazo)}.`;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }} accessibilityLiveRegion="polite">
        <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: cor }} />
        <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, lineHeight: 18, color: cores.tinta, fontVariant: ['tabular-nums'] }}>{valorComUnidade(ponto.valor, unidade)}</Text>
        <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 18, color: cores.texto3 }}>{indice === 0 ? `ponto de partida · ${descreverData(ponto.data)}` : descreverData(ponto.data)}</Text>
      </View>

      <View style={{ height: ALTURA }} onLayout={(e) => setLargura(e.nativeEvent.layout.width)} accessible accessibilityRole="image" accessibilityLabel={resumo}>
        {largura > 0 ? (
          <>
            <Svg width={largura} height={ALTURA}>
              {/* Base do gráfico e linha do alvo: finas e discretas. */}
              <Line x1={MARGEM.esquerda} x2={largura - MARGEM.direita} y1={ALTURA - MARGEM.fundo} y2={ALTURA - MARGEM.fundo} stroke={cores.linha} strokeWidth={1} />
              <Line x1={MARGEM.esquerda} x2={largura - MARGEM.direita} y1={yAlvo} y2={yAlvo} stroke={cores.tracejado} strokeWidth={1} />
              {pontos.length > 1 ? (
                <Polyline points={pontos.map((p) => `${x(p.data)},${y(p.valor)}`).join(' ')} fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              ) : null}
              {pontos.map((p, i) => (
                <Circle key={i} cx={x(p.data)} cy={y(p.valor)} r={i === indice ? RAIO + 1 : RAIO} fill={cor} stroke={cores.superficie} strokeWidth={2} />
              ))}
            </Svg>

            <Text style={[estiloEixo, { position: 'absolute', left: 0, width: MARGEM.esquerda - 6, top: yAlvo - 7, textAlign: 'right' }]}>{formatarValor(alvo)}</Text>
            {Math.abs(yInicial - yAlvo) >= 14 ? (
              <Text style={[estiloEixo, { position: 'absolute', left: 0, width: MARGEM.esquerda - 6, top: yInicial - 7, textAlign: 'right' }]}>{formatarValor(pontos[0].valor)}</Text>
            ) : null}
            <Text style={[estiloEixo, { position: 'absolute', right: MARGEM.direita, top: yAlvo - 15 }]}>alvo</Text>
            <Text style={[estiloEixo, { position: 'absolute', left: MARGEM.esquerda, bottom: 0 }]}>{descreverDataCurta(pontos[0].data)}</Text>
            <Text style={[estiloEixo, { position: 'absolute', right: MARGEM.direita, bottom: 0 }]}>{`prazo · ${descreverData(prazo)}`}</Text>

            {/* Alvos de toque maiores do que os pontos. */}
            {pontos.map((p, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`${descreverData(p.data)}: ${valorComUnidade(p.valor, unidade)}`}
                onPress={() => setEscolhido(i)}
                style={{ position: 'absolute', left: x(p.data) - 16, top: y(p.valor) - 16, width: 32, height: 32 }}
              />
            ))}
          </>
        ) : null}
      </View>
    </View>
  );
}

const estiloEixo = { fontFamily: fontes.texto, fontSize: 11, lineHeight: 14, color: cores.texto3, fontVariant: ['tabular-nums' as const] };
