import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { avisarErro } from '@/components/dialogos';
import { Icone } from '@/components/Icone';
import { ListaDeAreas } from '@/components/ListaDeAreas';
import { Botao, BotaoIcone, Seccao, Titulo, estilos } from '@/components/ui';
import { criarArea, reordenarAreas } from '@/data/areas';
import { recarregarConsultas, useConsulta } from '@/data/consulta';
import { primeiroArranque } from '@/data/definicoes';
import { revisaoPorFazer } from '@/data/revisao';
import { carregarPlanoDaSemana } from '@/data/semanas';
import { carregarPlano } from '@/data/tarefas';
import { MAX_AREAS, podeCriarArea } from '@/domain/regras';
import { DIAS_DE_REVISAO } from '@/domain/revisao';
import { descreverSemanaPorExtenso } from '@/domain/semana';
import { escolherSemana, useHoje, usePrepararSemana, useSemanaAtual } from '@/estado/semana';
import { SUGESTOES_DE_AREAS } from '@/sugestoes';
import { cores, corDaArea, fontes } from '@/theme';

const TABELAS = ['areas', 'tarefas', 'tarefas_semana', 'blocos'] as const;
const TABELAS_DA_REVISAO = ['tarefas_semana', 'revisoes', 'definicoes'] as const;
const TABELAS_DO_ARRANQUE = ['areas', 'definicoes'] as const;
const TABELAS_DO_PLANO = ['semanas'] as const;

export default function AreasEcra() {
  const router = useRouter();
  const semana = useSemanaAtual();
  usePrepararSemana(semana);
  const plano = useConsulta(() => carregarPlano(semana), TABELAS, semana);
  const hoje = useHoje();
  const porRever = useConsulta(() => revisaoPorFazer(hoje), TABELAS_DA_REVISAO, hoje);
  const estadoDaSemana = useConsulta(() => carregarPlanoDaSemana(semana, hoje).estado, TABELAS_DO_PLANO, `${semana}|${hoje}`);
  const [aCriar, setACriar] = useState<string | null>(null);
  const boasVindas = useConsulta(primeiroArranque, TABELAS_DO_ARRANQUE);

  const lista = plano.areas;
  const podeCriar = podeCriarArea(lista.length);

  async function criarSugestao(s: (typeof SUGESTOES_DE_AREAS)[number]) {
    setACriar(s.nome);
    try {
      await criarArea({ ...s, missao: '' });
    } catch (e) {
      avisarErro('Não foi possível criar a área', e);
    } finally {
      setACriar(null);
    }
  }

  // App acabada de instalar: começa pelo primeiro arranque.
  if (boasVindas) return <Redirect href="/boas-vindas" />;

  return (
    <SafeAreaView style={estilos.ecra} edges={['top']}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Titulo subtitulo={`Semana de ${descreverSemanaPorExtenso(semana)}`}>As minhas áreas</Titulo>
          </View>
          <BotaoIcone icone="engrenagem" rotulo="Definições" tamanho={22} cor={cores.texto2} onPress={() => router.push('/definicoes')} style={{ marginRight: -10, marginTop: -4 }} />
        </View>

        {porRever ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/revisao')}
            style={({ pressed }) => ({ marginTop: -4, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: cores.tinta, opacity: pressed ? 0.85 : 1 })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: cores.tintaSuave, alignItems: 'center', justifyContent: 'center' }}>
              <Icone nome="revisao" cor="#FFFFFF" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: '#FFFFFF' }}>{`Revisão de ${DIAS_DE_REVISAO[porRever.diaRevisao]}`}</Text>
              <Text style={{ fontFamily: fontes.texto, fontSize: 13, lineHeight: 18, color: cores.textoSobreTinta }}>{`Como correu a semana de ${descreverSemanaPorExtenso(porRever.semana)}?`}</Text>
            </View>
            <Icone nome="seta-direita" tamanho={18} cor="#FFFFFF" espessura={2} />
          </Pressable>
        ) : null}

        {estadoDaSemana !== 'aceite' && lista.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              escolherSemana(semana);
              router.navigate('/semana');
            }}
            style={({ pressed }) => ({ marginTop: -4, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: cores.tinta, backgroundColor: cores.superficie, opacity: pressed ? 0.7 : 1 })}
          >
            <Icone nome="calendario" cor={cores.tinta} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: cores.tinta }}>{estadoDaSemana === 'rascunho' ? 'A proposta desta semana está por aceitar' : 'Esta semana ainda não tem plano'}</Text>
              <Text style={{ fontFamily: fontes.texto, fontSize: 13, lineHeight: 18, color: cores.texto3 }}>{estadoDaSemana === 'rascunho' ? 'Reveja os blocos e aceite a semana.' : 'Comece por uma cópia da semana passada.'}</Text>
            </View>
            <Icone nome="seta-direita" tamanho={18} cor={cores.tinta} espessura={2} />
          </Pressable>
        ) : null}

        <Seccao titulo="Áreas" direita={<Text style={estilos.pequeno}>{`${lista.length} de ${MAX_AREAS} no máximo`}</Text>}>
          <ListaDeAreas
            itens={lista}
            aoAbrir={(areaId) => router.push({ pathname: '/area/[id]', params: { id: String(areaId) } })}
            aoReordenar={(ids) => {
              try {
                reordenarAreas(ids);
                recarregarConsultas();
              } catch (e) {
                avisarErro('Não foi possível mudar a ordem', e);
              }
            }}
          />
          {lista.length > 1 ? <Text style={[estilos.pequeno, { fontSize: 12, lineHeight: 16 }]}>Mantenha uma área premida e arraste para mudar a ordem.</Text> : null}

          {lista.length === 0 ? (
            <View style={{ gap: 12, marginTop: 4 }}>
              <Text style={estilos.corpo}>Comece por escolher as áreas da sua vida. Pode mudar tudo depois.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SUGESTOES_DE_AREAS.map((s) => {
                  const cor = corDaArea(s.cor);
                  return (
                    <Pressable
                      key={s.nome}
                      accessibilityRole="button"
                      accessibilityLabel={`Criar área ${s.nome}`}
                      disabled={aCriar !== null}
                      onPress={() => criarSugestao(s)}
                      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: cor.tinta }}
                    >
                      <Icone nome={s.icone} tamanho={16} cor={cor.texto} />
                      <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, color: cor.texto }}>{s.nome}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Botao
            titulo="Nova área"
            icone="mais"
            variante="tracejado"
            disabled={!podeCriar}
            onPress={() => router.push('/area/nova')}
            accessibilityHint={podeCriar ? undefined : `Já tem ${MAX_AREAS} áreas. Arquive uma para criar outra.`}
            style={{ marginTop: 2 }}
          />
        </Seccao>
      </ScrollView>
    </SafeAreaView>
  );
}
