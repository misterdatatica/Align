# Align — Áreas de Responsabilidade

App móvel (iOS e Android) para definir áreas da vida, a missão de cada uma, metas semanais, tarefas
e alocá-las num calendário semanal. Segue a especificação v1 e o design dos 5 ecrãs.

## Arrancar

```bash
npm install
npx expo start          # abrir no Expo Go (iOS/Android) ou num development build
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run typecheck` | TypeScript sem emitir ficheiros |
| `npm test` | Testes das regras de negócio (`node --test`, sem dependências) |
| `npm run lint` | ESLint (configuração da Expo) |
| `npm run db:generate` | Gera uma nova migração Drizzle depois de mudar `src/db/schema.ts` |

## Estrutura

```
src/
  app/                 rotas Expo Router (cada ficheiro é um ecrã)
    (tabs)/            Áreas · Semana · Calendário · Revisão
    area/[id].tsx      detalhe da área (missão, metas, cor, arquivar)
    area/nova.tsx      criar área (modal)
  db/schema.ts         as 7 entidades da especificação (Drizzle + SQLite)
  db/client.ts         abre align.db com change listener (useLiveQuery)
  data/                leituras e escritas usadas pelos ecrãs
  domain/              regras puras e testadas: semana, metas, recorrência
  components/          ícones (react-native-svg) e UI partilhada
  theme.ts             cores e fontes do design
drizzle/               migrações geradas (incluídas no bundle como .sql)
```

## Estado (plano de entrega)

- [x] **Fase 1 — Base:** projeto, navegação, modelo de dados, migrações.
- [x] Áreas: lista, sugestões iniciais, criar (limite de 7), detalhe, missão, metas (2 h/dia → 14 h/semana), cor, arquivar.
- [ ] **Fase 2 — Planear a semana:** tarefas, recorrência, instâncias por semana.
- [ ] **Fase 3 — Calendário:** grelha, arrastar e largar (gesture-handler + reanimated já instalados).
- [ ] **Fase 4 — Revisão:** horas feitas, transitar tarefas, reflexão, lembrete local.
- [ ] **Fase 5 — Testes e lojas:** EAS Build / Submit.

## Notas

- Expo SDK 58, Expo Router com rotas em `src/app`. Instalar pacotes sempre com `npx expo install`.
- Os dados ficam só no telemóvel (SQLite). Contas e sincronização são v2.
