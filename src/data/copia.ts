import { db } from '@/db/client';
import { areas, blocos, definicoes, metas, revisoes, tarefas, tarefasSemana } from '@/db/schema';

/*
 * Cópia de segurança: todos os dados num objeto que se guarda como ficheiro JSON, para não perder
 * nada ao trocar de telemóvel. Importar substitui tudo o que a app tem.
 */

const APP = 'align';
/** Versão do formato do ficheiro. Aumentar quando o modelo de dados mudar de forma incompatível. */
const VERSAO = 1;

const TABELAS = { areas, metas, tarefas, tarefasSemana, blocos, revisoes, definicoes } as const;
type NomeTabela = keyof typeof TABELAS;
/** Ordem em que se pode inserir sem falhar as ligações entre tabelas (pais antes dos filhos). */
const ORDEM: NomeTabela[] = ['areas', 'metas', 'tarefas', 'tarefasSemana', 'blocos', 'revisoes', 'definicoes'];

export type CopiaDeSeguranca = {
  app: typeof APP;
  versao: number;
  exportadoEm: string;
  dados: { [T in NomeTabela]: (typeof TABELAS)[T]['$inferSelect'][] };
};

export function exportarDados(agora: Date = new Date()): CopiaDeSeguranca {
  return {
    app: APP,
    versao: VERSAO,
    exportadoEm: agora.toISOString(),
    dados: {
      areas: db.select().from(areas).all(),
      metas: db.select().from(metas).all(),
      tarefas: db.select().from(tarefas).all(),
      tarefasSemana: db.select().from(tarefasSemana).all(),
      blocos: db.select().from(blocos).all(),
      revisoes: db.select().from(revisoes).all(),
      definicoes: db.select().from(definicoes).all(),
    },
  };
}

function eObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Confirma que o ficheiro é uma cópia desta app, numa versão que se sabe ler. */
export function lerCopia(texto: string): CopiaDeSeguranca {
  let copia: unknown;
  try {
    copia = JSON.parse(texto);
  } catch {
    throw new Error('O ficheiro não é uma cópia de segurança válida.');
  }
  if (!eObjeto(copia) || copia.app !== APP || !eObjeto(copia.dados)) throw new Error('O ficheiro não é uma cópia de segurança desta app.');
  if (typeof copia.versao !== 'number' || copia.versao > VERSAO) {
    throw new Error('Esta cópia foi feita por uma versão mais recente da app. Atualize a app e tente outra vez.');
  }
  for (const nome of ORDEM) {
    if (!Array.isArray(copia.dados[nome]) || !copia.dados[nome].every(eObjeto)) throw new Error('A cópia de segurança está incompleta.');
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
  return `${nAreas} ${nAreas === 1 ? 'área' : 'áreas'} e ${nTarefas} ${nTarefas === 1 ? 'tarefa' : 'tarefas'}`;
}
