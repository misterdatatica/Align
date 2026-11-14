import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type TextStyle, type ViewStyle } from 'react-native';

import { cores, coresArea, fontes } from '@/theme';
import { Icone, type NomeIcone } from './Icone';

export function Titulo({ children, subtitulo }: { children: ReactNode; subtitulo?: string }) {
  return (
    <View style={{ gap: 4 }}>
      {subtitulo ? <Text style={estilos.subtitulo}>{subtitulo}</Text> : null}
      <Text style={estilos.titulo} accessibilityRole="header">
        {children}
      </Text>
    </View>
  );
}

export function Seccao({ titulo, direita, children, style }: { titulo: string; direita?: ReactNode; children: ReactNode; style?: ViewStyle }) {
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
  return <View style={[estilos.cartao, style]}>{children}</View>;
}

type BotaoProps = Omit<PressableProps, 'children' | 'style'> & {
  titulo: string;
  icone?: NomeIcone;
  variante?: 'primario' | 'tracejado' | 'texto';
  style?: ViewStyle;
};

export function Botao({ titulo, icone, variante = 'primario', style, disabled, ...resto }: BotaoProps) {
  const cor = variante === 'primario' ? '#FFFFFF' : cores.tinta;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        estilos.botao,
        variante === 'primario' && { backgroundColor: cores.tinta },
        variante === 'tracejado' && { borderWidth: 1.5, borderStyle: 'dashed', borderColor: cores.tracejado },
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

export function SeletorCor({ valor, onChange }: { valor: string; onChange: (id: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
      {coresArea.map((c) => {
        const ativa = c.id === valor;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="radio"
            accessibilityLabel={c.nome}
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

export const estilos = StyleSheet.create({
  ecra: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 16, gap: 20, paddingBottom: 32 },
  titulo: { fontFamily: fontes.titulo, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: cores.tinta },
  subtitulo: { fontFamily: fontes.textoMedio, fontSize: 13, lineHeight: 18, color: cores.texto3 },
  rotulo: { fontFamily: fontes.textoForte, fontSize: 12, lineHeight: 16, letterSpacing: 0.7, color: cores.texto3 },
  cartao: { backgroundColor: cores.superficie, borderRadius: 16, borderWidth: 1, borderColor: cores.linha },
  botao: { minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  textoBotao: { fontFamily: fontes.textoForte, fontSize: 15 },
  corpo: { fontFamily: fontes.texto, fontSize: 15, lineHeight: 20, color: cores.tinta } as TextStyle,
  pequeno: { fontFamily: fontes.texto, fontSize: 13, lineHeight: 18, color: cores.texto3 } as TextStyle,
  campo: {
    fontFamily: fontes.texto,
    fontSize: 16,
    color: cores.tinta,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: '#8A909A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  } as TextStyle,
});
