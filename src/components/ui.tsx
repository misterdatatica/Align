import type { ReactNode } from 'react';
import { Pressable, Text, View, type PressableProps, type ViewStyle } from 'react-native';

import { fontes, useTema } from '@/theme';
import { Icone, iconesArea, type NomeIcone } from './Icone';
import { t } from '@/i18n';

/** Altura de linha de cada tamanho de título do design. */
const ALTURA_TITULO = { 30: 36, 28: 34, 24: 32 } as const;

/** Título do ecrã. O design usa 30 px nas Áreas, 28 px na Semana e na Revisão e 24 px no Calendário. */
export function Titulo({ children, subtitulo, tamanho = 30 }: { children: ReactNode; subtitulo?: string; tamanho?: 30 | 28 | 24 }) {
  const { estilos } = useTema();
  return (
    <View style={{ gap: 4 }}>
      {subtitulo ? <Text style={estilos.subtitulo}>{subtitulo}</Text> : null}
      <Text style={[estilos.titulo, { fontSize: tamanho, lineHeight: ALTURA_TITULO[tamanho] }]} accessibilityRole="header">
        {children}
      </Text>
    </View>
  );
}

export function Seccao({ titulo, direita, children, style }: { titulo: string; direita?: ReactNode; children: ReactNode; style?: ViewStyle }) {
  const { estilos } = useTema();
  return (
    <View style={[{ gap: 8 }, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={estilos.rotulo} accessibilityRole="header">
          {titulo.toUpperCase()}
        </Text>
        {direita}
      </View>
      {children}
    </View>
  );
}

export function Cartao({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { estilos } = useTema();
  return <View style={[estilos.cartao, style]}>{children}</View>;
}

type BotaoProps = Omit<PressableProps, 'children' | 'style'> & {
  titulo: string;
  icone?: NomeIcone;
  /** `perigo` é para ações que apagam: texto vermelho, sem fundo. */
  variante?: 'primario' | 'tracejado' | 'texto' | 'contorno' | 'perigo';
  style?: ViewStyle;
};

export function Botao({ titulo, icone, variante = 'primario', style, disabled, ...resto }: BotaoProps) {
  const { cores, estilos } = useTema();
  const cor = variante === 'primario' ? cores.sobreTinta : variante === 'perigo' ? cores.perigo : cores.tinta;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        estilos.botao,
        variante === 'primario' && { backgroundColor: cores.tinta },
        variante === 'tracejado' && { borderWidth: 1.5, borderStyle: 'dashed', borderColor: cores.tracejado },
        variante === 'contorno' && { borderWidth: 1, borderColor: cores.contorno, backgroundColor: cores.superficie },
        variante === 'texto' && { justifyContent: 'flex-start', paddingHorizontal: 8 },
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.7 },
        style,
      ]}
      {...resto}
    >
      {icone ? <Icone nome={icone} tamanho={18} cor={cor} espessura={2} /> : null}
      <Text style={[estilos.textoBotao, { color: cor }]}>{titulo}</Text>
    </Pressable>
  );
}

type BotaoIconeProps = Omit<PressableProps, 'children' | 'style'> & {
  icone: NomeIcone;
  /** O que o botão faz, para o leitor de ecrã. */
  rotulo: string;
  cor?: string;
  tamanho?: number;
  style?: ViewStyle;
};

/** Botão só com ícone, com alvo de toque de 44 px. */
export function BotaoIcone({ icone, rotulo, cor: corPedida, tamanho = 20, style, disabled, ...resto }: BotaoIconeProps) {
  const { cores } = useTema();
  const cor = corPedida ?? cores.tinta;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      disabled={disabled}
      style={({ pressed }) => [
        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
        (pressed || disabled) && { opacity: disabled ? 0.3 : 0.6 },
        style,
      ]}
      {...resto}
    >
      <Icone nome={icone} tamanho={tamanho} cor={cor} espessura={2} />
    </Pressable>
  );
}

/** Pílula de escolha única ou múltipla (tipo de meta, duração, dias da semana…). */
export function Opcao({
  titulo,
  ativa,
  onPress,
  rotulo,
  multipla,
  ponto,
  style,
}: {
  titulo: string;
  ativa: boolean;
  onPress: () => void;
  /** Texto para o leitor de ecrã quando o título é uma abreviatura (ex.: "S" → "segunda"). */
  rotulo?: string;
  /** Faz parte de um grupo onde se podem escolher várias. */
  multipla?: boolean;
  /** Cor de um ponto à esquerda (ex.: a cor da área). */
  ponto?: string;
  style?: ViewStyle;
}) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole={multipla ? 'checkbox' : 'radio'}
      accessibilityLabel={rotulo}
      accessibilityState={multipla ? { checked: ativa } : { selected: ativa }}
      onPress={onPress}
      style={[
        {
          minHeight: 44,
          minWidth: 44,
          paddingHorizontal: 14,
          borderRadius: 999,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: ativa ? cores.tinta : cores.contorno,
          backgroundColor: ativa ? cores.tinta : cores.superficie,
        },
        style,
      ]}
    >
      {ponto ? <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: ponto }} /> : null}
      <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, color: ativa ? cores.sobreTinta : cores.tinta }}>{titulo}</Text>
    </Pressable>
  );
}

/** Menos / valor / mais, para números pequenos (duração, vezes por semana). */
export function Passo({
  valor,
  texto,
  minimo,
  maximo,
  passo = 1,
  onChange,
  rotulo,
}: {
  valor: number;
  /** Como mostrar o valor, ex.: "1,5 h". */
  texto: string;
  minimo: number;
  maximo: number;
  passo?: number;
  onChange: (valor: number) => void;
  /** O que se está a ajustar, para o leitor de ecrã (ex.: "Duração"). */
  rotulo: string;
}) {
  const { cores } = useTema();
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={rotulo}
      accessibilityValue={{ text: texto }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment' && valor < maximo) onChange(Math.min(maximo, valor + passo));
        if (e.nativeEvent.actionName === 'decrement' && valor > minimo) onChange(Math.max(minimo, valor - passo));
      }}
      style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: cores.contorno, backgroundColor: cores.superficie }}
    >
      <BotaoIcone icone="menos" rotulo={t('Menos {campo}', { campo: rotulo.toLowerCase() })} disabled={valor <= minimo} onPress={() => onChange(Math.max(minimo, valor - passo))} />
      <Text style={{ minWidth: 64, textAlign: 'center', fontFamily: fontes.textoForte, fontSize: 16, color: cores.tinta, fontVariant: ['tabular-nums'] }}>{texto}</Text>
      <BotaoIcone icone="mais" rotulo={t('Mais {campo}', { campo: rotulo.toLowerCase() })} disabled={valor >= maximo} onPress={() => onChange(Math.min(maximo, valor + passo))} />
    </View>
  );
}

/** Barra de progresso do design: 8 px, cantos redondos, pista cinzenta. */
export function BarraProgresso({ valor, cor, pista: pistaPedida }: { valor: number; cor: string; pista?: string }) {
  const { cores } = useTema();
  const pista = pistaPedida ?? cores.pista;
  const proporcao = Math.min(1, Math.max(0, valor));
  return (
    <View style={{ height: 8, borderRadius: 999, backgroundColor: pista, overflow: 'hidden' }} aria-hidden>
      <View style={{ width: `${proporcao * 100}%`, height: '100%', borderRadius: 999, backgroundColor: cor }} />
    </View>
  );
}

export function SeletorCor({ valor, onChange }: { valor: string; onChange: (id: string) => void }) {
  const { cores, coresArea } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
      {coresArea.map((c) => {
        const ativa = c.id === valor;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="radio"
            accessibilityLabel={t(c.nome)}
            accessibilityState={{ selected: ativa }}
            onPress={() => onChange(c.id)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              backgroundColor: c.forte,
              borderWidth: ativa ? 3 : 0,
              borderColor: cores.fundo,
              outlineColor: cores.tinta,
              outlineWidth: ativa ? 2 : 0,
              outlineStyle: 'solid',
            }}
          />
        );
      })}
    </View>
  );
}

/** Escolha do ícone da área; o ícone ativo usa a cor da área. */
export function SeletorIcone({ valor, cor, onChange }: { valor: string; cor: string; onChange: (nome: NomeIcone) => void }) {
  const { cores, corDaArea } = useTema();
  const c = corDaArea(cor);
  return (
    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }} accessibilityRole="radiogroup" accessibilityLabel={t('Ícone')}>
      {iconesArea.map((i) => {
        const ativo = i === valor;
        return (
          <Pressable
            key={i}
            accessibilityRole="radio"
            accessibilityLabel={i}
            accessibilityState={{ selected: ativo }}
            onPress={() => onChange(i)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: ativo ? c.tinta : cores.superficie,
              borderWidth: ativo ? 2 : 1,
              borderColor: ativo ? c.forte : cores.linha,
            }}
          >
            <Icone nome={i} tamanho={22} cor={ativo ? c.texto : cores.texto2} />
          </Pressable>
        );
      })}
    </View>
  );
}
