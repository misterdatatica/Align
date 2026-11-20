import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { comDesfazer } from '@/components/AvisoTemporario';
import { avisarErro } from '@/components/dialogos';
import { AvisoDeSemana } from '@/components/AvisoDeSemana';
import { FormularioMeta } from '@/components/FormularioMeta';
import { Icone } from '@/components/Icone';
import { AtualizarValor } from '@/components/metas/AtualizarValor';
import { GraficoMeta } from '@/components/metas/GraficoMeta';
import { TEXTO_ESTAGNADA, textoDoPrazo, textoDoProgresso } from '@/components/metas/textos';
import { BarraProgresso, Botao, BotaoIcone, Cartao, Seccao, estilos } from '@/components/ui';
import { useConsulta } from '@/data/consulta';
import { apagarMeta, apagarRegisto, carregarMeta, mudarEstadoDaMeta } from '@/data/metas';
import { NOME_DO_ESTADO, formatarValor, pontosDaLinha, valorComUnidade, type EstadoMeta } from '@/domain/metas';
import { descreverRecorrencia } from '@/domain/recorrencia';
import { descreverData, semanaNaFrase } from '@/domain/semana';
import { formatarDuracao } from '@/domain/tarefas';
import { useHoje, useSemanaAtual, useSemanaEscolhida } from '@/estado/semana';
import { cores, corDaArea, fontes } from '@/theme';

const TABELAS = ['areas', 'metas', 'metas_registos', 'tarefas', 'tarefas_semana'] as const;

/** O aviso que aparece ao mudar o estado de uma meta. */
const TEXTO_DO_ESTADO: Record<EstadoMeta, string> = { concluida: 'Meta concluída', pausada: 'Meta em pausa', abandonada: 'Meta abandonada', ativa: 'Meta ativa outra vez' };

export default function MetaEcra() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const metaId = Number(id);
  const router = useRouter();
  const hoje = useHoje();
  // A semana que se está a planear (a do separador Semana), não necessariamente a atual.
  const semana = useSemanaEscolhida();
  const atual = useSemanaAtual();
  const meta = useConsulta(() => carregarMeta(metaId, semana, hoje), TABELAS, `${metaId}|${semana}|${hoje}`);
  const [aAlterar, setAAlterar] = useState(false);

  if (!meta) {
    return (
      <View style={[estilos.ecra, estilos.conteudo]}>
        <Stack.Screen options={{ title: '' }} />
        <Text style={estilos.corpo}>Esta meta já não existe.</Text>
        <Botao titulo="Voltar" variante="contorno" onPress={() => router.back()} />
      </View>
    );
  }

  if (aAlterar) {
    return (
      <>
        <Stack.Screen options={{ title: 'Alterar meta' }} />
        <FormularioMeta areaId={meta.areaId} meta={meta} hoje={hoje} aoFechar={() => setAAlterar(false)} />
      </>
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
        avisarErro('Não foi possível mudar a meta', erro);
      }
      return;
    }
    comDesfazer(TEXTO_DO_ESTADO[estado], () => mudarEstadoDaMeta(metaId, estado), 'Não foi possível mudar a meta');
  }

  /** Apaga a meta e o histórico; as tarefas ligadas ficam, sem meta. */
  function apagar() {
    if (comDesfazer('Meta apagada', () => apagarMeta(metaId), 'Não foi possível apagar a meta')) router.back();
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
              <Text style={{ fontFamily: fontes.textoForte, fontSize: 12, lineHeight: 16, color: cores.texto2 }}>{NOME_DO_ESTADO[meta.estado]}</Text>
            </View>
          )}
        </View>
        <Text style={[estilos.titulo, { fontSize: 24, lineHeight: 30 }]} accessibilityRole="header">
          {meta.descricao}
        </Text>
        <Text style={[estilos.pequeno, atrasada ? { color: cores.perigo } : null]}>{textoDoPrazo(meta)}</Text>
      </View>

      <Seccao titulo="Progresso">
        <Cartao style={{ padding: 16, gap: 14 }}>
          {numero ? (
            <>
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ fontFamily: fontes.titulo, fontSize: 22, lineHeight: 28, color: cores.tinta }}>{textoDoProgresso(meta)}</Text>
                  <Text style={estilos.pequeno}>{`${Math.round(meta.progresso * 100)}% do caminho`}</Text>
                </View>
                <BarraProgresso valor={meta.progresso} cor={cor.forte} pista={cores.linhaSuave} />
                <Text style={estilos.pequeno}>{`Partiu de ${valorComUnidade(meta.valorInicial!, meta.unidade)}.`}</Text>
              </View>
              <GraficoMeta pontos={pontosDaLinha(meta.criadoEm.slice(0, 10), meta.valorInicial!, meta.registos)} alvo={meta.valorAlvo!} prazo={meta.prazo} unidade={meta.unidade} cor={cor.forte} />
              {ativa ? <AtualizarValor key={`${meta.id}|${meta.valorAtual}`} meta={meta} hoje={hoje} /> : null}
              {ativa && meta.alcancada ? (
                <View style={{ gap: 8 }}>
                  <Text style={estilos.corpo}>Chegou ao alvo.</Text>
                  <Botao titulo="Concluir meta" icone="certo" onPress={() => mudarEstado('concluida')} />
                </View>
              ) : null}
              {ativa && meta.estagnada && !meta.alcancada ? <Aviso texto={TEXTO_ESTAGNADA} /> : null}
            </>
          ) : (
            <>
              <Text style={{ fontFamily: fontes.titulo, fontSize: 22, lineHeight: 28, color: cores.tinta }}>{textoDoProgresso(meta)}</Text>
              {ativa ? <Botao titulo="Marcar como alcançada" icone="certo" onPress={() => mudarEstado('concluida')} /> : null}
            </>
          )}
        </Cartao>
      </Seccao>

      <Seccao titulo="Tarefas ligadas">
        <AvisoDeSemana semana={semana} />
        <Cartao style={{ overflow: 'hidden' }}>
          {meta.tarefas.map((t, i) => (
            <View key={t.id} style={{ paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
              <Text style={{ fontFamily: fontes.textoMedio, fontSize: 15, lineHeight: 20, color: cores.tinta }}>{t.nome}</Text>
              <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>
                {[formatarDuracao(t.duracaoMin) ?? 'sem duração', descreverRecorrencia(t.recorrencia) ?? 'não repete', t.total > 0 ? `${t.feitas}/${t.total} feitas ${semanaNaFrase(semana, atual, 'em')}` : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
          {meta.tarefas.length === 0 ? <Text style={[estilos.pequeno, { padding: 16, paddingBottom: 4 }]}>O que vai fazer para lá chegar? Ligue tarefas a esta meta.</Text> : null}
          {ativa || meta.estado === 'pausada' ? (
            <View style={[{ paddingHorizontal: 8 }, meta.tarefas.length > 0 ? { borderTopWidth: 1, borderTopColor: cores.linhaSuave } : null]}>
              <Botao
                titulo="Nova tarefa para esta meta"
                icone="mais"
                variante="texto"
                onPress={() => router.push({ pathname: '/tarefa/nova', params: { areaId: String(meta.areaId), metaId: String(meta.id), semana } })}
              />
            </View>
          ) : null}
        </Cartao>
        <Text style={estilos.pequeno}>Para ligar uma tarefa que já existe, abra-a e escolha esta meta.</Text>
      </Seccao>

      {numero && meta.registos.length > 0 ? (
        <Seccao titulo="Histórico">
          <Cartao style={{ overflow: 'hidden' }}>
            {[...meta.registos].reverse().map((r, i) => (
              <View key={r.data} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
                <Text style={{ flex: 1, fontFamily: fontes.texto, fontSize: 14, lineHeight: 20, color: cores.texto2 }}>{descreverData(r.data)}</Text>
                <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, lineHeight: 20, color: cores.tinta, fontVariant: ['tabular-nums'] }}>{formatarValor(r.valor)}</Text>
                <BotaoIcone icone="fechar" rotulo={`Apagar o registo de ${descreverData(r.data)}`} tamanho={16} cor={cores.texto3} onPress={() => comDesfazer('Registo apagado', () => apagarRegisto(meta.id, r.data), 'Não foi possível apagar o registo')} />
              </View>
            ))}
          </Cartao>
        </Seccao>
      ) : null}

      <View style={{ gap: 4 }}>
        <Botao titulo="Alterar meta" icone="lapis" variante="contorno" onPress={() => setAAlterar(true)} />
        {ativa ? (
          <>
            <Botao titulo="Pausar meta" icone="pausa" variante="texto" onPress={() => mudarEstado('pausada')} style={{ justifyContent: 'center' }} />
            <Botao titulo="Abandonar meta" variante="texto" onPress={() => mudarEstado('abandonada')} style={{ justifyContent: 'center' }} />
          </>
        ) : (
          <Botao titulo={meta.estado === 'pausada' ? 'Retomar meta' : 'Voltar a ativar'} variante="texto" onPress={() => mudarEstado('ativa')} style={{ justifyContent: 'center' }} />
        )}
        {meta.estado === 'pausada' ? <Text style={[estilos.pequeno, { textAlign: 'center' }]}>Em pausa: o histórico e as tarefas ligadas ficam guardados.</Text> : null}
        <Botao titulo="Apagar meta" icone="lixo" variante="perigo" onPress={apagar} />
      </View>
    </ScrollView>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: cores.fundo }}>
      <View style={{ marginTop: 1 }}>
        <Icone nome="aviso" tamanho={16} cor={cores.texto2} />
      </View>
      <Text style={[estilos.pequeno, { flex: 1, color: cores.texto2 }]}>{texto}</Text>
    </View>
  );
}
