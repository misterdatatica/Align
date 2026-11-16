# Align — Áreas de Responsabilidade

App móvel (iOS e Android) para definir áreas da vida, a missão de cada uma, metas (resultados com
prazo), tarefas, e alocá-las num calendário semanal que cada semana começa como uma cópia da anterior.

## Arrancar

```bash
npm install
npx expo start          # abrir no Expo Go (iOS/Android) ou num development build
npx expo start --web    # ver no navegador (útil para desenvolver; a v1 é para telemóvel)
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run typecheck` | TypeScript sem emitir ficheiros |
| `npm test` | Testes das regras e da camada de dados, contra SQLite real em memória (`node --test`, sem dependências) |
| `npm run e2e` | Cenários de ponta a ponta na versão web, num Chrome sem janela (ver abaixo) |
| `npm run lint` | ESLint (configuração da Expo) |
| `npm run db:generate` | Gera uma nova migração Drizzle depois de mudar `src/db/schema.ts` |

## Estrutura

```
src/
  app/                   rotas Expo Router (cada ficheiro é um ecrã)
    (tabs)/              Áreas · Semana · Calendário · Revisão
    area/[id].tsx        detalhe da área: missão, metas (progresso, prazo, tarefas ligadas), tarefas, cor, ícone
    area/nova.tsx        criar área
    meta/[id].tsx        uma meta: progresso, linha do histórico, atualizar valor, pausar, concluir
    meta/nova.tsx        criar meta
    tarefa/nova.tsx      criar tarefa          tarefa/[id].tsx   alterar ou apagar tarefa
    definicoes.tsx       revisão (dia, hora, lembrete), horas do calendário, cópia de segurança
    boas-vindas.tsx      primeiro arranque, em três passos
  db/schema.ts           as entidades (Drizzle + SQLite), incluindo o histórico das metas e o plano das semanas
  db/client.ts           ligação à base de dados      db/preparar.ts   abre-a e aplica as migrações
  data/                  leituras e escritas usadas pelos ecrãs (metas, tarefas, semanas, calendário, revisão…)
    consulta.ts          useConsulta: lê e volta a ler quando as tabelas mudam
  domain/                regras puras e testadas: semana, metas, proposta, recorrência, tarefas, calendário, revisão
  components/            ícones, UI partilhada, formulários
    calendario/          grelha, blocos, bandeja "Por alocar", folha de detalhes, o arrasto (arrasto.ts)
                         e a pergunta "Só esta semana / Esta e as seguintes"
    metas/               cartão da meta, linha de progresso, atualizar o valor
    semana/              o plano da semana: escolher a origem, rever e aceitar a proposta, semana modelo
  estado/semana.ts       o dia de hoje e a semana escolhida nos separadores
  lembrete.ts            lembrete local da revisão (expo-notifications); lembrete.web.ts não faz nada
  copiaFicheiro.ts       guardar e abrir o ficheiro da cópia; copiaFicheiro.web.ts para o navegador
  theme.ts               cores e fontes do design
drizzle/                 migrações geradas (incluídas no pacote como .sql)
scripts/testes/          apoio aos testes em Node (substitui o expo-sqlite por node:sqlite)
scripts/e2e/             cenários de ponta a ponta e o condutor do Chrome
```

## Como os dados funcionam

- **Meta** é um resultado com prazo ("Conseguir meditar 1 h seguida até 31 mar 2027"), não uma
  atividade. Mede-se com um **número** (valor inicial → alvo, também a descer: 55 → 50 min) ou como
  um **marco** (alcançado ou não). No máximo 3 ativas por área; pausar, concluir ou abandonar não
  apaga nada. Cada atualização do valor fica em `metas_registos` (uma por dia), para a linha de
  progresso. As tarefas podem ligar-se a uma meta; o tempo semanal vive só nas tarefas e nos blocos.
- **Tarefa** é o modelo (nome, duração, repetição); **tarefa da semana** é cada instância: "Meditar,
  todos os dias" são 7 linhas em cada semana.
- Alterar ou apagar uma tarefa vale **a partir da semana em que se está**; as semanas anteriores
  ficam como estavam (a tarefa antiga é fechada com `semanaFim` e nasce uma nova, na mesma série,
  `serieId`).
- Uma instância tem no máximo um **bloco** no calendário. Sem bloco está "por alocar"; com bloco,
  "alocada"; bloco marcado como feito, "feita". Um bloco sem tarefa é um bloco "Ocupado".
- **Semanas** (`semanas`): uma semana sem linha ainda não foi planeada. Planear cria uma **proposta**
  (rascunho) a partir da última semana planeada, da **semana modelo** ou vazia, que só fica
  definitiva com "Aceitar semana". A cópia leva os blocos das tarefas recorrentes e os "Ocupado"
  para o mesmo dia e hora, passa as tarefas únicas por fazer para "Por alocar" (respeitando a
  revisão) e nunca copia o "feito". A primeira semana de todas começa já aceite.
- Mover ou retirar um bloco de uma tarefa recorrente pede um âmbito. "Só esta semana" guarda o
  horário habitual na instância (`habitualInicio/Fim`), e a semana seguinte copia o habitual;
  "Esta e as seguintes" muda o hábito e acerta as semanas seguintes que já existem.
- Tarefas **sem duração** não vão ao calendário: contam-se marcando-as como feitas.
- As escritas são transações síncronas do SQLite, por isso nunca ficam a meio.
- A migração `0003` converte as metas antigas (alvo semanal) em metas pausadas, com o alvo antigo na
  descrição e um prazo provisório, para serem reescritas como resultados. As tarefas continuam
  ligadas. As cópias de segurança antigas (versão 1) são convertidas da mesma forma ao importar.

## Estado (plano de entrega da especificação)

- [x] **Fase 1 — Base:** projeto, navegação, modelo de dados, migrações.
- [x] **Fase 2 — Áreas e metas:** áreas (limite de 7, reordenar a arrastar, arquivar e repor), missão,
      metas com progresso, tarefas únicas e recorrentes, ecrã "Planear a semana".
- [x] **Fase 3 — Calendário:** grelha de 7 dias em meias horas, arrastar da bandeja, mover e esticar
      blocos, alocar só com toques, blocos "Ocupado", aviso de sobreposição.
- [x] **Fase 4 — Revisão:** horas feitas contra planeadas, "Feito?" para blocos por marcar, passar
      tarefas para a semana seguinte, reflexão, lembrete local, exportar e importar, primeiro arranque.
- [x] **Metas de resultado e proposta da semana:** metas com prazo e histórico, semana seguinte como
      cópia (passada, modelo ou vazia) a rever e aceitar, "só esta semana / esta e as seguintes",
      passo "Como estão as suas metas?" na revisão.
- [ ] **Fase 5 — Testes e lojas:** testar num iPhone e num Android reais, corrigir, EAS Build / Submit.

O que falta verificar em telemóveis reais (não se consegue no navegador): o arrasto com o dedo
e a sua fluidez, o lembrete (notificação à hora escolhida), exportar pela folha de partilha e
importar pelo seletor de ficheiros, e o uso em modo de avião.

## Testes de ponta a ponta

`npm run e2e` percorre a app como um utilizador, na versão web: primeiro arranque, áreas e metas,
planear a semana, calendário (arrastar, mover, esticar), revisão e cópia de segurança. Precisa do
Chrome instalado e da app a ser servida noutro terminal (`npx expo start --web`). Cada cenário usa
um perfil de navegador vazio, por isso não toca nos dados de ninguém.

```bash
npm run e2e                 # todos
npm run e2e -- calendario   # só um: semana, calendario, revisao, arranque, ordem
```

Em Linux, num contentor (como root), indique o Chrome e desligue a sandbox:

```bash
CHROME_PATH=/caminho/do/chrome CHROME_ARGS=--no-sandbox npm run e2e
```

## Notas

- Expo SDK 58, Expo Router com rotas em `src/app`. Instalar pacotes sempre com `npx expo install`.
- Os dados ficam só no telemóvel (SQLite). Contas e sincronização são v2.
- **Versão web:** serve para desenvolver e testar. O SQLite da Expo no navegador desiste de uma
  chamada síncrona ao fim de cerca de 30 ms; `src/db/client.ts` alarga essa espera e
  `src/db/preparar.ts` aplica as migrações pela API assíncrona, para não haver falhas ao arrancar
  nem ao guardar. No telemóvel nada disto se aplica.
- Em modo de desenvolvimento não use `CI=1` com `expo start`: desliga a deteção de alterações.
