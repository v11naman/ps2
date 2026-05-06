import { loadAgents, loadOrders, loadEdges, loadConstraints } from "./data.js";
import { buildGraph, dijkstraWithEdges, setEdges } from "./pathfinder.js";
import type { RawAgent, RawOrder, RawEdge, RawConstraints } from "./data.js";

export type OrderStatus = "pending" | "assigned" | "delivered" | "breached";
export type AgentStatus = "idle" | "busy" | "full";
export type SlaStatus = "on_track" | "at_risk" | "breached";

export interface AgentState {
  agentId: string;
  currentX: number;
  currentY: number;
  rating: number;
  activeOrders: number;
  status: AgentStatus;
  totalDeliveries: number;
  slaBreaches: number;
}

export interface OrderState {
  orderId: string;
  timestamp: string;
  locationX: number;
  locationY: number;
  prepTimeMinutes: number;
  priority: "high" | "normal" | "low";
  slaMinutes: number;
  status: OrderStatus;
  assignedAgentId: string | null;
  estimatedDeliveryMinutes: number | null;
  score: number | null;
}

export interface AssignmentState {
  id: number;
  orderId: string;
  agentId: string;
  assignedAt: string;
  estimatedDeliveryMinutes: number;
  agentScore: number;
  slaStatus: SlaStatus;
  pathX: number[];
  pathY: number[];
}

export interface CandidateScore {
  agentId: string;
  score: number;
  distanceMinutes: number;
  activeOrders: number;
  rating: number;
}

export interface DispatchResult {
  success: boolean;
  orderId: string;
  assignedAgentId: string | null;
  estimatedDeliveryMinutes: number | null;
  agentScore: number | null;
  reason: string | null;
  candidateScores: CandidateScore[];
}

let agents: Map<string, AgentState> = new Map();
let orders: Map<string, OrderState> = new Map();
let assignments: AssignmentState[] = [];
let edges: RawEdge[] = [];
let constraints: RawConstraints;
let graph: ReturnType<typeof buildGraph>;
let assignmentIdCounter = 1;

function priorityWeight(priority: "high" | "normal" | "low"): number {
  switch (priority) {
    case "high":
      return constraints.priority_weight_high;
    case "normal":
      return constraints.priority_weight_normal;
    case "low":
      return constraints.priority_weight_low;
  }
}

function computeAgentStatus(activeOrders: number): AgentStatus {
  if (activeOrders === 0) return "idle";
  if (activeOrders >= constraints.max_active_orders_per_agent) return "full";
  return "busy";
}

function computeSlaStatus(estimatedMinutes: number, slaMinutes: number): SlaStatus {
  if (estimatedMinutes > slaMinutes) return "breached";
  if (estimatedMinutes > slaMinutes * 0.8) return "at_risk";
  return "on_track";
}

function scoreAgent(agent: AgentState, order: OrderState): CandidateScore | null {
  if (agent.activeOrders >= constraints.max_active_orders_per_agent) return null;

  const pathResult = dijkstraWithEdges(graph, agent.currentX, agent.currentY, order.locationX, order.locationY);
  if (pathResult.distance === Infinity) return null;

  const travelTime = pathResult.distance;
  const totalTime = order.prepTimeMinutes + travelTime;

  const pw = priorityWeight(order.priority);

  const slaUrgency = totalTime > order.slaMinutes ? 0.1 : order.slaMinutes / (order.slaMinutes - totalTime + 1);
  const loadPenalty = 1 + agent.activeOrders * 0.3;

  const score = (pw * agent.rating * slaUrgency) / (loadPenalty * (totalTime + 1));

  return {
    agentId: agent.agentId,
    score,
    distanceMinutes: travelTime,
    activeOrders: agent.activeOrders,
    rating: agent.rating,
  };
}

export function initState() {
  const rawAgents = loadAgents();
  const rawOrders = loadOrders();
  edges = loadEdges();
  constraints = loadConstraints();

  setEdges(edges);
  graph = buildGraph(edges);

  agents = new Map(
    rawAgents.map((a) => [
      a.agent_id,
      {
        agentId: a.agent_id,
        currentX: a.current_x,
        currentY: a.current_y,
        rating: a.rating,
        activeOrders: 0,
        status: "idle" as AgentStatus,
        totalDeliveries: 0,
        slaBreaches: 0,
      },
    ])
  );

  orders = new Map(
    rawOrders.map((o) => [
      o.order_id,
      {
        orderId: o.order_id,
        timestamp: o.timestamp,
        locationX: o.location_x,
        locationY: o.location_y,
        prepTimeMinutes: o.prep_time_minutes,
        priority: o.priority,
        slaMinutes: o.sla_minutes,
        status: "pending" as OrderStatus,
        assignedAgentId: null,
        estimatedDeliveryMinutes: null,
        score: null,
      },
    ])
  );

  assignments = [];
  assignmentIdCounter = 1;
}

export function getAgents(): AgentState[] {
  return Array.from(agents.values());
}

export function getAgent(agentId: string): AgentState | null {
  return agents.get(agentId) ?? null;
}

export function getOrders(status?: string): OrderState[] {
  const all = Array.from(orders.values());
  if (!status) return all;
  return all.filter((o) => o.status === status);
}

export function getOrder(orderId: string): OrderState | null {
  return orders.get(orderId) ?? null;
}

export function getAssignments(): AssignmentState[] {
  return assignments;
}

export function getEdgesData(): RawEdge[] {
  return edges;
}

export function getConstraints(): RawConstraints {
  return constraints;
}

export function dispatchOrder(orderId: string): DispatchResult {
  const order = orders.get(orderId);
  if (!order) {
    return { success: false, orderId, assignedAgentId: null, estimatedDeliveryMinutes: null, agentScore: null, reason: "Order not found", candidateScores: [] };
  }
  if (order.status !== "pending") {
    return { success: false, orderId, assignedAgentId: null, estimatedDeliveryMinutes: null, agentScore: null, reason: `Order is already ${order.status}`, candidateScores: [] };
  }

  const candidateScores: CandidateScore[] = [];
  for (const agent of agents.values()) {
    const score = scoreAgent(agent, order);
    if (score) candidateScores.push(score);
  }

  if (candidateScores.length === 0) {
    return { success: false, orderId, assignedAgentId: null, estimatedDeliveryMinutes: null, agentScore: null, reason: "No available agents", candidateScores: [] };
  }

  candidateScores.sort((a, b) => b.score - a.score);
  const best = candidateScores[0];
  const agent = agents.get(best.agentId)!;

  const pathResult = dijkstraWithEdges(graph, agent.currentX, agent.currentY, order.locationX, order.locationY);
  const estimatedDelivery = order.prepTimeMinutes + pathResult.distance;
  const slaStatus = computeSlaStatus(estimatedDelivery, order.slaMinutes);

  agent.activeOrders += 1;
  agent.totalDeliveries += 1;
  agent.status = computeAgentStatus(agent.activeOrders);
  agent.currentX = order.locationX;
  agent.currentY = order.locationY;

  if (slaStatus === "breached") {
    agent.slaBreaches += 1;
  }

  order.status = "assigned";
  order.assignedAgentId = best.agentId;
  order.estimatedDeliveryMinutes = estimatedDelivery;
  order.score = best.score;

  const assignment: AssignmentState = {
    id: assignmentIdCounter++,
    orderId,
    agentId: best.agentId,
    assignedAt: new Date().toISOString(),
    estimatedDeliveryMinutes: estimatedDelivery,
    agentScore: best.score,
    slaStatus,
    pathX: pathResult.path.map((p) => p.x),
    pathY: pathResult.path.map((p) => p.y),
  };
  assignments.push(assignment);

  return {
    success: true,
    orderId,
    assignedAgentId: best.agentId,
    estimatedDeliveryMinutes: estimatedDelivery,
    agentScore: best.score,
    reason: null,
    candidateScores,
  };
}

export function dispatchBatch(): { dispatched: number; skipped: number; results: DispatchResult[] } {
  const pending = Array.from(orders.values()).filter((o) => o.status === "pending");

  pending.sort((a, b) => {
    const pw = priorityWeight(b.priority) - priorityWeight(a.priority);
    if (pw !== 0) return pw;
    return a.slaMinutes - b.slaMinutes;
  });

  const results: DispatchResult[] = [];
  let dispatched = 0;
  let skipped = 0;

  for (const order of pending) {
    const result = dispatchOrder(order.orderId);
    results.push(result);
    if (result.success) dispatched++;
    else skipped++;
  }

  return { dispatched, skipped, results };
}

export function getMetrics() {
  const allOrders = Array.from(orders.values());
  const assigned = allOrders.filter((o) => o.status === "assigned");
  const pending = allOrders.filter((o) => o.status === "pending");

  const breached = assignments.filter((a) => a.slaStatus === "breached").length;
  const deliveryTimes = assigned.map((o) => o.estimatedDeliveryMinutes ?? 0);
  const avgDelivery = deliveryTimes.length > 0 ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length : 0;

  const agentLoads = Array.from(agents.values()).map((a) => a.activeOrders);
  const meanLoad = agentLoads.length > 0 ? agentLoads.reduce((a, b) => a + b, 0) / agentLoads.length : 0;
  const loadVariance =
    agentLoads.length > 0
      ? agentLoads.reduce((sum, l) => sum + Math.pow(l - meanLoad, 2), 0) / agentLoads.length
      : 0;

  const activeAgents = Array.from(agents.values()).filter((a) => a.activeOrders > 0).length;

  return {
    totalOrders: allOrders.length,
    assignedOrders: assigned.length,
    pendingOrders: pending.length,
    slaBreachCount: breached,
    slaBreachRate: assigned.length > 0 ? breached / assigned.length : 0,
    avgDeliveryTimeMinutes: avgDelivery,
    loadVariance,
    activeAgents,
    totalAgents: agents.size,
  };
}

export function getAgentLoad() {
  return Array.from(agents.values()).map((a) => ({
    agentId: a.agentId,
    activeOrders: a.activeOrders,
    totalDeliveries: a.totalDeliveries,
    rating: a.rating,
    currentX: a.currentX,
    currentY: a.currentY,
  }));
}

export function getTimeline() {
  return assignments.map((a) => {
    const order = orders.get(a.orderId);
    return {
      time: a.assignedAt,
      orderId: a.orderId,
      agentId: a.agentId,
      priority: order?.priority ?? "normal",
      estimatedMinutes: a.estimatedDeliveryMinutes,
      slaMinutes: order?.slaMinutes ?? 50,
      slaStatus: a.slaStatus,
    };
  });
}

export interface CompleteResult {
  success: boolean;
  orderId: string;
  agentId: string | null;
  reason: string | null;
}

export function completeOrder(orderId: string): CompleteResult {
  const order = orders.get(orderId);
  if (!order) {
    return { success: false, orderId, agentId: null, reason: "Order not found" };
  }
  if (order.status !== "assigned") {
    return { success: false, orderId, agentId: null, reason: `Order is ${order.status}, not assigned` };
  }

  const agentId = order.assignedAgentId!;
  const agent = agents.get(agentId);

  order.status = "delivered";

  if (agent) {
    agent.activeOrders = Math.max(0, agent.activeOrders - 1);
    agent.status = computeAgentStatus(agent.activeOrders);
  }

  return { success: true, orderId, agentId, reason: null };
}

export function autoCompleteByElapsed(elapsedMinutes: number): CompleteResult[] {
  const results: CompleteResult[] = [];
  for (const order of orders.values()) {
    if (order.status === "assigned" && order.estimatedDeliveryMinutes != null) {
      if (order.estimatedDeliveryMinutes <= elapsedMinutes) {
        results.push(completeOrder(order.orderId));
      }
    }
  }
  return results;
}

export function getNextPendingByTimestamp(): OrderState | null {
  const pending = Array.from(orders.values())
    .filter((o) => o.status === "pending")
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return pending[0] ?? null;
}

export function getSimulationBaseline(): string | null {
  const all = Array.from(orders.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return all[0]?.timestamp ?? null;
}
