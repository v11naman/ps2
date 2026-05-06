import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import agentsRouter from "./agents.js";
import ordersRouter from "./orders.js";
import dispatchRouter from "./dispatch.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/agents", agentsRouter);
router.use("/orders", ordersRouter);
router.use(dispatchRouter);

export default router;
