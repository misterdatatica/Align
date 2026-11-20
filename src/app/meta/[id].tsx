import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { comDesfazer } from '@/components/AvisoTemporario';
import { avisarErro } from '@/components/dialogos';
import { AvisoDeSemana } from '@/components/AvisoDeSemana';
import { Icone } from '@/components/Icone';
import { AtualizarValor } from '@/components/metas/AtualizarValor';
import { GraficoMeta } from '@/components/metas/GraficoMeta';
import { textoEstagnada, textoDoPrazo, textoDoProgresso } from '@/components/metas/textos';
import { BarraProgresso, Botao, BotaoIcone, Cartao, Seccao } from '@/components/ui';
import { useConsulta } from '@/data/consulta';
import { apagarMeta, apagarRegisto, carregarMeta, mudarEstadoDaMeta } from '@/data/metas';
import { NOME_DO_ESTADO, formatarValor, pontosDaLinha, valorComUnidade, type EstadoMeta } from '@/domain/metas';
import { descreverRecorrencia } from '@/domain/recorrencia';
import { descreverData, semanaNaFrase } from '@/domain/semana';
import { formatarDuracao } from '@/domain/tarefas';
import { useHoje, useSemanaAtual, useSemanaEscolhida } from '@/estado/semana';
import { fontes, useTema } from '@/theme';
import { t } from '@/i18n';

const TABELAS = ['areas', 'metas', 'metas_registos', 'tarefas', 'tarefas_semana'] as const;

/** O aviso que aparece ao mudar o estado de uma meta. */
const textoDoEstado = (estado: EstadoMeta): string =>
  ({ concluida: t('Meta concluída'), pausada: t('Meta em pausa'), abandonada: t('Meta abandonada'), ativa: t('Meta ativa outra vez') })[estado];

export default function MetaEcra() {
  const { cores, estilos, corDaArea } = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const metaId = Number(id);
  const router = useRouter();
  const hoje = useHoje();
  // A semana que se está a planear (a do separador Semana), não necessariamente a atual.
  const semana = useSemanaEscolhida();
  const atual = useSemanaAtual();
  const meta = useConsulta(() => carregarMeta(metaId, semana, hoje), TABELAS, `${metaId}|${semana}|${hoje}`);

  if (!meta) {
    return (
      <View style={[estilos.ecra, estilos.conteudo]}>
        <Stack.Screen options={{ title: '' }} />
        <Text style={estilos.corpo}>{t('Esta meta já não existe.')}</Text>
        <Botao titulo={t('Voltar')} variante="contorno" onPress={() => router.back()} />
      </View>
    );
  }


  const cor = corDaArea(meta.area.cor);
  const ativa = meta.estado === 'ativa';
  const numero = meta.medida === 'numero' && meta.valorInicial !== null && meta.valorAlvo !== null;
  const atrasada = ativa && meta.diasQueFaltam < 0;

  /** Concluir, pausar e abandonar fazem-se logo, com uns segundos para desfazer. */
  function mudarEstado(estado: EstadoMeta) {
    if (estado === 'ativa') {
      try {
        mudarEstadoDaMeta(metaId, estado);
      } catch (erro) {
        avisarErro(t('Não foi possível mudar a meta'), erro);
      }
      return;
    }
    comDesfazer(textoDoEstado(estado), () => mudarEstadoDaMeta(metaId, estado), t('Não foi possível mudar a meta'));
  }

  /** Apaga a meta e o histórico; as tarefas ligadas ficam, sem meta. */
  function apagar() {
    if (comDesfazer(t('Meta apagada'), () => apagarMeta(metaId), t('Não foi possível apagar a meta'))) router.back();
  }

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={[estilos.conteudo, { paddingTop: 4 }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: cor.forte }} />
          <Text style={estilos.subtitulo}>{`Meta · ${meta.area.nome}`}</Text>
          {ativa ? null : (
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: cores.pista }}>
              <Text style={{ fontFamily: fontes.textoForte, fontSize: 12, lineHeight: 16, color: cores.texto2 }}>{t(NOME_DO_ESTADO[meta.estado])}</Text>
            </View>
          )}
        </View>
        <Text style={[estilos.titulo, { fontSize: 24, lineHeight: 30 }]} accessibilityRole="header">
          {meta.descricao}
        </Text>
        <Text style={[estilos.pequeno, atrasada ? { color: cores.perigo } : null]}>{textoDoPrazo(meta)}</Text>
      </View>

      <Seccao titulo={t('Progresso')}>
        <Cartao style={{ padding: 16, gap: 14 }}>
          {numero ? (
            <>
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ fontFamily: fontes.titulo, fontSize: 22, lineHeight: 28, color: cores.tinta }}>{textoDoProgresso(meta)}</Text>
                  <Text style={estilos.pequeno}>{t('{p}% do caminho', { p: Math.round(meta.progresso * 100) })}</Text>
                </View>
                <BarraProgresso valor={meta.progresso} cor={cor.forte} pista={cores.linhaSuave} />
                <Text style={estilos.pequeno}>{t('Partiu de {valor}.', { valor: valorComUnidade(meta.valorInicial!, meta.unidade) })}</Text>
              </View>
              <GraficoMeta pontos={pontosDaLinha(meta.criadoEm.slice(0, 10), meta.valorInicial!, meta.registos)} alvo={meta.valorAlvo!} prazo={meta.prazo} unidade={meta.unidade} cor={cor.forte} />
              {ativa ? <AtualizarValor key={`${meta.id}|${meta.valorAtual}`} meta={meta} hoje={hoje} /> : null}
              {ativa && meta.alcancada ? (
                <View style={{ gap: 8 }}>
                  <Text style={estilos.corpo}>{t('Chegou ao alvo.')}</Text>
                  <Botao titulo={t('Concluir meta')} icone="certo" onPress={() => mudarEstado('concluida')} />
                </View>
              ) : null}
              {ativa && meta.estagnada && !meta.alcancada ? <Aviso texto={textoEstagnada()} /> : null}
            </>
          ) : (
            <>
              <Text style={{ fontFamily: fontes.titulo, fontSize: 22, lineHeight: 28, color: cores.tinta }}>{textoDoProgresso(meta)}</Text>
              {ativa ? <Botao titulo={t('Marcar como alcançada')} icone="certo" onPress={() => mudarEstado('concluida')} /> : null}
            </>
          )}
        </Cartao>
      </Seccao>

      <Seccao titulo={t('Tarefas ligadas')}>
        <AvisoDeSemana semana={semana} />
        <Cartao style={{ overflow: 'hidden' }}>
          {meta.tarefas.map((tf, i) => (
            <View key={tf.id} style={{ paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
              <Text style={{ fontFamily: fontes.textoMedio, fontSize: 15, lineHeight: 20, color: cores.tinta }}>{tf.nome}</Text>
              <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>
                {[formatarDuracao(tf.duracaoMin) ?? t('sem duração'), descreverRecorrencia(tf.recorrencia) ?? t('não repete'), tf.total > 0 ? t('{feitas}/{total} feitas {quando}', { feitas: tf.feitas, total: tf.total, quando: semanaNaFrase(semana, atual, 'em') }) : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
          {meta.tarefas.length === 0 ? <Text style={[estilos.pequeno, { padding: 16, paddingBottom: 4 }]}>{t('O que vai fazer para lá chegar? Ligue tarefas a esta meta.')}</Text> : null}
          {ativa || meta.estado === 'pausada' ? (
            <View style={[{ paddingHorizontal: 8 }, meta.tarefas.length > 0 ? { borderTopWidth: 1, borderTopColor: cores.linhaSuave } : null]}>
              <Botao
                titulo={t('Nova tarefa para esta meta')}
                icone="mais"
                variante="texto"
                onPress={() => router.push({ pathname: '/tarefa/nova', params: { areaId: String(meta.areaId), metaId: String(meta.id), semana } })}
              />
            </View>
          ) : null}
        </Cartao>
        <Text style={estilos.pequeno}>{t('Para ligar uma tarefa que já existe, abra-a e escolha esta meta.')}</Text>
      </Seccao>

      {numero && meta.registos.length > 0 ? (
        <Seccao titulo={t('Histórico')}>
          <Cartao style={{ overflow: 'hidden' }}>
            {[...meta.registos].reverse().map((r, i) => (
              <View key={r.data} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
                <Text style={{ flex: 1, fontFamily: fontes.texto, fontSize: 14, lineHeight: 20, color: cores.texto2 }}>{descreverData(r.data)}</Text>
                <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, lineHeight: 20, color: cores.tinta, fontVariant: ['tabular-nums'] }}>{formatarValor(r.valor)}</Text>
                <BotaoIcone icone="fechar" rotulo={t('Apagar o registo de {dia}', { dia: descreverData(r.data) })} tamanho={16} cor={cores.texto3} onPress={() => comDesfazer(t('Registo apagado'), () => apagarRegisto(meta.id, r.data), t('Não foi possível apagar o registo'))} />
              </View>
            ))}
          </Cartao>
        </Seccao>
      ) : null}

      <View style={{ gap: 4 }}>
        <Botao titulo={t('Alterar meta')} icone="lapis" variante="contorno" onPress={() => router.push({ pathname: '/meta/alterar', params: { id: String(meta.id) } })} />
        {ativa ? (
          <>
            <Botao titulo={t('Pausar meta')} icone="pausa" variante="texto" onPress={() => mudarEstado('pausada')} style={{ justifyContent: 'center' }} />
            <Botao titulo={t('Abandonar meta')} variante="texto" onPress={() => mudarEstado('abandonada')} style={{ justifyContent: 'center' }} />
          </>
        ) : (
          <Botao titulo={meta.estado === 'pausada' ? t('Retomar meta') : t('Voltar a ativar')} variante="texto" onPress={() => mudarEstado('ativa')} style={{ justifyContent: 'center' }} />
        )}
        {meta.estado === 'pausada' ? <Text style={[estilos.pequeno, { textAlign: 'center' }]}>{t('Em pausa: o histórico e as tarefas ligadas ficam guardados.')}</Text> : null}
        <Botao titulo={t('Apagar meta')} icone="lixo" variante="perigo" onPress={apagar} />
      </View>
    </ScrollView>
  );
}

function Aviso({ texto }: { texto: string }) {
  const { cores, estilos } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: cores.fundo }}>
      <View style={{ marginTop: 1 }}>
        <Icone nome="aviso" tamanho={16} cor={cores.texto2} />
      </View>
      <Text style={[estilos.pequeno, { flex: 1, color: cores.texto2 }]}>{texto}</Text>
    </View>
  );
}
