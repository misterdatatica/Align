/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { coresAreaClaras } from '../coresArea.ts';
import { db } from '../db/client.ts';
import { areas, semanas, tarefas, tarefasSemana } from '../db/schema.ts';
import { MODELOS, resumirModelo, descreverTarefaDoModelo, type Modelo } from '../domain/modelos.ts';
import { instanciasPorSemana } from '../domain/recorrencia.ts';
import { carregarCalendario } from './calendario.ts';
import { aplicarModelo, novidadesDoModelo } from './modelos.ts';
import { planearSemana } from './semanas.ts';
import { carregarPlano, criarTarefa, garantirSemana } from './tarefas.ts';

const S16 = '2026-11-16';
const S23 = '2026-11-23';
/** Quarta-feira, 10:00: segunda e terça já passaram. */
const QUARTA = new Date(2026, 10, 18, 10, 0);

const modelo = (id: string): Modelo => {
  const m = MODELOS().find((x) => x.id === id);
  assert.ok(m, `o modelo ${id} existe`);
  return m;
};

/** Os blocos de uma tarefa na semana, como "dia hora" (dia 0 = segunda). */
function blocosDe(semana: string, nome: string): string[] {
  return carregarCalendario(semana)
    .blocos.filter((b) => b.nome === nome)
    .map((b) => `${b.dia} ${b.inicioMin / 60}`)
    .sort();
}

beforeEach(() => prepararBd());

describe('os modelos', () => {
  for (const m of MODELOS()) {
    it(`"${m.nome}" está bem feito: cores, dias, horários e nada sobreposto`, () => {
      const cores = m.areas.map((a) => a.cor);
      assert.ok(cores.every((c) => coresAreaClaras.some((x) => x.id === c)), 'cores que existem');
      assert.equal(new Set(cores).size, cores.length, 'cada área com a sua cor');
      assert.equal(new Set(m.areas.map((a) => a.nome)).size, m.areas.length, 'nomes de áreas diferentes');
      assert.ok(m.areas.every((a) => a.missao && a.tarefas.length > 0), 'todas as áreas têm missão e tarefas');

      const ocupado: { dia: number; inicio: number; fim: number; nome: string }[] = [];
      for (const tm of m.areas.flatMap((a) => a.tarefas)) {
        if (tm.duracaoMin === null) {
          assert.deepEqual(tm.horarios, [], `${tm.nome}: sem duração, sem horários`);
          continue;
        }
        assert.equal(tm.horarios.length, instanciasPorSemana(tm.recorrencia), `${tm.nome}: um horário por vez na semana`);
        const dias = tm.horarios.map((x) => x.dia);
        assert.equal(new Set(dias).size, dias.length, `${tm.nome}: um por dia`);
        if (tm.recorrencia.tipo === 'dias') assert.deepEqual([...dias].sort(), tm.recorrencia.dias.map((d) => d - 1).sort(), `${tm.nome}: nos dias da recorrência`);
        for (const x of tm.horarios) {
          assert.ok(x.dia >= 0 && x.dia <= 6 && x.inicioMin >= 0 && x.inicioMin + tm.duracaoMin <= 24 * 60, `${tm.nome}: dentro do dia`);
          const choque = ocupado.find((o) => o.dia === x.dia && o.inicio < x.inicioMin + tm.duracaoMin! && x.inicioMin < o.fim);
          assert.equal(choque, undefined, `${tm.nome} sobrepõe-se a ${choque?.nome}`);
          ocupado.push({ dia: x.dia, inicio: x.inicioMin, fim: x.inicioMin + tm.duracaoMin, nome: tm.nome });
        }
      }
    });
  }

  it('resume-se e descreve-se', () => {
    assert.deepEqual(resumirModelo(modelo('estudante')), { areas: 4, tarefas: 8, minutosPorSemana: 5 * 90 + 60 + 30 + 3 * 45 + 120 + 30 + 7 * 30 });
    const [exercicio] = modelo('familia').areas.find((a) => a.nome === 'Saúde')!.tarefas;
    assert.equal(descreverTarefaDoModelo(exercicio), 'ter, qui, sáb · 07:00, 08:30 · 30 min');
    assert.equal(descreverTarefaDoModelo(modelo('estudante').areas[1].tarefas[1]), 'todos os dias · sem duração');
  });
});

describe('aplicar um modelo', () => {
  it('a meio da semana começa daqui para a frente, e a semana seguinte fica logo com tudo', () => {
    const estudante = modelo('estudante');
    assert.deepEqual(novidadesDoModelo(estudante, QUARTA), { areas: 4, tarefas: 8 });
    assert.deepEqual(aplicarModelo(estudante, QUARTA), { areas: 4, tarefas: 8 });

    const criadas = db.select().from(areas).all();
    assert.deepEqual(
      criadas.map((a) => [a.nome, a.cor, a.ordem]),
      [
        ['Estudos', 'azul', 0],
        ['Saúde', 'rosa', 1],
        ['Amigos e família', 'laranja', 2],
        ['Lazer', 'verde', 3],
      ],
    );
    assert.equal(criadas[0].missao, 'Aprender a sério, ao meu ritmo.');

    assert.deepEqual(blocosDe(S16, 'Estudar'), ['2 17', '3 17', '4 17'], 'segunda e terça já passaram');
    assert.deepEqual(blocosDe(S16, 'Exercício'), ['2 19', '4 19']);
    assert.equal(carregarPlano(S16).porAlocar, 0, 'nada fica "por alocar" do que já passou');
    const estudar = db.select({ id: tarefas.id }).from(tarefas).where(eq(tarefas.nome, 'Estudar')).get()!.id;
    assert.equal(db.select().from(tarefasSemana).where(eq(tarefasSemana.tarefaId, estudar)).all().filter((i) => i.semana === S16).length, 3);

    assert.deepEqual(blocosDe(S23, 'Estudar'), ['0 17', '1 17', '2 17', '3 17', '4 17'], 'a semana seguinte foi criada já com o modelo inteiro');
    assert.equal(blocosDe(S23, 'Ler por prazer').length, 7);
    planearSemana('2026-11-30', QUARTA);
    assert.deepEqual(blocosDe('2026-11-30', 'Estudar'), ['0 17', '1 17', '2 17', '3 17', '4 17'], 'e as outras copiam-na');

    const deitar = db.select({ id: tarefas.id }).from(tarefas).where(eq(tarefas.nome, 'Deitar antes da meia-noite')).get()!.id;
    const diasDe = (semana: string) =>
      db
        .select({ dia: tarefasSemana.dia, semana: tarefasSemana.semana })
        .from(tarefasSemana)
        .where(eq(tarefasSemana.tarefaId, deitar))
        .all()
        .filter((i) => i.semana === semana)
        .map((i) => i.dia)
        .sort();
    assert.deepEqual(diasDe(S16), ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'], 'as tarefas sem duração, de hoje em diante, com o seu dia para o Hoje');
    assert.equal(diasDe(S23).length, 7);
  });

  it('uma tarefa cujas vezes já passaram todas começa na semana seguinte', () => {
    aplicarModelo(modelo('familia'), QUARTA);
    const planear = db.select().from(tarefas).where(eq(tarefas.nome, 'Planear a semana de trabalho')).get();
    assert.equal(planear?.semanaInicio, S23);
    garantirSemana(S16, QUARTA);
    assert.equal(carregarPlano(S16).porAlocar, 0, 'abrir a semana não a faz aparecer "por alocar"');
    assert.deepEqual(blocosDe(S23, 'Planear a semana de trabalho'), ['0 8.5']);
  });

  it('à segunda antes de tudo, a semana atual leva o modelo inteiro e a seguinte não é criada', () => {
    aplicarModelo(modelo('estudante'), new Date(2026, 10, 16, 6, 0));
    assert.deepEqual(blocosDe(S16, 'Estudar'), ['0 17', '1 17', '2 17', '3 17', '4 17']);
    assert.deepEqual(db.select({ semana: semanas.semana }).from(semanas).all().map((s) => s.semana), [S16]);
  });

  it('aplicar outra vez não repete nada', () => {
    const estudante = modelo('estudante');
    aplicarModelo(estudante, QUARTA);
    const antes = [db.select().from(areas).all().length, db.select().from(tarefas).all().length, db.select().from(tarefasSemana).all().length];
    assert.deepEqual(novidadesDoModelo(estudante, QUARTA), { areas: 0, tarefas: 0 });
    assert.deepEqual(aplicarModelo(estudante, QUARTA), { areas: 0, tarefas: 0 });
    assert.deepEqual([db.select().from(areas).all().length, db.select().from(tarefas).all().length, db.select().from(tarefasSemana).all().length], antes);
  });

  it('usa as áreas e as tarefas que já existem com o mesmo nome (sem ligar a maiúsculas nem acentos)', () => {
    garantirSemana(S16, QUARTA);
    const saude = db.insert(areas).values({ nome: 'saude', cor: 'verde', icone: 'bola' }).returning({ id: areas.id }).get().id;
    const lazer = db.insert(areas).values({ nome: 'Lazer', cor: 'violeta', icone: 'folha', missao: 'A minha missão.', ordem: 1 }).returning({ id: areas.id }).get().id;
    criarTarefa({ areaId: saude, nome: 'exercicio', duracaoMin: 60, recorrencia: { tipo: 'vezes_por_semana', vezes: 2 } }, S16);

    assert.deepEqual(aplicarModelo(modelo('estudante'), QUARTA), { areas: 2, tarefas: 7 });
    const lista = db.select().from(areas).all();
    assert.equal(lista.length, 4);
    assert.equal(lista.find((a) => a.id === saude)?.missao, 'Ter energia para as aulas e para o resto.', 'a missão entra onde não havia');
    assert.equal(lista.find((a) => a.id === lazer)?.missao, 'A minha missão.', 'e não substitui a que já havia');
    assert.deepEqual(
      db.select({ nome: tarefas.nome }).from(tarefas).where(eq(tarefas.areaId, saude)).all().map((x) => x.nome),
      ['exercicio', 'Deitar antes da meia-noite'],
    );
  });

  it('as semanas seguintes que já existem também ficam com as tarefas e os blocos', () => {
    garantirSemana(S16, QUARTA);
    planearSemana(S23, QUARTA);
    aplicarModelo(modelo('independente'), QUARTA);
    assert.deepEqual(blocosDe(S23, 'Trabalho para clientes'), ['0 9', '1 9', '2 9', '3 9', '4 9']);
    assert.deepEqual(blocosDe(S16, 'Trabalho para clientes'), ['3 9', '4 9'], 'às 10:00 de quarta, o bloco das 9:00 já começou');
  });
});
