import { Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { Icone } from '@/components/Icone';
import type { BlocoCalendario } from '@/data/calendario';
import { formatarIntervalo } from '@/domain/calendario';
import { DIAS_LONGOS } from '@/domain/semana';
import { fontes, useTema } from '@/theme';
import { t } from '@/i18n';

/**
 * Riscas diagonais dos blocos "Ocupado" (compromissos fixos, sem área).
 * `legenda` desenha a versão pequena e mais escura que o design usa na legenda.
 */
export function Riscas({ legenda }: { legenda?: boolean }) {
  const { cores } = useTema();
  const risca = legenda ? 2 : 5;
  const id = legenda ? 'riscas-legenda' : 'riscas-ocupado';
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
      <Defs>
        <Pattern id={id} patternUnits="userSpaceOnUse" width={risca * 2} height={risca * 2} patternTransform="rotate(45)">
          <Rect width={risca} height={risca * 2} fill={legenda ? cores.ocupadoRiscaLegenda : cores.ocupadoClaro} />
          <Rect x={risca} width={risca} height={risca * 2} fill={cores.ocupadoEscuro} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

type Props = {
  bloco: BlocoCalendario;
  /** Posição e tamanho dentro da grelha, em px. */
  esquerda: number;
  topo: number;
  largura: number;
  altura: number;
  /** A ser arrastado: fica esbatido no sítio de origem. */
  esbatido: boolean;
  /** Numa proposta, o bloco sobrepõe-se a outro: leva um contorno de aviso. */
  atencao?: boolean;
  aoTocar: (bloco: BlocoCalendario) => void;
};

/**
 * Um bloco do calendário, com a cor da área e o nome curto da tarefa.
 * Tocar abre os detalhes; manter premido arrasta (gesto da grelha, ver arrasto.ts).
 */
export function Bloco({ bloco, esquerda, topo, largura, altura, esbatido, atencao, aoTocar }: Props) {
  const { cores, corDaArea } = useTema();
  const ocupado = bloco.tipo === 'ocupado';
  const cor = ocupado ? null : corDaArea(bloco.cor ?? '');
  const corTexto = cor ? cor.texto : cores.texto2;
  // Nas vistas de 1 e 3 dias os blocos são largos: cabe o nome inteiro e, se houver altura, a hora.
  const largo = largura >= 90;
  const comHora = largo && altura >= 30;
  // 12 px por linha de texto, com 2 px de margem em cima e em baixo.
  const linhas = Math.max(1, Math.floor((altura - 4 - (comHora ? 12 : 0)) / 12));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${bloco.nome}, ${t(DIAS_LONGOS[bloco.dia])}, ${formatarIntervalo(bloco.inicioMin, bloco.fimMin)}${bloco.feito ? `, ${t('feito')}` : ''}${atencao ? `, ${t('sobreposto a outro bloco')}` : ''}`}
      accessibilityHint={t('Abre os detalhes do bloco')}
      onPress={() => aoTocar(bloco)}
      style={{
        position: 'absolute',
        left: esquerda + 1,
        top: topo + 1,
        width: Math.max(0, largura - 2),
        height: Math.max(0, altura - 2),
        borderRadius: 6,
        overflow: 'hidden',
        borderWidth: atencao ? 2 : 1,
        // Contorno do design: a cor forte da área a 45% (ou cinzento a 20% nos "Ocupado").
        borderColor: atencao ? cores.perigo : cor ? `${cor.forte}73` : cores.contornoOcupado,
        backgroundColor: cor ? cor.tinta : cores.ocupadoClaro,
        opacity: esbatido ? 0.35 : 1,
      }}
    >
      {ocupado ? <Riscas /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 1, paddingHorizontal: 2, paddingTop: 1 }}>
        {bloco.feito ? (
          <View style={{ marginTop: 1 }}>
            <Icone nome="certo" tamanho={9} cor={corTexto} espessura={3.2} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={linhas}
            style={{
              fontFamily: fontes.textoForte,
              fontSize: largo ? 11 : 10,
              lineHeight: 12,
              letterSpacing: -0.1,
              color: corTexto,
              textDecorationLine: bloco.feito ? 'line-through' : 'none',
            }}
          >
            {largo ? bloco.nome : bloco.nomeCurto}
          </Text>
          {comHora ? (
            <Text numberOfLines={1} style={{ fontFamily: fontes.texto, fontSize: 10, lineHeight: 12, color: corTexto, opacity: 0.8 }}>
              {formatarIntervalo(bloco.inicioMin, bloco.fimMin)}
            </Text>
          ) : null}
        </View>
      </View>
      {/* Pega da borda inferior: puxar por aqui muda a duração. */}
      {altura >= 28 ? <View style={{ position: 'absolute', bottom: 2, alignSelf: 'center', width: 12, height: 2, borderRadius: 1, backgroundColor: corTexto, opacity: 0.35 }} /> : null}
    </Pressable>
  );
}
