import { Router } from "express";
import {
  getAssignments,
  dispatchOrder,
  dispatchBatch,
  getMetrics,
  getAgentLoad,
  getTimeline,
  getEdgesData,
  initState,
  getAgents,
  getOrders,
  completeOrder,
  autoCompleteByElapsed,
  getNextPendingByTimestamp,
  getSimulationBaseline,
} from "../lib/dispatch.js";

const router = Router();

router.get("/assignments", (_req, res) => {
  res.json(getAssignments());
});

router.post("/dispatch", (req, res) => {
  const { orderId } = req.body as { orderId?: string };
  if (!orderId) {
    res.status(400).json({ error: "orderId is required" });
    return;
  }
  const result = dispatchOrder(orderId);
  res.json(result);
});

router.post("/dispatch/batch", (_req, res) => {
  const result = dispatchBatch();
  res.json(result);
});

router.get("/metrics", (_req, res) => {
  res.json(getMetrics());
});

router.get("/metrics/agent-load", (_req, res) => {
  res.json(getAgentLoad());
});

router.get("/metrics/timeline", (_req, res) => {
  res.json(getTimeline());
});

router.post("/simulation/reset", (_req, res) => {
  initState();
  const orders = getOrders();
  const agents = getAgents();
  res.json({
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === "pending").length,
    assignedOrders: orders.filter((o) => o.status === "assigned").length,
    totalAgents: agents.length,
  });
});

router.get("/simulation/status", (_req, res) => {
  const orders = getOrders();
  const agents = getAgents();
  res.json({
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === "pending").length,
    assignedOrders: orders.filter((o) => o.status === "assigned").length,
    totalAgents: agents.length,
  });
});

router.post("/simulation/step", (_req, res) => {
  const next = getNextPendingByTimestamp();
  if (!next) {
    res.json({ success: false, reason: "No pending orders", orderId: null });
    return;
  }
  const result = dispatchOrder(next.orderId);
  res.json({ ...result, timestamp: next.timestamp });
});

router.post("/simulation/auto-complete", (req, res) => {
  const { elapsedMinutes } = req.body as { elapsedMinutes?: number };
  if (elapsedMinutes == null) {
    res.status(400).json({ error: "elapsedMinutes is required" });
    return;
  }
  const completed = autoCompleteByElapsed(elapsedMinutes);
  res.json({ completed: completed.filter((r) => r.success).length, results: completed });
});

router.get("/simulation/baseline", (_req, res) => {
  const baseline = getSimulationBaseline();
  res.json({ baseline });
});

router.post("/orders/:orderId/complete", (req, res) => {
  const result = completeOrder(req.params.orderId);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

router.get("/grid", (_req, res) => {
  const edges = getEdgesData();
  res.json({
    edges: edges.map((e) => ({
      fromX: e.from_x,
      fromY: e.from_y,
      toX: e.to_x,
      toY: e.to_y,
      distanceMinutes: e.distance_minutes,
      delayMultiplier: e.delay_multiplier,
    })),
    gridSize: 10,
  });
});

export default router;
