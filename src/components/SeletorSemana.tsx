import { Text, View } from 'react-native';

import { BotaoIcone } from '@/components/ui';
import { descreverSemana, descreverSemanaComAno, somarSemanas } from '@/domain/semana';
import { fontes, useTema } from '@/theme';

type Props = {
  semana: string;
  aoMudar: (semana: string) => void;
  /** Versão sem cartão, para o cabeçalho do Calendário. */
  compacto?: boolean;
};

/** Semana anterior / "16 – 22 nov 2026" / semana seguinte. */
export function SeletorSemana({ semana, aoMudar, compacto }: Props) {
  const { cores, estilos } = useTema();
  const anterior = <BotaoIcone icone="seta-esquerda" rotulo="Semana anterior" onPress={() => aoMudar(somarSemanas(semana, -1))} />;
  const seguinte = <BotaoIcone icone="seta-direita" rotulo="Semana seguinte" onPress={() => aoMudar(somarSemanas(semana, 1))} />;

  if (compacto) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {anterior}
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fontes.textoForte, fontSize: 14, lineHeight: 20, color: cores.tinta }}>
          {descreverSemana(semana)}
        </Text>
        {seguinte}
      </View>
    );
  }

  return (
    <View style={[estilos.cartao, { height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 1 }]}>
      {anterior}
      <Text accessibilityLiveRegion="polite" style={{ fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: cores.tinta }}>
        {descreverSemanaComAno(semana)}
      </Text>
      {seguinte}
    </View>
  );
}
