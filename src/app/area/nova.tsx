import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput } from 'react-native';

import { avisarErro } from '@/components/dialogos';
import type { NomeIcone } from '@/components/Icone';
import { Botao, Seccao, SeletorCor, SeletorIcone } from '@/components/ui';
import { criarArea } from '@/data/areas';
import { useTema } from '@/theme';

export default function NovaAreaEcra() {
  const { cores, estilos } = useTema();
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [missao, setMissao] = useState('');
  const [cor, setCor] = useState('violeta');
  const [icone, setIcone] = useState<NomeIcone>('folha');
  const [aGuardar, setAGuardar] = useState(false);

  async function guardar() {
    setAGuardar(true);
    try {
      const area = await criarArea({ nome, missao, cor, icone });
      router.replace({ pathname: '/area/[id]', params: { id: String(area.id) } });
    } catch (e) {
      avisarErro('Não foi possível criar a área', e);
      setAGuardar(false);
    }
  }

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <Seccao titulo="Nome">
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder="Ex.: Espiritual"
          placeholderTextColor={cores.texto3}
          style={estilos.campo}
          accessibilityLabel="Nome da área"
          autoFocus
          maxLength={40}
        />
      </Seccao>
      <Seccao titulo="Missão">
        <TextInput
          value={missao}
          onChangeText={setMissao}
          placeholder="Porque é que esta área importa?"
          placeholderTextColor={cores.texto3}
          style={[estilos.campo, { minHeight: 80, textAlignVertical: 'top' }]}
          accessibilityLabel="Missão da área"
          multiline
          maxLength={140}
        />
      </Seccao>
      <Seccao titulo="Cor">
        <SeletorCor valor={cor} onChange={setCor} />
      </Seccao>
      <Seccao titulo="Ícone">
        <SeletorIcone valor={icone} cor={cor} onChange={setIcone} />
      </Seccao>
      <Botao titulo="Criar área" onPress={guardar} disabled={aGuardar || !nome.trim()} />
      <Text style={[estilos.pequeno, { textAlign: 'center' }]}>Pode ter até 7 áreas. Menos áreas, mais foco.</Text>
    </ScrollView>
  );
}
