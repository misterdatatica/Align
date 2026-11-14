import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Icone, type NomeIcone } from '@/components/Icone';
import { Botao, Cartao, Seccao, SeletorCor, estilos } from '@/components/ui';
import { apagarMeta, arquivarArea, atualizarArea, consultaArea, consultaMetas, criarMeta } from '@/data/areas';
import { alvoSemanal, alvoValido, descreverMeta, type PeriodoMeta, type TipoMeta } from '@/domain/regras';
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
                  {descreverMeta(m)}
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

/**
 * Guarda a missão enquanto o utilizador escreve (com uma pequena pausa), ao sair do campo
 * e ao sair do ecrã — não depende de onEndEditing, que nem sempre dispara (web, voltar atrás).
 */
function EditorMissao({ areaId, inicial }: { areaId: number; inicial: string }) {
  const [missao, setMissao] = useState(inicial);
  const guardada = useRef(inicial.trim());
  const pendente = useRef<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const guardar = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    const texto = pendente.current;
    pendente.current = null;
    if (texto === null || texto === guardada.current) return;
    guardada.current = texto;
    atualizarArea(areaId, { missao: texto }).catch((e: Error) => Alert.alert('Não foi possível guardar a missão', e.message));
  }, [areaId]);

  // Ao sair do ecrã, guarda o que ainda estiver por guardar.
  useEffect(() => guardar, [guardar]);

  function mudar(texto: string) {
    setMissao(texto);
    pendente.current = texto.trim();
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(guardar, 600);
  }

  return (
    <TextInput
      value={missao}
      onChangeText={mudar}
      onBlur={guardar}
      placeholder="Porque é que esta área importa?"
      placeholderTextColor={cores.texto3}
      multiline
      maxLength={140}
      accessibilityLabel="Missão"
      style={[estilos.cartao, { padding: 16, fontFamily: fontes.tituloMedio, fontSize: 20, lineHeight: 26, color: cores.tinta }]}
    />
  );
}

/**
 * Formulário curto. Tempo: "Meditar" + 2 h por dia → 14 h por semana.
 * Vezes: "A Course in Miracles" + 1 lição por dia → 7 por semana (conta por conclusão, sem tempo no calendário).
 */
function NovaMeta({ areaId, separador }: { areaId: number; separador: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoMeta>('horas');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [unidade, setUnidade] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoMeta>('dia');

  // Nas metas de vezes o campo vazio vale 1 (o valor sugerido); só as de tempo exigem um número.
  const numero = tipo === 'vezes' && valor.trim() === '' ? 1 : Number(valor.replace(',', '.'));

  function escolherTipo(novo: TipoMeta) {
    setTipo(novo);
    // Um valor de horas como "1,5" não serve para vezes: limpa-o em vez de bloquear o botão.
    if (novo === 'vezes' && !Number.isInteger(Number(valor.replace(',', '.')))) setValor('');
  }
  const valido = descricao.trim().length > 0 && alvoValido(tipo, numero);
  const previsao = valido ? descreverMeta({ tipo, periodo, unidade, alvoSemanal: alvoSemanal(numero, periodo) }) : null;

  async function guardar() {
    try {
      await criarMeta({ areaId, descricao, tipo, periodo, unidade, alvoSemanal: alvoSemanal(numero, periodo) });
      setDescricao('');
      setValor('');
      setUnidade('');
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
      <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Medir por">
        <Opcao titulo="Tempo" ativa={tipo === 'horas'} onPress={() => escolherTipo('horas')} />
        <Opcao titulo="Vezes" ativa={tipo === 'vezes'} onPress={() => escolherTipo('vezes')} />
      </View>
      <TextInput
        value={descricao}
        onChangeText={setDescricao}
        placeholder={tipo === 'horas' ? 'O quê? Ex.: Meditar' : 'O quê? Ex.: A Course in Miracles'}
        placeholderTextColor={cores.texto3}
        style={estilos.campo}
        accessibilityLabel="Descrição da meta"
        autoFocus
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <TextInput
          value={valor}
          onChangeText={setValor}
          placeholder={tipo === 'horas' ? '2' : '1'}
          placeholderTextColor={cores.texto3}
          keyboardType={tipo === 'horas' ? 'decimal-pad' : 'number-pad'}
          style={[estilos.campo, { width: 72 }]}
          accessibilityLabel={tipo === 'horas' ? 'Horas' : 'Quantas vezes'}
        />
        {tipo === 'horas' ? (
          <Text style={estilos.corpo}>h</Text>
        ) : (
          <TextInput
            value={unidade}
            onChangeText={setUnidade}
            placeholder="lição (opcional)"
            placeholderTextColor={cores.texto3}
            autoCapitalize="none"
            maxLength={24}
            style={[estilos.campo, { flexGrow: 1, flexBasis: 140 }]}
            accessibilityLabel="Unidade, no singular (opcional)"
          />
        )}
        <Text style={estilos.corpo}>por</Text>
        {(['dia', 'semana'] as const).map((p) => (
          <Opcao key={p} titulo={p} ativa={periodo === p} onPress={() => setPeriodo(p)} />
        ))}
      </View>
      {previsao ? <Text style={estilos.pequeno}>{previsao}</Text> : null}
      {tipo === 'vezes' ? <Text style={estilos.pequeno}>Conta cada vez que marca a tarefa como feita. Não ocupa tempo no calendário.</Text> : null}
      {tipo === 'vezes' && valor.length > 0 && !Number.isInteger(numero) ? <Text style={estilos.pequeno}>Use um número inteiro.</Text> : null}
      <Botao titulo="Guardar meta" onPress={guardar} disabled={!valido} />
    </View>
  );
}

/** Pílula de escolha única (tipo de meta, período). */
function Opcao({ titulo, ativa, onPress }: { titulo: string; ativa: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: ativa }}
      onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: ativa ? cores.tinta : cores.linha, backgroundColor: ativa ? cores.tinta : cores.superficie }}
    >
      <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, color: ativa ? '#FFFFFF' : cores.tinta }}>{titulo}</Text>
    </Pressable>
  );
}
