import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Icone, type NomeIcone } from '@/components/Icone';
import { Cartao, Seccao } from '@/components/ui';
import { useConsulta } from '@/data/consulta';
import { pesquisar } from '@/data/pesquisa';
import { NOME_DO_ESTADO } from '@/domain/metas';
import { descreverRecorrencia } from '@/domain/recorrencia';
import { descreverData, descreverSemanaPorExtenso } from '@/domain/semana';
import { formatarDuracao } from '@/domain/tarefas';
import { useSemanaAtual } from '@/estado/semana';
import { t } from '@/i18n';
import { fontes, useTema } from '@/theme';

const TABELAS = ['areas', 'metas', 'tarefas', 'tarefas_semana'] as const;

/** Pesquisar áreas, metas e tarefas pelo nome, sem ligar a maiúsculas nem a acentos. */
export default function PesquisaEcra() {
  const { cores, estilos } = useTema();
  const router = useRouter();
  const semanaAtual = useSemanaAtual();
  const [texto, setTexto] = useState('');
  const resultado = useConsulta(() => pesquisar(texto, semanaAtual), TABELAS, `${texto}|${semanaAtual}`);
  const vazio = !texto.trim();
  const nada = !vazio && resultado.areas.length + resultado.metas.length + resultado.tarefas.length === 0;

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={{ justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: 14, zIndex: 1 }} pointerEvents="none">
          <Icone nome="lupa" tamanho={18} cor={cores.texto3} />
        </View>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder={t('Tarefas, metas ou áreas')}
          placeholderTextColor={cores.texto3}
          accessibilityLabel={t('Pesquisar')}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={[estilos.campo, { paddingLeft: 40 }]}
        />
      </View>

      {vazio ? <Text style={estilos.pequeno}>{t('Escreva o nome de uma tarefa, meta ou área. Não precisa de acentos.')}</Text> : null}
      {nada ? <Text style={estilos.corpo}>{t('Nada encontrado para “{texto}”.', { texto: texto.trim() })}</Text> : null}

      {resultado.metas.length > 0 ? (
        <Seccao titulo={t('Metas')}>
          <Cartao style={{ overflow: 'hidden' }}>
            {resultado.metas.map((m, i) => (
              <Resultado
                key={m.id}
                primeiro={i === 0}
                icone="alvo"
                cor={m.area.cor}
                titulo={m.descricao}
                detalhe={[m.area.nome, m.estado === 'ativa' ? t('Até {dia}', { dia: descreverData(m.prazo) }) : t(NOME_DO_ESTADO[m.estado])].join(' · ')}
                aoAbrir={() => router.push({ pathname: '/meta/[id]', params: { id: String(m.id) } })}
              />
            ))}
          </Cartao>
        </Seccao>
      ) : null}

      {resultado.tarefas.length > 0 ? (
        <Seccao titulo={t('Tarefas')}>
          <Cartao style={{ overflow: 'hidden' }}>
            {resultado.tarefas.map((tf, i) => (
              <Resultado
                key={tf.id}
                primeiro={i === 0}
                icone={tf.recorrencia ? 'repetir' : 'lista'}
                cor={tf.area.cor}
                titulo={tf.nome}
                detalhe={[
                  tf.area.nome,
                  formatarDuracao(tf.duracaoMin) ?? t('sem duração'),
                  descreverRecorrencia(tf.recorrencia),
                  tf.semana !== semanaAtual ? t('semana de {semana}', { semana: descreverSemanaPorExtenso(tf.semana) }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                aoAbrir={() => router.push({ pathname: '/tarefa/[id]', params: { id: String(tf.id), semana: tf.semana } })}
              />
            ))}
          </Cartao>
        </Seccao>
      ) : null}

      {resultado.areas.length > 0 ? (
        <Seccao titulo={t('Áreas')}>
          <Cartao style={{ overflow: 'hidden' }}>
            {resultado.areas.map((a, i) => (
              <Resultado
                key={a.id}
                primeiro={i === 0}
                icone={a.icone as NomeIcone}
                cor={a.cor}
                titulo={a.nome}
                detalhe={t('Área')}
                aoAbrir={() => router.push({ pathname: '/area/[id]', params: { id: String(a.id) } })}
              />
            ))}
          </Cartao>
        </Seccao>
      ) : null}
    </ScrollView>
  );
}

function Resultado({ primeiro, icone, cor, titulo, detalhe, aoAbrir }: { primeiro: boolean; icone: NomeIcone; cor: string; titulo: string; detalhe: string; aoAbrir: () => void }) {
  const { cores, corDaArea } = useTema();
  const corArea = corDaArea(cor);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titulo}, ${detalhe}`}
      onPress={aoAbrir}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: primeiro ? 0 : 1, borderTopColor: cores.linhaSuave, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: corArea.tinta }}>
        <Icone nome={icone} tamanho={16} cor={corArea.texto} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontFamily: fontes.textoMedio, fontSize: 15, lineHeight: 20, color: cores.tinta }}>
          {titulo}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>
          {detalhe}
        </Text>
      </View>
      <Icone nome="seta-direita" tamanho={16} cor={cores.texto3} espessura={2} />
    </Pressable>
  );
}
