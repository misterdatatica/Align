import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { comDesfazer } from '@/components/AvisoTemporario';
import { CampoAutoGuardado } from '@/components/CampoAutoGuardado';
import { avisarErro, confirmar } from '@/components/dialogos';
import { exportarCopia, ondeGuardarACopia } from '@/components/exportarCopia';
import { Icone } from '@/components/Icone';
import { AtualizarValor } from '@/components/metas/AtualizarValor';
import { textoEstagnada, textoDoPrazo, textoDoProgresso } from '@/components/metas/textos';
import { LigacaoPlus } from '@/components/Plus';
import { BarraProgresso, Botao, BotaoIcone, Cartao, Seccao, Titulo } from '@/components/ui';
import { useConsulta } from '@/data/consulta';
import { mudarEstadoDaMeta, type MetaDetalhada } from '@/data/metas';
import { precisaDeCopia } from '@/data/definicoes';
import { carregarRevisao, comecarRevisao, fecharRevisao, guardarReflexao, reabrirRevisao, responderBloco, type RevisaoDaSemana } from '@/data/revisao';
import { formatarIntervalo } from '@/domain/calendario';
import { formatarHoras, formatarProgressoHoras, progresso } from '@/domain/regras';
import { percentagemCumprida } from '@/domain/revisao';
import { DIAS_CURTOS, descreverDia, descreverSemanaPorExtenso, somarSemanas } from '@/domain/semana';
import { formatarDuracao } from '@/domain/tarefas';
import { escolherSemana, useHoje } from '@/estado/semana';
import { fontes, useTema } from '@/theme';
import { t } from '@/i18n';

const TABELAS = ['areas', 'metas', 'metas_registos', 'tarefas', 'tarefas_semana', 'blocos', 'revisoes', 'definicoes'] as const;

export default function RevisaoEcra() {
  const hoje = useHoje();
  const revisao = useConsulta(() => carregarRevisao(hoje), TABELAS, hoje);
  // A escolha das tarefas que passam recomeça quando muda a semana em revisão.
  return <Revisao key={revisao.semana} revisao={revisao} hoje={hoje} />;
}

function Revisao({ revisao, hoje }: { revisao: RevisaoDaSemana; hoje: string }) {
  const { cores, estilos, corDaArea } = useTema();
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

  const semCopia = useConsulta(() => precisaDeCopia(), ['definicoes']);

  /** Depois de fechar: a semana seguinte já está planeada (igual a esta); abre-a para a ajustar. */
  function planear() {
    escolherSemana(seguinte);
    router.navigate('/semana');
  }

  function concluir(meta: MetaDetalhada) {
    const ok = comDesfazer(
      t('Meta concluída'),
      () => mudarEstadoDaMeta(meta.id, 'concluida'),
      t('Não foi possível concluir a meta'),
      () => setAlcancadas((atuais) => atuais.filter((m) => m.id !== meta.id)),
    );
    if (ok) setAlcancadas((atuais) => [...atuais, { id: meta.id, descricao: meta.descricao }]);
  }

  async function fechar() {
    if (porConfirmar.length > 0) {
      const sim = await confirmar({
        titulo: porConfirmar.length === 1 ? t('Há 1 bloco por marcar') : t('Há {n} blocos por marcar', { n: porConfirmar.length }),
        mensagem: t('Os blocos por marcar contam como não feitos. Fechar a revisão assim?'),
        acao: t('Fechar revisão'),
      });
      if (!sim) return;
    }
    try {
      fecharRevisao(
        semana,
        porFazer.filter((tf) => !ficam.has(tf.tarefaId)).map((tf) => tf.tarefaId),
      );
    } catch (erro) {
      avisarErro(t('Não foi possível fechar a revisão'), erro);
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
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Titulo tamanho={28} subtitulo={t('Semana de {semana}', { semana: descreverSemanaPorExtenso(semana) })}>
              {t('Revisão da semana')}
            </Titulo>
          </View>
          <BotaoIcone icone="grafico" rotulo={t('Estatísticas e histórico')} tamanho={22} cor={cores.texto2} onPress={() => router.push('/estatisticas')} style={{ marginRight: -10, marginTop: -4 }} />
        </View>

        {!revisao.temTarefas ? (
          <Cartao style={{ padding: 16, gap: 12 }}>
            <Text style={estilos.corpo}>{t('Ainda não há nada para rever nesta semana. Planeie as tarefas e ponha-as no calendário; no fim da semana, a revisão mostra como correu.')}</Text>
            <Botao titulo={t('Planear a semana')} variante="contorno" onPress={() => router.navigate('/semana')} />
          </Cartao>
        ) : (
          <>
            <View style={{ gap: 12, marginTop: -8 }}>
              {disponivel ? null : (
                <View style={{ gap: 8 }}>
                  <Text style={estilos.pequeno}>{t('A revisão desta semana abre {dia}. Até lá, é assim que a semana vai.', { dia: descreverDia(revisao.abreEm) })}</Text>
                  <Botao
                    titulo={t('Fazer a revisão agora')}
                    variante="contorno"
                    accessibilityHint={t('Abre a revisão desta semana antes do dia marcado')}
                    onPress={() => tentar(t('Não foi possível abrir a revisão'), () => comecarRevisao(semana))}
                  />
                </View>
              )}
              <Cartao style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 }}>
                  <Text style={{ fontFamily: fontes.titulo, fontSize: 34, lineHeight: 40, letterSpacing: -0.7, color: cores.tinta }}>{formatarHoras(revisao.minutosFeitos / 60)}</Text>
                  <Text style={{ fontFamily: fontes.texto, fontSize: 14, lineHeight: 20, color: cores.texto3 }}>
                    {planeado ? t('de {horas} planeadas', { horas: formatarHoras(revisao.minutosPlaneados / 60) }) : t('feitas')}
                  </Text>
                </View>
                {planeado ? (
                  <Text style={{ marginTop: 4, fontFamily: fontes.texto, fontSize: 13, lineHeight: 18, color: cores.texto2 }}>
                    {disponivel ? t('Cumpriu {p}% do plano.', { p: percentagemCumprida(revisao.minutosFeitos, revisao.minutosPlaneados) }) : t('Vai em {p}% do plano.', { p: percentagemCumprida(revisao.minutosFeitos, revisao.minutosPlaneados) })}
                  </Text>
                ) : null}
              </Cartao>
            </View>

            {disponivel && semCopia ? (
              <Cartao style={{ padding: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ marginTop: 2 }}>
                    <Icone nome="aviso" tamanho={18} cor={cores.tinta} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: cores.tinta }}>{t('Faça uma cópia de segurança')}</Text>
                    <Text style={estilos.pequeno}>{`${t('Os dados ficam só neste telemóvel e já passou mais de um mês sem cópia.')} ${ondeGuardarACopia()}`}</Text>
                  </View>
                </View>
                <Botao titulo={t('Fazer cópia agora')} variante="contorno" onPress={exportarCopia} />
              </Cartao>
            ) : null}

            {areas.length > 0 ? (
              <Seccao titulo={t('Por área')}>
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
              <Seccao titulo={t('Feito?')}>
                <Text style={[estilos.pequeno, { marginTop: -4 }]}>{t('Estes blocos estão no calendário mas ainda não foram marcados.')}</Text>
                <Cartao style={{ overflow: 'hidden' }}>
                  {porConfirmar.map((b, i) => (
                    <View key={b.blocoId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingLeft: 16, paddingRight: 8, paddingVertical: 6, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontFamily: fontes.textoMedio, fontSize: 15, lineHeight: 20, color: cores.tinta }} numberOfLines={1}>
                          {b.nome}
                        </Text>
                        <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>
                          {`${b.area} · ${DIAS_CURTOS[b.dia] ? t(DIAS_CURTOS[b.dia]).toLowerCase() : ''} ${formatarIntervalo(b.inicioMin, b.fimMin)}`}
                        </Text>
                      </View>
                      <Resposta titulo={t('Não')} rotulo={t('{nome}: não foi feito', { nome: b.nome })} onPress={() => tentar(t('Não foi possível marcar o bloco'), () => responderBloco(b.blocoId, false))} />
                      <Resposta titulo={t('Feito')} rotulo={t('{nome}: feito', { nome: b.nome })} cheia onPress={() => tentar(t('Não foi possível marcar o bloco'), () => responderBloco(b.blocoId, true))} />
                    </View>
                  ))}
                </Cartao>
              </Seccao>
            ) : null}

            {disponivel && porFazer.length > 0 ? (
              <Seccao titulo={t('Ficou por fazer')}>
                <Text style={[estilos.pequeno, { marginTop: -4, fontSize: 12, lineHeight: 16 }]}>
                  {fechada ? t('O que não foi feito nesta semana.') : t('As tarefas marcadas passam para a semana de {semana}.', { semana: descreverSemanaPorExtenso(seguinte) })}
                </Text>
                <Cartao style={{ overflow: 'hidden' }}>
                  {porFazer.map((tf, i) => {
                    const passa = !ficam.has(tf.tarefaId);
                    const detalhe = [tf.area, formatarDuracao(tf.duracaoMin)].filter(Boolean).join(' · ');
                    return (
                      <Pressable
                        key={tf.tarefaId}
                        disabled={fechada}
                        accessibilityRole={fechada ? 'text' : 'checkbox'}
                        accessibilityLabel={`${tf.nome}, ${detalhe}${fechada ? (tf.transitou ? `, ${t('passou para a semana seguinte')}` : '') : ''}`}
                        accessibilityState={fechada ? undefined : { checked: passa }}
                        onPress={() => alternar(tf.tarefaId)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}
                      >
                        {fechada ? null : <Caixa marcada={passa} />}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontFamily: fontes.textoMedio, fontSize: 15, lineHeight: 20, color: cores.tinta }} numberOfLines={2}>
                            {tf.nome}
                          </Text>
                          <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>
                            {fechada && tf.transitou ? `${detalhe} · ${t('passou para a semana seguinte')}` : detalhe}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </Cartao>
              </Seccao>
            ) : null}

            {disponivel && (metas.length > 0 || alcancadas.length > 0) ? (
              <Seccao titulo={t('Como estão as suas metas?')}>
                <Text style={[estilos.pequeno, { marginTop: -4, fontSize: 12, lineHeight: 16 }]}>{t('Atualize o valor das metas de número e marque os marcos que alcançou.')}</Text>
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
                            <Botao titulo={t('Chegou ao alvo: concluir meta')} icone="certo" variante="contorno" accessibilityLabel={t('Concluir a meta {meta}', { meta: m.descricao })} onPress={() => concluir(m)} />
                          ) : null}
                        </>
                      ) : (
                        <Botao titulo={t('Alcançada')} icone="certo" variante="contorno" accessibilityLabel={t('{meta}: alcançada', { meta: m.descricao })} onPress={() => concluir(m)} />
                      )}
                      {m.estagnada && !m.alcancada ? (
                        <View style={{ gap: 4, padding: 12, borderRadius: 12, backgroundColor: cores.fundo }}>
                          <Text style={[estilos.pequeno, { color: cores.texto2 }]}>{textoEstagnada()}</Text>
                          <Pressable accessibilityRole="button" accessibilityLabel={t('Rever a meta {meta}', { meta: m.descricao })} onPress={() => router.push({ pathname: '/meta/[id]', params: { id: String(m.id) } })} style={{ minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' }}>
                            <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, color: cores.tinta, textDecorationLine: 'underline' }}>{t('Rever a meta')}</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ))}
                  {alcancadas.map((m, i) => (
                    <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: i === 0 && metas.length === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
                      <Icone nome="certo" tamanho={16} cor={cores.texto2} espessura={2.2} />
                      <Text style={{ flex: 1, fontFamily: fontes.textoMedio, fontSize: 14, lineHeight: 20, color: cores.texto2 }}>{t('{meta} — concluída', { meta: m.descricao })}</Text>
                    </View>
                  ))}
                </Cartao>
              </Seccao>
            ) : null}

            {disponivel ? (
              <Seccao titulo={t('Reflexão')}>
                <View style={{ gap: 12 }}>
                  <Nota titulo={t('O que correu bem?')} inicial={revisao.correuBem} guardar={(texto) => guardarReflexao(semana, { correuBem: texto })} />
                  <Nota titulo={t('O que quero mudar?')} inicial={revisao.queroMudar} guardar={(texto) => guardarReflexao(semana, { queroMudar: texto })} />
                </View>
              </Seccao>
            ) : null}

            {disponivel && !fechada ? (
              <View style={{ gap: 4 }}>
                <Botao titulo={t('Fechar revisão')} icone="certo" accessibilityHint={t('Dá a semana por revista; o que ficou marcado passa para a semana seguinte')} onPress={fechar} style={{ minHeight: 52 }} />
                <Text style={[estilos.pequeno, { textAlign: 'center' }]}>{t('Depois de fechar, planeia a semana seguinte.')}</Text>
              </View>
            ) : null}
            {disponivel && fechada ? (
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 4 }}>
                  <Icone nome="certo" tamanho={16} cor={cores.texto2} espessura={2.2} />
                  <Text style={[estilos.pequeno, { color: cores.texto2 }]}>{t('Revisão fechada.')}</Text>
                </View>
                <Botao
                  titulo={t('Planear a semana de {semana} →', { semana: descreverSemanaPorExtenso(seguinte) })}
                  accessibilityHint={t('Abre a semana seguinte, que começa igual a esta')}
                  onPress={planear}
                  style={{ minHeight: 52, paddingHorizontal: 12 }}
                />
                <Botao titulo={t('Reabrir a revisão')} variante="texto" onPress={() => tentar(t('Não foi possível reabrir a revisão'), () => reabrirRevisao(semana))} style={{ justifyContent: 'center' }} />
              </View>
            ) : null}
          </>
        )}

        <LigacaoPlus icone="grafico" titulo={t('Estatísticas e histórico')} texto={t('Horas por área, metas e reflexões ao longo dos meses')} onPress={() => router.push('/estatisticas')} />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Caixa de visto do design: 22 px, escura quando marcada. */
function Caixa({ marcada }: { marcada: boolean }) {
  const { cores } = useTema();
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
      {marcada ? <Icone nome="certo" tamanho={15} cor={cores.sobreTinta} espessura={2.6} /> : null}
    </View>
  );
}

/** Botão pequeno das respostas a "Feito?". */
function Resposta({ titulo, rotulo, cheia, onPress }: { titulo: string; rotulo: string; cheia?: boolean; onPress: () => void }) {
  const { cores } = useTema();
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
      <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, color: cheia ? cores.sobreTinta : cores.tinta }}>{titulo}</Text>
    </Pressable>
  );
}

/** Pergunta de reflexão com um campo que se guarda sozinho. */
function Nota({ titulo, inicial, guardar }: { titulo: string; inicial: string; guardar: (texto: string) => void }) {
  const { cores } = useTema();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, lineHeight: 20, color: cores.tinta }}>{titulo}</Text>
      <CampoAutoGuardado
        inicial={inicial}
        guardar={async (texto) => guardar(texto)}
        erro={t('Não foi possível guardar a nota')}
        placeholder={t('Escreva aqui…')}
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
