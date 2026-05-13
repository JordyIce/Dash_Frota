# Dash Frota — B&Q Energia

Dashboard de frota (combustível + motor ocioso) consumindo duas bases do Google Sheets:

- **Veloe GO Consolidado** — transações de combustível (planilha unificada, base principal)
- **Base ZUQ** — telemetria diária por placa (motor ocioso, gerente real, grupo, operação)

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS 3 (paleta B&Q herdada do Dash_Metro)
- Recharts 2 para charts
- React Router 6
- Parser CSV state-machine (mesmo padrão do Dash_Metro)

## Cruzamento de bases

Na inicialização, o app:

1. Faz fetch das duas bases em paralelo (`fetchAll()` em `src/lib/data.ts`)
2. Para cada placa na Base ZUQ, identifica o **gerente predominante** (modo, com prioridade pra nomes nominais sobre "Gestão Frota")
3. Injeta o gerente real no campo `Transacao.gerente` da base Veloe
4. Quando uma placa Veloe não tem correspondência na ZUQ, cai pra `descricaoCC` como fallback

Resultado: o filtro **Gerente** mostra nomes reais (Moslay, Harlei, Alex, Thiago, etc) ao invés do CC.

## Páginas

| Rota | Página | Fonte |
|---|---|---|
| `/orcamento` | Orçamento — gasto total e por CC | Veloe |
| `/consumo` | Consumo por Gerência | Veloe |
| `/ranking` | Ranking KM/L (melhores e piores) por CC/Placa/Motorista | Veloe |
| `/periodo` | Consumo por dia/semana/mês/ano | Veloe |
| `/condutores` | Ranking de motoristas abaixo da meta | Veloe |
| `/ocioso` | Motor Ocioso — KPIs, ranking por gerência/operação/grupo, piores placas, evolução | ZUQ |
| `/evolucao` | Evolução semanal (gasto, volume, KM/L) | Veloe |
| `/preco` | Preço por LT por operação e fornecedor | Veloe |

## Filtros globais (todas as páginas)

- **Centro de Custo** — Descrição CC placa
- **Gerente** — nome real cruzado da ZUQ (fallback: CC)
- **Tipo do Carro** — Perfil de uso (Veloe) ∪ Grupo (ZUQ)
- **Grupo do Carro** — Tipo de Frota (Alugada / Própria / Nenhuma)
- **Data início / fim**

## Setup local

```bash
npm install
cp .env.example .env
npm run dev            # http://localhost:5173
```

## Deploy Vercel

1. Push pro GitHub.
2. Importa no Vercel — autodetecta Vite.
3. Variáveis de ambiente (Settings → Environment Variables):
   ```
   VITE_SHEET_ID=17oX46NDGybC2UEXAFg0__cqDEJ61eLjg0DcfxURshP8
   VITE_GID_VELOE=1773027822
   VITE_SHEET_ID_OCIOSO=1ACx9uDKLA-wB9g0FwINTTQ3ndMpn9DRJUpGS1s7dhi4
   VITE_GID_OCIOSO=1024045145
   ```
4. Deploy.

**Importante:** ambas as planilhas precisam estar com compartilhamento "Qualquer pessoa com o link → Leitor" para o `/export?format=csv` funcionar.

## Estrutura

```
src/
├── lib/
│   ├── csv.ts          # parser state-machine (com skipRows pra ZUQ)
│   ├── types.ts        # Transacao, OciosoDia, FilterState
│   ├── data.ts         # fetchAll() — Veloe + ZUQ + cruzamento de gerente
│   ├── filters.ts      # applyFilters + applyFiltersOcioso
│   └── utils.ts        # brl/num/lt/kmL/pct/parseDate/parseNumber
├── contexts/
│   ├── DataContext.tsx    # data (Veloe), ocioso (ZUQ), placasGerente
│   └── FiltersContext.tsx
├── components/
│   ├── Sidebar.tsx
│   ├── GlobalFilters.tsx
│   ├── MultiSelect.tsx
│   ├── KpiCard.tsx
│   └── UI.tsx
└── pages/
    ├── Orcamento.tsx
    ├── Consumo.tsx
    ├── RankingKmL.tsx
    ├── ConsumoTemporal.tsx
    ├── Condutores.tsx
    ├── MotorOcioso.tsx     # KPIs + ranking + piores placas + evolução
    ├── EvolucaoSemanal.tsx
    └── PrecoLt.tsx
```

## Notas de implementação

- **KM/L ponderado:** todas as médias de KM/L são ponderadas pelos litros consumidos, não pela contagem de transações.
- **Motor Ocioso:** vem direto da coluna "Motor ocioso" da Base ZUQ (já em horas, valor pré-calculado). KPI de "% Ligado" = ocioso / tempo ligado.
- **Filtros na ZUQ:** `applyFiltersOcioso` mapeia: Gerente→gerente, Tipo do Carro→grupo, Centro de Custo→operacao (matching por substring), Data→data. Grupo do Carro (Tipo de Frota) não existe na ZUQ e é ignorado nessa página.
- **Robustez ZUQ:** se a Base ZUQ falhar ao carregar (sem acesso, timeout), o app degrada graciosamente — Veloe continua funcionando, e o filtro Gerente usa o proxy CC como fallback.
- **Parser ZUQ:** linha 1 vazia/#N/A — `csvToObjects(rows, { skipRows: 1 })` ignora ela e usa linha 2 como header.
- **Performance:** todos os agregados usam `useMemo`.
