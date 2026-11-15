import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { avisarErro, confirmar } from '@/components/dialogos';
import { Botao, Opcao, estilos } from '@/components/ui';
import { apagarMeta, atualizarMeta, criarMeta } from '@/data/areas';
import type { Meta } from '@/db/schema';
import { alvoSemanal, alvoValido, descreverMeta, type PeriodoMeta, type TipoMeta } from '@/domain/regras';
import { cores } from '@/theme';

type Props = {
  areaId: number;
  /** Meta a alterar; sem ela, o formulário cria uma nova. */
  meta?: Meta;
  aoFechar: () => void;
};

/** O valor tal como o utilizador o escreveu: "2 h por dia" guarda-se como 14, mostra-se como "2". */
function valorInicial(meta: Meta | undefined): string {
  if (!meta) return '';
  const valor = meta.periodo === 'dia' ? meta.alvoSemanal / 7 : meta.alvoSemanal;
  return String(Math.round(valor * 100) / 100).replace('.', ',');
}

/**
 * Formulário curto. Tempo: "Meditar" + 2 h por dia → 14 h por semana.
 * Vezes: "A Course in Miracles" + 1 lição por dia → 7 por semana (conta por conclusão, sem tempo no calendário).
 */
export function FormularioMeta({ areaId, meta, aoFechar }: Props) {
  const [tipo, setTipo] = useState<TipoMeta>(meta?.tipo ?? 'horas');
  const [descricao, setDescricao] = useState(meta?.descricao ?? '');
  const [valor, setValor] = useState(valorInicial(meta));
  const [unidade, setUnidade] = useState(meta?.unidade ?? '');
  const [periodo, setPeriodo] = useState<PeriodoMeta>(meta?.periodo ?? 'dia');

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
    const dados = { descricao, tipo, periodo, unidade, alvoSemanal: alvoSemanal(numero, periodo) };
    try {
      if (meta) await atualizarMeta(meta.id, dados);
      else await criarMeta({ areaId, ...dados });
      aoFechar();
    } catch (e) {
      avisarErro('Não foi possível guardar a meta', e);
    }
  }

  async function apagar() {
    if (!meta) return;
    const sim = await confirmar({
      titulo: `Apagar a meta “${meta.descricao}”?`,
      mensagem: 'As tarefas ligadas a esta meta continuam a existir, mas deixam de contar para ela.',
      acao: 'Apagar',
      destrutiva: true,
    });
    if (!sim) return;
    try {
      await apagarMeta(meta.id, areaId);
      aoFechar();
    } catch (e) {
      avisarErro('Não foi possível apagar a meta', e);
    }
  }

  return (
    <View style={{ padding: 16, gap: 10 }}>
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
        autoFocus={!meta}
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Botao titulo="Cancelar" variante="texto" onPress={aoFechar} />
        {meta ? <Botao titulo="Apagar meta" icone="lixo" variante="perigo" onPress={apagar} /> : null}
      </View>
    </View>
  );
}
