import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { GraficoColunas } from '@/components/estatisticas/GraficoColunas';
import { Icone } from '@/components/Icone';
import { SoPlus } from '@/components/Plus';
import { BarraProgresso, BotaoIcone, Cartao, Seccao, Segmentado } from '@/components/ui';
import { useConsulta } from '@/data/consulta';
import { carregarEstatisticas, primeiraSemanaComDados, type Estatisticas } from '@/data/estatisticas';
import { descreverPeriodo, fimDoPeriodo, percentagem, periodoDe, somarPeriodo, type Periodo, type TipoDePeriodo } from '@/domain/estatisticas';
import { valorComUnidade } from '@/domain/metas';
import { formatarHoras, formatarProgressoHoras, progresso } from '@/domain/regras';
import { descreverData, descreverSemanaPorExtenso } from '@/domain/semana';
import { useHoje } from '@/estado/semana';
import { t } from '@/i18n';
import { fontes, useTema } from '@/theme';

const TABELAS = ['areas', 'metas', 'metas_registos', 'tarefas', 'tarefas_semana', 'blocos', 'revisoes', 'semanas'] as const;

/**
 * Estatísticas e histórico (Align Plus): o balanço de um mês ou de um ano. Horas feitas contra as
 * planeadas, por semana ou por mês e por área, as metas, o que mais ficou por fazer e as reflexões.
 */
export default function EstatisticasEcra() {
  const { cores, estilos } = useTema();
  const hoje = useHoje();
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDe('mes', hoje));
  const e = useConsulta(() => carregarEstatisticas(periodo, hoje), TABELAS, `${periodo.tipo}|${periodo.inicio}|${hoje}`);
  const primeira = useConsulta(primeiraSemanaComDados, ['semanas']);

  const atual = periodoDe(periodo.tipo, hoje);
  const podeAvancar = periodo.inicio < atual.inicio;
  // Só se recua enquanto houver semanas planeadas antes do início deste período.
  const podeRecuar = primeira !== null && primeira < periodo.inicio;
  const titulo = descreverPeriodo(periodo);
  const vazio = e.minutosPlaneados === 0 && e.minutosFeitos === 0 && e.vezesFeitas === 0 && e.metasConcluidas.length === 0 && e.evolucaoDasMetas.length === 0;

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={estilos.conteudo}>
      <View style={{ gap: 12 }}>
        <Segmentado<TipoDePeriodo>
          rotulo={t('Período')}
          opcoes={[
            { valor: 'mes', titulo: t('Mês') },
            { valor: 'ano', titulo: t('Ano') },
          ]}
          valor={periodo.tipo}
          aoMudar={(tipo) => setPeriodo(periodoDe(tipo, hoje))}
        />
        <View style={[estilos.cartao, { height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 1 }]}>
          <BotaoIcone icone="seta-esquerda" rotulo={periodo.tipo === 'mes' ? t('Mês anterior') : t('Ano anterior')} disabled={!podeRecuar} onPress={() => setPeriodo(somarPeriodo(periodo, -1))} />
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={{ fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: cores.tinta }}>
            {titulo[0].toUpperCase() + titulo.slice(1)}
          </Text>
          <BotaoIcone icone="seta-direita" rotulo={periodo.tipo === 'mes' ? t('Mês seguinte') : t('Ano seguinte')} disabled={!podeAvancar} onPress={() => setPeriodo(somarPeriodo(periodo, 1))} />
        </View>
      </View>

      <SoPlus mensagem={t('As estatísticas e o histórico fazem parte do Align Plus.')}>
        {vazio ? (
          <Cartao style={{ padding: 16 }}>
            <Text style={estilos.corpo}>{periodo.tipo === 'mes' ? t('Ainda não há nada neste mês.') : t('Ainda não há nada neste ano.')}</Text>
          </Cartao>
        ) : (
          <Conteudo e={e} emCurso={periodo.inicio === atual.inicio && fimDoPeriodo(periodo) > hoje} />
        )}
      </SoPlus>
    </ScrollView>
  );
}

function Conteudo({ e, emCurso }: { e: Estatisticas; emCurso: boolean }) {
  const { cores, estilos, corDaArea } = useTema();
  const p = percentagem(e.minutosFeitos, e.minutosPlaneados);

  return (
    <>
      <Cartao style={{ padding: 16, gap: 14 }}>
        <View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 }}>
            <Text style={{ fontFamily: fontes.titulo, fontSize: 34, lineHeight: 40, letterSpacing: -0.7, color: cores.tinta }}>{formatarHoras(e.minutosFeitos / 60)}</Text>
            <Text style={{ fontFamily: fontes.texto, fontSize: 14, lineHeight: 20, color: cores.texto3 }}>
              {e.minutosPlaneados > 0 ? t('de {horas} planeadas', { horas: formatarHoras(e.minutosPlaneados / 60) }) : t('feitas')}
            </Text>
          </View>
          {p !== null ? (
            <Text style={{ marginTop: 4, fontFamily: fontes.texto, fontSize: 13, lineHeight: 18, color: cores.texto2 }}>
              {emCurso ? t('Vai em {p}% do plano.', { p }) : t('Cumpriu {p}% do plano.', { p })}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Numero valor={e.semanasPlaneadas} legenda={e.semanasPlaneadas === 1 ? t('semana planeada') : t('semanas planeadas')} />
          <Numero valor={e.revisoesFechadas} legenda={e.revisoesFechadas === 1 ? t('revisão fechada') : t('revisões fechadas')} />
          <Numero valor={e.metasConcluidas.length} legenda={e.metasConcluidas.length === 1 ? t('meta concluída') : t('metas concluídas')} />
        </View>
      </Cartao>

      <Seccao titulo={e.periodo.tipo === 'mes' ? t('Por semana') : t('Por mês')}>
        <Cartao style={{ padding: 16 }}>
          <GraficoColunas key={`${e.periodo.tipo}|${e.periodo.inicio}`} colunas={e.colunas} />
        </Cartao>
      </Seccao>

      {e.areas.length > 0 ? (
        <Seccao titulo={t('Por área')}>
          <Cartao style={{ padding: 16, gap: 16 }}>
            {e.areas.map((a) => (
              <View key={a.id} accessible accessibilityLabel={`${a.nome}: ${formatarProgressoHoras(a.minutosFeitos / 60, a.minutosPlaneados / 60)}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: corDaArea(a.cor).forte }} />
                    <Text style={{ flexShrink: 1, fontFamily: fontes.textoForte, fontSize: 14, lineHeight: 20, color: cores.tinta }} numberOfLines={1}>
                      {a.nome}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: fontes.texto, fontSize: 13, lineHeight: 20, color: cores.texto2, fontVariant: ['tabular-nums'] }}>{formatarProgressoHoras(a.minutosFeitos / 60, a.minutosPlaneados / 60)}</Text>
                </View>
                <View style={{ marginTop: 6 }}>
                  <BarraProgresso valor={progresso(a.minutosFeitos, a.minutosPlaneados)} cor={corDaArea(a.cor).forte} />
                </View>
              </View>
            ))}
          </Cartao>
        </Seccao>
      ) : null}

      {e.metasConcluidas.length > 0 || e.evolucaoDasMetas.length > 0 ? (
        <Seccao titulo={t('Metas')}>
          <Cartao style={{ overflow: 'hidden' }}>
            {e.metasConcluidas.map((m, i) => (
              <View key={`c${m.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
                <View style={{ width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: corDaArea(m.area.cor).tinta }}>
                  <Icone nome="certo" tamanho={15} cor={corDaArea(m.area.cor).texto} espessura={2.4} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: cores.tinta }}>{m.descricao}</Text>
                  <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>{t('{area} · concluída a {dia}', { area: m.area.nome, dia: descreverData(m.concluidaEm.slice(0, 10)) })}</Text>
                </View>
              </View>
            ))}
            {e.evolucaoDasMetas.map((m, i) => (
              <View key={`e${m.id}`} style={{ padding: 16, gap: 8, borderTopWidth: i === 0 && e.metasConcluidas.length === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
                <View style={{ gap: 2 }}>
                  <Text style={{ fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: cores.tinta }}>{m.descricao}</Text>
                  <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>
                    {t('{area} · de {de} para {para} (alvo: {alvo})', { area: m.area.nome, de: valorComUnidade(m.de, m.unidade), para: valorComUnidade(m.para, m.unidade), alvo: valorComUnidade(m.alvo, m.unidade) })}
                  </Text>
                </View>
                <BarraProgresso valor={m.progresso} cor={corDaArea(m.area.cor).forte} />
              </View>
            ))}
          </Cartao>
        </Seccao>
      ) : null}

      {e.porFazer.length > 0 ? (
        <Seccao titulo={t('O que mais ficou por fazer')}>
          <Cartao style={{ overflow: 'hidden' }}>
            {e.porFazer.map((p, i) => (
              <View key={p.chave} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
                <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: corDaArea(p.area.cor).forte }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: fontes.textoMedio, fontSize: 15, lineHeight: 20, color: cores.tinta }} numberOfLines={1}>
                    {p.nome}
                  </Text>
                  <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>{p.area.nome}</Text>
                </View>
                <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, color: cores.texto2, fontVariant: ['tabular-nums'] }}>{p.vezes === 1 ? t('1 vez') : t('{n} vezes', { n: p.vezes })}</Text>
              </View>
            ))}
          </Cartao>
          <Text style={estilos.pequeno}>{t('Se uma tarefa fica muitas vezes por fazer, talvez precise de outra hora, de menos tempo ou de sair do plano.')}</Text>
        </Seccao>
      ) : null}

      {e.reflexoes.length > 0 ? (
        <Seccao titulo={t('Reflexões')}>
          <View style={{ gap: 12 }}>
            {e.reflexoes.map((r) => (
              <Cartao key={r.semana} style={{ padding: 16, gap: 10 }}>
                <Text style={estilos.rotulo}>{t('Semana de {semana}', { semana: descreverSemanaPorExtenso(r.semana) }).toUpperCase()}</Text>
                {r.correuBem.trim() ? <Nota titulo={t('O que correu bem?')} texto={r.correuBem} /> : null}
                {r.queroMudar.trim() ? <Nota titulo={t('O que quero mudar?')} texto={r.queroMudar} /> : null}
              </Cartao>
            ))}
          </View>
        </Seccao>
      ) : null}
    </>
  );
}

function Numero({ valor, legenda }: { valor: number; legenda: string }) {
  const { cores } = useTema();
  return (
    <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${valor} ${legenda}`}>
      <Text style={{ fontFamily: fontes.titulo, fontSize: 22, lineHeight: 28, color: cores.tinta }}>{valor}</Text>
      <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>{legenda}</Text>
    </View>
  );
}

function Nota({ titulo, texto }: { titulo: string; texto: string }) {
  const { cores, estilos } = useTema();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, lineHeight: 18, color: cores.texto2 }}>{titulo}</Text>
      <Text style={estilos.corpo}>{texto}</Text>
    </View>
  );
}
