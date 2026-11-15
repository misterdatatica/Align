import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { avisarErro, confirmar } from '@/components/dialogos';
import { Botao, Opcao, Passo, Seccao, estilos } from '@/components/ui';
import { consultaAreasAtivas, consultaMetas } from '@/data/areas';
import { useConsulta } from '@/data/consulta';
import { apagarTarefa, criarTarefa, editarTarefa, type DadosTarefa } from '@/data/tarefas';
import type { Tarefa } from '@/db/schema';
import { instanciasPorSemana, type Recorrencia } from '@/domain/recorrencia';
import { formatarHoras } from '@/domain/regras';
import { DIAS_LONGOS, descreverSemana } from '@/domain/semana';
import { DURACAO_MAXIMA_MIN, PASSO_DURACAO_MIN, formatarDuracao, nomeCurtoDe } from '@/domain/tarefas';
import { cores, corDaArea } from '@/theme';

type TipoRepeticao = 'nenhuma' | 'diaria' | 'vezes' | 'dias';

const REPETICOES: { tipo: TipoRepeticao; titulo: string }[] = [
  { tipo: 'nenhuma', titulo: 'Não repete' },
  { tipo: 'diaria', titulo: 'Todos os dias' },
  { tipo: 'vezes', titulo: 'Vezes por semana' },
  { tipo: 'dias', titulo: 'Dias certos' },
];
const INICIAIS_DIAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function tipoDe(recorrencia: Recorrencia | null | undefined): TipoRepeticao {
  if (!recorrencia) return 'nenhuma';
  return recorrencia.tipo === 'diaria' ? 'diaria' : recorrencia.tipo === 'dias' ? 'dias' : 'vezes';
}

type Props = {
  /** Semana (segunda-feira) em que a tarefa é criada ou a partir da qual é alterada. */
  semana: string;
  /** Tarefa a alterar; sem ela, o formulário cria uma nova. */
  tarefa?: Tarefa;
  /** Área já escolhida ao abrir (botão "+" de uma área). */
  areaInicial?: number;
  aoFechar: () => void;
};

/** Criar ou alterar uma tarefa: nome, área, duração, repetição e meta associada. */
export function FormularioTarefa({ semana, tarefa, areaInicial, aoFechar }: Props) {
  const listaAreas = useConsulta(() => consultaAreasAtivas().all(), ['areas']);
  const [nome, setNome] = useState(tarefa?.nome ?? '');
  const [nomeCurto, setNomeCurto] = useState(tarefa?.nomeCurto ?? '');
  const [areaId, setAreaId] = useState<number | null>(tarefa?.areaId ?? areaInicial ?? null);
  const [semDuracao, setSemDuracao] = useState(tarefa ? tarefa.duracaoMin === null : false);
  const [duracaoMin, setDuracaoMin] = useState(tarefa?.duracaoMin ?? 60);
  const [repeticao, setRepeticao] = useState<TipoRepeticao>(tipoDe(tarefa?.recorrencia));
  const [vezes, setVezes] = useState(tarefa?.recorrencia?.tipo === 'vezes_por_semana' ? tarefa.recorrencia.vezes : 3);
  const [dias, setDias] = useState<number[]>(tarefa?.recorrencia?.tipo === 'dias' ? tarefa.recorrencia.dias : []);
  const [metaId, setMetaId] = useState<number | null>(tarefa?.metaId ?? null);
  const [aGuardar, setAGuardar] = useState(false);

  // Com uma só área não há nada para escolher.
  const areaEscolhida = areaId ?? (listaAreas.length === 1 ? listaAreas[0].id : null);
  const listaMetas = useConsulta(() => (areaEscolhida === null ? [] : consultaMetas(areaEscolhida).all()), ['metas'], areaEscolhida ?? 0);
  const metaEscolhida = listaMetas.some((m) => m.id === metaId) ? metaId : null;

  const recorrencia: Recorrencia | null =
    repeticao === 'diaria' ? { tipo: 'diaria' } : repeticao === 'vezes' ? { tipo: 'vezes_por_semana', vezes } : repeticao === 'dias' ? { tipo: 'dias', dias } : null;
  const porSemana = instanciasPorSemana(recorrencia);
  const valido = nome.trim().length > 0 && areaEscolhida !== null && (repeticao !== 'dias' || dias.length > 0);

  let resumo: string | null = null;
  if (repeticao !== 'nenhuma' && porSemana > 0) {
    resumo = semDuracao
      ? `Nesta semana: ${porSemana} ${porSemana === 1 ? 'vez' : 'vezes'}.`
      : `Nesta semana: ${porSemana} × ${formatarDuracao(duracaoMin)} = ${formatarHoras((porSemana * duracaoMin) / 60)}.`;
  }

  function alternarDia(dia: number) {
    setDias((atuais) => (atuais.includes(dia) ? atuais.filter((d) => d !== dia) : [...atuais, dia].sort((a, b) => a - b)));
  }

  function guardar() {
    if (areaEscolhida === null) return;
    const dados: DadosTarefa = {
      areaId: areaEscolhida,
      metaId: metaEscolhida,
      nome,
      nomeCurto: semDuracao ? null : nomeCurto,
      duracaoMin: semDuracao ? null : duracaoMin,
      recorrencia,
    };
    setAGuardar(true);
    try {
      if (tarefa) editarTarefa(tarefa.id, semana, dados);
      else criarTarefa(dados, semana);
      aoFechar();
    } catch (erro) {
      avisarErro(tarefa ? 'Não foi possível guardar a tarefa' : 'Não foi possível criar a tarefa', erro);
      setAGuardar(false);
    }
  }

  async function apagar() {
    if (!tarefa) return;
    const sim = await confirmar({
      titulo: `Apagar “${tarefa.nome}”?`,
      mensagem: 'Sai desta semana e das seguintes. As semanas anteriores ficam no histórico.',
      acao: 'Apagar',
      destrutiva: true,
    });
    if (!sim) return;
    try {
      apagarTarefa(tarefa.id, semana);
      aoFechar();
    } catch (erro) {
      avisarErro('Não foi possível apagar a tarefa', erro);
    }
  }

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Seccao titulo="Nome">
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder="Ex.: Meditar"
          placeholderTextColor={cores.texto3}
          style={estilos.campo}
          accessibilityLabel="Nome da tarefa"
          autoFocus={!tarefa}
          maxLength={60}
          returnKeyType="done"
        />
      </Seccao>

      {listaAreas.length > 1 ? (
        <Seccao titulo="Área">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Área">
            {listaAreas.map((a) => (
              <Opcao key={a.id} titulo={a.nome} ponto={areaEscolhida === a.id ? undefined : corDaArea(a.cor).forte} ativa={areaEscolhida === a.id} onPress={() => setAreaId(a.id)} />
            ))}
          </View>
        </Seccao>
      ) : null}

      <Seccao titulo="Duração">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <View style={{ opacity: semDuracao ? 0.4 : 1 }} pointerEvents={semDuracao ? 'none' : 'auto'}>
            <Passo
              rotulo="Duração"
              valor={duracaoMin}
              texto={formatarDuracao(duracaoMin) ?? ''}
              minimo={PASSO_DURACAO_MIN}
              maximo={DURACAO_MAXIMA_MIN}
              passo={PASSO_DURACAO_MIN}
              onChange={setDuracaoMin}
            />
          </View>
          <Opcao titulo="Sem duração" multipla ativa={semDuracao} onPress={() => setSemDuracao((v) => !v)} />
        </View>
        {semDuracao ? <Text style={estilos.pequeno}>Não ocupa tempo no calendário. Conta cada vez que a marca como feita.</Text> : null}
      </Seccao>

      <Seccao titulo="Repetição">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Repetição">
          {REPETICOES.map((r) => (
            <Opcao key={r.tipo} titulo={r.titulo} ativa={repeticao === r.tipo} onPress={() => setRepeticao(r.tipo)} />
          ))}
        </View>
        {repeticao === 'vezes' ? (
          <View style={{ flexDirection: 'row' }}>
            <Passo rotulo="Vezes por semana" valor={vezes} texto={`${vezes}× por semana`} minimo={1} maximo={6} onChange={setVezes} />
          </View>
        ) : null}
        {repeticao === 'dias' ? (
          <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel="Dias da semana">
            {INICIAIS_DIAS.map((inicial, i) => (
              <Opcao
                key={DIAS_LONGOS[i]}
                titulo={inicial}
                rotulo={DIAS_LONGOS[i]}
                multipla
                ativa={dias.includes(i + 1)}
                onPress={() => alternarDia(i + 1)}
                style={{ flex: 1, paddingHorizontal: 0 }}
              />
            ))}
          </View>
        ) : null}
        {resumo ? <Text style={estilos.pequeno}>{resumo}</Text> : null}
      </Seccao>

      {listaMetas.length > 0 ? (
        <Seccao titulo="Meta (opcional)">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Meta associada">
            <Opcao titulo="Nenhuma" ativa={metaEscolhida === null} onPress={() => setMetaId(null)} />
            {listaMetas.map((m) => (
              <Opcao key={m.id} titulo={m.descricao} ativa={metaEscolhida === m.id} onPress={() => setMetaId(m.id)} />
            ))}
          </View>
          <Text style={estilos.pequeno}>O tempo desta tarefa conta para a meta escolhida.</Text>
        </Seccao>
      ) : null}

      {semDuracao ? null : (
        <Seccao titulo="Nome no calendário (opcional)">
          <TextInput
            value={nomeCurto}
            onChangeText={setNomeCurto}
            placeholder={nome.trim() ? nomeCurtoDe(nome) : 'Ex.: Apres. Q4'}
            placeholderTextColor={cores.texto3}
            style={estilos.campo}
            accessibilityLabel="Nome curto para o calendário"
            maxLength={12}
            returnKeyType="done"
          />
          <Text style={estilos.pequeno}>Os blocos do calendário são estreitos: um nome curto lê-se melhor.</Text>
        </Seccao>
      )}

      <View style={{ gap: 4 }}>
        {tarefa ? <Text style={[estilos.pequeno, { textAlign: 'center' }]}>{`As alterações valem a partir da semana de ${descreverSemana(semana)}.`}</Text> : null}
        <Botao titulo={tarefa ? 'Guardar alterações' : 'Criar tarefa'} onPress={guardar} disabled={!valido || aGuardar} />
        {tarefa ? <Botao titulo="Apagar tarefa" icone="lixo" variante="perigo" onPress={apagar} /> : null}
      </View>
    </ScrollView>
  );
}
