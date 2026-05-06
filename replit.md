# Smart Delivery Dispatch System

A real-time delivery dispatch system that assigns agents to orders using a priority-weighted scoring algorithm with Dijkstra pathfinding on a 10x10 grid.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/dispatch-dashboard run dev` — run the frontend (port 25833)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (in-memory state, no DB needed)
- Frontend: React + Vite + Tailwind + shadcn/ui + Recharts
- Routing: Wouter
- State: TanStack React Query (auto-refresh every 5-10s)
- API codegen: Orval (OpenAPI → React Query hooks + Zod schemas)

## Where things live

- `attached_assets/` — source CSV data (agents, orders, edges, constraints)
- `artifacts/api-server/src/lib/data.ts` — CSV loaders
- `artifacts/api-server/src/lib/dispatch.ts` — in-memory state + dispatch engine
- `artifacts/api-server/src/lib/pathfinder.ts` — Dijkstra pathfinding
- `artifacts/api-server/src/routes/` — API route handlers
- `artifacts/dispatch-dashboard/src/pages/` — 5 frontend pages
- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/src/generated/` — generated hooks

## Architecture decisions

- **In-memory state**: All simulation state (agents, orders, assignments) lives in RAM via `dispatch.ts`. No DB needed for a hackathon demo — data resets on restart, and the reset endpoint reinitializes from CSVs.
- **Dijkstra on grid**: Path costs = `distance_minutes * delay_multiplier` per edge. Graph is bidirectional. Results include full waypoint path for visualization.
- **Scoring formula**: `(priority_weight * agent_rating * sla_urgency) / (load_penalty * (travel_time + prep_time + 1))` — balances urgency, fairness, and quality.
- **Priority ordering**: Batch dispatch sorts pending orders by priority weight then SLA deadline before assigning, ensuring high-priority orders get best agents.
- **Agent position update**: After assignment, agent's position moves to the order's location (simulating delivery completion).

## Product

- **Dashboard**: Live 10x10 SVG grid map with agent dots (green/amber/red by load) and order markers (red/orange/gray by priority). Dispatch All button assigns all 150 orders optimally.
- **Orders**: Filterable table with per-order dispatch buttons, SLA countdown, ETA vs SLA comparison.
- **Agents**: Card grid showing all 25 agents with rating stars, location, active orders, load bars.
- **Assignments**: Full decision log with agent score, SLA status badges, path node count.
- **Analytics**: Recharts bar/line/pie charts for agent load, SLA compliance, ETA vs SLA timeline.

## Gotchas

- CSV files must be at `attached_assets/` relative to workspace root; `data.ts` uses `process.cwd()` to find them (CWD = `artifacts/api-server/` when running via pnpm)
- After `dispatchBatch`, agent positions update to delivery locations — call reset to restore initial state
- No DATABASE_URL needed — this project uses in-memory state only

## Pointers

- See the `pnpm-workspace` skill for workspace structure and TypeScript setup
