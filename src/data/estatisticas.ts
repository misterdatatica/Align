import { and, asc, eq, inArray, lt } from 'drizzle-orm';

import { db } from '@/db/client';
import { areas, blocos, metas, metasRegistos, revisoes, semanas as tabelaSemanas, tarefas, tarefasSemana } from '@/db/schema';
import { fimDoPeriodo, mesDaSemana, rotuloDoMes, semanasDoPeriodo, type Periodo } from '@/domain/estatisticas';
import { progressoDaMeta } from '@/domain/metas';
import { deDataISO, descreverDataCurta, inicioDaSemana, minutosEntre } from '@/domain/semana';

/*
 * Estatísticas e histórico (WeekAlign Plus) de um mês ou de um ano: horas planeadas e feitas (com as mesmas
 * contas da revisão), por coluna (semanas do mês ou meses do ano) e por área, o que mais ficou por fazer,
 * as metas concluídas e a evolução das metas de número, e as reflexões das revisões.
 *
 * Só contam as semanas que já começaram: as seguintes podem já ter plano, mas ainda não são história.
 * Ficam de fora as áreas arquivadas, como na revisão.
 */

type AreaResumida = { id: number; nome: string; cor: string };

export type ColunaDasEstatisticas = {
  /** A semana (AAAA-MM-DD) no mês; o mês (0–11) no ano. */
  chave: string | number;
  rotulo: string;
  minutosPlaneados: number;
  minutosFeitos: number;
  /** Ainda não começou: fica vazia no gráfico. */
  futura: boolean;
};

export type Estatisticas = {
  periodo: Periodo;
  colunas: ColunaDasEstatisticas[];
  minutosPlaneados: number;
  minutosFeitos: number;
  /** Vezes feitas, com e sem duração. */
  vezesFeitas: number;
  semanasPlaneadas: number;
  revisoesFechadas: number;
  /** As áreas com horas planeadas ou feitas no período, pela ordem das áreas. */
  areas: (AreaResumida & { minutosPlaneados: number; minutosFeitos: number })[];
  /** As tarefas que mais ficaram por fazer (no máximo 5), da que mais para a que menos. */
  porFazer: { chave: number; nome: string; area: AreaResumida; vezes: number }[];
  metasConcluidas: { id: number; descricao: string; area: AreaResumida; concluidaEm: string }[];
  /** Metas de número que tiveram registos no período: onde estavam no início e no fim. */
  evolucaoDasMetas: { id: number; descricao: string; area: AreaResumida; unidade: string | null; de: number; para: number; alvo: number; progresso: number }[];
  /** As reflexões das revisões do período, da mais recente para a mais antiga. */
  reflexoes: { semana: string; correuBem: string; queroMudar: string }[];
};

const MAXIMO_POR_FAZER = 5;

/** `hoje` é AAAA-MM-DD. */
export function carregarEstatisticas(periodo: Periodo, hoje: string): Estatisticas {
  const semanaAtual = inicioDaSemana(deDataISO(hoje));
  const fim = fimDoPeriodo(periodo);
  const todasAsSemanas = semanasDoPeriodo(periodo);
  const semanas = todasAsSemanas.filter((s) => s <= semanaAtual);

  const colunas: ColunaDasEstatisticas[] =
    periodo.tipo === 'mes'
      ? todasAsSemanas.map((s) => ({ chave: s, rotulo: descreverDataCurta(s), minutosPlaneados: 0, minutosFeitos: 0, futura: s > semanaAtual }))
      : Array.from({ length: 12 }, (_, mes) => {
          const primeiroDia = `${periodo.inicio.slice(0, 4)}-${String(mes + 1).padStart(2, '0')}-01`;
          return { chave: mes, rotulo: rotuloDoMes(mes), minutosPlaneados: 0, minutosFeitos: 0, futura: primeiroDia > hoje };
        });
  const colunaDe = (semana: string) => colunas.find((c) => c.chave === (periodo.tipo === 'mes' ? semana : mesDaSemana(semana)));

  const resultado: Estatisticas = {
    periodo,
    colunas,
    minutosPlaneados: 0,
    minutosFeitos: 0,
    vezesFeitas: 0,
    semanasPlaneadas: 0,
    revisoesFechadas: 0,
    areas: [],
    porFazer: [],
    metasConcluidas: [],
    evolucaoDasMetas: [],
    reflexoes: [],
  };

  const listaAreas = db.select({ id: areas.id, nome: areas.nome, cor: areas.cor }).from(areas).where(eq(areas.arquivada, false)).orderBy(asc(areas.ordem), asc(areas.id)).all();
  const areaPorId = new Map(listaAreas.map((a) => [a.id, a]));

  if (semanas.length > 0) {
    const instancias = db
      .select({
        semana: tarefasSemana.semana,
        estado: tarefasSemana.estado,
        tarefaId: tarefas.id,
        serieId: tarefas.serieId,
        nome: tarefas.nome,
        duracaoMin: tarefas.duracaoMin,
        areaId: tarefas.areaId,
        inicio: blocos.inicio,
        fim: blocos.fim,
      })
      .from(tarefasSemana)
      .innerJoin(tarefas, eq(tarefasSemana.tarefaId, tarefas.id))
      .leftJoin(blocos, eq(blocos.tarefaSemanaId, tarefasSemana.id))
      .where(inArray(tarefasSemana.semana, semanas))
      .orderBy(asc(tarefasSemana.semana), asc(tarefasSemana.id))
      .all();

    const porArea = new Map<number, { minutosPlaneados: number; minutosFeitos: number }>();
    const porFazer = new Map<number, { chave: number; nome: string; area: AreaResumida; vezes: number }>();
    for (const i of instancias) {
      const area = areaPorId.get(i.areaId);
      if (!area) continue; // área arquivada
      const planeados = i.duracaoMin ?? 0;
      const feitos = i.estado === 'feita' && i.inicio && i.fim ? minutosEntre(i.inicio, i.fim) : 0;
      const coluna = colunaDe(i.semana);
      if (coluna) {
        coluna.minutosPlaneados += planeados;
        coluna.minutosFeitos += feitos;
      }
      resultado.minutosPlaneados += planeados;
      resultado.minutosFeitos += feitos;
      if (i.estado === 'feita') resultado.vezesFeitas += 1;
      const daArea = porArea.get(area.id) ?? { minutosPlaneados: 0, minutosFeitos: 0 };
      daArea.minutosPlaneados += planeados;
      daArea.minutosFeitos += feitos;
      porArea.set(area.id, daArea);

      // Por fazer: o que a revisão deu como não feito, ou ficou por fazer numa semana que já acabou.
      const ficou = i.estado === 'nao_feita' || (i.semana < semanaAtual && (i.estado === 'por_alocar' || i.estado === 'alocada'));
      if (ficou) {
        const chave = i.serieId ?? i.tarefaId;
        const atual = porFazer.get(chave) ?? { chave, nome: i.nome, area, vezes: 0 };
        // O nome mais recente da tarefa (as instâncias vêm por ordem de semana).
        porFazer.set(chave, { ...atual, nome: i.nome, area, vezes: atual.vezes + 1 });
      }
    }
    resultado.areas = listaAreas.filter((a) => porArea.has(a.id)).map((a) => ({ ...a, ...porArea.get(a.id)! })).filter((a) => a.minutosPlaneados > 0 || a.minutosFeitos > 0);
    resultado.porFazer = [...porFazer.values()].sort((a, b) => b.vezes - a.vezes || a.nome.localeCompare(b.nome)).slice(0, MAXIMO_POR_FAZER);

    resultado.semanasPlaneadas = db.select({ semana: tabelaSemanas.semana }).from(tabelaSemanas).where(inArray(tabelaSemanas.semana, semanas)).all().length;
    const listaRevisoes = db.select().from(revisoes).where(inArray(revisoes.semana, semanas)).all();
    resultado.revisoesFechadas = listaRevisoes.filter((r) => r.fechadaEm).length;
    resultado.reflexoes = listaRevisoes
      .filter((r) => r.correuBem.trim() || r.queroMudar.trim())
      .sort((a, b) => b.semana.localeCompare(a.semana))
      .map((r) => ({ semana: r.semana, correuBem: r.correuBem, queroMudar: r.queroMudar }));
  }

  // Metas: as concluídas no período, e a evolução das de número com registos no período.
  const listaMetas = db
    .select()
    .from(metas)
    .where(inArray(metas.areaId, listaAreas.length ? listaAreas.map((a) => a.id) : [-1]))
    .orderBy(asc(metas.id))
    .all();
  resultado.metasConcluidas = listaMetas
    .filter((m) => m.estado === 'concluida' && m.concluidaEm && m.concluidaEm >= periodo.inicio && m.concluidaEm < fim)
    .sort((a, b) => a.concluidaEm!.localeCompare(b.concluidaEm!))
    .map((m) => ({ id: m.id, descricao: m.descricao, area: areaPorId.get(m.areaId)!, concluidaEm: m.concluidaEm! }));

  const deNumero = listaMetas.filter((m) => m.medida === 'numero' && m.valorInicial !== null && m.valorAlvo !== null);
  if (deNumero.length > 0) {
    const registos = db
      .select()
      .from(metasRegistos)
      .where(and(inArray(metasRegistos.metaId, deNumero.map((m) => m.id)), lt(metasRegistos.data, fim)))
      .orderBy(asc(metasRegistos.data))
      .all();
    for (const m of deNumero) {
      const daMeta = registos.filter((r) => r.metaId === m.id);
      const noPeriodo = daMeta.filter((r) => r.data >= periodo.inicio);
      if (noPeriodo.length === 0) continue;
      const antes = daMeta.filter((r) => r.data < periodo.inicio);
      const de = antes.length ? antes[antes.length - 1].valor : m.valorInicial!;
      const para = noPeriodo[noPeriodo.length - 1].valor;
      resultado.evolucaoDasMetas.push({
        id: m.id,
        descricao: m.descricao,
        area: areaPorId.get(m.areaId)!,
        unidade: m.unidade,
        de,
        para,
        alvo: m.valorAlvo!,
        progresso: progressoDaMeta({ valorInicial: m.valorInicial!, valorAtual: para, valorAlvo: m.valorAlvo! }),
      });
    }
  }

  return resultado;
}

/** O período mais antigo com dados: para não deixar recuar para meses vazios sem fim. */
export function primeiraSemanaComDados(): string | null {
  return db.select({ semana: tabelaSemanas.semana }).from(tabelaSemanas).orderBy(asc(tabelaSemanas.semana)).limit(1).get()?.semana ?? null;
}

