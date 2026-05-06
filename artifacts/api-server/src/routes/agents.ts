import { Router } from "express";
import { getAgents, getAgent } from "../lib/dispatch.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json(getAgents());
});

router.get("/:agentId", (req, res) => {
  const agent = getAgent(req.params.agentId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(agent);
});

export default router;
