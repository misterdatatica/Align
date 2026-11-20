import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { comDesfazer } from '@/components/AvisoTemporario';
import { Icone } from '@/components/Icone';
import { LinhaTarefa } from '@/components/LinhaTarefa';
import { SeletorSemana } from '@/components/SeletorSemana';
import { Botao, BotaoIcone, Cartao, Titulo } from '@/components/ui';
import { useConsulta } from '@/data/consulta';
import { carregarPlanoDaSemana, limparSemana, refazerSemana, type PlanoDaSemana as PlanoDaSemanaPlaneada } from '@/data/semanas';
import { carregarPlano, type PlanoDaSemana } from '@/data/tarefas';
import { formatarHoras } from '@/domain/regras';
import { descreverSemanaPorExtenso, somarSemanas } from '@/domain/semana';
import { escolherSemana, useHoje, usePrepararSemana, useSemanaAtual, useSemanaEscolhida } from '@/estado/semana';
import { fontes, useTema } from '@/theme';
import { t } from '@/i18n';

const TABELAS = ['areas', 'tarefas', 'tarefas_semana', 'blocos'] as const;
const TABELAS_DO_PLANO = ['semanas'] as const;

export default function SemanaEcra() {
  const { cores, estilos } = useTema();
  const router = useRouter();
  const semana = useSemanaEscolhida();
  const semanaAtual = useSemanaAtual();
  usePrepararSemana(semana);
  const hoje = useHoje();
  const plano = useConsulta(() => carregarPlano(semana), TABELAS, semana);
  const planoDaSemana = useConsulta(() => carregarPlanoDaSemana(semana, hoje), TABELAS_DO_PLANO, `${semana}|${hoje}`);

  return (
    <SafeAreaView style={estilos.ecra} edges={['top']}>
      <ScrollView contentContainerStyle={[estilos.conteudo, { gap: 16 }]}>
        <View style={{ gap: 12 }}>
          <Titulo tamanho={28}>{t('Planear a semana')}</Titulo>
          <SeletorSemana semana={semana} aoMudar={escolherSemana} />
          {semana === semanaAtual ? null : (
            <Pressable accessibilityRole="button" onPress={() => escolherSemana(semanaAtual)} style={{ minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
              <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, color: cores.tinta, textDecorationLine: 'underline' }}>{t('Voltar a esta semana')}</Text>
            </Pressable>
          )}
        </View>

        <OrigemDaSemana plano={planoDaSemana} />

        <Cartao style={{ padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Numero valor={formatarHoras(plano.minutosPlaneados / 60)} legenda={t('planeadas')} />
            <Numero valor={formatarHoras(plano.minutosCalendario / 60)} legenda={t('no calendário')} />
            <Numero valor={String(plano.porAlocar)} legenda={t('por alocar')} />
          </View>
          <Botao
            titulo={t('Alocar no calendário')}
            icone="calendario"
            onPress={() => router.navigate('/calendario')}
            style={{ borderRadius: 12 }}
          />
        </Cartao>

        {plano.areas.length === 0 ? (
          <Cartao style={{ padding: 16, gap: 12 }}>
            <Text style={estilos.corpo}>{t('As tarefas organizam-se por área. Crie primeiro as áreas da sua vida.')}</Text>
            <Botao titulo={t('Ir para as áreas')} variante="contorno" onPress={() => router.navigate('/areas')} />
          </Cartao>
        ) : (
          <View style={{ gap: 12 }}>
            {plano.areas.map((grupo) => (
              <AreaDaSemana key={grupo.area.id} grupo={grupo} semana={semana} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** De onde veio a semana: começa sempre igual à anterior, sem nada para aceitar. */
/**
 * De onde veio a semana, um aviso quando a anterior mudou depois de esta ter sido criada, e as ações
 * "Refazer a partir da semana anterior" e "Limpar esta semana" (ambas com "Desfazer").
 */
function OrigemDaSemana({ plano }: { plano: PlanoDaSemanaPlaneada }) {
  const { cores, estilos } = useTema();
  const { estado, semana, origem, origemSemana, podePlanear, temAnterior, desatualizada } = plano;
  let texto: string | null = null;
  if (estado === 'por_planear') texto = t('Esta semana já passou e não chegou a ser planeada.');
  else if (origemSemana) {
    texto = origemSemana === somarSemanas(semana, -1) ? t('Começou igual à semana passada. Mude o que quiser: a semana seguinte começa igual a esta.') : t('Começou igual à semana de {semana}, a última planeada.', { semana: descreverSemanaPorExtenso(origemSemana) });
  } else if (origem === 'vazia' && temAnterior) texto = t('Esta semana foi limpa: as tarefas que repetem ficam por alocar.');
  const acoes = estado === 'aceite' && podePlanear;
  if (!texto && !acoes) return null;
  return (
    <View style={{ gap: 4, marginTop: -4 }}>
      {texto ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icone nome="repetir" tamanho={14} cor={cores.texto3} espessura={2} />
          <Text style={[estilos.pequeno, { flex: 1 }]}>{texto}</Text>
        </View>
      ) : null}
      {acoes && desatualizada ? (
        <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.contorno }} accessibilityLiveRegion="polite">
          <Icone nome="aviso" tamanho={16} cor={cores.tinta} />
          <Text style={[estilos.pequeno, { flex: 1, color: cores.texto2 }]}>{t('A semana anterior mudou depois de esta ter sido criada (um “Ocupado” ou uma tarefa nova). Refaça-a para apanhar as mudanças.')}</Text>
        </View>
      ) : null}
      {acoes ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, paddingLeft: 22 }}>
          {temAnterior ? (
            <Ligacao
              titulo={t('Refazer a partir da semana anterior')}
              dica={t('Volta a copiar a semana anterior, com o que lá mudou entretanto. Os blocos mudados só nesta semana perdem-se; as tarefas e o que já foi feito ficam.')}
              aoPremir={() => comDesfazer(t('Semana refeita a partir da semana anterior'), () => refazerSemana(semana), t('Não foi possível refazer a semana'))}
            />
          ) : null}
          <Ligacao
            titulo={t('Limpar esta semana')}
            dica={t('Tira os blocos e os “Ocupado” desta semana, para começar do zero. As tarefas ficam por alocar e o que já foi feito fica.')}
            aoPremir={() => comDesfazer(t('Semana limpa: as tarefas ficaram por alocar'), () => limparSemana(semana), t('Não foi possível limpar a semana'))}
          />
        </View>
      ) : null}
    </View>
  );
}

function Ligacao({ titulo, dica, aoPremir }: { titulo: string; dica: string; aoPremir: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable accessibilityRole="button" accessibilityHint={dica} onPress={aoPremir} style={({ pressed }) => ({ minHeight: 40, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, color: cores.tinta, textDecorationLine: 'underline' }}>{titulo}</Text>
    </Pressable>
  );
}

function Numero({ valor, legenda }: { valor: string; legenda: string }) {
  const { cores } = useTema();
  return (
    <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${valor} ${legenda}`}>
      <Text style={{ fontFamily: fontes.titulo, fontSize: 22, lineHeight: 28, color: cores.tinta }}>{valor}</Text>
      <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>{legenda}</Text>
    </View>
  );
}

function AreaDaSemana({ grupo, semana }: { grupo: PlanoDaSemana['areas'][number]; semana: string }) {
  const { cores, estilos, corDaArea } = useTema();
  const router = useRouter();
  const { area, tarefas, minutosPlaneados } = grupo;
  return (
    <View style={[estilos.cartao, { overflow: 'hidden' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingLeft: 16, paddingRight: 4 }}>
        <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: corDaArea(area.cor).forte }} />
        <Text style={{ flexShrink: 1, fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: cores.tinta }} numberOfLines={1} accessibilityRole="header">
          {area.nome}
        </Text>
        {minutosPlaneados > 0 ? <Text style={estilos.pequeno}>{formatarHoras(minutosPlaneados / 60)}</Text> : null}
        <BotaoIcone
          icone="mais"
          rotulo={t('Adicionar tarefa em {area}', { area: area.nome })}
          onPress={() => router.push({ pathname: '/tarefa/nova', params: { areaId: String(area.id), semana } })}
          style={{ marginLeft: 'auto' }}
        />
      </View>
      {tarefas.length === 0 ? (
        <Text style={[estilos.pequeno, { paddingHorizontal: 16, paddingBottom: 14 }]}>{t('Sem tarefas nesta semana.')}</Text>
      ) : (
        tarefas.map((tf) => <LinhaTarefa key={tf.id} tarefa={tf} semana={semana} />)
      )}
    </View>
  );
}
