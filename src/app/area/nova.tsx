import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput } from 'react-native';

import { avisarErro } from '@/components/dialogos';
import type { NomeIcone } from '@/components/Icone';
import { Botao, Seccao, SeletorCor, SeletorIcone } from '@/components/ui';
import { criarArea } from '@/data/areas';
import { useTema } from '@/theme';
import { t } from '@/i18n';

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
      avisarErro(t('Não foi possível criar a área'), e);
      setAGuardar(false);
    }
  }

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <Seccao titulo={t('Nome')}>
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder={t('Ex.: Espiritual')}
          placeholderTextColor={cores.texto3}
          style={estilos.campo}
          accessibilityLabel={t('Nome da área')}
          autoFocus
          maxLength={40}
        />
      </Seccao>
      <Seccao titulo={t('Missão')}>
        <TextInput
          value={missao}
          onChangeText={setMissao}
          placeholder={t('Porque é que esta área importa?')}
          placeholderTextColor={cores.texto3}
          style={[estilos.campo, { minHeight: 80, textAlignVertical: 'top' }]}
          accessibilityLabel={t('Missão da área')}
          multiline
          maxLength={140}
        />
      </Seccao>
      <Seccao titulo={t('Cor')}>
        <SeletorCor valor={cor} onChange={setCor} />
      </Seccao>
      <Seccao titulo={t('Ícone')}>
        <SeletorIcone valor={icone} cor={cor} onChange={setIcone} />
      </Seccao>
      <Botao titulo={t('Criar área')} onPress={guardar} disabled={aGuardar || !nome.trim()} />
      <Text style={[estilos.pequeno, { textAlign: 'center' }]}>{t('Pode ter até 7 áreas. Menos áreas, mais foco.')}</Text>
    </ScrollView>
  );
}
