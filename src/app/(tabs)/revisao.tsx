import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CampoAutoGuardado } from '@/components/CampoAutoGuardado';
import { avisarErro, confirmar } from '@/components/dialogos';
import { Icone } from '@/components/Icone';
import { AtualizarValor } from '@/components/metas/AtualizarValor';
import { TEXTO_ESTAGNADA, textoDoPrazo, textoDoProgresso } from '@/components/metas/textos';
import { BarraProgresso, Botao, Cartao, Seccao, Titulo, estilos } from '@/components/ui';
import { useConsulta } from '@/data/consulta';
import { mudarEstadoDaMeta, type MetaDetalhada } from '@/data/metas';
import { carregarRevisao, fecharRevisao, guardarReflexao, reabrirRevisao, responderBloco, type RevisaoDaSemana } from '@/data/revisao';
import { abrirProposta } from '@/data/semanas';
import { formatarIntervalo } from '@/domain/calendario';
import { formatarHoras, formatarProgressoHoras, progresso } from '@/domain/regras';
import { percentagemCumprida } from '@/domain/revisao';
import { DIAS_CURTOS, descreverDia, descreverSemanaPorExtenso, somarSemanas } from '@/domain/semana';
import { formatarDuracao } from '@/domain/tarefas';
import { escolherSemana, useHoje } from '@/estado/semana';
import { cores, corDaArea, fontes } from '@/theme';

const TABELAS = ['areas', 'metas', 'metas_registos', 'tarefas', 'tarefas_semana', 'blocos', 'revisoes', 'definicoes'] as const;

export default function RevisaoEcra() {
  const hoje = useHoje();
  const revisao = useConsulta(() => carregarRevisao(hoje), TABELAS, hoje);
  // A escolha das tarefas que passam recomeça quando muda a semana em revisão.
  return <Revisao key={revisao.semana} revisao={revisao} hoje={hoje} />;
}

function Revisao({ revisao, hoje }: { revisao: RevisaoDaSemana; hoje: string }) {
  const router = useRouter();
  const { semana, disponivel, fechadaEm, areas, porConfirmar, porFazer, metas } = revisao;
  /** Marcos marcados como alcançados nesta revisão: deixam de estar ativos, mas ficam à vista. */
  const [alcancadas, setAlcancadas] = useState<{ id: number; descricao: string }[]>([]);
  const seguinte = somarSemanas(semana, 1);
  const fechada = fechadaEm !== null;
  /** Tarefas por fazer que o utilizador desmarcou: essas não passam para a semana seguinte. */
  const [ficam, setFicam] = useState<ReadonlySet<number>>(new Set());

  function alternar(tarefaId: number) {
    setFicam((atuais) => {
      const novas = new Set(atuais);
      if (!novas.delete(tarefaId)) novas.add(tarefaId);
      return novas;
    });
  }

  /** O último passo: abre a proposta da semana seguinte (criada como cópia da que passou, se ainda não existir). */
  function planear() {
    try {
      abrirProposta(seguinte);
    } catch (erro) {
      avisarErro('Não foi possível criar a proposta da semana', erro);
    }
    escolherSemana(seguinte);
    router.navigate('/semana');
  }

  function concluir(meta: MetaDetalhada) {
    tentar('Não foi possível concluir a meta', () => {
      mudarEstadoDaMeta(meta.id, 'concluida');
      setAlcancadas((atuais) => [...atuais, { id: meta.id, descricao: meta.descricao }]);
    });
  }

  async function fechar() {
    if (porConfirmar.length > 0) {
      const sim = await confirmar({
        titulo: porConfirmar.length === 1 ? 'Há 1 bloco por marcar' : `Há ${porConfirmar.length} blocos por marcar`,
        mensagem: 'Os blocos por marcar contam como não feitos. Fechar a revisão assim?',
        acao: 'Fechar revisão',
      });
      if (!sim) return;
    }
    try {
      fecharRevisao(
        semana,
        porFazer.filter((t) => !ficam.has(t.tarefaId)).map((t) => t.tarefaId),
      );
      planear();
    } catch (erro) {
      avisarErro('Não foi possível fechar a revisão', erro);
    }
  }

  function tentar(titulo: string, acao: () => void) {
    try {
      acao();
    } catch (erro) {
      avisarErro(titulo, erro);
    }
  }

  const planeado = revisao.minutosPlaneados > 0;

  return (
    <SafeAreaView style={estilos.ecra} edges={['top']}>
      <ScrollView contentContainerStyle={[estilos.conteudo, { gap: 24 }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Titulo tamanho={28} subtitulo={`Semana de ${descreverSemanaPorExtenso(semana)}`}>
          Revisão da semana
        </Titulo>

        {!revisao.temTarefas ? (
          <Cartao style={{ padding: 16, gap: 12 }}>
            <Text style={estilos.corpo}>Ainda não há nada para rever nesta semana. Planeie as tarefas e ponha-as no calendário; no fim da semana, a revisão mostra como correu.</Text>
            <Botao titulo="Planear a semana" variante="contorno" onPress={() => router.navigate('/semana')} />
          </Cartao>
        ) : (
          <>
            <View style={{ gap: 12, marginTop: -8 }}>
              {disponivel ? null : (
                <Text style={estilos.pequeno}>{`A revisão desta semana abre ${descreverDia(revisao.abreEm)}. Até lá, é assim que a semana vai.`}</Text>
              )}
              <Cartao style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 }}>
                  <Text style={{ fontFamily: fontes.titulo, fontSize: 34, lineHeight: 40, letterSpacing: -0.7, color: cores.tinta }}>{formatarHoras(revisao.minutosFeitos / 60)}</Text>
                  <Text style={{ fontFamily: fontes.texto, fontSize: 14, lineHeight: 20, color: cores.texto3 }}>
                    {planeado ? `de ${formatarHoras(revisao.minutosPlaneados / 60)} planeadas` : 'feitas'}
                  </Text>
                </View>
                {planeado ? (
                  <Text style={{ marginTop: 4, fontFamily: fontes.texto, fontSize: 13, lineHeight: 18, color: cores.texto2 }}>
                    {`${disponivel ? 'Cumpriu' : 'Vai em'} ${percentagemCumprida(revisao.minutosFeitos, revisao.minutosPlaneados)}% do plano.`}
                  </Text>
                ) : null}
              </Cartao>
            </View>

            {areas.length > 0 ? (
              <Seccao titulo="Por área">
                <Cartao style={{ padding: 16, gap: 16 }}>
                  {areas.map((a) => (
                    <View key={a.id} accessible accessibilityLabel={`${a.nome}: ${formatarProgressoHoras(a.minutosFeitos / 60, a.minutosPlaneados / 60)}`}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: corDaArea(a.cor).forte }} />
                          <Text style={{ flexShrink: 1, fontFamily: fontes.textoForte, fontSize: 14, lineHeight: 20, color: cores.tinta }} numberOfLines={1}>
                            {a.nome}
                          </Text>
                        </View>
                        <Text style={{ fontFamily: fontes.texto, fontSize: 13, lineHeight: 20, color: cores.texto2, fontVariant: ['tabular-nums'] }}>
                          {formatarProgressoHoras(a.minutosFeitos / 60, a.minutosPlaneados / 60)}
                        </Text>
                      </View>
                      <View style={{ marginTop: 6 }}>
                        <BarraProgresso valor={progresso(a.minutosFeitos, a.minutosPlaneados)} cor={corDaArea(a.cor).forte} />
                      </View>
                    </View>
                  ))}
                </Cartao>
              </Seccao>
            ) : null}

            {disponivel && !fechada && porConfirmar.length > 0 ? (
              <Seccao titulo="Feito?">
                <Text style={[estilos.pequeno, { marginTop: -4 }]}>Estes blocos estão no calendário mas ainda não foram marcados.</Text>
                <Cartao style={{ overflow: 'hidden' }}>
                  {porConfirmar.map((b, i) => (
                    <View key={b.blocoId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingLeft: 16, paddingRight: 8, paddingVertical: 6, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontFamily: fontes.textoMedio, fontSize: 15, lineHeight: 20, color: cores.tinta }} numberOfLines={1}>
                          {b.nome}
                        </Text>
                        <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>
                          {`${b.area} · ${DIAS_CURTOS[b.dia]?.toLowerCase() ?? ''} ${formatarIntervalo(b.inicioMin, b.fimMin)}`}
                        </Text>
                      </View>
                      <Resposta titulo="Não" rotulo={`${b.nome}: não foi feito`} onPress={() => tentar('Não foi possível marcar o bloco', () => responderBloco(b.blocoId, false))} />
                      <Resposta titulo="Feito" rotulo={`${b.nome}: feito`} cheia onPress={() => tentar('Não foi possível marcar o bloco', () => responderBloco(b.blocoId, true))} />
                    </View>
                  ))}
                </Cartao>
              </Seccao>
            ) : null}

            {disponivel && porFazer.length > 0 ? (
              <Seccao titulo="Ficou por fazer">
                <Text style={[estilos.pequeno, { marginTop: -4, fontSize: 12, lineHeight: 16 }]}>
                  {fechada ? 'O que não foi feito nesta semana.' : `As tarefas marcadas passam para a semana de ${descreverSemanaPorExtenso(seguinte)}.`}
                </Text>
                <Cartao style={{ overflow: 'hidden' }}>
                  {porFazer.map((t, i) => {
                    const passa = !ficam.has(t.tarefaId);
                    const detalhe = [t.area, formatarDuracao(t.duracaoMin)].filter(Boolean).join(' · ');
                    return (
                      <Pressable
                        key={t.tarefaId}
                        disabled={fechada}
                        accessibilityRole={fechada ? 'text' : 'checkbox'}
                        accessibilityLabel={`${t.nome}, ${detalhe}${fechada ? (t.transitou ? ', passou para a semana seguinte' : '') : ''}`}
                        accessibilityState={fechada ? undefined : { checked: passa }}
                        onPress={() => alternar(t.tarefaId)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}
                      >
                        {fechada ? null : <Caixa marcada={passa} />}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontFamily: fontes.textoMedio, fontSize: 15, lineHeight: 20, color: cores.tinta }} numberOfLines={2}>
                            {t.nome}
                          </Text>
                          <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>
                            {fechada && t.transitou ? `${detalhe} · passou para a semana seguinte` : detalhe}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </Cartao>
              </Seccao>
            ) : null}

            {disponivel && (metas.length > 0 || alcancadas.length > 0) ? (
              <Seccao titulo="Como estão as suas metas?">
                <Text style={[estilos.pequeno, { marginTop: -4, fontSize: 12, lineHeight: 16 }]}>Atualize o valor das metas de número e marque os marcos que alcançou.</Text>
                <Cartao style={{ overflow: 'hidden' }}>
                  {metas.map((m, i) => (
                    <View key={m.id} style={{ padding: 16, gap: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
                      <View style={{ gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: corDaArea(m.area.cor).forte }} />
                          <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>{`${m.area.nome} · ${textoDoPrazo(m).toLowerCase()}`}</Text>
                        </View>
                        <Text style={{ fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: cores.tinta }}>{m.descricao}</Text>
                      </View>
                      {m.medida === 'numero' ? (
                        <>
                          <View style={{ gap: 6 }}>
                            <Text style={{ fontFamily: fontes.texto, fontSize: 13, lineHeight: 18, color: cores.texto2, fontVariant: ['tabular-nums'] }}>{textoDoProgresso(m)}</Text>
                            <BarraProgresso valor={m.progresso} cor={corDaArea(m.area.cor).forte} />
                          </View>
                          <AtualizarValor key={`${m.id}|${m.valorAtual}`} meta={m} hoje={hoje} />
                          {m.alcancada ? (
                            <Botao titulo="Chegou ao alvo: concluir meta" icone="certo" variante="contorno" accessibilityLabel={`Concluir a meta ${m.descricao}`} onPress={() => concluir(m)} />
                          ) : null}
                        </>
                      ) : (
                        <Botao titulo="Alcançada" icone="certo" variante="contorno" accessibilityLabel={`${m.descricao}: alcançada`} onPress={() => concluir(m)} />
                      )}
                      {m.estagnada && !m.alcancada ? (
                        <View style={{ gap: 4, padding: 12, borderRadius: 12, backgroundColor: cores.fundo }}>
                          <Text style={[estilos.pequeno, { color: cores.texto2 }]}>{TEXTO_ESTAGNADA}</Text>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Rever a meta ${m.descricao}`} onPress={() => router.push({ pathname: '/meta/[id]', params: { id: String(m.id) } })} style={{ minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' }}>
                            <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, color: cores.tinta, textDecorationLine: 'underline' }}>Rever a meta</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ))}
                  {alcancadas.map((m, i) => (
                    <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: i === 0 && metas.length === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
                      <Icone nome="certo" tamanho={16} cor={cores.texto2} espessura={2.2} />
                      <Text style={{ flex: 1, fontFamily: fontes.textoMedio, fontSize: 14, lineHeight: 20, color: cores.texto2 }}>{`${m.descricao} — concluída`}</Text>
                    </View>
                  ))}
                </Cartao>
              </Seccao>
            ) : null}

            {disponivel ? (
              <Seccao titulo="Reflexão">
                <View style={{ gap: 12 }}>
                  <Nota titulo="O que correu bem?" inicial={revisao.correuBem} guardar={(texto) => guardarReflexao(semana, { correuBem: texto })} />
                  <Nota titulo="O que quero mudar?" inicial={revisao.queroMudar} guardar={(texto) => guardarReflexao(semana, { queroMudar: texto })} />
                </View>
              </Seccao>
            ) : null}

            {disponivel ? (
              <View style={{ gap: 4 }}>
                {fechada ? <Text style={[estilos.pequeno, { textAlign: 'center' }]}>Revisão fechada.</Text> : null}
                <Botao
                  titulo={`Planear a semana de ${descreverSemanaPorExtenso(seguinte)}`}
                  accessibilityHint="Abre a proposta da semana seguinte, para rever e aceitar"
                  onPress={fechada ? planear : fechar}
                  style={{ minHeight: 52, paddingHorizontal: 12 }}
                />
                {fechada ? (
                  <Botao titulo="Reabrir a revisão" variante="texto" onPress={() => tentar('Não foi possível reabrir a revisão', () => reabrirRevisao(semana))} style={{ justifyContent: 'center' }} />
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Caixa de visto do design: 22 px, escura quando marcada. */
function Caixa({ marcada }: { marcada: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: marcada ? 0 : 1.5,
        borderColor: cores.tracejado,
        backgroundColor: marcada ? cores.tinta : cores.superficie,
      }}
    >
      {marcada ? <Icone nome="certo" tamanho={15} cor="#FFFFFF" espessura={2.6} /> : null}
    </View>
  );
}

/** Botão pequeno das respostas a "Feito?". */
function Resposta({ titulo, rotulo, cheia, onPress }: { titulo: string; rotulo: string; cheia?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        minWidth: 56,
        paddingHorizontal: 12,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: cheia ? cores.tinta : cores.contorno,
        backgroundColor: cheia ? cores.tinta : cores.superficie,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, color: cheia ? '#FFFFFF' : cores.tinta }}>{titulo}</Text>
    </Pressable>
  );
}

/** Pergunta de reflexão com um campo que se guarda sozinho. */
function Nota({ titulo, inicial, guardar }: { titulo: string; inicial: string; guardar: (texto: string) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, lineHeight: 20, color: cores.tinta }}>{titulo}</Text>
      <CampoAutoGuardado
        inicial={inicial}
        guardar={async (texto) => guardar(texto)}
        erro="Não foi possível guardar a nota"
        placeholder="Escreva aqui…"
        multiline
        maxLength={500}
        accessibilityLabel={titulo}
        style={{
          minHeight: 72,
          textAlignVertical: 'top',
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: cores.contornoCampo,
          backgroundColor: cores.superficie,
          fontFamily: fontes.texto,
          fontSize: 15,
          lineHeight: 20,
          color: cores.tinta,
        }}
      />
    </View>
  );
}
