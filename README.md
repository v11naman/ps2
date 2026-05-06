# Smart Delivery Dispatch System

## Team Information
- **Team Name**: Procrastinators United
- **Year**: 1st Year
- **All-Female Team**: No

## Architecture Overview

#### Describe your approach here. Keep it short and clear.

Scoring Formula:
score = (priority_weight × agent_rating × sla_urgency)
        ──────────────────────────────────────────────
        load_penalty × (travel_time×2 + prep_time + 1)
Agent Scoring Factors:

priority_weight — 1.5 / 1.0 / 0.8 for high/normal/low orders
agent_rating — quality score (1–5) favoring better agents
sla_urgency — spikes as deadline approaches, drops to 0.1 if breached
load_penalty — penalizes busy agents (1 + active_orders × 0.25)
travel_time × 2 — double-weighted to strongly prefer nearby agents

SLA, Priority & Capacity Management:

Hard cap: agents reject assignments if activeOrders ≥ max_active_orders_per_agent (default: 2)
Batch dispatch sorts by priority DESC → tightest SLA first
sla_urgency term dynamically escalates scoring for near-deadline orders

Pipeline Steps:

Validate order is pending
Filter agents below load cap
Run Dijkstra (agent → order location) for each candidate
Score all candidates → pick highest scorer
Update order (assigned), agent (activeOrders+1, position teleported)
Log assignment with path waypoints
On auto-complete, decrement load and free agent for reuse
**Note:** Please do not change the format or spelling of anything in this README. The fields are extracted using a script, so any changes to the structure or formatting may break the extraction process.
