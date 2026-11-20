import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/components/ui';
import type { Ambito } from '@/domain/proposta';
import { fontes, useTema } from '@/theme';
import { t } from '@/i18n';

type Props = {
  /** O que se está a mudar, ex.: "Mover “Meditar” para ter 07:00?". */
  titulo: string;
  aoEscolher: (ambito: Ambito) => void;
  aoCancelar: () => void;
};

/**
 * A pergunta que se faz ao mover, alterar ou retirar um bloco de uma tarefa recorrente:
 * "Só esta semana" (a semana seguinte volta ao horário habitual) ou "Esta e as seguintes".
 */
export function EscolhaDeAmbito({ titulo, aoEscolher, aoCancelar }: Props) {
  const { cores, estilos } = useTema();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fontes.titulo, fontSize: 20, lineHeight: 26, color: cores.tinta }} accessibilityRole="header">
          {titulo}
        </Text>
        <Text style={estilos.pequeno}>{t('Esta tarefa repete-se. A mudança vale só para esta semana ou passa a ser o horário habitual?')}</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Botao titulo={t('Só esta semana')} variante="contorno" onPress={() => aoEscolher('semana')} />
        <Botao titulo={t('Esta e as seguintes')} onPress={() => aoEscolher('seguintes')} />
        <Botao titulo={t('Cancelar')} variante="texto" onPress={aoCancelar} style={{ justifyContent: 'center' }} />
      </View>
    </View>
  );
}

/** A mesma pergunta numa folha própria, para quando o bloco foi mudado a arrastar. */
export function FolhaDeAmbito({ pergunta, aoEscolher, aoCancelar }: { pergunta: string | null; aoEscolher: (ambito: Ambito) => void; aoCancelar: () => void }) {
  const { cores } = useTema();
  const margens = useSafeAreaInsets();
  return (
    <Modal visible={pergunta !== null} transparent animationType="slide" onRequestClose={aoCancelar} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Cancelar')} onPress={aoCancelar} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: cores.veu }} />
        <View accessibilityViewIsModal style={{ backgroundColor: cores.fundo, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 20, paddingBottom: Math.max(margens.bottom, 16) }}>
          {pergunta !== null ? <EscolhaDeAmbito titulo={pergunta} aoEscolher={aoEscolher} aoCancelar={aoCancelar} /> : null}
        </View>
      </View>
    </Modal>
  );
}
