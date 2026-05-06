import { Router } from "express";
import { getOrders, getOrder } from "../lib/dispatch.js";

const router = Router();

router.get("/", (req, res) => {
  const status = req.query.status as string | undefined;
  res.json(getOrders(status));
});

router.get("/:orderId", (req, res) => {
  const order = getOrder(req.params.orderId);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(order);
});

export default router;
