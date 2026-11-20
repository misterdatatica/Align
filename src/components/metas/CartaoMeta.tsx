import { Pressable, Text, View } from 'react-native';

import { Icone } from '@/components/Icone';
import { BarraProgresso } from '@/components/ui';
import type { MetaDetalhada } from '@/data/metas';
import { NOME_DO_ESTADO } from '@/domain/metas';
import { descreverRecorrencia } from '@/domain/recorrencia';
import { formatarDuracao } from '@/domain/tarefas';
import { fontes, useTema } from '@/theme';

import { textoEstagnada, textoDoPrazo, textoDoProgresso } from './textos';
import { t } from '@/i18n';

type Props = {
  meta: MetaDetalhada;
  /** Cor forte da área. */
  cor: string;
  aoAbrir: () => void;
  /** A semana das contagens, no meio de uma frase: "esta semana", "na semana seguinte"… */
  quando: string;
  /** Na lista de todas as metas: mostra a área por cima da descrição. */
  area?: string;
};

/** Uma meta no detalhe da área: progresso, prazo, dias que faltam e as tarefas ligadas. Tocar abre-a. */
export function CartaoMeta({ meta, cor, aoAbrir, quando, area }: Props) {
  const { cores, estilos } = useTema();
  const ativa = meta.estado === 'ativa';
  const progresso = textoDoProgresso(meta);
  const prazo = textoDoPrazo(meta);
  const atrasada = ativa && meta.diasQueFaltam < 0;
  const nomesDasTarefas = meta.tarefas.map((tf) => tf.nome).join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${area ? `${area}: ` : ''}${meta.descricao}. ${ativa ? '' : `${t(NOME_DO_ESTADO[meta.estado])}. `}${progresso}. ${prazo}. ${nomesDasTarefas ? t('Tarefas ligadas: {nomes}', { nomes: nomesDasTarefas }) : t('Sem tarefas ligadas')}.`}
      accessibilityHint={t('Abre a meta')}
      onPress={aoAbrir}
      style={({ pressed }) => ({ padding: 16, gap: 10, opacity: pressed ? 0.6 : 1 })}
    >
      {area ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: -6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: cor }} />
          <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>{area}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <Text style={{ flex: 1, fontFamily: fontes.textoForte, fontSize: 16, lineHeight: 22, color: ativa ? cores.tinta : cores.texto2 }}>{meta.descricao}</Text>
        {ativa ? null : (
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: cores.pista }}>
            <Text style={{ fontFamily: fontes.textoForte, fontSize: 12, lineHeight: 16, color: cores.texto2 }}>{t(NOME_DO_ESTADO[meta.estado])}</Text>
          </View>
        )}
        <View style={{ marginTop: 3 }}>
          <Icone nome="seta-direita" tamanho={16} cor={cores.texto3} espessura={2} />
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Text style={[estilos.pequeno, atrasada ? { color: cores.perigo } : null]}>{prazo}</Text>
          <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, lineHeight: 18, color: cores.tinta, fontVariant: ['tabular-nums'] }}>{progresso}</Text>
        </View>
        {meta.medida === 'numero' ? <BarraProgresso valor={meta.progresso} cor={ativa ? cor : cores.tracejado} pista={cores.linhaSuave} /> : null}
      </View>

      {ativa && meta.estagnada ? <Text style={estilos.pequeno}>{textoEstagnada()}</Text> : null}

      {meta.tarefas.length === 0 ? (
        ativa ? (
          <Text style={estilos.pequeno}>{t('Ainda não há tarefas ligadas a esta meta.')}</Text>
        ) : null
      ) : (
        <View style={{ gap: 2 }}>
          {meta.tarefas.map((tf) => {
            const detalhe = [formatarDuracao(tf.duracaoMin), descreverRecorrencia(tf.recorrencia), tf.total > 0 ? `${tf.feitas}/${tf.total} ${quando}` : null].filter(Boolean).join(' · ');
            return (
              <View key={tf.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icone nome={tf.recorrencia ? 'repetir' : 'certo'} tamanho={12} cor={cores.texto3} espessura={2} />
                <Text style={{ flexShrink: 1, fontFamily: fontes.textoMedio, fontSize: 13, lineHeight: 18, color: cores.texto2 }} numberOfLines={1}>
                  {tf.nome}
                </Text>
                <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 18, color: cores.texto3 }} numberOfLines={1}>
                  {detalhe}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Pressable>
  );
}
