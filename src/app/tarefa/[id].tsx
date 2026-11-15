import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { FormularioTarefa } from '@/components/FormularioTarefa';
import { Botao, estilos } from '@/components/ui';
import { carregarTarefa } from '@/data/tarefas';
import { useSemanaAtual } from '@/estado/semana';

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export default function EditarTarefaEcra() {
  const { id, semana } = useLocalSearchParams<{ id: string; semana?: string }>();
  const semanaAtual = useSemanaAtual();
  const router = useRouter();
  // Lida uma vez: o formulário trabalha sobre uma cópia até se guardar.
  const [tarefa] = useState(() => carregarTarefa(Number(id)));

  if (!tarefa) {
    return (
      <View style={[estilos.ecra, estilos.conteudo]}>
        <Text style={estilos.corpo}>Esta tarefa já não existe.</Text>
        <Botao titulo="Voltar" variante="contorno" onPress={() => router.back()} />
      </View>
    );
  }

  return <FormularioTarefa tarefa={tarefa} semana={semana && DATA_ISO.test(semana) ? semana : semanaAtual} aoFechar={() => router.back()} />;
}
