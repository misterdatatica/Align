import { and, asc, count, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { areas, blocos, metas, revisoes, semanas, tarefas, tarefasSemana, type Area, type Tarefa } from '@/db/schema';
import { instanciasPorSemana, normalizarRecorrencia, type Recorrencia } from '@/domain/recorrencia';
import { diasDaSemana, inicioDaSemana, MINUTOS_DIA, minutosEntre, paraDataHora, partirDataHora } from '@/domain/semana';
import { acertarInstancias, diasDaTarefa, distribuirDias, DURACAO_MAXIMA_MIN, montarPlano, type PlanoSemana } from '@/domain/tarefas';
import { ErroDaApp } from '@/domain/erros';
import { t } from '@/i18n';

/*
 * Tarefas e as suas instâncias semanais.
 *
 * - `tarefas` é o modelo (nome, duração, recorrência); `tarefas_semana` tem uma linha por instância:
 *   "Meditar, todos os dias" são 7 linhas em cada semana.
 * - As escritas são transações síncronas (o SQLite da Expo é síncrono), por isso nunca ficam a meio.
 * - Alterar ou apagar vale "a partir desta semana": as semanas anteriores ficam como estavam.
 *   As versões de uma tarefa partilham a série (`serieId`), para a proposta da semana as reconhecer.
 */

/** `db` ou a transação em curso: as funções auxiliares funcionam com os dois. */
export type Bd = Pick<typeof db, 'select' | 'selectDistinct' | 'insert' | 'update' | 'delete'>;

const AGORA = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export type DadosTarefa = {
  areaId: number;
  metaId?: number | null;
  nome: string;
  /** Nome para os blocos do calendário; vazio = usa o início do nome. */
  nomeCurto?: string | null;
  /** Minutos; null = não ocupa tempo no calendário, conta só quando é marcada como feita. */
  duracaoMin: number | null;
  recorrencia: Recorrencia | null;
  /** Só nas tarefas únicas sem duração: dia da semana (0 = segunda … 6 = domingo); null = qualquer dia. */
  dia?: number | null;
};

function normalizar(dados: DadosTarefa) {
  const nome = dados.nome.trim();
  if (!nome) throw new ErroDaApp(t('A tarefa precisa de um nome.'));
  const { duracaoMin } = dados;
  if (duracaoMin !== null && (!Number.isInteger(duracaoMin) || duracaoMin <= 0 || duracaoMin > DURACAO_MAXIMA_MIN)) {
    throw new ErroDaApp(t('A duração tem de estar entre 30 minutos e 12 horas.'));
  }
  const recorrencia = normalizarRecorrencia(dados.recorrencia);
  const dia = duracaoMin === null && recorrencia === null && Number.isInteger(dados.dia) && dados.dia! >= 0 && dados.dia! <= 6 ? dados.dia! : null;
  return {
    areaId: dados.areaId,
    metaId: dados.metaId ?? null,
    nome,
    nomeCurto: dados.nomeCurto?.trim() || null,
    duracaoMin,
    recorrencia,
    dia,
  };
}

function validarAreaEMeta(bd: Bd, areaId: number, metaId: number | null) {
  const area = bd.select({ arquivada: areas.arquivada }).from(areas).where(eq(areas.id, areaId)).get();
  if (!area || area.arquivada) throw new ErroDaApp(t('A área desta tarefa já não existe.'));
  if (metaId !== null) {
    const meta = bd.select({ areaId: metas.areaId }).from(metas).where(eq(metas.id, metaId)).get();
    if (!meta || meta.areaId !== areaId) throw new ErroDaApp(t('A meta escolhida não pertence a esta área.'));
  }
}

function criarInstancias(bd: Bd, tarefaId: number, semana: string, quantas: number, transitadaDe: string | null = null) {
  if (quantas <= 0) return;
  bd.insert(tarefasSemana)
    .values(Array.from({ length: quantas }, () => ({ tarefaId, semana, transitadaDe })))
    .run();
}

/** Cria a tarefa e as suas instâncias na semana indicada. Devolve o id da tarefa. */
export function criarTarefa(dados: DadosTarefa, semana: string): number {
  const d = normalizar(dados);
  return db.transaction((tx) => {
    validarAreaEMeta(tx, d.areaId, d.metaId);
    const { id } = tx
      .insert(tarefas)
      .values({ ...d, semanaInicio: semana })
      .returning({ id: tarefas.id })
      .get();
    criarInstancias(tx, id, semana, instanciasPorSemana(d.recorrencia));
    atribuirDias(tx, semana);
    return id;
  });
}

/**
 * Nas tarefas sem duração que têm dias (todos os dias, dias certos, ou o dia escolhido de uma tarefa
 * única), liga cada instância da semana ao seu dia. Só mexe no que está fora do sítio, por isso pode
 * chamar-se sempre que as instâncias mudam.
 */
export function atribuirDias(tx: Bd, semana: string): void {
  const datas = diasDaSemana(semana);
  const linhas = tx
    .select({ id: tarefasSemana.id, dia: tarefasSemana.dia, tarefaId: tarefas.id, duracaoMin: tarefas.duracaoMin, recorrencia: tarefas.recorrencia, diaEscolhido: tarefas.dia })
    .from(tarefasSemana)
    .innerJoin(tarefas, eq(tarefasSemana.tarefaId, tarefas.id))
    .where(eq(tarefasSemana.semana, semana))
    .orderBy(asc(tarefasSemana.id))
    .all();
  const porTarefa = new Map<number, typeof linhas>();
  for (const l of linhas) porTarefa.set(l.tarefaId, [...(porTarefa.get(l.tarefaId) ?? []), l]);
  for (const instancias of porTarefa.values()) {
    const { duracaoMin, recorrencia, diaEscolhido } = instancias[0];
    const dias = diasDaTarefa({ duracaoMin, recorrencia, dia: diaEscolhido }).map((d) => datas[d]);
    for (const { id, dia } of distribuirDias(instancias, dias)) {
      tx.update(tarefasSemana).set({ dia, atualizadoEm: AGORA }).where(eq(tarefasSemana.id, id)).run();
    }
  }
}

/**
 * Mantém uma semana já planeada em dia: cria as instâncias "por alocar" das tarefas recorrentes que
 * lhe faltam (ex.: uma tarefa criada depois de a semana ter sido planeada). Pode chamar-se sempre que
 * se abre a semana: só cria o que falta. Não preenche semanas que já passaram.
 *
 * Uma semana ainda sem plano fica como está — é o utilizador que escolhe de onde parte (ver
 * src/data/semanas.ts) — exceto a primeira de todas, que não tem de onde copiar e começa já aceite.
 * Devolve quantas instâncias criou.
 */
export function garantirSemana(semana: string, hoje: Date = new Date()): number {
  if (semana < inicioDaSemana(hoje)) return 0;
  return db.transaction((tx) => {
    const planeada = tx.select({ semana: semanas.semana }).from(semanas).where(eq(semanas.semana, semana)).get();
    if (!planeada) {
      const outras = tx.select({ n: count() }).from(semanas).get()?.n ?? 0;
      if (outras > 0) return 0;
      tx.insert(semanas).values({ semana, estado: 'aceite', origem: 'vazia' }).run();
    }
    const criadas = criarInstanciasEmFalta(tx, semana);
    atribuirDias(tx, semana);
    return criadas;
  });
}

/** Tarefas recorrentes em vigor numa semana, de áreas por arquivar. */
export function recorrentesEmVigor(bd: Bd, semana: string) {
  return bd
    .select({ id: tarefas.id, serieId: tarefas.serieId, recorrencia: tarefas.recorrencia, duracaoMin: tarefas.duracaoMin })
    .from(tarefas)
    .innerJoin(areas, eq(tarefas.areaId, areas.id))
    .where(
      and(isNotNull(tarefas.recorrencia), eq(areas.arquivada, false), lte(tarefas.semanaInicio, semana), or(isNull(tarefas.semanaFim), gt(tarefas.semanaFim, semana))),
    )
    .orderBy(asc(tarefas.id))
    .all();
}

/** Cria as instâncias das tarefas recorrentes que ainda não têm nenhuma na semana. */
function criarInstanciasEmFalta(tx: Bd, semana: string): number {
  const comInstancias = new Set(
    tx
      .select({ tarefaId: tarefasSemana.tarefaId })
      .from(tarefasSemana)
      .where(eq(tarefasSemana.semana, semana))
      .all()
      .map((i) => i.tarefaId),
  );
  let criadas = 0;
  for (const t of recorrentesEmVigor(tx, semana)) {
    if (comInstancias.has(t.id)) continue;
    const quantas = instanciasPorSemana(t.recorrencia);
    criarInstancias(tx, t.id, semana, quantas);
    criadas += quantas;
  }
  return criadas;
}

/**
 * Altera a tarefa a partir da semana indicada. Se a tarefa já existia em semanas anteriores, essas ficam
 * com a versão antiga (a tarefa é fechada e nasce uma nova a partir desta semana). Devolve o id em vigor.
 */
export function editarTarefa(id: number, semana: string, dados: DadosTarefa): number {
  const d = normalizar(dados);
  return db.transaction((tx) => {
    const atual = tx.select().from(tarefas).where(eq(tarefas.id, id)).get();
    if (!atual) throw new ErroDaApp(t('A tarefa já não existe.'));
    validarAreaEMeta(tx, d.areaId, d.metaId);

    const anteriores = tx
      .select({ n: count() })
      .from(tarefasSemana)
      .where(and(eq(tarefasSemana.tarefaId, id), lt(tarefasSemana.semana, semana)))
      .get();
    let emVigor = id;
    if (anteriores && anteriores.n > 0) {
      tx.update(tarefas).set({ semanaFim: semana, atualizadoEm: AGORA }).where(eq(tarefas.id, id)).run();
      emVigor = tx
        .insert(tarefas)
        .values({ ...d, semanaInicio: semana, semanaFim: atual.semanaFim && atual.semanaFim > semana ? atual.semanaFim : null, serieId: atual.serieId ?? id })
        .returning({ id: tarefas.id })
        .get().id;
      tx.update(tarefasSemana)
        .set({ tarefaId: emVigor, atualizadoEm: AGORA })
        .where(and(eq(tarefasSemana.tarefaId, id), gte(tarefasSemana.semana, semana)))
        .run();
    } else {
      tx.update(tarefas).set({ ...d, atualizadoEm: AGORA }).where(eq(tarefas.id, id)).run();
    }

    // Acerta o número de instâncias desta semana e das seguintes já abertas.
    const linhas = tx
      .select({ id: tarefasSemana.id, semana: tarefasSemana.semana, estado: tarefasSemana.estado, blocoId: blocos.id })
      .from(tarefasSemana)
      .leftJoin(blocos, eq(blocos.tarefaSemanaId, tarefasSemana.id))
      .where(and(eq(tarefasSemana.tarefaId, emVigor), gte(tarefasSemana.semana, semana)))
      .orderBy(asc(tarefasSemana.id))
      .all();
    const porSemana = new Map<string, Map<number, { id: number; estado: (typeof linhas)[number]['estado']; temBloco: boolean }>>();
    for (const l of linhas) {
      const daSemana = porSemana.get(l.semana) ?? new Map();
      daSemana.set(l.id, { id: l.id, estado: l.estado, temBloco: l.blocoId !== null || daSemana.get(l.id)?.temBloco === true });
      porSemana.set(l.semana, daSemana);
    }
    const porSemanaAlvo = instanciasPorSemana(d.recorrencia);
    for (const [s, daSemana] of porSemana) {
      // Uma tarefa que deixou de repetir só fica na semana em que foi alterada.
      const alvo = d.recorrencia === null && s !== semana ? 0 : porSemanaAlvo;
      const { criar, remover } = acertarInstancias([...daSemana.values()], alvo);
      if (remover.length) tx.delete(tarefasSemana).where(inArray(tarefasSemana.id, remover)).run();
      criarInstancias(tx, emVigor, s, criar);
      atribuirDias(tx, s);
    }
    atribuirDias(tx, semana);

    if (atual.duracaoMin !== d.duracaoMin) {
      const noCalendario = tx
        .select({ id: blocos.id, inicio: blocos.inicio, fim: blocos.fim, feito: blocos.feito, instanciaId: tarefasSemana.id })
        .from(blocos)
        .innerJoin(tarefasSemana, eq(blocos.tarefaSemanaId, tarefasSemana.id))
        .where(and(eq(tarefasSemana.tarefaId, emVigor), gte(tarefasSemana.semana, semana)))
        .all();
      if (d.duracaoMin === null) {
        // Deixou de ocupar tempo: sai do calendário (o que já estava feito continua feito).
        if (noCalendario.length) {
          tx.delete(blocos)
            .where(
              inArray(
                blocos.id,
                noCalendario.map((b) => b.id),
              ),
            )
            .run();
          tx.update(tarefasSemana)
            .set({ estado: 'por_alocar', atualizadoEm: AGORA })
            .where(
              and(
                inArray(
                  tarefasSemana.id,
                  noCalendario.map((b) => b.instanciaId),
                ),
                eq(tarefasSemana.estado, 'alocada'),
              ),
            )
            .run();
        }
        // Sem tempo no calendário também deixa de haver horário habitual para copiar.
        tx.update(tarefasSemana)
          .set({ habitualInicio: null, habitualFim: null })
          .where(and(eq(tarefasSemana.tarefaId, emVigor), gte(tarefasSemana.semana, semana)))
          .run();
      } else if (atual.duracaoMin !== null) {
        // Os blocos que ainda tinham a duração antiga acompanham a nova; os que o utilizador ajustou ficam.
        for (const b of noCalendario) {
          if (b.feito || minutosEntre(b.inicio, b.fim) !== atual.duracaoMin) continue;
          const { dia, minutos } = partirDataHora(b.inicio);
          tx.update(blocos)
            .set({ fim: paraDataHora(dia, Math.min(MINUTOS_DIA, minutos + d.duracaoMin)), atualizadoEm: AGORA })
            .where(eq(blocos.id, b.id))
            .run();
        }
      }
    }
    return emVigor;
  });
}

/** Tira a tarefa desta semana e das seguintes. O que ficou em semanas anteriores mantém-se no histórico. */
export function apagarTarefa(id: number, semana: string): void {
  db.transaction((tx) => {
    const atual = tx.select({ semanaFim: tarefas.semanaFim }).from(tarefas).where(eq(tarefas.id, id)).get();
    if (!atual) return;
    // Os blocos destas instâncias saem com elas (ON DELETE CASCADE).
    tx.delete(tarefasSemana)
      .where(and(eq(tarefasSemana.tarefaId, id), gte(tarefasSemana.semana, semana)))
      .run();
    const restantes = tx.select({ n: count() }).from(tarefasSemana).where(eq(tarefasSemana.tarefaId, id)).get();
    if (!restantes || restantes.n === 0) {
      tx.delete(tarefas).where(eq(tarefas.id, id)).run();
    } else if (!atual.semanaFim || atual.semanaFim > semana) {
      tx.update(tarefas).set({ semanaFim: semana, atualizadoEm: AGORA }).where(eq(tarefas.id, id)).run();
    }
  });
}

/**
 * Tarefas sem duração (ex.: "Lição ACIM") contam-se marcando-as como feitas, uma vez de cada vez.
 * `feita = true` marca mais uma; `false` desfaz a última.
 */
export function marcarVez(tarefaId: number, semana: string, feita: boolean): void {
  db.transaction((tx) => {
    const tarefa = tx.select({ duracaoMin: tarefas.duracaoMin }).from(tarefas).where(eq(tarefas.id, tarefaId)).get();
    if (!tarefa) throw new ErroDaApp(t('A tarefa já não existe.'));
    if (tarefa.duracaoMin !== null) throw new ErroDaApp(t('As tarefas com duração marcam-se como feitas no calendário.'));
    const lista = tx
      .select({ id: tarefasSemana.id, estado: tarefasSemana.estado })
      .from(tarefasSemana)
      .where(and(eq(tarefasSemana.tarefaId, tarefaId), eq(tarefasSemana.semana, semana)))
      .orderBy(asc(tarefasSemana.id))
      .all();
    if (feita) {
      const proxima = lista.find((i) => i.estado !== 'feita');
      if (proxima) tx.update(tarefasSemana).set({ estado: 'feita', atualizadoEm: AGORA }).where(eq(tarefasSemana.id, proxima.id)).run();
      return;
    }
    const ultima = lista.findLast((i) => i.estado === 'feita');
    if (!ultima) return;
    const revisao = tx.select({ fechadaEm: revisoes.fechadaEm }).from(revisoes).where(eq(revisoes.semana, semana)).get();
    tx.update(tarefasSemana)
      .set({ estado: revisao?.fechadaEm ? 'nao_feita' : 'por_alocar', atualizadoEm: AGORA })
      .where(eq(tarefasSemana.id, ultima.id))
      .run();
  });
}

/**
 * Marca (ou desmarca) uma instância de uma tarefa sem duração: é assim que o ecrã Hoje marca a tarefa
 * do dia, sem mexer nas dos outros dias.
 */
export function marcarInstancia(instanciaId: number, feita: boolean): void {
  db.transaction((tx) => {
    const instancia = tx
      .select({ semana: tarefasSemana.semana, duracaoMin: tarefas.duracaoMin })
      .from(tarefasSemana)
      .innerJoin(tarefas, eq(tarefasSemana.tarefaId, tarefas.id))
      .where(eq(tarefasSemana.id, instanciaId))
      .get();
    if (!instancia) throw new ErroDaApp(t('A tarefa já não existe.'));
    if (instancia.duracaoMin !== null) throw new ErroDaApp(t('As tarefas com duração marcam-se como feitas no calendário.'));
    const revisao = tx.select({ fechadaEm: revisoes.fechadaEm }).from(revisoes).where(eq(revisoes.semana, instancia.semana)).get();
    tx.update(tarefasSemana)
      .set({ estado: feita ? 'feita' : revisao?.fechadaEm ? 'nao_feita' : 'por_alocar', atualizadoEm: AGORA })
      .where(eq(tarefasSemana.id, instanciaId))
      .run();
  });
}

export type PlanoDaSemana = PlanoSemana<Area>;

/** Tudo o que os ecrãs precisam sobre uma semana: áreas ativas, tarefas, estados e horas. */
export function carregarPlano(semana: string): PlanoDaSemana {
  const listaAreas = db.select().from(areas).where(eq(areas.arquivada, false)).orderBy(asc(areas.ordem), asc(areas.id)).all();
  const instancias = db
    .select({ id: tarefasSemana.id, tarefaId: tarefasSemana.tarefaId, estado: tarefasSemana.estado, transitadaDe: tarefasSemana.transitadaDe })
    .from(tarefasSemana)
    .where(eq(tarefasSemana.semana, semana))
    .orderBy(asc(tarefasSemana.id))
    .all();
  if (instancias.length === 0) return montarPlano(semana, listaAreas, [], [], []);

  const listaTarefas = db
    .select({
      id: tarefas.id,
      areaId: tarefas.areaId,
      metaId: tarefas.metaId,
      nome: tarefas.nome,
      nomeCurto: tarefas.nomeCurto,
      duracaoMin: tarefas.duracaoMin,
      recorrencia: tarefas.recorrencia,
      dia: tarefas.dia,
    })
    .from(tarefas)
    .where(inArray(tarefas.id, [...new Set(instancias.map((i) => i.tarefaId))]))
    .all();
  const listaBlocos = db
    .select({ tarefaSemanaId: blocos.tarefaSemanaId, inicio: blocos.inicio, fim: blocos.fim, feito: blocos.feito })
    .from(blocos)
    .innerJoin(tarefasSemana, eq(blocos.tarefaSemanaId, tarefasSemana.id))
    .where(eq(tarefasSemana.semana, semana))
    .all();
  return montarPlano(semana, listaAreas, listaTarefas, instancias, listaBlocos);
}

/** A tarefa tal como está guardada, para o formulário de edição. */
export function carregarTarefa(id: number): Tarefa | undefined {
  return db.select().from(tarefas).where(eq(tarefas.id, id)).get();
}
