import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinhaTarefa } from '@/components/LinhaTarefa';
import { CartaoPlano } from '@/components/semana/CartaoPlano';
import { SeletorSemana } from '@/components/SeletorSemana';
import { Botao, BotaoIcone, Cartao, Titulo, estilos } from '@/components/ui';
import { useConsulta } from '@/data/consulta';
import { carregarPlanoDaSemana } from '@/data/semanas';
import { carregarPlano, type PlanoDaSemana } from '@/data/tarefas';
import { formatarHoras } from '@/domain/regras';
import { escolherSemana, useHoje, usePrepararSemana, useSemanaAtual, useSemanaEscolhida } from '@/estado/semana';
import { cores, corDaArea, fontes } from '@/theme';

const TABELAS = ['areas', 'tarefas', 'tarefas_semana', 'blocos'] as const;
const TABELAS_DO_PLANO = ['areas', 'tarefas', 'tarefas_semana', 'blocos', 'semanas'] as const;

export default function SemanaEcra() {
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
          <Titulo tamanho={28}>Planear a semana</Titulo>
          <SeletorSemana semana={semana} aoMudar={escolherSemana} />
          {semana === semanaAtual ? null : (
            <Pressable accessibilityRole="button" onPress={() => escolherSemana(semanaAtual)} style={{ minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
              <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, color: cores.tinta, textDecorationLine: 'underline' }}>Voltar a esta semana</Text>
            </Pressable>
          )}
        </View>

        {/* A escolha da origem recomeça quando se muda de semana ou a proposta é criada. */}
        <CartaoPlano key={`${semana}|${planoDaSemana.estado}`} plano={planoDaSemana} aoRever={() => router.navigate('/calendario')} />

        <Cartao style={{ padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Numero valor={formatarHoras(plano.minutosPlaneados / 60)} legenda="planeadas" />
            <Numero valor={formatarHoras(plano.minutosCalendario / 60)} legenda="no calendário" />
            <Numero valor={String(plano.porAlocar)} legenda="por alocar" />
          </View>
          <Botao
            titulo="Alocar no calendário"
            icone="calendario"
            variante={planoDaSemana.estado === 'aceite' ? 'primario' : 'contorno'}
            onPress={() => router.navigate('/calendario')}
            style={{ borderRadius: 12 }}
          />
        </Cartao>

        {plano.areas.length === 0 ? (
          <Cartao style={{ padding: 16, gap: 12 }}>
            <Text style={estilos.corpo}>As tarefas organizam-se por área. Crie primeiro as áreas da sua vida.</Text>
            <Botao titulo="Ir para as áreas" variante="contorno" onPress={() => router.navigate('/')} />
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

function Numero({ valor, legenda }: { valor: string; legenda: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${valor} ${legenda}`}>
      <Text style={{ fontFamily: fontes.titulo, fontSize: 22, lineHeight: 28, color: cores.tinta }}>{valor}</Text>
      <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>{legenda}</Text>
    </View>
  );
}

function AreaDaSemana({ grupo, semana }: { grupo: PlanoDaSemana['areas'][number]; semana: string }) {
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
          rotulo={`Adicionar tarefa em ${area.nome}`}
          onPress={() => router.push({ pathname: '/tarefa/nova', params: { areaId: String(area.id), semana } })}
          style={{ marginLeft: 'auto' }}
        />
      </View>
      {tarefas.length === 0 ? (
        <Text style={[estilos.pequeno, { paddingHorizontal: 16, paddingBottom: 14 }]}>Sem tarefas nesta semana.</Text>
      ) : (
        tarefas.map((t) => <LinhaTarefa key={t.id} tarefa={t} semana={semana} />)
      )}
    </View>
  );
}
