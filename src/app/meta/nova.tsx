import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { FormularioMeta } from '@/components/FormularioMeta';
import { Botao } from '@/components/ui';
import { useHoje } from '@/estado/semana';
import { useTema } from '@/theme';

export default function NovaMetaEcra() {
  const { estilos } = useTema();
  const { areaId } = useLocalSearchParams<{ areaId?: string }>();
  const router = useRouter();
  const hoje = useHoje();
  const area = Number(areaId);

  if (!Number.isInteger(area) || area <= 0) {
    return (
      <View style={[estilos.ecra, estilos.conteudo]}>
        <Text style={estilos.corpo}>As metas criam-se a partir de uma área.</Text>
        <Botao titulo="Voltar" variante="contorno" onPress={() => router.back()} />
      </View>
    );
  }
  return <FormularioMeta areaId={area} hoje={hoje} aoFechar={() => router.back()} />;
}
