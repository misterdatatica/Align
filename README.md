# WeekAlign — Áreas de Responsabilidade

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
| `npm run e2e` | Cenários de ponta a ponta na versão web, num Chrome sem janela em pt-PT (o cenário `ingles` corre em en-GB) |
| `npm run lint` | ESLint (configuração da Expo) |
| `npm run db:generate` | Gera uma nova migração Drizzle depois de mudar `src/db/schema.ts` |

## Estrutura

```
src/
  app/                   rotas Expo Router (cada ficheiro é um ecrã)
    (tabs)/              Hoje (index) · Áreas · Semana · Calendário (dia / 3 dias / semana) · Revisão
    area/[id].tsx        detalhe da área: missão, metas (progresso, prazo, tarefas ligadas), tarefas, cor, ícone
    area/nova.tsx        criar área
    meta/[id].tsx        uma meta: progresso, linha do histórico, atualizar valor, pausar, concluir
    meta/nova.tsx        criar meta
    tarefa/nova.tsx      criar tarefa          tarefa/[id].tsx   alterar ou apagar tarefa
    definicoes.tsx       revisão (dia, hora, lembrete), horas do calendário, avisos dos blocos, calendários do
                         telemóvel, cópia de segurança
    pesquisa.tsx         pesquisar áreas, metas e tarefas pelo nome (sem acentos nem maiúsculas)
    estatisticas.tsx     estatísticas e histórico do mês ou do ano (WeekAlign Plus)
    metas.tsx            "As minhas metas": todas as metas, por estado (ativas, pausadas, concluídas, abandonadas)
    modelos.tsx          modelos de áreas e tarefas já com horário (WeekAlign Plus)
    boas-vindas.tsx      primeiro arranque, em três passos (as áreas, ou um modelo)
  db/schema.ts           as entidades (Drizzle + SQLite), incluindo o histórico das metas e o plano das semanas
  db/client.ts           ligação à base de dados      db/preparar.ts   abre-a e aplica as migrações
  data/                  leituras e escritas usadas pelos ecrãs (metas, tarefas, semanas, calendário, revisão…)
    consulta.ts          useConsulta: lê e volta a ler quando as tabelas mudam
  domain/                regras puras e testadas: semana, metas, cópia da semana (proposta.ts), recorrência,
                         tarefas, calendário, revisão; erros.ts tem o ErroDaApp (mensagens para o utilizador)
  components/            ícones, UI partilhada, formulários
    AvisoTemporario.tsx  aviso de 5 s com "Desfazer" (comDesfazer), em vez de pedir confirmação
    exportarCopia.ts     exportar a cópia de segurança e registar a data
    calendario/          grelha, blocos, bandeja "Por alocar", folha de detalhes, o arrasto (arrasto.ts)
                         e a pergunta "Só esta semana / Esta e as seguintes"
    metas/               cartão da meta, linha de progresso, atualizar o valor
  estado/semana.ts       o dia de hoje e a semana escolhida nos separadores
  lembrete.ts            lembrete local da revisão (expo-notifications); lembrete.web.ts não faz nada
  avisos.ts              avisos antes de cada bloco (WeekAlign Plus), refeitos quando os blocos mudam; avisos.web.ts não faz nada
  eventos.ts             eventos dos calendários do telemóvel como "Ocupado" (WeekAlign Plus); eventos.web.ts não faz nada
idiomas/                 textos do iOS por idioma (o pedido de acesso aos calendários)
  copiaFicheiro.ts       guardar e abrir o ficheiro da cópia; copiaFicheiro.web.ts para o navegador
  i18n/                  traduções: t('texto em português'), en.ts (inglês), listas.ts e o teste que garante
                         que nada fica por traduzir
  theme.ts               paletas clara e escura, cores das áreas, fontes e estilos partilhados; os ecrãs
                         leem o tema com useTema() (o layout principal escolhe-o pela preferência e pelo sistema)
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
- **Semanas** (`semanas`): uma semana sem linha ainda não foi planeada. Ao abrir uma semana (atual
  ou futura), `planearSemana` cria-a sozinha **igual à semana anterior**, sem nada para aceitar; se
  faltarem semanas pelo meio, planeiam-se todas por ordem. A cópia leva os blocos das tarefas
  recorrentes e os "Ocupado" para o mesmo dia e hora, passa as tarefas únicas por fazer para
  "Por alocar" (respeitando a revisão) e nunca copia o "feito". A primeira semana de todas começa
  vazia. As semanas que já passaram sem plano ficam assim. Uma semana criada cedo (aberta com
  antecedência) não apanha o que muda depois na anterior: "Refazer a partir da semana anterior"
  (`refazerSemana`) volta a copiá-la, mantendo as tarefas e o que já foi feito. (As colunas `estado = 'rascunho'` e
  `modelo` vêm de versões anteriores e já não se usam.)
- Apagar, arquivar, concluir, pausar ou abandonar faz-se logo e mostra um aviso com **Desfazer**
  durante 5 s. Desfazer repõe uma fotografia dos dados tirada antes da ação; o aviso sai assim que
  outra coisa mudar os dados.
- **Aparência** (`definicoes.tema`): automático (segue o telemóvel), claro ou escuro. Nada usa cores
  fixas: os componentes pedem `useTema()`. No telemóvel, "Claro" e "Escuro" também se aplicam aos
  componentes do sistema (`Appearance.setColorScheme`); no Android o modo automático precisa do
  `expo-system-ui`.
- **Idiomas:** português de Portugal e inglês, pelo idioma do telemóvel ou escolhido nas Definições (`definicoes.idioma`) (`expo-localization`; qualquer
  `pt-*` dá português, o resto inglês). O texto português fica no código e é a chave da tradução:
  `t('Revisão de {dia}', { dia })`. Os textos novos vão para `src/i18n/en.ts`; `npm test` falha se
  algum ficar sem tradução, se as `{chavetas}` não baterem certo ou se sobrar uma tradução que já não se usa.
  Datas, meses, dias da semana e o separador decimal também mudam com o idioma.
- **WeekAlign Plus:** as funcionalidades pagas perguntam a `temPlus()` (`src/plus.ts`), que por agora
  responde sempre que sim. Quando houver pagamentos, só aí se muda. `SoPlus` e `EtiquetaPlus` estão
  em `src/components/Plus.tsx`.
- **Estatísticas** (`src/data/estatisticas.ts`): um mês ou um ano, com as mesmas contas da revisão.
  Uma semana conta para o mês da sua quinta-feira. Só contam as semanas que já começaram e as áreas
  por arquivar. `metas.concluida_em` guarda quando uma meta foi concluída (migração 0007).
- **Avisos dos blocos** (`src/avisos.ts`, regras em `src/domain/avisos.ts`): uma notificação local uns
  minutos antes (5, 10, 15 ou 30) de cada bloco das tarefas por fazer; os "Ocupado" não avisam. O
  telemóvel guarda poucas notificações agendadas (64 no iOS), por isso agendam-se as 60 mais próximas,
  nos 7 dias seguintes, e a lista refaz-se quando a app abre, quando volta a ficar à frente e sempre
  que os blocos, as tarefas ou as definições mudam (só cancela e agenda o que mudou). A partir de
  sexta-feira a semana seguinte é criada (cópia desta, como ao abri-la), para os avisos de segunda
  existirem mesmo sem abrir a app no fim de semana. Tocar num aviso abre o Hoje. No Android 12+ as
  notificações só chegam à hora certa com "Alarmes e lembretes" permitidos (`SCHEDULE_EXACT_ALARM`
  no `app.json`); as Definições mostram como permitir. Colunas `definicoes.avisos_blocos` e
  `minutos_antes` (migração 0008).
- **Modelos** (`src/domain/modelos.ts`, aplicar em `src/data/modelos.ts`): Vida equilibrada, Estudante,
  Família e trabalho e Por conta própria, cada um com áreas (cor, ícone, missão) e tarefas recorrentes
  já com horário. Escolhem-se no primeiro arranque ou em Áreas → Modelos, com "Desfazer". Aplicar junta
  ao que existe: uma área com o mesmo nome (sem ligar a maiúsculas nem a acentos) é essa área (a missão
  só entra se estiver vazia) e uma tarefa que a área já tem não se repete. Quem começa a meio da semana
  começa daí para a frente: nesta semana só entram as vezes que ainda estão para vir, e a semana
  seguinte é criada logo com o modelo inteiro (as outras copiam-na). Os testes verificam que nenhum
  modelo tem blocos sobrepostos e que os horários batem certo com as recorrências.
- **Calendários do telemóvel** (`src/eventos.ts`, com `expo-calendar`): os eventos do Google Calendar,
  do iCloud e das outras contas do telemóvel, da semana atual e das 4 seguintes, guardam-se como blocos
  "Ocupado" com `blocos.evento_id` (migração 0009), para o calendário, o Hoje e os avisos de
  sobreposição os verem como os outros. A app só lê. Refazem-se quando a app abre, quando volta a ficar
  à frente e quando as definições mudam, e só se escreve o que mudou (`src/data/eventos.ts`). Ficam de
  fora os de dia inteiro, os cancelados e os marcados como "livre"; um evento que passa da meia-noite
  fica partido por dia. São só para ver: não se arrastam nem se editam, não se copiam para a semana
  seguinte, não contam para "semana desatualizada", "Limpar" não os tira e não vão na cópia de
  segurança. Nas Definições escolhe-se que calendários mostrar (`definicoes.calendarios_escondidos`:
  os novos aparecem). O pedido de acesso no iOS está em `idiomas/` (português e inglês).
- `definicoes.ultima_copia` guarda a data da última cópia de segurança; a revisão lembra de fazer
  uma quando passaram mais de 30 dias.
- Mover ou retirar um bloco de uma tarefa recorrente pede um âmbito. "Só esta semana" guarda o
  horário habitual na instância (`habitualInicio/Fim`), e a semana seguinte copia o habitual;
  "Esta e as seguintes" muda o hábito e acerta as semanas seguintes que já existem.
- Tarefas **sem duração** não vão ao calendário: contam-se marcando-as como feitas. As que têm dias
  (todos os dias, dias certos, ou o dia escolhido de uma tarefa única) ficam com cada instância ligada
  ao seu dia (`tarefas_semana.dia`, acertado por `atribuirDias`) e aparecem no ecrã Hoje nesse dia; as
  de "vezes por semana" e as tarefas únicas sem dia contam-se na semana, em qualquer dia.
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
- [x] **Uso diário:** ecrã Hoje, semana nova sempre igual à anterior, "Desfazer" em vez de
      confirmações, erros compreensíveis, "Guardado ✓", revisão em dois passos (e mais cedo),
      calendário de 1, 3 ou 7 dias com zoom de dois dedos, lembrete de cópia de segurança, modo escuro, português e inglês.
- [ ] **Fase 5 — Testes e lojas:** testar num iPhone e num Android reais, corrigir, EAS Build / Submit.

O que falta verificar em telemóveis reais (não se consegue no navegador): o arrasto com o dedo
e a sua fluidez, o zoom de dois dedos no calendário, o lembrete (notificação à hora escolhida), os avisos dos
blocos (à hora certa, tocar abre o Hoje, "Alarmes e lembretes" no Android), os eventos dos calendários do
telemóvel (acesso, escolher calendários, eventos que mudam lá fora), exportar pela folha de partilha e
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
