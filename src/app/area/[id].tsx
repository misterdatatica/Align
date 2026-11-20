import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { AvisoDeSemana } from '@/components/AvisoDeSemana';
import { CampoAutoGuardado } from '@/components/CampoAutoGuardado';
import { comDesfazer } from '@/components/AvisoTemporario';
import { avisarErro } from '@/components/dialogos';
import { Icone, type NomeIcone } from '@/components/Icone';
import { LinhaTarefa } from '@/components/LinhaTarefa';
import { CartaoMeta } from '@/components/metas/CartaoMeta';
import { Botao, Cartao, Seccao, SeletorCor, SeletorIcone } from '@/components/ui';
import { arquivarArea, atualizarArea, carregarAreaNaSemana } from '@/data/areas';
import { useConsulta } from '@/data/consulta';
import { MAX_METAS_ATIVAS, podeAtivarMeta } from '@/domain/metas';
import { semanaNaFrase } from '@/domain/semana';
import { useHoje, usePrepararSemana, useSemanaAtual, useSemanaEscolhida } from '@/estado/semana';
import { fontes, useTema } from '@/theme';
import { t } from '@/i18n';

const TABELAS = ['areas', 'metas', 'metas_registos', 'tarefas', 'tarefas_semana', 'blocos'] as const;

export default function AreaEcra() {
  const { cores, estilos, corDaArea } = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const areaId = Number(id);
  const router = useRouter();
  // A semana que se está a planear (a do separador Semana), não necessariamente a atual.
  const semana = useSemanaEscolhida();
  const atual = useSemanaAtual();
  usePrepararSemana(semana);
  const hoje = useHoje();
  const dados = useConsulta(() => carregarAreaNaSemana(areaId, semana, hoje), TABELAS, `${areaId}|${semana}|${hoje}`);

  if (!dados) return null;
  const { area, metas, tarefas } = dados;
  const cor = corDaArea(area.cor);
  // As ativas primeiro; as pausadas, concluídas e abandonadas ficam por baixo, sem contar para o limite.
  const ativas = metas.filter((m) => m.estado === 'ativa');
  const outras = metas.filter((m) => m.estado !== 'ativa');
  const podeCriarMeta = podeAtivarMeta(ativas.length);
  const abrirMeta = (metaId: number) => router.push({ pathname: '/meta/[id]', params: { id: String(metaId) } });

  /** A área deixa de aparecer, mas o histórico fica guardado (e pode ser reposta nas definições). */
  function arquivar() {
    if (comDesfazer(t('“{nome}” arquivada', { nome: area.nome }), () => arquivarArea(areaId), t('Não foi possível arquivar a área'))) router.back();
  }

  function mudar(campos: Parameters<typeof atualizarArea>[1]) {
    atualizarArea(areaId, campos).catch((e: unknown) => avisarErro(t('Não foi possível guardar'), e));
  }

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={[estilos.conteudo, { paddingTop: 4 }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: cor.tinta, alignItems: 'center', justifyContent: 'center' }}>
          <Icone nome={area.icone as NomeIcone} tamanho={24} cor={cor.texto} />
        </View>
        <CampoAutoGuardado
          key={`nome-${area.id}`}
          inicial={area.nome}
          guardar={(nome) => atualizarArea(areaId, { nome })}
          obrigatorio
          erro={t('Não foi possível guardar o nome')}
          maxLength={40}
          accessibilityLabel={t('Nome da área')}
          placeholder={t('Nome da área')}
          contentor={{ flex: 1 }}
          style={[estilos.titulo, { paddingVertical: 4 }]}
        />
      </View>

      <Seccao titulo={t('Missão')}>
        <CampoAutoGuardado
          key={`missao-${area.id}`}
          inicial={area.missao}
          guardar={(missao) => atualizarArea(areaId, { missao })}
          erro={t('Não foi possível guardar a missão')}
          placeholder={t('Porque é que esta área importa?')}
          multiline
          maxLength={140}
          accessibilityLabel={t('Missão')}
          style={[estilos.cartao, { padding: 16, fontFamily: fontes.tituloMedio, fontSize: 20, lineHeight: 26, color: cores.tinta }]}
        />
      </Seccao>

      <Seccao titulo={t('Metas')} direita={<Text style={estilos.pequeno}>{t('{n} de {max} ativas', { n: ativas.length, max: MAX_METAS_ATIVAS })}</Text>}>
        <Cartao>
          {ativas.map((m, i) => (
            <View key={m.id} style={i === 0 ? null : { borderTopWidth: 1, borderTopColor: cores.linhaSuave }}>
              <CartaoMeta meta={m} cor={cor.forte} aoAbrir={() => abrirMeta(m.id)} quando={semanaNaFrase(semana, atual, 'em')} />
            </View>
          ))}
          {ativas.length === 0 ? <Text style={[estilos.pequeno, { padding: 16, paddingBottom: 4 }]}>{t('Onde quer chegar nesta área? Uma meta é um resultado com prazo, não uma atividade.')}</Text> : null}
          <View style={[{ paddingHorizontal: 8 }, ativas.length > 0 ? { borderTopWidth: 1, borderTopColor: cores.linhaSuave } : null]}>
            <Botao
              titulo={t('Adicionar meta')}
              icone="mais"
              variante="texto"
              disabled={!podeCriarMeta}
              accessibilityHint={podeCriarMeta ? undefined : t('Já tem {max} metas ativas nesta área.', { max: MAX_METAS_ATIVAS })}
              onPress={() => router.push({ pathname: '/meta/nova', params: { areaId: String(areaId) } })}
            />
          </View>
        </Cartao>
        <Text style={[estilos.pequeno, podeCriarMeta ? null : { color: cores.texto2 }]}>
          {podeCriarMeta
            ? t('Até {max} metas ativas por área: menos metas, mais foco. As pausadas e as concluídas não contam.', { max: MAX_METAS_ATIVAS })
            : t('O máximo são {max} metas ativas por área. Conclua, pause ou abandone uma para criar outra.', { max: MAX_METAS_ATIVAS })}
        </Text>
        {outras.length > 0 ? (
          <Cartao style={{ marginTop: 4 }}>
            {outras.map((m, i) => (
              <View key={m.id} style={i === 0 ? null : { borderTopWidth: 1, borderTopColor: cores.linhaSuave }}>
                <CartaoMeta meta={m} cor={cor.forte} aoAbrir={() => abrirMeta(m.id)} quando={semanaNaFrase(semana, atual, 'em')} />
              </View>
            ))}
          </Cartao>
        ) : null}
      </Seccao>

      <Seccao titulo={t('Tarefas {quando}', { quando: semanaNaFrase(semana, atual, 'de') })}>
        <AvisoDeSemana semana={semana} />
        <View style={[estilos.cartao, { overflow: 'hidden' }]}>
          {tarefas.map((tf, i) => (
            <LinhaTarefa key={tf.id} tarefa={tf} semana={semana} porExtenso semLinha={i === 0} />
          ))}
          <View style={[{ paddingHorizontal: 8 }, tarefas.length > 0 ? { borderTopWidth: 1, borderTopColor: cores.linhaSuave } : null]}>
            <Botao
              titulo={t('Nova tarefa')}
              icone="mais"
              variante="texto"
              onPress={() => router.push({ pathname: '/tarefa/nova', params: { areaId: String(areaId), semana } })}
            />
          </View>
        </View>
      </Seccao>

      <Seccao titulo={t('Cor')}>
        <SeletorCor valor={area.cor} onChange={(c) => mudar({ cor: c })} />
      </Seccao>

      <Seccao titulo={t('Ícone')}>
        <SeletorIcone valor={area.icone} cor={area.cor} onChange={(i) => mudar({ icone: i })} />
      </Seccao>

      <Botao titulo={t('Arquivar área')} variante="texto" onPress={arquivar} />
    </ScrollView>
  );
}
