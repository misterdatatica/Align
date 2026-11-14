import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Icone, type NomeIcone } from '@/components/Icone';
import { Botao, Cartao, Seccao, SeletorCor, estilos } from '@/components/ui';
import { apagarMeta, arquivarArea, atualizarArea, consultaArea, consultaMetas, criarMeta } from '@/data/areas';
import { alvoSemanal, formatarHoras, type PeriodoMeta } from '@/domain/regras';
import { cores, corDaArea, fontes } from '@/theme';

export default function AreaEcra() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const areaId = Number(id);
  const router = useRouter();
  const { data: linhas } = useLiveQuery(consultaArea(areaId), [areaId]);
  const { data: listaMetas } = useLiveQuery(consultaMetas(areaId), [areaId]);
  const area = linhas[0];

  if (!area) return null;
  const cor = corDaArea(area.cor);

  function arquivar() {
    Alert.alert('Arquivar área?', 'A área deixa de aparecer, mas o histórico fica guardado.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Arquivar',
        style: 'destructive',
        onPress: async () => {
          await arquivarArea(areaId);
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={[estilos.conteudo, { paddingTop: 4 }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: '' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: cor.tinta, alignItems: 'center', justifyContent: 'center' }}>
          <Icone nome={area.icone as NomeIcone} tamanho={24} cor={cor.texto} />
        </View>
        <Text style={estilos.titulo} accessibilityRole="header">
          {area.nome}
        </Text>
      </View>

      <Seccao titulo="Missão">
        <EditorMissao key={area.id} areaId={areaId} inicial={area.missao} />
      </Seccao>

      <Seccao titulo="Metas">
        <Cartao>
          {listaMetas.map((m, i) => (
            <View key={m.id} style={{ padding: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontes.textoForte, fontSize: 16, lineHeight: 22, color: cores.tinta }}>{m.descricao}</Text>
                <Text style={[estilos.pequeno, { marginTop: 2 }]}>
                  {m.tipo === 'horas' ? `Medida à semana: ${formatarHoras(m.alvoSemanal)}` : `${m.alvoSemanal}× por semana`}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Apagar meta ${m.descricao}`}
                onPress={() => apagarMeta(m.id, areaId)}
                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={[estilos.pequeno, { color: cores.texto2 }]}>Apagar</Text>
              </Pressable>
            </View>
          ))}
          <NovaMeta areaId={areaId} separador={listaMetas.length > 0} />
        </Cartao>
      </Seccao>

      <Seccao titulo="Cor">
        <SeletorCor valor={area.cor} onChange={(c) => atualizarArea(areaId, { cor: c })} />
      </Seccao>

      <Botao titulo="Arquivar área" variante="texto" onPress={arquivar} />
    </ScrollView>
  );
}

/** Guarda a missão quando o utilizador sai do campo. */
function EditorMissao({ areaId, inicial }: { areaId: number; inicial: string }) {
  const [missao, setMissao] = useState(inicial);
  return (
    <TextInput
      value={missao}
      onChangeText={setMissao}
      onEndEditing={() => {
        if (missao.trim() !== inicial) atualizarArea(areaId, { missao: missao.trim() });
      }}
      placeholder="Porque é que esta área importa?"
      placeholderTextColor={cores.texto3}
      multiline
      maxLength={140}
      accessibilityLabel="Missão"
      style={[estilos.cartao, { padding: 16, fontFamily: fontes.tituloMedio, fontSize: 20, lineHeight: 26, color: cores.tinta }]}
    />
  );
}

/** Formulário curto: "Meditar" + 2 h por dia → guarda 14 h por semana. */
function NovaMeta({ areaId, separador }: { areaId: number; separador: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoMeta>('dia');

  const numero = Number(valor.replace(',', '.'));
  const valido = descricao.trim().length > 0 && Number.isFinite(numero) && numero > 0;

  async function guardar() {
    try {
      await criarMeta({ areaId, descricao, tipo: 'horas', alvoSemanal: alvoSemanal(numero, periodo) });
      setDescricao('');
      setValor('');
      setAberto(false);
    } catch (e) {
      Alert.alert('Não foi possível guardar a meta', (e as Error).message);
    }
  }

  const borda = separador ? { borderTopWidth: 1, borderTopColor: cores.linhaSuave } : null;

  if (!aberto) {
    return (
      <View style={[{ paddingHorizontal: 8 }, borda]}>
        <Botao titulo="Adicionar meta" icone="mais" variante="texto" onPress={() => setAberto(true)} />
      </View>
    );
  }

  return (
    <View style={[{ padding: 16, gap: 10 }, borda]}>
      <TextInput value={descricao} onChangeText={setDescricao} placeholder="O quê? Ex.: Meditar" placeholderTextColor={cores.texto3} style={estilos.campo} accessibilityLabel="Descrição da meta" autoFocus />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput value={valor} onChangeText={setValor} placeholder="2" placeholderTextColor={cores.texto3} keyboardType="decimal-pad" style={[estilos.campo, { width: 72 }]} accessibilityLabel="Horas" />
        <Text style={estilos.corpo}>h por</Text>
        {(['dia', 'semana'] as const).map((p) => (
          <Pressable
            key={p}
            accessibilityRole="radio"
            accessibilityState={{ selected: periodo === p }}
            onPress={() => setPeriodo(p)}
            style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: periodo === p ? cores.tinta : cores.linha, backgroundColor: periodo === p ? cores.tinta : cores.superficie }}
          >
            <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, color: periodo === p ? '#FFFFFF' : cores.tinta }}>{p}</Text>
          </Pressable>
        ))}
      </View>
      {valido && periodo === 'dia' ? <Text style={estilos.pequeno}>{`Medida à semana: ${formatarHoras(alvoSemanal(numero, 'dia'))}`}</Text> : null}
      <Botao titulo="Guardar meta" onPress={guardar} disabled={!valido} />
    </View>
  );
}
