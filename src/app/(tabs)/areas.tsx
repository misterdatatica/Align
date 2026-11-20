import { useRouter } from 'expo-router';
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
import { carregarPlano } from '@/data/tarefas';
import { MAX_AREAS, podeCriarArea } from '@/domain/regras';
import { descreverSemanaPorExtenso } from '@/domain/semana';
import { usePrepararSemana, useSemanaAtual } from '@/estado/semana';
import { SUGESTOES_DE_AREAS } from '@/sugestoes';
import { cores, corDaArea, fontes } from '@/theme';

const TABELAS = ['areas', 'tarefas', 'tarefas_semana', 'blocos'] as const;

export default function AreasEcra() {
  const router = useRouter();
  const semana = useSemanaAtual();
  usePrepararSemana(semana);
  const plano = useConsulta(() => carregarPlano(semana), TABELAS, semana);
  const [aCriar, setACriar] = useState<string | null>(null);

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

  return (
    <SafeAreaView style={estilos.ecra} edges={['top']}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Titulo subtitulo={`Semana de ${descreverSemanaPorExtenso(semana)}`}>As minhas áreas</Titulo>
          </View>
          <BotaoIcone icone="engrenagem" rotulo="Definições" tamanho={22} cor={cores.texto2} onPress={() => router.push('/definicoes')} style={{ marginRight: -10, marginTop: -4 }} />
        </View>

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
