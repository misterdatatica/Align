import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvisoDeSemana } from '@/components/AvisoDeSemana';
import { avisarErro } from '@/components/dialogos';
import { Icone } from '@/components/Icone';
import { ListaDeAreas } from '@/components/ListaDeAreas';
import { Botao, BotaoIcone, Seccao, Titulo } from '@/components/ui';
import { criarArea, reordenarAreas } from '@/data/areas';
import { recarregarConsultas, useConsulta } from '@/data/consulta';
import { carregarPlano } from '@/data/tarefas';
import { MAX_AREAS, podeCriarArea } from '@/domain/regras';
import { descreverSemanaPorExtenso, semanaNaFrase } from '@/domain/semana';
import { usePrepararSemana, useSemanaAtual, useSemanaEscolhida } from '@/estado/semana';
import { SUGESTOES_DE_AREAS } from '@/sugestoes';
import { fontes, useTema } from '@/theme';
import { t } from '@/i18n';

const TABELAS = ['areas', 'tarefas', 'tarefas_semana', 'blocos'] as const;

export default function AreasEcra() {
  const { cores, estilos, corDaArea } = useTema();
  const router = useRouter();
  // As contagens são da semana que se está a planear (a do separador Semana).
  const semana = useSemanaEscolhida();
  const atual = useSemanaAtual();
  usePrepararSemana(semana);
  const plano = useConsulta(() => carregarPlano(semana), TABELAS, semana);
  const [aCriar, setACriar] = useState<string | null>(null);

  const lista = plano.areas;
  const podeCriar = podeCriarArea(lista.length);

  async function criarSugestao(s: (typeof SUGESTOES_DE_AREAS)[number]) {
    setACriar(s.nome);
    try {
      await criarArea({ ...s, nome: t(s.nome), missao: '' });
    } catch (e) {
      avisarErro(t('Não foi possível criar a área'), e);
    } finally {
      setACriar(null);
    }
  }

  return (
    <SafeAreaView style={estilos.ecra} edges={['top']}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Titulo subtitulo={t('Semana de {semana}', { semana: descreverSemanaPorExtenso(semana) })}>{t('As minhas áreas')}</Titulo>
          </View>
          <BotaoIcone icone="engrenagem" rotulo={t('Definições')} tamanho={22} cor={cores.texto2} onPress={() => router.push('/definicoes')} style={{ marginRight: -10, marginTop: -4 }} />
        </View>

        <Seccao titulo={t('Áreas')} direita={<Text style={estilos.pequeno}>{t('{n} de {max} no máximo', { n: lista.length, max: MAX_AREAS })}</Text>}>
          <AvisoDeSemana semana={semana} />
          <ListaDeAreas
            itens={lista}
            quando={semanaNaFrase(semana, atual, 'em')}
            aoAbrir={(areaId) => router.push({ pathname: '/area/[id]', params: { id: String(areaId) } })}
            aoReordenar={(ids) => {
              try {
                reordenarAreas(ids);
                recarregarConsultas();
              } catch (e) {
                avisarErro(t('Não foi possível mudar a ordem'), e);
              }
            }}
          />
          {lista.length > 1 ? <Text style={[estilos.pequeno, { fontSize: 12, lineHeight: 16 }]}>{t('Mantenha uma área premida e arraste para mudar a ordem.')}</Text> : null}

          {lista.length === 0 ? (
            <View style={{ gap: 12, marginTop: 4 }}>
              <Text style={estilos.corpo}>{t('Comece por escolher as áreas da sua vida. Pode mudar tudo depois.')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SUGESTOES_DE_AREAS.map((s) => {
                  const cor = corDaArea(s.cor);
                  return (
                    <Pressable
                      key={s.nome}
                      accessibilityRole="button"
                      accessibilityLabel={t('Criar área {nome}', { nome: t(s.nome) })}
                      disabled={aCriar !== null}
                      onPress={() => criarSugestao(s)}
                      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: cor.tinta }}
                    >
                      <Icone nome={s.icone} tamanho={16} cor={cor.texto} />
                      <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, color: cor.texto }}>{t(s.nome)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Botao
            titulo={t('Nova área')}
            icone="mais"
            variante="tracejado"
            disabled={!podeCriar}
            onPress={() => router.push('/area/nova')}
            accessibilityHint={podeCriar ? undefined : t('Já tem {max} áreas. Arquive uma para criar outra.', { max: MAX_AREAS })}
            style={{ marginTop: 2 }}
          />
        </Seccao>
      </ScrollView>
    </SafeAreaView>
  );
}
