import { isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { areas, blocos, definicoes, metas, metasRegistos, revisoes, semanas, tarefas, tarefasSemana } from '@/db/schema';
import { formatarValor } from '@/domain/metas';
import { deDataISO, inicioDaSemana, paraDataISO, somarMeses } from '@/domain/semana';
import { ErroDaApp } from '@/domain/erros';
import { t } from '@/i18n';

/*
 * Cópia de segurança: todos os dados num objeto que se guarda como ficheiro JSON, para não perder
 * nada ao trocar de telemóvel. Importar substitui tudo o que a app tem.
 */

const APP = 'align';
/**
 * Versão do formato do ficheiro. Aumentar quando o modelo de dados mudar de forma incompatível.
 * 2: as metas passaram a ser resultados com prazo (com histórico) e as semanas passaram a ter plano.
 */
const VERSAO = 2;

const TABELAS = { areas, metas, metasRegistos, tarefas, tarefasSemana, blocos, revisoes, semanas, definicoes } as const;
type NomeTabela = keyof typeof TABELAS;
/** Ordem em que se pode inserir sem falhar as ligações entre tabelas (pais antes dos filhos). */
const ORDEM: NomeTabela[] = ['areas', 'metas', 'metasRegistos', 'tarefas', 'tarefasSemana', 'blocos', 'revisoes', 'semanas', 'definicoes'];

export type CopiaDeSeguranca = {
  app: typeof APP;
  versao: number;
  exportadoEm: string;
  dados: { [T in NomeTabela]: (typeof TABELAS)[T]['$inferSelect'][] };
};

/**
 * Todos os dados. `paraFicheiro`: para a cópia de segurança, sem os eventos do telemóvel (voltam a vir
 * do telemóvel); as fotografias para "Desfazer" levam tudo.
 */
export function exportarDados(agora: Date = new Date(), { paraFicheiro = false }: { paraFicheiro?: boolean } = {}): CopiaDeSeguranca {
  return {
    app: APP,
    versao: VERSAO,
    exportadoEm: agora.toISOString(),
    dados: {
      areas: db.select().from(areas).all(),
      metas: db.select().from(metas).all(),
      metasRegistos: db.select().from(metasRegistos).all(),
      tarefas: db.select().from(tarefas).all(),
      tarefasSemana: db.select().from(tarefasSemana).all(),
      blocos: db
        .select()
        .from(blocos)
        .where(paraFicheiro ? isNull(blocos.eventoId) : undefined)
        .all(),
      revisoes: db.select().from(revisoes).all(),
      semanas: db.select().from(semanas).all(),
      definicoes: db.select().from(definicoes).all(),
    },
  };
}

function eObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Traz uma cópia da versão 1 para o modelo de dados de agora, com as mesmas regras da migração
 * drizzle/0003: as metas antigas (alvos semanais) ficam pausadas, com o alvo na descrição e um prazo
 * provisório, para o utilizador as reescrever como resultados; as semanas com dados ficam aceites.
 */
function atualizarDaVersao1(dados: Record<string, unknown>, hoje: Date): void {
  const texto = (valor: unknown) => (typeof valor === 'string' ? valor : '');
  const prazo = somarMeses(paraDataISO(hoje), 3);
  const antigas = Array.isArray(dados.metas) ? (dados.metas as Record<string, unknown>[]) : [];
  dados.metas = antigas.map((m) => {
    const semanal = typeof m.alvoSemanal === 'number' ? m.alvoSemanal : 0;
    const valor = formatarValor(m.periodo === 'dia' ? semanal / 7 : semanal);
    const periodo = m.periodo === 'dia' ? 'dia' : 'semana';
    const alvo = m.tipo === 'horas' ? `${valor} h por ${periodo}` : `${valor}× por ${periodo}${texto(m.unidade) ? ` (${texto(m.unidade)})` : ''}`;
    return {
      id: m.id,
      areaId: m.areaId,
      descricao: `${texto(m.descricao)} — ${alvo}`,
      prazo,
      medida: 'marco',
      valorInicial: null,
      valorAtual: null,
      valorAlvo: null,
      unidade: null,
      estado: 'pausada',
      criadoEm: m.criadoEm,
      atualizadoEm: m.atualizadoEm,
    };
  });
  dados.metasRegistos = [];

  const instancias = Array.isArray(dados.tarefasSemana) ? (dados.tarefasSemana as Record<string, unknown>[]) : [];
  const listaBlocos = Array.isArray(dados.blocos) ? (dados.blocos as Record<string, unknown>[]) : [];
  const semanaDaInstancia = new Map(instancias.map((i) => [i.id, texto(i.semana)]));
  const atual = inicioDaSemana(hoje);
  const comBlocos = new Set<string>();
  for (const b of listaBlocos) {
    const semana = b.tarefaSemanaId == null ? inicioDaSemana(deDataISO(texto(b.inicio).slice(0, 10))) : semanaDaInstancia.get(b.tarefaSemanaId);
    if (semana) comBlocos.add(semana);
  }
  const planeadas = new Set([...instancias.map((i) => texto(i.semana)).filter((s) => s && s <= atual), ...comBlocos]);
  dados.semanas = [...planeadas].sort().map((semana) => ({ semana, estado: 'aceite' }));
}

/** Confirma que o ficheiro é uma cópia desta app, numa versão que se sabe ler. `hoje` só conta para cópias antigas. */
export function lerCopia(texto: string, hoje: Date = new Date()): CopiaDeSeguranca {
  let copia: unknown;
  try {
    copia = JSON.parse(texto);
  } catch {
    throw new ErroDaApp(t('O ficheiro não é uma cópia de segurança válida.'));
  }
  if (!eObjeto(copia) || copia.app !== APP || !eObjeto(copia.dados)) throw new ErroDaApp(t('O ficheiro não é uma cópia de segurança desta app.'));
  if (typeof copia.versao !== 'number' || copia.versao > VERSAO) {
    throw new ErroDaApp(t('Esta cópia foi feita por uma versão mais recente da app. Atualize a app e tente outra vez.'));
  }
  if (copia.versao < 2) atualizarDaVersao1(copia.dados, hoje);
  for (const nome of ORDEM) {
    if (!Array.isArray(copia.dados[nome]) || !copia.dados[nome].every(eObjeto)) throw new ErroDaApp(t('A cópia de segurança está incompleta.'));
  }
  return copia as CopiaDeSeguranca;
}

/**
 * Substitui todos os dados pelos da cópia. Corre numa só transação: se alguma coisa falhar
 * (ex.: ficheiro alterado à mão), fica tudo como estava.
 */
export function importarDados(copia: CopiaDeSeguranca): void {
  db.transaction((tx) => {
    for (const nome of [...ORDEM].reverse()) tx.delete(TABELAS[nome]).run();
    for (const nome of ORDEM) {
      const linhas = copia.dados[nome];
      // Em grupos, para não passar o limite de valores por instrução do SQLite.
      for (let i = 0; i < linhas.length; i += 50) {
        tx.insert(TABELAS[nome])
          .values(linhas.slice(i, i + 50) as never)
          .run();
      }
    }
  });
}

/** Resumo para mostrar antes de importar: "3 áreas, 12 tarefas". */
export function resumirCopia(copia: CopiaDeSeguranca): string {
  const nAreas = copia.dados.areas.length;
  const nTarefas = copia.dados.tarefas.length;
  const areas = nAreas === 1 ? t('1 área') : t('{n} áreas', { n: nAreas });
  const tarefas = nTarefas === 1 ? t('1 tarefa') : t('{n} tarefas', { n: nTarefas });
  return t('{areas} e {tarefas}', { areas, tarefas });
}
