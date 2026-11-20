import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { CartaoMeta } from '@/components/metas/CartaoMeta';
import { Cartao, Opcao, Seccao } from '@/components/ui';
import { useConsulta } from '@/data/consulta';
import { carregarTodasAsMetas } from '@/data/metas';
import type { EstadoMeta } from '@/domain/metas';
import { semanaNaFrase } from '@/domain/semana';
import { useHoje, useSemanaAtual } from '@/estado/semana';
import { t } from '@/i18n';
import { useTema } from '@/theme';

const TABELAS = ['areas', 'metas', 'metas_registos', 'tarefas', 'tarefas_semana'] as const;

type Filtro = 'todas' | EstadoMeta;

const FILTROS = (): { valor: Filtro; titulo: string }[] => [
  { valor: 'todas', titulo: t('Todas') },
  { valor: 'ativa', titulo: t('Ativas') },
  { valor: 'pausada', titulo: t('Pausadas') },
  { valor: 'concluida', titulo: t('Concluídas') },
  { valor: 'abandonada', titulo: t('Abandonadas') },
];

/** Títulos das secções, pela ordem em que aparecem. */
const SECCOES = (): { estado: EstadoMeta; titulo: string }[] => [
  { estado: 'ativa', titulo: t('Ativas') },
  { estado: 'pausada', titulo: t('Pausadas') },
  { estado: 'concluida', titulo: t('Concluídas') },
  { estado: 'abandonada', titulo: t('Abandonadas') },
];

/**
 * Todas as metas de todas as áreas, separadas por estado: as ativas, e também as pausadas, as
 * concluídas (o que já alcançou) e as abandonadas, que noutros ecrãs ficam escondidas.
 */
export default function MetasEcra() {
  const { cores, estilos, corDaArea } = useTema();
  const router = useRouter();
  const hoje = useHoje();
  const semana = useSemanaAtual();
  const metas = useConsulta(() => carregarTodasAsMetas(semana, hoje), TABELAS, `${semana}|${hoje}`);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const seccoes = SECCOES()
    .filter((s) => filtro === 'todas' || s.estado === filtro)
    .map((s) => ({ ...s, metas: metas.filter((m) => m.estado === s.estado) }))
    .filter((s) => s.metas.length > 0 || filtro !== 'todas');

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={estilos.conteudo}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={t('Mostrar metas')}>
        {FILTROS().map((f) => {
          const quantas = f.valor === 'todas' ? metas.length : metas.filter((m) => m.estado === f.valor).length;
          return <Opcao key={f.valor} titulo={`${f.titulo} · ${quantas}`} ativa={filtro === f.valor} onPress={() => setFiltro(f.valor)} style={{ minHeight: 40, paddingHorizontal: 12 }} />;
        })}
      </View>

      {metas.length === 0 ? (
        <Text style={estilos.corpo}>{t('Ainda não há metas. Crie-as a partir de uma área.')}</Text>
      ) : (
        seccoes.map((s) => (
          <Seccao key={s.estado} titulo={s.titulo}>
            {s.metas.length === 0 ? (
              <Text style={estilos.pequeno}>{t('Nenhuma meta neste estado.')}</Text>
            ) : (
              <Cartao>
                {s.metas.map((m, i) => (
                  <View key={m.id} style={i === 0 ? null : { borderTopWidth: 1, borderTopColor: cores.linhaSuave }}>
                    <CartaoMeta
                      meta={m}
                      area={m.area.nome}
                      cor={corDaArea(m.area.cor).forte}
                      quando={semanaNaFrase(semana, semana, 'em')}
                      aoAbrir={() => router.push({ pathname: '/meta/[id]', params: { id: String(m.id) } })}
                    />
                  </View>
                ))}
              </Cartao>
            )}
          </Seccao>
        ))
      )}
    </ScrollView>
  );
}
