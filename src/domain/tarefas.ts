/** Regras das tarefas e das suas instâncias semanais que não dependem da base de dados. */

import type { Recorrencia } from './recorrencia';
import { formatarHoras } from './regras';
import { minutosEntre } from './semana';

export type EstadoInstancia = 'por_alocar' | 'alocada' | 'feita' | 'nao_feita';

/** Passo e limite das durações: os blocos do calendário encaixam em meias horas. */
export const PASSO_DURACAO_MIN = 30;
export const DURACAO_MAXIMA_MIN = 12 * 60;

/** Nome que cabe num bloco do calendário: o nome curto escolhido, ou o início do nome. */
export function nomeCurtoDe(nome: string, nomeCurto?: string | null): string {
  const curto = nomeCurto?.trim();
  if (curto) return curto;
  const limpo = nome.trim();
  if (limpo.length <= 10) return limpo;
  const primeira = limpo.split(/\s+/)[0];
  if (primeira.length >= 3 && primeira.length <= 10) return primeira;
  return `${limpo.slice(0, 8).trimEnd()}.`;
}

/** "2 h", "30 min", "1,5 h"; null (sem duração) devolve null. */
export function formatarDuracao(minutos: number | null): string | null {
  return minutos === null ? null : formatarHoras(minutos / 60);
}

export type TarefaBase = {
  id: number;
  areaId: number;
  metaId: number | null;
  nome: string;
  nomeCurto: string | null;
  /** null = não ocupa tempo no calendário; conta só quando é marcada como feita. */
  duracaoMin: number | null;
  recorrencia: Recorrencia | null;
};

export type InstanciaSemana = {
  id: number;
  tarefaId: number;
  estado: EstadoInstancia;
  transitadaDe: string | null;
};

export type BlocoDaInstancia = {
  tarefaSemanaId: number | null;
  inicio: string;
  fim: string;
  feito: boolean;
};

/** Uma tarefa numa semana: quantas instâncias tem e em que ponto estão. */
export type ResumoTarefa = TarefaBase & {
  /** Instâncias nesta semana (1 se não repete). */
  total: number;
  /** Instâncias com bloco no calendário, feitas ou não. */
  noCalendario: number;
  feitas: number;
  naoFeitas: number;
  /** Instâncias com duração que ainda não têm bloco nem estão feitas. */
  porAlocar: number;
  /** Ids das instâncias por alocar, pela ordem em que foram criadas. */
  instanciasPorAlocar: number[];
  veioDaSemanaPassada: boolean;
  minutosPlaneados: number;
  minutosCalendario: number;
  minutosFeitos: number;
  /** Id da primeira instância: mantém a ordem da lista mesmo quando a tarefa é alterada. */
  ordem: number;
};

export function resumirTarefa(tarefa: TarefaBase, instancias: InstanciaSemana[], blocos: BlocoDaInstancia[]): ResumoTarefa {
  const blocoPorInstancia = new Map<number, BlocoDaInstancia>();
  for (const b of blocos) if (b.tarefaSemanaId !== null) blocoPorInstancia.set(b.tarefaSemanaId, b);

  let noCalendario = 0;
  let feitas = 0;
  let naoFeitas = 0;
  let minutosCalendario = 0;
  let minutosFeitos = 0;
  let veioDaSemanaPassada = false;
  const instanciasPorAlocar: number[] = [];

  for (const i of instancias) {
    const bloco = blocoPorInstancia.get(i.id);
    if (bloco) {
      noCalendario += 1;
      const minutos = minutosEntre(bloco.inicio, bloco.fim);
      minutosCalendario += minutos;
      if (i.estado === 'feita') minutosFeitos += minutos;
    }
    if (i.estado === 'feita') feitas += 1;
    else if (i.estado === 'nao_feita') naoFeitas += 1;
    if (i.transitadaDe) veioDaSemanaPassada = true;
    if (!bloco && i.estado === 'por_alocar' && tarefa.duracaoMin !== null) instanciasPorAlocar.push(i.id);
  }

  return {
    ...tarefa,
    total: instancias.length,
    noCalendario,
    feitas,
    naoFeitas,
    porAlocar: instanciasPorAlocar.length,
    instanciasPorAlocar,
    veioDaSemanaPassada,
    minutosPlaneados: (tarefa.duracaoMin ?? 0) * instancias.length,
    minutosCalendario,
    minutosFeitos,
    ordem: instancias.length ? Math.min(...instancias.map((i) => i.id)) : 0,
  };
}

/** O que a lista "Planear a semana" mostra à direita de cada tarefa. */
export type EstadoLinha =
  /** Falta pôr no calendário (contorno). */
  | { tipo: 'por_alocar'; texto: string }
  /** Tudo no calendário ou tudo feito (visto). */
  | { tipo: 'completa'; texto: string }
  /** Semana já revista e ficou por fazer (sem destaque). */
  | { tipo: 'neutra'; texto: string }
  /** Tarefa sem duração: conta-se marcando como feita. */
  | { tipo: 'contagem'; feitas: number; total: number };

export function estadoDaLinha(r: Pick<ResumoTarefa, 'duracaoMin' | 'total' | 'noCalendario' | 'feitas' | 'naoFeitas'>): EstadoLinha {
  if (r.duracaoMin === null) return { tipo: 'contagem', feitas: r.feitas, total: r.total };
  if (r.total === 1) {
    if (r.feitas === 1) return { tipo: 'completa', texto: 'Feita' };
    if (r.naoFeitas === 1) return { tipo: 'neutra', texto: 'Não feita' };
    if (r.noCalendario === 1) return { tipo: 'completa', texto: 'Alocada' };
    return { tipo: 'por_alocar', texto: 'Por alocar' };
  }
  if (r.feitas === r.total) return { tipo: 'completa', texto: `${r.feitas}/${r.total} feitas` };
  if (r.naoFeitas > 0) return { tipo: 'neutra', texto: `${r.feitas}/${r.total} feitas` };
  if (r.noCalendario === r.total) return { tipo: 'completa', texto: `${r.noCalendario}/${r.total}` };
  return { tipo: 'por_alocar', texto: `${r.noCalendario}/${r.total}` };
}

/** Linha por baixo do nome: "2 h · todos os dias", "30 min · vem da semana passada". */
export function detalheDaLinha(r: Pick<ResumoTarefa, 'duracaoMin' | 'veioDaSemanaPassada'>, recorrencia: string | null): string {
  const partes = [formatarDuracao(r.duracaoMin), recorrencia, r.veioDaSemanaPassada ? 'vem da semana passada' : null].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'sem duração';
}

export type InstanciaParaAcertar = { id: number; estado: EstadoInstancia; temBloco: boolean };

/**
 * Quando a recorrência muda (ex.: de 4× para 2× por semana), diz quantas instâncias criar ou quais retirar.
 * Retira primeiro as que ainda não estão no calendário e nunca as que já foram feitas.
 */
export function acertarInstancias(existentes: InstanciaParaAcertar[], alvo: number): { criar: number; remover: number[] } {
  if (existentes.length <= alvo) return { criar: alvo - existentes.length, remover: [] };
  const peso = (i: InstanciaParaAcertar) => (i.temBloco ? 2 : i.estado === 'nao_feita' ? 1 : 0);
  const candidatas = existentes.filter((i) => i.estado !== 'feita').sort((a, b) => peso(a) - peso(b) || b.id - a.id);
  return { criar: 0, remover: candidatas.slice(0, existentes.length - alvo).map((i) => i.id) };
}

export type AreaComTarefas<A> = { area: A; tarefas: ResumoTarefa[]; minutosPlaneados: number };

export type PlanoSemana<A> = {
  semana: string;
  areas: AreaComTarefas<A>[];
  minutosPlaneados: number;
  minutosCalendario: number;
  minutosFeitos: number;
  /** Instâncias com duração ainda fora do calendário. */
  porAlocar: number;
  minutosPorAlocar: number;
};

/** Junta áreas, tarefas, instâncias e blocos de uma semana no que os ecrãs mostram. */
export function montarPlano<A extends { id: number }>(
  semana: string,
  areas: A[],
  tarefas: TarefaBase[],
  instancias: InstanciaSemana[],
  blocos: BlocoDaInstancia[],
): PlanoSemana<A> {
  const instanciasPorTarefa = new Map<number, InstanciaSemana[]>();
  for (const i of instancias) {
    const lista = instanciasPorTarefa.get(i.tarefaId);
    if (lista) lista.push(i);
    else instanciasPorTarefa.set(i.tarefaId, [i]);
  }
  const tarefaDaInstancia = new Map(instancias.map((i) => [i.id, i.tarefaId]));
  const blocosPorTarefa = new Map<number, BlocoDaInstancia[]>();
  for (const b of blocos) {
    const tarefaId = b.tarefaSemanaId === null ? undefined : tarefaDaInstancia.get(b.tarefaSemanaId);
    if (tarefaId === undefined) continue;
    const lista = blocosPorTarefa.get(tarefaId);
    if (lista) lista.push(b);
    else blocosPorTarefa.set(tarefaId, [b]);
  }

  const plano: PlanoSemana<A> = { semana, areas: [], minutosPlaneados: 0, minutosCalendario: 0, minutosFeitos: 0, porAlocar: 0, minutosPorAlocar: 0 };
  for (const area of areas) {
    const resumos = tarefas
      .filter((t) => t.areaId === area.id && instanciasPorTarefa.has(t.id))
      .map((t) => resumirTarefa(t, instanciasPorTarefa.get(t.id) ?? [], blocosPorTarefa.get(t.id) ?? []))
      .sort((a, b) => a.ordem - b.ordem);
    const minutosPlaneados = resumos.reduce((soma, r) => soma + r.minutosPlaneados, 0);
    plano.areas.push({ area, tarefas: resumos, minutosPlaneados });
    plano.minutosPlaneados += minutosPlaneados;
    for (const r of resumos) {
      plano.minutosCalendario += r.minutosCalendario;
      plano.minutosFeitos += r.minutosFeitos;
      plano.porAlocar += r.porAlocar;
      plano.minutosPorAlocar += r.porAlocar * (r.duracaoMin ?? 0);
    }
  }
  return plano;
}
