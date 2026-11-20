import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icone, type NomeIcone } from '@/components/Icone';
import { Cartao } from '@/components/ui';
import { t } from '@/i18n';
import { usePlus } from '@/plus';
import { fontes, useTema } from '@/theme';

/** Etiqueta "PLUS" ao lado das funcionalidades do Align Plus. */
export function EtiquetaPlus() {
  const { cores } = useTema();
  return (
    <View accessible accessibilityLabel={t('Faz parte do Align Plus')} style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1, borderColor: cores.tinta }}>
      <Text style={{ fontFamily: fontes.textoForte, fontSize: 10, lineHeight: 14, letterSpacing: 0.6, color: cores.tinta }}>PLUS</Text>
    </View>
  );
}

/** Cartão que abre uma funcionalidade do Align Plus: ícone, título com a etiqueta, explicação e seta. */
export function LigacaoPlus({ icone, titulo, texto, onPress }: { icone: NomeIcone; titulo: string; texto: string; onPress: () => void }) {
  const { cores, estilos } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={texto}
      onPress={onPress}
      style={({ pressed }) => [estilos.cartao, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, opacity: pressed ? 0.7 : 1 }]}
    >
      <Icone nome={icone} cor={cores.tinta} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flexShrink: 1, fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: cores.tinta }}>{titulo}</Text>
          <EtiquetaPlus />
        </View>
        <Text style={estilos.pequeno}>{texto}</Text>
      </View>
      <Icone nome="seta-direita" tamanho={18} cor={cores.texto3} espessura={2} />
    </Pressable>
  );
}

/**
 * Mostra o conteúdo a quem tem o Align Plus; aos outros, um convite com a `mensagem` (ex.: "As
 * estatísticas fazem parte do Align Plus."). Por agora o Plus está aberto a todos (ver src/plus.ts),
 * por isso mostra sempre o conteúdo.
 */
export function SoPlus({ children, mensagem }: { children: ReactNode; mensagem: string }) {
  const { estilos } = useTema();
  const plus = usePlus();
  if (plus) return <>{children}</>;
  return (
    <Cartao style={{ padding: 16, gap: 8 }}>
      <EtiquetaPlus />
      <Text style={estilos.corpo}>{mensagem}</Text>
    </Cartao>
  );
}
