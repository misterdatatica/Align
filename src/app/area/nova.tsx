import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Icone, iconesArea, type NomeIcone } from '@/components/Icone';
import { Botao, Seccao, SeletorCor, estilos } from '@/components/ui';
import { criarArea } from '@/data/areas';
import { cores, corDaArea } from '@/theme';

export default function NovaAreaEcra() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [missao, setMissao] = useState('');
  const [cor, setCor] = useState('violeta');
  const [icone, setIcone] = useState<NomeIcone>('folha');
  const [aGuardar, setAGuardar] = useState(false);
  const c = corDaArea(cor);

  async function guardar() {
    setAGuardar(true);
    try {
      const area = await criarArea({ nome, missao, cor, icone });
      router.replace({ pathname: '/area/[id]', params: { id: String(area.id) } });
    } catch (e) {
      Alert.alert('Não foi possível criar a área', (e as Error).message);
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
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {iconesArea.map((i) => {
            const ativo = i === icone;
            return (
              <Pressable
                key={i}
                accessibilityRole="radio"
                accessibilityLabel={i}
                accessibilityState={{ selected: ativo }}
                onPress={() => setIcone(i)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: ativo ? c.tinta : cores.superficie,
                  borderWidth: ativo ? 2 : 1,
                  borderColor: ativo ? c.forte : cores.linha,
                }}
              >
                <Icone nome={i} tamanho={22} cor={ativo ? c.texto : cores.texto2} />
              </Pressable>
            );
          })}
        </View>
      </Seccao>
      <Botao titulo="Criar área" onPress={guardar} disabled={aGuardar || !nome.trim()} />
      <Text style={[estilos.pequeno, { textAlign: 'center' }]}>Pode ter até 7 áreas. Menos áreas, mais foco.</Text>
    </ScrollView>
  );
}
