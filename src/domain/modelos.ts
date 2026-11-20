import type { NomeIcone } from '../components/Icone.tsx';
import { t } from '../i18n/index.ts';
import { descreverRecorrencia, instanciasPorSemana, type Recorrencia } from './recorrencia.ts';
import { formatarHora } from './semana.ts';
import { formatarDuracao } from './tarefas.ts';

/*
 * Modelos (WeekAlign Plus): conjuntos de áreas com missão e tarefas já com horário, para quem prefere não
 * começar do zero. Aplicar um modelo acrescenta o que ainda não existe (ver src/data/modelos.ts); depois
 * muda-se tudo como o resto. Os textos estão em português e passam por t(), como os do resto da app.
 */

/** Um lugar na semana: dia (0 = segunda … 6 = domingo) e hora de início, em minutos. */
export type HorarioDoModelo = { dia: number; inicioMin: number };

export type TarefaDoModelo = {
  nome: string;
  /** null = sem duração: conta-se marcando-a como feita, no Hoje dos seus dias. */
  duracaoMin: number | null;
  recorrencia: Recorrencia;
  /** Nas tarefas com duração, um por vez na semana: onde ficam os blocos. */
  horarios: HorarioDoModelo[];
};

export type AreaDoModelo = { nome: string; cor: string; icone: NomeIcone; missao: string; tarefas: TarefaDoModelo[] };

export type Modelo = { id: string; nome: string; descricao: string; areas: AreaDoModelo[] };

const h = (horas: number, minutos = 0) => horas * 60 + minutos;
const SEG_A_SEX = [0, 1, 2, 3, 4];
const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];
/** O mesmo horário em vários dias (0 = segunda … 6 = domingo). */
const nosDias = (dias: number[], inicioMin: number): HorarioDoModelo[] => dias.map((dia) => ({ dia, inicioMin }));
/** Repete nestes dias (0 = segunda): a recorrência conta 1 = segunda … 7 = domingo. */
const emDias = (dias: number[]): Recorrencia => (dias.length === 7 ? { tipo: 'diaria' } : { tipo: 'dias', dias: dias.map((d) => d + 1) });

/** Os modelos, já no idioma da app. Uma função, para os textos serem traduzidos quando se mostram. */
export function MODELOS(): Modelo[] {
  return [
    {
      id: 'equilibrio',
      nome: t('Vida equilibrada'),
      descricao: t('Um pouco de cada área, para começar com o pé direito.'),
      areas: [
        {
          nome: t('Espiritual'),
          cor: 'violeta',
          icone: 'folha',
          missao: t('Começar cada dia com calma e com propósito.'),
          tarefas: [{ nome: t('Meditar'), duracaoMin: 15, recorrencia: emDias(TODOS_OS_DIAS), horarios: nosDias(TODOS_OS_DIAS, h(7)) }],
        },
        {
          nome: t('Saúde'),
          cor: 'rosa',
          icone: 'coracao',
          missao: t('Cuidar do corpo, para ter energia para o resto.'),
          tarefas: [
            { nome: t('Exercício'), duracaoMin: 45, recorrencia: emDias([0, 2, 4]), horarios: nosDias([0, 2, 4], h(18, 30)) },
            { nome: t('Beber 2 litros de água'), duracaoMin: null, recorrencia: emDias(TODOS_OS_DIAS), horarios: [] },
          ],
        },
        {
          nome: t('Trabalho'),
          cor: 'azul',
          icone: 'pasta',
          missao: t('Fazer o que importa, e não só o que é urgente.'),
          tarefas: [{ nome: t('Trabalho focado'), duracaoMin: 90, recorrencia: emDias(SEG_A_SEX), horarios: nosDias(SEG_A_SEX, h(9, 30)) }],
        },
        {
          nome: t('Família'),
          cor: 'laranja',
          icone: 'casa',
          missao: t('Estar presente para quem mais gosto.'),
          tarefas: [
            { nome: t('Jantar sem telemóveis'), duracaoMin: null, recorrencia: emDias(TODOS_OS_DIAS), horarios: [] },
            { nome: t('Ligar a alguém de quem gosto'), duracaoMin: 30, recorrencia: emDias([6]), horarios: nosDias([6], h(17)) },
          ],
        },
        {
          nome: t('Finanças'),
          cor: 'petroleo',
          icone: 'livro',
          missao: t('Saber para onde vai o meu dinheiro.'),
          tarefas: [{ nome: t('Rever as contas da semana'), duracaoMin: 30, recorrencia: emDias([6]), horarios: nosDias([6], h(18)) }],
        },
      ],
    },
    {
      id: 'estudante',
      nome: t('Estudante'),
      descricao: t('Estudar com método, sem deixar tudo para a véspera, e com tempo para descansar.'),
      areas: [
        {
          nome: t('Estudos'),
          cor: 'azul',
          icone: 'livro',
          missao: t('Aprender a sério, ao meu ritmo.'),
          tarefas: [
            { nome: t('Estudar'), duracaoMin: 90, recorrencia: emDias(SEG_A_SEX), horarios: nosDias(SEG_A_SEX, h(17)) },
            { nome: t('Rever a matéria da semana'), duracaoMin: 60, recorrencia: emDias([5]), horarios: nosDias([5], h(10)) },
            { nome: t('Preparar a semana de aulas'), duracaoMin: 30, recorrencia: emDias([6]), horarios: nosDias([6], h(19)) },
          ],
        },
        {
          nome: t('Saúde'),
          cor: 'rosa',
          icone: 'coracao',
          missao: t('Ter energia para as aulas e para o resto.'),
          tarefas: [
            { nome: t('Exercício'), duracaoMin: 45, recorrencia: emDias([0, 2, 4]), horarios: nosDias([0, 2, 4], h(19)) },
            { nome: t('Deitar antes da meia-noite'), duracaoMin: null, recorrencia: emDias(TODOS_OS_DIAS), horarios: [] },
          ],
        },
        {
          nome: t('Amigos e família'),
          cor: 'laranja',
          icone: 'casa',
          missao: t('Estar presente para quem gosto.'),
          tarefas: [
            { nome: t('Tempo com amigos'), duracaoMin: 120, recorrencia: emDias([5]), horarios: nosDias([5], h(15)) },
            { nome: t('Ligar à família'), duracaoMin: 30, recorrencia: emDias([6]), horarios: nosDias([6], h(18)) },
          ],
        },
        {
          nome: t('Lazer'),
          cor: 'verde',
          icone: 'bola',
          missao: t('Descansar sem culpa e fazer o que me dá gosto.'),
          tarefas: [{ nome: t('Ler por prazer'), duracaoMin: 30, recorrencia: emDias(TODOS_OS_DIAS), horarios: nosDias(TODOS_OS_DIAS, h(22, 30)) }],
        },
      ],
    },
    {
      id: 'familia',
      nome: t('Família e trabalho'),
      descricao: t('Trabalho focado, tempo a sério com os filhos e um pouco para si.'),
      areas: [
        {
          nome: t('Família'),
          cor: 'laranja',
          icone: 'casa',
          missao: t('Uma casa onde todos se sentem vistos e ouvidos.'),
          tarefas: [
            { nome: t('Tempo só com os filhos'), duracaoMin: 30, recorrencia: emDias(SEG_A_SEX), horarios: nosDias(SEG_A_SEX, h(19)) },
            { nome: t('Jantar em família'), duracaoMin: null, recorrencia: emDias(TODOS_OS_DIAS), horarios: [] },
            { nome: t('Programa de fim de semana'), duracaoMin: 180, recorrencia: emDias([5]), horarios: nosDias([5], h(10)) },
          ],
        },
        {
          nome: t('Casal'),
          cor: 'rosa',
          icone: 'coracao',
          missao: t('Cuidar da relação, e não só da logística da casa.'),
          tarefas: [{ nome: t('Tempo a dois'), duracaoMin: 90, recorrencia: emDias([4]), horarios: nosDias([4], h(21, 30)) }],
        },
        {
          nome: t('Trabalho'),
          cor: 'azul',
          icone: 'pasta',
          missao: t('Trabalho bem feito, dentro do horário.'),
          tarefas: [
            { nome: t('Planear a semana de trabalho'), duracaoMin: 30, recorrencia: emDias([0]), horarios: nosDias([0], h(8, 30)) },
            { nome: t('Trabalho focado'), duracaoMin: 120, recorrencia: emDias(SEG_A_SEX), horarios: nosDias(SEG_A_SEX, h(9)) },
          ],
        },
        {
          nome: t('Saúde'),
          cor: 'verde',
          icone: 'bola',
          missao: t('Ter energia para acompanhar os dias cheios.'),
          tarefas: [{ nome: t('Exercício'), duracaoMin: 30, recorrencia: emDias([1, 3, 5]), horarios: [...nosDias([1, 3], h(7)), { dia: 5, inicioMin: h(8, 30) }] }],
        },
        {
          nome: t('Tempo para mim'),
          cor: 'violeta',
          icone: 'folha',
          missao: t('Cuidar de mim, para estar bem com os outros.'),
          tarefas: [{ nome: t('Uma hora só para mim'), duracaoMin: 60, recorrencia: emDias([6]), horarios: nosDias([6], h(16)) }],
        },
      ],
    },
    {
      id: 'independente',
      nome: t('Por conta própria'),
      descricao: t('Clientes, faturas e novos projetos, sem deixar o trabalho ocupar a vida toda.'),
      areas: [
        {
          nome: t('Clientes'),
          cor: 'azul',
          icone: 'pasta',
          missao: t('Entregar trabalho de que me orgulho, a tempo.'),
          tarefas: [
            { nome: t('Trabalho para clientes'), duracaoMin: 180, recorrencia: emDias(SEG_A_SEX), horarios: nosDias(SEG_A_SEX, h(9)) },
            { nome: t('Responder a emails e mensagens'), duracaoMin: 30, recorrencia: emDias(SEG_A_SEX), horarios: nosDias(SEG_A_SEX, h(14)) },
          ],
        },
        {
          nome: t('Negócio'),
          cor: 'petroleo',
          icone: 'livro',
          missao: t('Um negócio estável, que não depende da sorte.'),
          tarefas: [
            { nome: t('Procurar novos clientes'), duracaoMin: 60, recorrencia: emDias([1, 3]), horarios: nosDias([1, 3], h(15)) },
            { nome: t('Faturas e contas'), duracaoMin: 60, recorrencia: emDias([4]), horarios: nosDias([4], h(16)) },
          ],
        },
        {
          nome: t('Aprender'),
          cor: 'violeta',
          icone: 'folha',
          missao: t('Ser cada vez melhor no que faço.'),
          tarefas: [{ nome: t('Aprender algo novo'), duracaoMin: 60, recorrencia: emDias([2]), horarios: nosDias([2], h(15)) }],
        },
        {
          nome: t('Saúde'),
          cor: 'rosa',
          icone: 'coracao',
          missao: t('Um corpo que aguenta os dias longos ao computador.'),
          tarefas: [
            { nome: t('Exercício'), duracaoMin: 45, recorrencia: emDias([0, 2, 4]), horarios: nosDias([0, 2, 4], h(7, 30)) },
            { nome: t('Almoçar longe do ecrã'), duracaoMin: null, recorrencia: emDias(SEG_A_SEX), horarios: [] },
          ],
        },
        {
          nome: t('Vida pessoal'),
          cor: 'laranja',
          icone: 'casa',
          missao: t('Desligar a sério ao fim do dia.'),
          tarefas: [
            { nome: t('Fechar o computador às 19h'), duracaoMin: null, recorrencia: emDias(SEG_A_SEX), horarios: [] },
            { nome: t('Tempo com amigos ou família'), duracaoMin: 120, recorrencia: emDias([5]), horarios: nosDias([5], h(16)) },
          ],
        },
      ],
    },
  ];
}

/** Quantas tarefas e quantos minutos por semana o modelo traz. */
export function resumirModelo(modelo: Modelo): { areas: number; tarefas: number; minutosPorSemana: number } {
  const tarefas = modelo.areas.flatMap((a) => a.tarefas);
  return {
    areas: modelo.areas.length,
    tarefas: tarefas.length,
    minutosPorSemana: tarefas.reduce((total, tm) => total + (tm.duracaoMin ?? 0) * instanciasPorSemana(tm.recorrencia), 0),
  };
}

/** Quando se faz a tarefa, ex.: "seg, qua, sex · 18:30 · 45 min" ou "todos os dias · sem duração". */
export function descreverTarefaDoModelo(tm: TarefaDoModelo): string {
  const quando = descreverRecorrencia(tm.recorrencia);
  if (tm.duracaoMin === null) return [quando, t('sem duração')].join(' · ');
  const horas = [...new Set([...tm.horarios].sort((a, b) => a.inicioMin - b.inicioMin).map((x) => formatarHora(x.inicioMin)))].join(', ');
  return [quando, horas, formatarDuracao(tm.duracaoMin)].join(' · ');
}
