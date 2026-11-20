import { and, asc, eq, gt, gte, isNull, or, sql } from 'drizzle-orm';

import { normalizarTexto } from '@/data/pesquisa';
import { planearSemana } from '@/data/semanas';
import { atribuirDias, type Bd } from '@/data/tarefas';
import { db } from '@/db/client';
import { areas, blocos, semanas, tarefas, tarefasSemana } from '@/db/schema';
import type { AreaDoModelo, Modelo, TarefaDoModelo } from '@/domain/modelos';
import { instanciasPorSemana, normalizarRecorrencia } from '@/domain/recorrencia';
import { diasDaSemana, inicioDaSemana, MINUTOS_DIA, paraDataHora, paraDataISO, somarSemanas } from '@/domain/semana';
import { diasDaTarefa } from '@/domain/tarefas';

/*
 * Aplicar um modelo (ver src/domain/modelos.ts): acrescenta as áreas e as tarefas que ainda não existem,
 * com os blocos nos seus horários. Uma área do modelo com o nome de uma área que já existe (sem ligar a
 * maiúsculas nem a acentos) é essa área; uma tarefa com o nome de uma que a área já tem não se repete.
 * Por isso aplicar o mesmo modelo duas vezes não duplica nada.
 */

const AGORA = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

type PlanoDaArea = {
  area: AreaDoModelo;
  /** A área que já existe com este nome; null = é criada. */
  existente: { id: number; missao: string } | null;
  /** As tarefas que a área ainda não tem. */
  tarefas: TarefaDoModelo[];
};

function planear(bd: Bd, modelo: Modelo, semana: string): PlanoDaArea[] {
  const existentes = bd.select({ id: areas.id, nome: areas.nome, missao: areas.missao }).from(areas).where(eq(areas.arquivada, false)).all();
  return modelo.areas.map((area) => {
    const existente = existentes.find((e) => normalizarTexto(e.nome) === normalizarTexto(area.nome)) ?? null;
    const jaTem = existente
      ? bd
          .select({ nome: tarefas.nome })
          .from(tarefas)
          .where(and(eq(tarefas.areaId, existente.id), or(isNull(tarefas.semanaFim), gt(tarefas.semanaFim, semana))))
          .all()
          .map((tarefa) => normalizarTexto(tarefa.nome))
      : [];
    return { area, existente, tarefas: area.tarefas.filter((tm) => !jaTem.includes(normalizarTexto(tm.nome))) };
  });
}

export type NovidadesDoModelo = { areas: number; tarefas: number };

function contar(plano: PlanoDaArea[]): NovidadesDoModelo {
  return { areas: plano.filter((p) => !p.existente).length, tarefas: plano.reduce((total, p) => total + p.tarefas.length, 0) };
}

/** O que o modelo acrescentaria agora: quantas áreas e quantas tarefas novas. */
export function novidadesDoModelo(modelo: Modelo, hoje: Date = new Date()): NovidadesDoModelo {
  return contar(planear(db, modelo, inicioDaSemana(hoje)));
}

/** Uma vez da tarefa numa semana: o dia (AAAA-MM-DD) e, nas que têm duração, o bloco. */
type Vez = { dia: string | null; bloco: { inicio: string; fim: string } | null };

/** As vezes da tarefa do modelo numa semana, com os dias e os blocos dos seus horários. */
function vezesNaSemana(tm: TarefaDoModelo, semana: string): Vez[] {
  const dias = diasDaSemana(semana);
  if (tm.duracaoMin !== null) {
    return tm.horarios.map((h) => ({
      dia: dias[h.dia],
      bloco: { inicio: paraDataHora(dias[h.dia], h.inicioMin), fim: paraDataHora(dias[h.dia], Math.min(MINUTOS_DIA, h.inicioMin + tm.duracaoMin!)) },
    }));
  }
  const comDia = diasDaTarefa({ duracaoMin: null, recorrencia: tm.recorrencia, dia: null });
  if (comDia.length) return comDia.map((d) => ({ dia: dias[d], bloco: null }));
  return Array.from({ length: instanciasPorSemana(tm.recorrencia) }, () => ({ dia: null, bloco: null }));
}

/** A vez ainda está para vir: o bloco ainda não começou, ou o dia ainda não acabou. */
function aindaVem(vez: Vez, hoje: string, agora: string): boolean {
  if (vez.bloco) return vez.bloco.inicio >= agora;
  return vez.dia === null || vez.dia >= hoje;
}

/**
 * Acrescenta o que falta do modelo, a começar na semana atual, e devolve o que acrescentou.
 *
 * Os blocos vão para os horários do modelo, nesta semana e nas seguintes que já existam. Quem começa a
 * meio da semana começa daí para a frente: nesta semana só entram as vezes que ainda estão para vir (não
 * se pergunta "Feito?" nem fica "por alocar" o que nunca esteve planeado). Como a semana seguinte se
 * copia desta, nesse caso é criada logo, com o modelo inteiro; uma tarefa cujas vezes já passaram todas
 * (ex.: à segunda de manhã) só começa nela.
 */
export function aplicarModelo(modelo: Modelo, hoje: Date = new Date()): NovidadesDoModelo {
  const atual = inicioDaSemana(hoje);
  const seguinte = somarSemanas(atual, 1);
  const hojeISO = paraDataISO(hoje);
  const agora = paraDataHora(hojeISO, hoje.getHours() * 60 + hoje.getMinutes());
  // A semana atual tem de existir: é nela que as tarefas começam (a primeira de todas começa vazia).
  planearSemana(atual, hoje);
  const algumaJaPassou = planear(db, modelo, atual).some((p) => p.tarefas.some((tm) => vezesNaSemana(tm, atual).some((v) => !aindaVem(v, hojeISO, agora))));
  if (algumaJaPassou) planearSemana(seguinte, hoje);

  return db.transaction((tx) => {
    const plano = planear(tx, modelo, atual);
    const comPlano = tx
      .select({ semana: semanas.semana })
      .from(semanas)
      .where(gte(semanas.semana, atual))
      .orderBy(asc(semanas.semana))
      .all()
      .map((s) => s.semana);
    let ordem = tx.select({ id: areas.id }).from(areas).where(eq(areas.arquivada, false)).all().length;

    for (const { area, existente, tarefas: novas } of plano) {
      let areaId: number;
      if (existente) {
        areaId = existente.id;
        // A missão do modelo só entra numa área que ainda não tem nenhuma.
        if (!existente.missao.trim()) tx.update(areas).set({ missao: area.missao, atualizadoEm: AGORA }).where(eq(areas.id, areaId)).run();
      } else {
        areaId = tx.insert(areas).values({ nome: area.nome, cor: area.cor, icone: area.icone, missao: area.missao, ordem: ordem++ }).returning({ id: areas.id }).get().id;
      }

      for (const tm of novas) {
        const recorrencia = normalizarRecorrencia(tm.recorrencia);
        const nestaSemana = vezesNaSemana(tm, atual).filter((v) => aindaVem(v, hojeISO, agora));
        const semanaInicio = nestaSemana.length ? atual : seguinte;
        const tarefaId = tx.insert(tarefas).values({ areaId, nome: tm.nome, duracaoMin: tm.duracaoMin, recorrencia, semanaInicio }).returning({ id: tarefas.id }).get().id;
        for (const semana of comPlano.filter((s) => s >= semanaInicio)) {
          for (const vez of semana === atual ? nestaSemana : vezesNaSemana(tm, semana)) {
            const instancia = tx
              .insert(tarefasSemana)
              .values({ tarefaId, semana, dia: vez.bloco ? null : vez.dia, estado: vez.bloco ? 'alocada' : 'por_alocar' })
              .returning({ id: tarefasSemana.id })
              .get().id;
            if (vez.bloco) tx.insert(blocos).values({ tarefaSemanaId: instancia, ...vez.bloco }).run();
          }
        }
      }
    }
    // Por segurança: as tarefas sem duração já levam o seu dia, e isto só mexe no que estiver fora do sítio.
    for (const semana of comPlano) atribuirDias(tx, semana);
    return contar(plano);
  });
}
