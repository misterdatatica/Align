import { and, asc, eq, gt, gte, isNull, lt, ne, or, sql } from 'drizzle-orm';

import { carregarDefinicoes } from '@/data/definicoes';
import { carregarPlano, type Bd } from '@/data/tarefas';
import { db } from '@/db/client';
import { blocos, tarefas, tarefasSemana } from '@/db/schema';
import { disporDia, limitesDaGrelha } from '@/domain/calendario';
import type { Ambito } from '@/domain/proposta';
import type { Recorrencia } from '@/domain/recorrencia';
import { diasDaSemana, limitesDaSemana, MINUTOS_DIA, paraDataHora, partirDataHora } from '@/domain/semana';
import { nomeCurtoDe } from '@/domain/tarefas';
import { ErroDaApp } from '@/domain/erros';

/*
 * Blocos do calendário. Um bloco pertence a uma instância de tarefa (tarefas_semana) ou, sem ela,
 * é um bloco "Ocupado". Cada instância tem no máximo um bloco, e o estado da instância acompanha-o:
 * sem bloco = por alocar; com bloco = alocada; bloco feito = feita.
 *
 * Os blocos das tarefas recorrentes têm um horário habitual, que a semana seguinte copia. Mexer num
 * deles pede um âmbito: "só esta semana" guarda o habitual na instância (a semana é uma exceção);
 * "esta e as seguintes" muda o hábito e acerta as semanas seguintes que já existem.
 */

const AGORA = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const TITULO_OCUPADO = 'Ocupado';

export type BlocoCalendario = {
  id: number;
  tipo: 'tarefa' | 'ocupado';
  /** 0 = segunda … 6 = domingo. */
  dia: number;
  inicioMin: number;
  fimMin: number;
  feito: boolean;
  /** Nome da tarefa ou título do bloco "Ocupado". */
  nome: string;
  /** Texto que cabe dentro do bloco. */
  nomeCurto: string;
  /** Cor da área; null nos blocos "Ocupado". */
  cor: string | null;
  area: string | null;
  areaId: number | null;
  tarefaId: number | null;
  /** O bloco é de uma tarefa que repete: mudá-lo pergunta "só esta semana" ou "esta e as seguintes". */
  recorrente: boolean;
  /** Este bloco foi mudado só nesta semana: a semana seguinte volta ao horário habitual. */
  soEstaSemana: boolean;
  /** Blocos sobrepostos ficam lado a lado: coluna deste bloco e número de colunas do grupo. */
  coluna: number;
  colunas: number;
};

export type TarefaPorAlocar = {
  tarefaId: number;
  nome: string;
  nomeCurto: string;
  duracaoMin: number;
  cor: string;
  area: string;
  recorrencia: Recorrencia | null;
  /** Instâncias ainda fora do calendário. */
  quantas: number;
  /** Tarefa única que ficou por fazer e passou da semana anterior. */
  veioDaSemanaPassada: boolean;
};

export type CalendarioDaSemana = {
  semana: string;
  /** Os 7 dias, de segunda a domingo (AAAA-MM-DD). */
  dias: string[];
  /** Limites da grelha em minutos desde a meia-noite. */
  inicioMin: number;
  fimMin: number;
  blocos: BlocoCalendario[];
  porAlocar: TarefaPorAlocar[];
  minutosPorAlocar: number;
  /** Áreas com tarefas no calendário desta semana, para a legenda. */
  legenda: { id: number; nome: string; cor: string }[];
};

export function carregarCalendario(semana: string): CalendarioDaSemana {
  const plano = carregarPlano(semana);
  const dias = diasDaSemana(semana);
  const tarefaPorId = new Map<number, { nome: string; nomeCurto: string; cor: string; area: string; areaId: number; recorrente: boolean }>();
  const porAlocar: TarefaPorAlocar[] = [];
  const legenda: CalendarioDaSemana['legenda'] = [];

  for (const { area, tarefas: daArea } of plano.areas) {
    let comDuracao = false;
    for (const t of daArea) {
      if (t.duracaoMin === null) continue;
      comDuracao = true;
      const nomeCurto = nomeCurtoDe(t.nome, t.nomeCurto);
      tarefaPorId.set(t.id, { nome: t.nome, nomeCurto, cor: area.cor, area: area.nome, areaId: area.id, recorrente: t.recorrencia !== null });
      if (t.porAlocar > 0) {
        porAlocar.push({ tarefaId: t.id, nome: t.nome, nomeCurto, duracaoMin: t.duracaoMin, cor: area.cor, area: area.nome, recorrencia: t.recorrencia, quantas: t.porAlocar, veioDaSemanaPassada: t.veioDaSemanaPassada });
      }
    }
    if (comDuracao) legenda.push({ id: area.id, nome: area.nome, cor: area.cor });
  }

  const lista: Omit<BlocoCalendario, 'coluna' | 'colunas'>[] = [];
  const deTarefas = db
    .select({ id: blocos.id, inicio: blocos.inicio, fim: blocos.fim, tarefaId: tarefasSemana.tarefaId, estado: tarefasSemana.estado, habitualInicio: tarefasSemana.habitualInicio })
    .from(blocos)
    .innerJoin(tarefasSemana, eq(blocos.tarefaSemanaId, tarefasSemana.id))
    .where(eq(tarefasSemana.semana, semana))
    .orderBy(asc(blocos.inicio), asc(blocos.id))
    .all();
  for (const b of deTarefas) {
    const tarefa = tarefaPorId.get(b.tarefaId);
    const inicio = partirDataHora(b.inicio);
    const dia = dias.indexOf(inicio.dia);
    if (!tarefa || dia === -1) continue; // área arquivada, ou bloco fora da semana
    lista.push({
      id: b.id,
      tipo: 'tarefa',
      dia,
      inicioMin: inicio.minutos,
      fimMin: partirDataHora(b.fim).minutos,
      feito: b.estado === 'feita',
      nome: tarefa.nome,
      nomeCurto: tarefa.nomeCurto,
      cor: tarefa.cor,
      area: tarefa.area,
      areaId: tarefa.areaId,
      tarefaId: b.tarefaId,
      recorrente: tarefa.recorrente,
      soEstaSemana: tarefa.recorrente && b.habitualInicio !== null,
    });
  }

  const { desde, ate } = limitesDaSemana(semana);
  const ocupados = db
    .select({ id: blocos.id, inicio: blocos.inicio, fim: blocos.fim, titulo: blocos.titulo })
    .from(blocos)
    .where(and(isNull(blocos.tarefaSemanaId), gte(blocos.inicio, desde), lt(blocos.inicio, ate)))
    .orderBy(asc(blocos.inicio), asc(blocos.id))
    .all();
  for (const b of ocupados) {
    const inicio = partirDataHora(b.inicio);
    const titulo = b.titulo?.trim() || TITULO_OCUPADO;
    lista.push({
      id: b.id,
      tipo: 'ocupado',
      dia: dias.indexOf(inicio.dia),
      inicioMin: inicio.minutos,
      fimMin: partirDataHora(b.fim).minutos,
      feito: false,
      nome: titulo,
      nomeCurto: titulo,
      cor: null,
      area: null,
      areaId: null,
      tarefaId: null,
      recorrente: false,
      soEstaSemana: false,
    });
  }

  const comColunas: BlocoCalendario[] = [];
  for (let dia = 0; dia < 7; dia++) {
    const doDia = lista.filter((b) => b.dia === dia);
    const disposicao = disporDia(doDia);
    for (const b of doDia) comColunas.push({ ...b, ...(disposicao.get(b.id) ?? { coluna: 0, colunas: 1 }) });
  }

  const definicoes = carregarDefinicoes();
  return {
    semana,
    dias,
    ...limitesDaGrelha(definicoes.inicioGrelha, definicoes.fimGrelha, comColunas),
    blocos: comColunas,
    porAlocar,
    minutosPorAlocar: plano.minutosPorAlocar,
    legenda,
  };
}

function validarIntervalo(inicioMin: number, fimMin: number) {
  if (!Number.isInteger(inicioMin) || !Number.isInteger(fimMin) || inicioMin < 0 || fimMin > MINUTOS_DIA || fimMin <= inicioMin) {
    throw new ErroDaApp('As horas do bloco não são válidas.');
  }
}

/**
 * Põe no calendário uma instância ainda por alocar da tarefa, com a duração da tarefa.
 * `dia` é AAAA-MM-DD e tem de pertencer à semana. Devolve o id do bloco.
 */
export function alocarTarefa(tarefaId: number, semana: string, dia: string, inicioMin: number): number {
  return db.transaction((tx) => {
    const tarefa = tx.select({ duracaoMin: tarefas.duracaoMin }).from(tarefas).where(eq(tarefas.id, tarefaId)).get();
    if (!tarefa) throw new ErroDaApp('A tarefa já não existe.');
    if (tarefa.duracaoMin === null) throw new ErroDaApp('Esta tarefa não ocupa tempo no calendário.');
    if (!diasDaSemana(semana).includes(dia)) throw new ErroDaApp('O dia escolhido não pertence a esta semana.');
    const fimMin = Math.min(MINUTOS_DIA, inicioMin + tarefa.duracaoMin);
    validarIntervalo(inicioMin, fimMin);

    // Primeiro as instâncias sem horário habitual: as que foram retiradas "só esta semana" ficam para o fim.
    const livre = tx
      .select({ id: tarefasSemana.id, habitualInicio: tarefasSemana.habitualInicio, habitualFim: tarefasSemana.habitualFim })
      .from(tarefasSemana)
      .leftJoin(blocos, eq(blocos.tarefaSemanaId, tarefasSemana.id))
      .where(and(eq(tarefasSemana.tarefaId, tarefaId), eq(tarefasSemana.semana, semana), eq(tarefasSemana.estado, 'por_alocar'), isNull(blocos.id)))
      .orderBy(sql`${tarefasSemana.habitualInicio} is not null`, asc(tarefasSemana.id))
      .limit(1)
      .get();
    if (!livre) throw new ErroDaApp('Esta tarefa já está toda no calendário.');

    const inicio = paraDataHora(dia, inicioMin);
    const fim = paraDataHora(dia, fimMin);
    const { id } = tx.insert(blocos).values({ tarefaSemanaId: livre.id, inicio, fim }).returning({ id: blocos.id }).get();
    // Voltar a pôr o bloco no horário habitual desfaz a exceção.
    const voltou = livre.habitualInicio === inicio && livre.habitualFim === fim;
    tx.update(tarefasSemana)
      .set({ estado: 'alocada', ...(voltou ? { habitualInicio: null, habitualFim: null } : {}), atualizadoEm: AGORA })
      .where(eq(tarefasSemana.id, livre.id))
      .run();
    return id;
  });
}

/**
 * Para tarefas que repetem em dias certos: põe as instâncias que faltam à mesma hora, nos dias
 * (todos, ou os escolhidos na recorrência) em que a tarefa ainda não tem bloco. Devolve quantas alocou.
 */
export function alocarRestantes(tarefaId: number, semana: string, inicioMin: number): number {
  return db.transaction((tx) => {
    const tarefa = tx.select({ duracaoMin: tarefas.duracaoMin, recorrencia: tarefas.recorrencia }).from(tarefas).where(eq(tarefas.id, tarefaId)).get();
    if (!tarefa || tarefa.duracaoMin === null || !tarefa.recorrencia || tarefa.recorrencia.tipo === 'vezes_por_semana') return 0;
    const fimMin = Math.min(MINUTOS_DIA, inicioMin + tarefa.duracaoMin);
    validarIntervalo(inicioMin, fimMin);

    const instancias = tx
      .select({ id: tarefasSemana.id, estado: tarefasSemana.estado, inicio: blocos.inicio, habitualInicio: tarefasSemana.habitualInicio })
      .from(tarefasSemana)
      .leftJoin(blocos, eq(blocos.tarefaSemanaId, tarefasSemana.id))
      .where(and(eq(tarefasSemana.tarefaId, tarefaId), eq(tarefasSemana.semana, semana)))
      .orderBy(asc(tarefasSemana.id))
      .all();
    const dias = diasDaSemana(semana);
    const ocupados = new Set(instancias.flatMap((i) => (i.inicio ? [partirDataHora(i.inicio).dia] : [])));
    const candidatos = (tarefa.recorrencia.tipo === 'dias' ? tarefa.recorrencia.dias.map((d) => dias[d - 1]) : dias).filter((d) => d && !ocupados.has(d));
    const livres = instancias.filter((i) => i.inicio === null && i.estado === 'por_alocar' && i.habitualInicio === null);

    const quantas = Math.min(candidatos.length, livres.length);
    for (let n = 0; n < quantas; n++) {
      tx.insert(blocos)
        .values({ tarefaSemanaId: livres[n].id, inicio: paraDataHora(candidatos[n], inicioMin), fim: paraDataHora(candidatos[n], fimMin) })
        .run();
      tx.update(tarefasSemana).set({ estado: 'alocada', atualizadoEm: AGORA }).where(eq(tarefasSemana.id, livres[n].id)).run();
    }
    return quantas;
  });
}

/** O bloco com o que é preciso saber da sua instância e da tarefa para decidir o âmbito de uma mudança. */
function lerBloco(bd: Bd, id: number) {
  return bd
    .select({
      inicio: blocos.inicio,
      fim: blocos.fim,
      instanciaId: blocos.tarefaSemanaId,
      semana: tarefasSemana.semana,
      habitualInicio: tarefasSemana.habitualInicio,
      habitualFim: tarefasSemana.habitualFim,
      tarefaId: tarefas.id,
      serieId: tarefas.serieId,
      recorrencia: tarefas.recorrencia,
    })
    .from(blocos)
    .leftJoin(tarefasSemana, eq(blocos.tarefaSemanaId, tarefasSemana.id))
    .leftJoin(tarefas, eq(tarefasSemana.tarefaId, tarefas.id))
    .where(eq(blocos.id, id))
    .get();
}

type Horario = { inicio: string; fim: string };

/** O mesmo dia da semana e a mesma hora, noutra semana. */
function noutraSemana(dataHora: string, de: string, para: string): string {
  const { dia, minutos } = partirDataHora(dataHora);
  return paraDataHora(diasDaSemana(para)[diasDaSemana(de).indexOf(dia)] ?? dia, minutos);
}

/**
 * "Esta e as seguintes": leva a mudança de um bloco habitual às semanas seguintes que já existem.
 * Em cada uma procura o bloco da mesma tarefa que está no horário antigo e muda-o para o novo
 * (ou retira-o, se `para` for null). O que já foi feito não se mexe.
 */
function propagar(tx: Bd, serie: number, semana: string, de: Horario, para: Horario | null) {
  const seguintes = tx
    .select({
      instanciaId: tarefasSemana.id,
      semana: tarefasSemana.semana,
      habitualInicio: tarefasSemana.habitualInicio,
      blocoId: blocos.id,
      inicio: blocos.inicio,
    })
    .from(tarefasSemana)
    .innerJoin(tarefas, eq(tarefasSemana.tarefaId, tarefas.id))
    .leftJoin(blocos, eq(blocos.tarefaSemanaId, tarefasSemana.id))
    .where(and(gt(tarefasSemana.semana, semana), or(eq(tarefas.id, serie), eq(tarefas.serieId, serie)), ne(tarefasSemana.estado, 'feita')))
    .orderBy(asc(tarefasSemana.semana), asc(tarefasSemana.id))
    .all();

  const tratadas = new Set<string>();
  for (const i of seguintes) {
    if (tratadas.has(i.semana)) continue;
    const antigo = noutraSemana(de.inicio, semana, i.semana);
    const excecao = i.habitualInicio !== null;
    if ((excecao ? i.habitualInicio : i.inicio) !== antigo) continue;
    tratadas.add(i.semana);
    const novo = para ? { inicio: noutraSemana(para.inicio, semana, i.semana), fim: noutraSemana(para.fim, semana, i.semana) } : null;
    if (excecao) {
      // Nessa semana o bloco é uma exceção: fica onde está e só muda o horário a que voltará.
      tx.update(tarefasSemana)
        .set({ habitualInicio: novo?.inicio ?? null, habitualFim: novo?.fim ?? null, atualizadoEm: AGORA })
        .where(eq(tarefasSemana.id, i.instanciaId))
        .run();
    } else if (i.blocoId !== null && novo) {
      tx.update(blocos)
        .set({ ...novo, atualizadoEm: AGORA })
        .where(eq(blocos.id, i.blocoId))
        .run();
    } else if (i.blocoId !== null) {
      tx.delete(blocos).where(eq(blocos.id, i.blocoId)).run();
      tx.update(tarefasSemana).set({ estado: 'por_alocar', atualizadoEm: AGORA }).where(eq(tarefasSemana.id, i.instanciaId)).run();
    }
  }
}

/**
 * Muda o dia, a hora de início ou a duração de um bloco.
 * Num bloco de uma tarefa recorrente, `ambito` diz se a mudança vale só nesta semana ou passa a ser o hábito.
 */
export function moverBloco(id: number, dia: string, inicioMin: number, fimMin: number, ambito: Ambito = 'seguintes'): void {
  validarIntervalo(inicioMin, fimMin);
  db.transaction((tx) => {
    const bloco = lerBloco(tx, id);
    if (!bloco) throw new ErroDaApp('O bloco já não existe.');
    // Um bloco de tarefa não sai da semana da sua instância.
    if (bloco.semana && !diasDaSemana(bloco.semana).includes(dia)) throw new ErroDaApp('O dia escolhido não pertence a esta semana.');
    const novo = { inicio: paraDataHora(dia, inicioMin), fim: paraDataHora(dia, fimMin) };
    tx.update(blocos)
      .set({ ...novo, atualizadoEm: AGORA })
      .where(eq(blocos.id, id))
      .run();
    if (bloco.instanciaId === null || bloco.semana === null || bloco.tarefaId === null || !bloco.recorrencia) return;

    const habitual = { inicio: bloco.habitualInicio ?? bloco.inicio, fim: bloco.habitualFim ?? bloco.fim };
    if (ambito === 'semana') {
      // Voltar ao horário habitual desfaz a exceção.
      const voltou = habitual.inicio === novo.inicio && habitual.fim === novo.fim;
      tx.update(tarefasSemana)
        .set({ habitualInicio: voltou ? null : habitual.inicio, habitualFim: voltou ? null : habitual.fim, atualizadoEm: AGORA })
        .where(eq(tarefasSemana.id, bloco.instanciaId))
        .run();
      return;
    }
    tx.update(tarefasSemana).set({ habitualInicio: null, habitualFim: null, atualizadoEm: AGORA }).where(eq(tarefasSemana.id, bloco.instanciaId)).run();
    propagar(tx, bloco.serieId ?? bloco.tarefaId, bloco.semana, habitual, novo);
  });
}

/** Marca (ou desmarca) um bloco de tarefa como feito. As horas feitas da revisão vêm daqui. */
export function marcarBlocoFeito(id: number, feito: boolean): void {
  db.transaction((tx) => {
    const bloco = tx.select({ instanciaId: blocos.tarefaSemanaId }).from(blocos).where(eq(blocos.id, id)).get();
    if (!bloco) throw new ErroDaApp('O bloco já não existe.');
    if (bloco.instanciaId === null) throw new ErroDaApp('Os blocos “Ocupado” não se marcam como feitos.');
    tx.update(blocos).set({ feito, atualizadoEm: AGORA }).where(eq(blocos.id, id)).run();
    tx.update(tarefasSemana)
      .set({ estado: feito ? 'feita' : 'alocada', atualizadoEm: AGORA })
      .where(eq(tarefasSemana.id, bloco.instanciaId))
      .run();
  });
}

/**
 * Tira o bloco do calendário. Se for de uma tarefa, a instância volta a "por alocar".
 * Numa tarefa recorrente, `ambito` diz se sai só desta semana (a seguinte volta a tê-lo) ou desta e das seguintes.
 */
export function retirarBloco(id: number, ambito: Ambito = 'seguintes'): void {
  db.transaction((tx) => {
    const bloco = lerBloco(tx, id);
    if (!bloco) return;
    tx.delete(blocos).where(eq(blocos.id, id)).run();
    if (bloco.instanciaId === null) return;

    const recorrente = bloco.semana !== null && bloco.tarefaId !== null && !!bloco.recorrencia;
    const habitual = { inicio: bloco.habitualInicio ?? bloco.inicio, fim: bloco.habitualFim ?? bloco.fim };
    const soEstaSemana = recorrente && ambito === 'semana';
    tx.update(tarefasSemana)
      .set({ estado: 'por_alocar', habitualInicio: soEstaSemana ? habitual.inicio : null, habitualFim: soEstaSemana ? habitual.fim : null, atualizadoEm: AGORA })
      .where(eq(tarefasSemana.id, bloco.instanciaId))
      .run();
    if (recorrente && !soEstaSemana) propagar(tx, bloco.serieId ?? bloco.tarefaId!, bloco.semana!, habitual, null);
  });
}

/** Cria um bloco "Ocupado": um compromisso fixo, sem área. Devolve o id. */
export function criarOcupado(dia: string, inicioMin: number, fimMin: number, titulo = ''): number {
  validarIntervalo(inicioMin, fimMin);
  return db
    .insert(blocos)
    .values({ titulo: titulo.trim() || null, inicio: paraDataHora(dia, inicioMin), fim: paraDataHora(dia, fimMin) })
    .returning({ id: blocos.id })
    .get().id;
}

export function renomearOcupado(id: number, titulo: string): void {
  db.update(blocos)
    .set({ titulo: titulo.trim() || null, atualizadoEm: AGORA })
    .where(and(eq(blocos.id, id), isNull(blocos.tarefaSemanaId)))
    .run();
}
