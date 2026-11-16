import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { avisarErro, confirmar } from '@/components/dialogos';
import { Icone } from '@/components/Icone';
import { Botao, Cartao, estilos } from '@/components/ui';
import { aceitarSemana, criarProposta, marcarSemanaModelo, type PlanoDaSemana } from '@/data/semanas';
import { formatarIntervalo } from '@/domain/calendario';
import type { OrigemDaSemana } from '@/domain/proposta';
import { DIAS_CURTOS, descreverSemanaPorExtenso, somarSemanas } from '@/domain/semana';
import { cores, fontes } from '@/theme';

type Props = {
  plano: PlanoDaSemana;
  /** Abre o calendário desta semana, para rever a proposta. */
  aoRever: () => void;
};

/** Como cada origem se apresenta ao utilizador nesta semana. */
function textosDaOrigem(origem: OrigemDaSemana, plano: PlanoDaSemana): { titulo: string; detalhe: string } {
  if (origem === 'passada') {
    const copiada = plano.ultimaPlaneada ?? '';
    const anterior = copiada === somarSemanas(plano.semana, -1);
    return {
      titulo: anterior ? 'Igual à semana passada' : 'Igual à última semana planeada',
      detalhe: `Copia os blocos da semana de ${descreverSemanaPorExtenso(copiada)}.`,
    };
  }
  if (origem === 'modelo') return { titulo: 'Igual à semana modelo', detalhe: `Copia a sua semana típica, a de ${descreverSemanaPorExtenso(plano.semanaModelo ?? '')}.` };
  return { titulo: 'Começar vazia', detalhe: 'Sem blocos: as tarefas que repetem ficam por alocar.' };
}

/**
 * O plano da semana no ecrã "Planear a semana": escolher de onde a semana parte, rever a proposta
 * (com o que precisa de atenção) e aceitá-la, e marcar a semana como modelo.
 */
export function CartaoPlano({ plano, aoRever }: Props) {
  const [origem, setOrigem] = useState<OrigemDaSemana>(plano.origem ?? plano.origemPorOmissao);
  const [aMudarOrigem, setAMudarOrigem] = useState(false);
  const escolhida = plano.origens.includes(origem) ? origem : plano.origemPorOmissao;

  function tentar(titulo: string, acao: () => void): boolean {
    try {
      acao();
      return true;
    } catch (erro) {
      avisarErro(titulo, erro);
      return false;
    }
  }

  async function refazer() {
    const sim = await confirmar({
      titulo: 'Refazer a proposta?',
      mensagem: 'A proposta atual é substituída: os blocos que mudou ou acrescentou nesta semana perdem-se. As tarefas ficam.',
      acao: 'Refazer',
    });
    if (sim && tentar('Não foi possível refazer a proposta', () => criarProposta(plano.semana, escolhida))) setAMudarOrigem(false);
  }

  const escolhaDeOrigem = (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Origem da semana">
      {plano.origens.map((o) => {
        const { titulo, detalhe } = textosDaOrigem(o, plano);
        const ativa = escolhida === o;
        return (
          <Pressable
            key={o}
            accessibilityRole="radio"
            accessibilityLabel={`${titulo}. ${detalhe}`}
            accessibilityState={{ selected: ativa }}
            onPress={() => setOrigem(o)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: ativa ? 2 : 1, borderColor: ativa ? cores.tinta : cores.contorno }}
          >
            <View style={{ width: 20, height: 20, borderRadius: 999, borderWidth: ativa ? 6 : 1.5, borderColor: ativa ? cores.tinta : cores.tracejado }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: cores.tinta }}>{titulo}</Text>
              <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto3 }}>{detalhe}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  let corpo: React.ReactNode = null;
  if (plano.estado === 'por_planear') {
    corpo = plano.podePlanear ? (
      <Cartao style={{ padding: 16, gap: 12 }}>
        <View style={{ gap: 2 }}>
          <Text style={estiloTitulo} accessibilityRole="header">
            Como quer começar esta semana?
          </Text>
          <Text style={estilos.pequeno}>Fica como proposta: revê, muda o que quiser e só depois aceita.</Text>
        </View>
        {escolhaDeOrigem}
        <Botao titulo="Criar proposta" onPress={() => tentar('Não foi possível criar a proposta', () => criarProposta(plano.semana, escolhida))} style={{ borderRadius: 12 }} />
      </Cartao>
    ) : (
      <Cartao style={{ padding: 16 }}>
        <Text style={estilos.pequeno}>Esta semana já passou e não chegou a ser planeada.</Text>
      </Cartao>
    );
  } else if (plano.estado === 'rascunho') {
    const atencao = plano.atencao ?? { sobreposicoes: [], areasSemTempo: [] };
    const { sobreposicoes, areasSemTempo } = atencao;
    const emOrdem = sobreposicoes.length === 0 && areasSemTempo.length === 0;
    const { titulo: tituloDaOrigem } = textosDaOrigem(plano.origem ?? 'vazia', { ...plano, ultimaPlaneada: plano.origemSemana ?? plano.ultimaPlaneada });
    corpo = (
      <Cartao style={{ padding: 16, gap: 12, borderColor: cores.tinta }}>
        <View style={{ gap: 2 }}>
          <Text style={estiloTitulo} accessibilityRole="header">
            Proposta por aceitar
          </Text>
          <Text style={estilos.pequeno}>{`${tituloDaOrigem}. Reveja, mude ou apague blocos no calendário; só fica definitiva quando aceitar.`}</Text>
        </View>

        <View style={{ gap: 8 }} accessibilityLabel="Precisa de atenção">
          {sobreposicoes.length > 0 ? (
            <Atencao titulo={sobreposicoes.length === 1 ? '1 sobreposição' : `${sobreposicoes.length} sobreposições`}>
              {sobreposicoes.slice(0, 3).map((s) => (
                <Text key={`${s.a.id}-${s.b.id}`} style={estiloDetalhe}>{`${DIAS_CURTOS[s.dia]} ${formatarIntervalo(s.inicioMin, s.fimMin)} · ${s.a.nome} e ${s.b.nome}`}</Text>
              ))}
              {sobreposicoes.length > 3 ? <Text style={estiloDetalhe}>{`e mais ${sobreposicoes.length - 3}`}</Text> : null}
            </Atencao>
          ) : null}
          {areasSemTempo.length > 0 ? (
            <Atencao titulo={areasSemTempo.length === 1 ? '1 área sem tempo no calendário' : `${areasSemTempo.length} áreas sem tempo no calendário`}>
              <Text style={estiloDetalhe}>{areasSemTempo.map((a) => a.nome).join(', ')}</Text>
            </Atencao>
          ) : null}
          {emOrdem ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icone nome="certo" tamanho={16} cor={cores.texto2} espessura={2.2} />
              <Text style={[estilos.pequeno, { color: cores.texto2 }]}>Sem sobreposições, e todas as áreas têm tempo.</Text>
            </View>
          ) : null}
        </View>

        {aMudarOrigem ? (
          <View style={{ gap: 8 }}>
            {escolhaDeOrigem}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Botao titulo="Cancelar" variante="contorno" onPress={() => setAMudarOrigem(false)} style={{ flex: 1 }} />
              <Botao titulo="Refazer proposta" onPress={refazer} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Botao titulo="Aceitar semana" icone="certo" onPress={() => tentar('Não foi possível aceitar a semana', () => aceitarSemana(plano.semana))} style={{ borderRadius: 12 }} />
            <Botao titulo="Rever no calendário" icone="calendario" variante="contorno" onPress={aoRever} style={{ borderRadius: 12 }} />
            {plano.origens.length > 1 ? <Botao titulo="Mudar a origem" variante="texto" onPress={() => setAMudarOrigem(true)} style={{ justifyContent: 'center', minHeight: 44 }} /> : null}
          </View>
        )}
      </Cartao>
    );
  }

  const outroModelo = plano.semanaModelo && !plano.modelo ? ` (substitui a de ${descreverSemanaPorExtenso(plano.semanaModelo)})` : '';
  return (
    <View style={{ gap: 8 }}>
      {corpo}
      {plano.estado === 'por_planear' ? null : (
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Semana modelo"
          accessibilityHint="A semana modelo é a sua semana típica: pode servir de origem às semanas seguintes."
          accessibilityState={{ checked: plano.modelo }}
          onPress={() => tentar('Não foi possível mudar a semana modelo', () => marcarSemanaModelo(plano.semana, !plano.modelo))}
          style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 })}
        >
          <Icone nome="estrela" tamanho={18} cor={plano.modelo ? cores.tinta : cores.texto3} espessura={plano.modelo ? 2.4 : 1.8} />
          <Text style={{ flex: 1, fontFamily: plano.modelo ? fontes.textoForte : fontes.textoMedio, fontSize: 14, lineHeight: 20, color: plano.modelo ? cores.tinta : cores.texto2 }}>
            {plano.modelo ? 'Esta é a semana modelo' : `Marcar como semana modelo${outroModelo}`}
          </Text>
          {plano.modelo ? <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, color: cores.tinta, textDecorationLine: 'underline' }}>Desmarcar</Text> : null}
        </Pressable>
      )}
    </View>
  );
}

function Atencao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: cores.perigoTinta }}>
      <View style={{ marginTop: 1 }}>
        <Icone nome="aviso" tamanho={16} cor={cores.perigo} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, lineHeight: 18, color: cores.tinta }}>{titulo}</Text>
        {children}
      </View>
    </View>
  );
}

const estiloTitulo = { fontFamily: fontes.textoForte, fontSize: 16, lineHeight: 22, color: cores.tinta };
const estiloDetalhe = { fontFamily: fontes.texto, fontSize: 13, lineHeight: 18, color: cores.texto2, fontVariant: ['tabular-nums' as const] };
