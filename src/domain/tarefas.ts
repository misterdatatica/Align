/** Regras das tarefas e das suas instâncias semanais que não dependem da base de dados. */

import { t } from '../i18n/index.ts';
import { DIAS_ABREVIADOS, type Recorrencia } from './recorrencia';
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
  /** Dia escolhido de uma tarefa única sem duração (0 = segunda … 6 = domingo); null = qualquer dia. */
  dia?: number | null;
};

/**
 * Os dias da semana (0 = segunda … 6 = domingo) em que se faz uma tarefa sem duração: todos, os dias
 * certos da recorrência, ou o dia escolhido de uma tarefa única. Vazio quando não tem dias (com
 * duração, "vezes por semana", ou tarefa única para qualquer dia).
 */
export function diasDaTarefa(t: Pick<TarefaBase, 'duracaoMin' | 'recorrencia' | 'dia'>): number[] {
  if (t.duracaoMin !== null) return [];
  const r = t.recorrencia;
  if (!r) return t.dia !== null && t.dia !== undefined && t.dia >= 0 && t.dia <= 6 ? [t.dia] : [];
  if (r.tipo === 'diaria') return [0, 1, 2, 3, 4, 5, 6];
  if (r.tipo === 'dias') return [...new Set(r.dias)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b).map((d) => d - 1);
  return [];
}

/**
 * Liga as instâncias de uma tarefa numa semana aos seus dias (AAAA-MM-DD). As que já estão num dia
 * certo ficam onde estão; as outras ocupam os dias que faltam, pela ordem; as que sobram ficam sem dia.
 * Devolve só as instâncias cujo dia muda.
 */
export function distribuirDias(instancias: { id: number; dia: string | null }[], dias: string[]): { id: number; dia: string | null }[] {
  const usados = new Set<string>();
  const novo = new Map<number, string | null>();
  for (const i of instancias) {
    if (i.dia !== null && dias.includes(i.dia) && !usados.has(i.dia)) {
      usados.add(i.dia);
      novo.set(i.id, i.dia);
    }
  }
  const livres = dias.filter((d) => !usados.has(d));
  for (const i of instancias) if (!novo.has(i.id)) novo.set(i.id, livres.shift() ?? null);
  return instancias.filter((i) => novo.get(i.id) !== i.dia).map((i) => ({ id: i.id, dia: novo.get(i.id) ?? null }));
}

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
    if (r.feitas === 1) return { tipo: 'completa', texto: t('Feita') };
    if (r.naoFeitas === 1) return { tipo: 'neutra', texto: t('Não feita') };
    if (r.noCalendario === 1) return { tipo: 'completa', texto: t('Alocada') };
    return { tipo: 'por_alocar', texto: t('Por alocar') };
  }
  if (r.feitas === r.total) return { tipo: 'completa', texto: t('{feitas}/{total} feitas', { feitas: r.feitas, total: r.total }) };
  if (r.naoFeitas > 0) return { tipo: 'neutra', texto: t('{feitas}/{total} feitas', { feitas: r.feitas, total: r.total }) };
  if (r.noCalendario === r.total) return { tipo: 'completa', texto: `${r.noCalendario}/${r.total}` };
  return { tipo: 'por_alocar', texto: `${r.noCalendario}/${r.total}` };
}

/** Linha por baixo do nome: "2 h · todos os dias", "30 min · vem da semana passada". */
export function detalheDaLinha(r: Pick<ResumoTarefa, 'duracaoMin' | 'veioDaSemanaPassada' | 'recorrencia' | 'dia'>, recorrencia: string | null): string {
  // Uma tarefa única sem duração com dia escolhido mostra-o ("qua").
  const dia = r.duracaoMin === null && !r.recorrencia && r.dia !== null && r.dia !== undefined ? t(DIAS_ABREVIADOS[r.dia]) : null;
  const partes = [formatarDuracao(r.duracaoMin), recorrencia, dia, r.veioDaSemanaPassada ? t('vem da semana passada') : null].filter(Boolean);
  return partes.length ? partes.join(' · ') : t('sem duração');
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
      .filter((tf) => tf.areaId === area.id && instanciasPorTarefa.has(tf.id))
      .map((tf) => resumirTarefa(tf, instanciasPorTarefa.get(tf.id) ?? [], blocosPorTarefa.get(tf.id) ?? []))
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
