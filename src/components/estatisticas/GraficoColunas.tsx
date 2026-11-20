import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ColunaDasEstatisticas } from '@/data/estatisticas';
import { percentagem } from '@/domain/estatisticas';
import { formatarHoras } from '@/domain/regras';
import { t } from '@/i18n';
import { fontes, useTema } from '@/theme';

const ALTURA = 132;
const LARGURA_MAXIMA = 24;

/**
 * Horas feitas contra as planeadas, uma coluna por semana (no mês) ou por mês (no ano). Cada coluna é
 * um medidor: a pista, num tom claro, é o planeado; o enchimento, no tom forte da mesma cor, é o feito.
 * Tocar numa coluna mostra os seus números por cima do gráfico (é aí que estão os valores, em vez de
 * um eixo com escala).
 */
export function GraficoColunas({ colunas }: { colunas: ColunaDasEstatisticas[] }) {
  const { cores, estilos } = useTema();
  const comDados = colunas.filter((c) => !c.futura);
  const ultimaComDados = [...comDados].reverse().find((c) => c.minutosPlaneados > 0 || c.minutosFeitos > 0) ?? comDados[comDados.length - 1];
  const [escolhida, setEscolhida] = useState<string | number | undefined>(ultimaComDados?.chave);
  const coluna = colunas.find((c) => c.chave === escolhida) ?? ultimaComDados;
  const maximo = Math.max(1, ...colunas.map((c) => Math.max(c.minutosPlaneados, c.minutosFeitos)));

  const descrever = (c: ColunaDasEstatisticas) => {
    if (c.futura) return t('{rotulo}: ainda não chegou', { rotulo: c.rotulo });
    if (c.minutosPlaneados === 0 && c.minutosFeitos === 0) return t('{rotulo}: nada planeado', { rotulo: c.rotulo });
    const p = percentagem(c.minutosFeitos, c.minutosPlaneados);
    return t('{rotulo}: {feitas} feitas de {planeadas} planeadas{percentagem}', {
      rotulo: c.rotulo,
      feitas: formatarHoras(c.minutosFeitos / 60),
      planeadas: formatarHoras(c.minutosPlaneados / 60),
      percentagem: p === null ? '' : ` (${p}%)`,
    });
  };

  return (
    <View style={{ gap: 10 }}>
      <Text style={[estilos.pequeno, { color: cores.texto2 }]} accessibilityLiveRegion="polite">
        {coluna ? descrever(coluna) : ''}
      </Text>
      <View style={{ height: ALTURA + 1, flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: cores.linha }}>
        {colunas.map((c) => {
          const ativa = coluna?.chave === c.chave;
          const alturaPista = (c.minutosPlaneados / maximo) * ALTURA;
          const alturaFeito = (c.minutosFeitos / maximo) * ALTURA;
          return (
            <Pressable
              key={String(c.chave)}
              accessibilityRole="button"
              accessibilityLabel={descrever(c)}
              accessibilityState={{ selected: ativa }}
              onPress={() => setEscolhida(c.chave)}
              style={{ flex: 1, height: ALTURA, alignItems: 'center', justifyContent: 'flex-end' }}
            >
              {c.futura ? null : (
                <View style={{ width: '62%', maxWidth: LARGURA_MAXIMA, height: Math.max(alturaPista, alturaFeito), justifyContent: 'flex-end', borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: cores.pista, overflow: 'hidden' }}>
                  <View style={{ height: alturaFeito, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: ativa ? cores.tinta : cores.texto2 }} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {colunas.map((c) => (
          <Text
            key={String(c.chave)}
            numberOfLines={1}
            style={{ flex: 1, textAlign: 'center', fontFamily: coluna?.chave === c.chave ? fontes.textoForte : fontes.texto, fontSize: 10, lineHeight: 12, color: c.futura ? cores.texto3 : coluna?.chave === c.chave ? cores.tinta : cores.texto2 }}
          >
            {c.rotulo}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 16 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Legenda cor={cores.tinta} texto={t('feitas')} />
        <Legenda cor={cores.pista} texto={t('planeadas')} />
      </View>
    </View>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  const { cores } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: cor }} />
      <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto2 }}>{texto}</Text>
    </View>
  );
}
