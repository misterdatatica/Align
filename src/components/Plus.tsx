import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

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
