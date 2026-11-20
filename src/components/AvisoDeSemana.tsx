import { Pressable, Text, View } from 'react-native';

import { Icone } from '@/components/Icone';
import { descreverSemanaPorExtenso } from '@/domain/semana';
import { escolherSemana, useSemanaAtual } from '@/estado/semana';
import { fontes, useTema } from '@/theme';

/**
 * Faixa que diz que o ecrã está a mostrar outra semana que não a atual (a que se está a planear no
 * separador Semana), com um atalho para voltar a esta semana. Na semana atual não aparece.
 */
export function AvisoDeSemana({ semana }: { semana: string }) {
  const { cores } = useTema();
  const atual = useSemanaAtual();
  if (semana === atual) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: 4, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: cores.contorno, backgroundColor: cores.superficie }}
    >
      <Icone nome="calendario" tamanho={18} cor={cores.tinta} />
      <Text style={{ flex: 1, fontFamily: fontes.textoMedio, fontSize: 13, lineHeight: 18, color: cores.tinta }}>
        {`A ver a semana de ${descreverSemanaPorExtenso(semana)}${semana < atual ? ', que já passou' : ''}.`}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => escolherSemana(atual)}
        style={({ pressed }) => ({ minHeight: 40, justifyContent: 'center', paddingHorizontal: 10, opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, color: cores.tinta, textDecorationLine: 'underline' }}>Voltar a esta semana</Text>
      </Pressable>
    </View>
  );
}
