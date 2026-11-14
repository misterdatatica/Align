import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Cartao, Titulo, estilos } from '@/components/ui';
import { descreverSemana, inicioDaSemana } from '@/domain/semana';
import { fontes } from '@/theme';

/** Ecrã provisório para as fases seguintes do plano de entrega. */
export function EmBreve({ titulo, fase, descricao }: { titulo: string; fase: string; descricao: string }) {
  const semana = useMemo(() => inicioDaSemana(new Date()), []);
  return (
    <SafeAreaView style={estilos.ecra} edges={['top']}>
      <View style={estilos.conteudo}>
        <Titulo subtitulo={`Semana de ${descreverSemana(semana)}`}>{titulo}</Titulo>
        <Cartao style={{ padding: 16, gap: 6 }}>
          <Text style={[estilos.corpo, { fontFamily: fontes.textoForte }]}>{fase}</Text>
          <Text style={estilos.pequeno}>{descricao}</Text>
        </Cartao>
      </View>
    </SafeAreaView>
  );
}
