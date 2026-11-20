import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { FormularioMeta } from '@/components/FormularioMeta';
import { Botao } from '@/components/ui';
import { carregarMeta } from '@/data/metas';
import { useHoje, useSemanaEscolhida } from '@/estado/semana';
import { t } from '@/i18n';
import { useTema } from '@/theme';

/** Alterar uma meta, num modal (como "Alterar tarefa"). */
export default function AlterarMetaEcra() {
  const { estilos } = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const hoje = useHoje();
  const semana = useSemanaEscolhida();
  // Lida uma vez: o formulário trabalha sobre uma cópia até se guardar.
  const [meta] = useState(() => carregarMeta(Number(id), semana, hoje));

  if (!meta) {
    return (
      <View style={[estilos.ecra, estilos.conteudo]}>
        <Text style={estilos.corpo}>{t('Esta meta já não existe.')}</Text>
        <Botao titulo={t('Voltar')} variante="contorno" onPress={() => router.back()} />
      </View>
    );
  }
  return <FormularioMeta areaId={meta.areaId} meta={meta} hoje={hoje} aoFechar={() => router.back()} />;
}
