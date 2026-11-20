import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { comDesfazer } from '@/components/AvisoTemporario';
import { avisarErro } from '@/components/dialogos';
import { Botao, Opcao, Passo, Seccao } from '@/components/ui';
import { consultaAreasAtivas } from '@/data/areas';
import { useConsulta } from '@/data/consulta';
import { metasParaTarefas } from '@/data/metas';
import { apagarTarefa, criarTarefa, editarTarefa, type DadosTarefa } from '@/data/tarefas';
import type { Tarefa } from '@/db/schema';
import { instanciasPorSemana, type Recorrencia } from '@/domain/recorrencia';
import { formatarHoras } from '@/domain/regras';
import { DIAS_CURTOS, DIAS_LONGOS, descreverSemana } from '@/domain/semana';
import { DURACAO_MAXIMA_MIN, PASSO_DURACAO_MIN, formatarDuracao, nomeCurtoDe } from '@/domain/tarefas';
import { useTema } from '@/theme';
import { t } from '@/i18n';

type TipoRepeticao = 'nenhuma' | 'diaria' | 'vezes' | 'dias';

const REPETICOES = (): { tipo: TipoRepeticao; titulo: string }[] => [
  { tipo: 'nenhuma', titulo: t('Não repete') },
  { tipo: 'diaria', titulo: t('Todos os dias') },
  { tipo: 'vezes', titulo: t('Vezes por semana') },
  { tipo: 'dias', titulo: t('Dias certos') },
];

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
  /** Meta já escolhida ao abrir ("Nova tarefa para esta meta"). */
  metaInicial?: number;
  aoFechar: () => void;
};

/** Criar ou alterar uma tarefa: nome, área, duração, repetição e a meta para a qual contribui. */
export function FormularioTarefa({ semana, tarefa, areaInicial, metaInicial, aoFechar }: Props) {
  const { cores, estilos, corDaArea } = useTema();
  const listaAreas = useConsulta(() => consultaAreasAtivas().all(), ['areas']);
  const [nome, setNome] = useState(tarefa?.nome ?? '');
  const [nomeCurto, setNomeCurto] = useState(tarefa?.nomeCurto ?? '');
  const [areaId, setAreaId] = useState<number | null>(tarefa?.areaId ?? areaInicial ?? null);
  const [semDuracao, setSemDuracao] = useState(tarefa ? tarefa.duracaoMin === null : false);
  const [duracaoMin, setDuracaoMin] = useState(tarefa?.duracaoMin ?? 60);
  const [repeticao, setRepeticao] = useState<TipoRepeticao>(tipoDe(tarefa?.recorrencia));
  const [vezes, setVezes] = useState(tarefa?.recorrencia?.tipo === 'vezes_por_semana' ? tarefa.recorrencia.vezes : 3);
  const [dias, setDias] = useState<number[]>(tarefa?.recorrencia?.tipo === 'dias' ? tarefa.recorrencia.dias : []);
  const [metaId, setMetaId] = useState<number | null>(tarefa?.metaId ?? metaInicial ?? null);
  const [aGuardar, setAGuardar] = useState(false);

  // Com uma só área não há nada para escolher.
  const areaEscolhida = areaId ?? (listaAreas.length === 1 ? listaAreas[0].id : null);
  const listaMetas = useConsulta(() => (areaEscolhida === null ? [] : metasParaTarefas(areaEscolhida)), ['metas'], areaEscolhida ?? 0);
  const metaEscolhida = listaMetas.some((m) => m.id === metaId) ? metaId : null;

  const recorrencia: Recorrencia | null =
    repeticao === 'diaria' ? { tipo: 'diaria' } : repeticao === 'vezes' ? { tipo: 'vezes_por_semana', vezes } : repeticao === 'dias' ? { tipo: 'dias', dias } : null;
  const porSemana = instanciasPorSemana(recorrencia);
  const valido = nome.trim().length > 0 && areaEscolhida !== null && (repeticao !== 'dias' || dias.length > 0);

  let resumo: string | null = null;
  if (repeticao !== 'nenhuma' && porSemana > 0) {
    resumo = semDuracao
      ? porSemana === 1
        ? t('Nesta semana: 1 vez.')
        : t('Nesta semana: {n} vezes.', { n: porSemana })
      : t('Nesta semana: {n} × {duracao} = {total}.', { n: porSemana, duracao: formatarDuracao(duracaoMin) ?? '', total: formatarHoras((porSemana * duracaoMin) / 60) });
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
      avisarErro(tarefa ? t('Não foi possível guardar a tarefa') : t('Não foi possível criar a tarefa'), erro);
      setAGuardar(false);
    }
  }

  function apagar() {
    if (!tarefa) return;
    if (comDesfazer(`“${tarefa.nome}” apagada`, () => apagarTarefa(tarefa.id, semana), t('Não foi possível apagar a tarefa'))) aoFechar();
  }

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Seccao titulo={t('Nome')}>
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder={t('Ex.: Meditar')}
          placeholderTextColor={cores.texto3}
          style={estilos.campo}
          accessibilityLabel={t('Nome da tarefa')}
          autoFocus={!tarefa}
          maxLength={60}
          returnKeyType="done"
        />
      </Seccao>

      {listaAreas.length > 1 ? (
        <Seccao titulo={t('Área')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={t('Área')}>
            {listaAreas.map((a) => (
              <Opcao key={a.id} titulo={a.nome} ponto={areaEscolhida === a.id ? undefined : corDaArea(a.cor).forte} ativa={areaEscolhida === a.id} onPress={() => setAreaId(a.id)} />
            ))}
          </View>
        </Seccao>
      ) : null}

      <Seccao titulo={t('Duração')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <View style={{ opacity: semDuracao ? 0.4 : 1 }} pointerEvents={semDuracao ? 'none' : 'auto'}>
            <Passo
              rotulo={t('Duração')}
              valor={duracaoMin}
              texto={formatarDuracao(duracaoMin) ?? ''}
              minimo={PASSO_DURACAO_MIN}
              maximo={DURACAO_MAXIMA_MIN}
              passo={PASSO_DURACAO_MIN}
              onChange={setDuracaoMin}
            />
          </View>
          <Opcao titulo={t('Sem duração')} multipla ativa={semDuracao} onPress={() => setSemDuracao((v) => !v)} />
        </View>
        {semDuracao ? <Text style={estilos.pequeno}>{t('Não ocupa tempo no calendário. Conta cada vez que a marca como feita.')}</Text> : null}
      </Seccao>

      <Seccao titulo={t('Repetição')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={t('Repetição')}>
          {REPETICOES().map((r) => (
            <Opcao key={r.tipo} titulo={r.titulo} ativa={repeticao === r.tipo} onPress={() => setRepeticao(r.tipo)} />
          ))}
        </View>
        {repeticao === 'vezes' ? (
          <View style={{ flexDirection: 'row' }}>
            <Passo rotulo={t('Vezes por semana')} valor={vezes} texto={t('{n}× por semana', { n: vezes })} minimo={1} maximo={6} onChange={setVezes} />
          </View>
        ) : null}
        {repeticao === 'dias' ? (
          <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={t('Dias da semana')}>
            {DIAS_CURTOS.map((curto, i) => (
              <Opcao
                key={DIAS_LONGOS[i]}
                titulo={t(curto)[0]}
                rotulo={t(DIAS_LONGOS[i])}
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
        <Seccao titulo={t('Meta (opcional)')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={t('Meta associada')}>
            <Opcao titulo={t('Nenhuma')} ativa={metaEscolhida === null} onPress={() => setMetaId(null)} />
            {listaMetas.map((m) => (
              <Opcao key={m.id} titulo={m.estado === 'pausada' ? `${m.descricao} (pausada)` : m.descricao} ativa={metaEscolhida === m.id} onPress={() => setMetaId(m.id)} style={{ maxWidth: '100%', paddingVertical: 8 }} />
            ))}
          </View>
          <Text style={estilos.pequeno}>{t('Ligue a tarefa à meta que ela ajuda a alcançar. O tempo conta-se na tarefa, não na meta.')}</Text>
        </Seccao>
      ) : null}

      {semDuracao ? null : (
        <Seccao titulo={t('Nome no calendário (opcional)')}>
          <TextInput
            value={nomeCurto}
            onChangeText={setNomeCurto}
            placeholder={nome.trim() ? nomeCurtoDe(nome) : t('Ex.: Apres. Q4')}
            placeholderTextColor={cores.texto3}
            style={estilos.campo}
            accessibilityLabel={t('Nome curto para o calendário')}
            maxLength={12}
            returnKeyType="done"
          />
          <Text style={estilos.pequeno}>{t('Os blocos do calendário são estreitos: um nome curto lê-se melhor.')}</Text>
        </Seccao>
      )}

      <View style={{ gap: 4 }}>
        {tarefa ? <Text style={[estilos.pequeno, { textAlign: 'center' }]}>{t('As alterações valem a partir da semana de {semana}.', { semana: descreverSemana(semana) })}</Text> : null}
        <Botao titulo={tarefa ? t('Guardar alterações') : t('Criar tarefa')} onPress={guardar} disabled={!valido || aGuardar} />
        {tarefa ? <Botao titulo={t('Apagar tarefa')} icone="lixo" variante="perigo" onPress={apagar} /> : null}
      </View>
    </ScrollView>
  );
}
