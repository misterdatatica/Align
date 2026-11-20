import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Riscas } from '@/components/calendario/Bloco';
import { avisarErro } from '@/components/dialogos';
import { Icone } from '@/components/Icone';
import { LinhaTarefa } from '@/components/LinhaTarefa';
import { Botao, Cartao, Seccao, Titulo } from '@/components/ui';
import { marcarBlocoFeito, type BlocoCalendario } from '@/data/calendario';
import { useConsulta } from '@/data/consulta';
import { primeiroArranque } from '@/data/definicoes';
import { carregarHoje } from '@/data/hoje';
import { revisaoPorFazer } from '@/data/revisao';
import { formatarIntervalo } from '@/domain/calendario';
import { DIAS_DE_REVISAO } from '@/domain/revisao';
import { descreverDia, descreverSemanaPorExtenso } from '@/domain/semana';
import { escolherSemana, useHoje, usePrepararSemana } from '@/estado/semana';
import { fontes, useTema } from '@/theme';
import { t } from '@/i18n';

const TABELAS = ['areas', 'tarefas', 'tarefas_semana', 'blocos', 'definicoes'] as const;
const TABELAS_DA_REVISAO = ['tarefas_semana', 'revisoes', 'definicoes'] as const;
const TABELAS_DO_ARRANQUE = ['areas', 'definicoes'] as const;

/** Minutos desde a meia-noite, atualizados a cada meio minuto (para saber o que está a decorrer). */
function useAgora(): number {
  const ler = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [agora, setAgora] = useState(ler);
  useEffect(() => {
    const intervalo = setInterval(() => setAgora(ler()), 30_000);
    return () => clearInterval(intervalo);
  }, []);
  return agora;
}

/**
 * Hoje: o que está no calendário para hoje, por ordem de hora, com uma caixa para marcar cada bloco
 * como feito, e as tarefas sem duração da semana. É o ecrã que a app abre.
 */
export default function HojeEcra() {
  const { cores, estilos, corDaArea } = useTema();
  const router = useRouter();
  const hoje = useHoje();
  const dia = useConsulta(() => carregarHoje(hoje), TABELAS, hoje);
  usePrepararSemana(dia.semana);
  const agora = useAgora();
  const porRever = useConsulta(() => revisaoPorFazer(hoje), TABELAS_DA_REVISAO, hoje);
  const boasVindas = useConsulta(primeiroArranque, TABELAS_DO_ARRANQUE);

  // App acabada de instalar: começa pelo primeiro arranque.
  if (boasVindas) return <Redirect href="/boas-vindas" />;

  const deTarefas = dia.blocos.filter((b) => b.tipo === 'tarefa');
  const feitos = deTarefas.filter((b) => b.feito).length;
  const titulo = descreverDia(hoje);

  function abrirCalendario() {
    escolherSemana(dia.semana);
    router.navigate('/calendario');
  }

  return (
    <SafeAreaView style={estilos.ecra} edges={['top']}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Titulo subtitulo={titulo[0].toUpperCase() + titulo.slice(1)}>{t('Hoje')}</Titulo>

        {porRever ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/revisao')}
            style={({ pressed }) => ({ marginTop: -4, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: cores.tinta, opacity: pressed ? 0.85 : 1 })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: cores.tintaSuave, alignItems: 'center', justifyContent: 'center' }}>
              <Icone nome="revisao" cor={cores.sobreTinta} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: cores.sobreTinta }}>{t('Revisão de {dia}', { dia: t(DIAS_DE_REVISAO[porRever.diaRevisao]) })}</Text>
              <Text style={{ fontFamily: fontes.texto, fontSize: 13, lineHeight: 18, color: cores.textoSobreTinta }}>{t('Como correu a semana de {semana}?', { semana: descreverSemanaPorExtenso(porRever.semana) })}</Text>
            </View>
            <Icone nome="seta-direita" tamanho={18} cor={cores.sobreTinta} espessura={2} />
          </Pressable>
        ) : null}

        {!dia.temAreas ? (
          <Cartao style={{ padding: 16, gap: 12 }}>
            <Text style={estilos.corpo}>{t('Ainda não há nada para hoje. Comece por criar as áreas da sua vida e as tarefas de cada uma.')}</Text>
            <Botao titulo={t('Ir para as áreas')} variante="contorno" onPress={() => router.navigate('/areas')} />
          </Cartao>
        ) : (
          <>
            <Seccao titulo={t('No calendário')} direita={deTarefas.length > 0 ? <Text style={estilos.pequeno}>{t('{n} de {total} feitos', { n: feitos, total: deTarefas.length })}</Text> : undefined}>
              {dia.blocos.length === 0 ? (
                <Cartao style={{ padding: 16, gap: 12 }}>
                  <Text style={estilos.corpo}>{t('Não há nada no calendário para hoje.')}</Text>
                  <Botao titulo={t('Abrir o calendário')} icone="calendario" variante="contorno" onPress={abrirCalendario} />
                </Cartao>
              ) : (
                <Cartao style={{ overflow: 'hidden' }}>
                  {dia.blocos.map((b, i) => (
                    <LinhaDoBloco key={b.id} bloco={b} agora={agora} primeira={i === 0} />
                  ))}
                </Cartao>
              )}
            </Seccao>

            {dia.semHora.length > 0 ? (
              <Seccao titulo={t('Sem hora marcada')}>
                <Text style={[estilos.pequeno, { marginTop: -4 }]}>{t('Tarefas desta semana que não ocupam tempo no calendário: marque cada vez que as faz.')}</Text>
                <View style={[estilos.cartao, { overflow: 'hidden' }]}>
                  {dia.semHora.flatMap((g) => g.tarefas.map((tf) => ({ area: g.area, tarefa: tf }))).map(({ area, tarefa }, i) => (
                    <View key={tarefa.id} style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                      <View style={{ width: 4, backgroundColor: corDaArea(area.cor).forte }} />
                      <View style={{ flex: 1 }}>
                        <LinhaTarefa tarefa={tarefa} semana={dia.semana} semLinha={i === 0} />
                      </View>
                    </View>
                  ))}
                </View>
              </Seccao>
            ) : null}

            {dia.porAlocar > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={abrirCalendario}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: cores.contorno, backgroundColor: cores.superficie, opacity: pressed ? 0.7 : 1 })}
              >
                <Icone nome="calendario" cor={cores.tinta} />
                <Text style={{ flex: 1, fontFamily: fontes.textoMedio, fontSize: 14, lineHeight: 20, color: cores.tinta }}>
                  {dia.porAlocar === 1 ? t('Há 1 tarefa desta semana ainda sem hora no calendário.') : t('Há {n} tarefas desta semana ainda sem hora no calendário.', { n: dia.porAlocar })}
                </Text>
                <Icone nome="seta-direita" tamanho={18} cor={cores.tinta} espessura={2} />
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Um bloco de hoje: hora, nome e área, e a caixa para o marcar como feito (os "Ocupado" não se marcam). */
function LinhaDoBloco({ bloco, agora, primeira }: { bloco: BlocoCalendario; agora: number; primeira: boolean }) {
  const { cores, corDaArea } = useTema();
  const ocupado = bloco.tipo === 'ocupado';
  const aDecorrer = agora >= bloco.inicioMin && agora < bloco.fimMin;
  const passou = agora >= bloco.fimMin;
  const cor = bloco.cor ? corDaArea(bloco.cor) : null;
  const intervalo = formatarIntervalo(bloco.inicioMin, bloco.fimMin);

  function alternar() {
    try {
      marcarBlocoFeito(bloco.id, !bloco.feito);
    } catch (erro) {
      avisarErro(t('Não foi possível marcar o bloco'), erro);
    }
  }

  const conteudo = (
    <>
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, overflow: 'hidden', backgroundColor: cor ? cor.forte : cores.ocupadoClaro }}>{ocupado ? <Riscas legenda /> : null}</View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: fontes.textoForte, fontSize: 12, lineHeight: 16, color: aDecorrer ? cores.tinta : cores.texto3, fontVariant: ['tabular-nums'] }}>{intervalo}</Text>
          {aDecorrer ? (
            <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: cores.tinta }}>
              <Text style={{ fontFamily: fontes.textoForte, fontSize: 10, lineHeight: 14, color: cores.sobreTinta }}>{t('AGORA')}</Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={2}
          style={{ fontFamily: fontes.textoMedio, fontSize: 15, lineHeight: 20, color: ocupado || (passou && !bloco.feito) ? cores.texto2 : cores.tinta, textDecorationLine: bloco.feito ? 'line-through' : 'none' }}
        >
          {bloco.nome}
        </Text>
        {bloco.area ? <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>{bloco.area}</Text> : null}
      </View>
      {ocupado ? null : (
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: bloco.feito ? 0 : 1.5,
              borderColor: cores.tracejado,
              backgroundColor: bloco.feito ? cores.tinta : 'transparent',
            }}
          >
            {bloco.feito ? <Icone nome="certo" tamanho={15} cor={cores.sobreTinta} espessura={2.4} /> : null}
          </View>
        </View>
      )}
    </>
  );

  const estilo = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 60, paddingLeft: 12, paddingRight: 6, borderTopWidth: primeira ? 0 : 1, borderTopColor: cores.linhaSuave, backgroundColor: aDecorrer ? cores.fundo : cores.superficie };

  if (ocupado) {
    return (
      <View style={estilo} accessible accessibilityLabel={`${bloco.nome}, ${intervalo}, ${t('ocupado')}`}>
        {conteudo}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={`${bloco.nome}, ${intervalo}${aDecorrer ? `, ${t('a decorrer')}` : ''}`}
      accessibilityState={{ checked: bloco.feito }}
      onPress={alternar}
      style={({ pressed }) => [estilo, { opacity: pressed ? 0.7 : 1 }]}
    >
      {conteudo}
    </Pressable>
  );
}
