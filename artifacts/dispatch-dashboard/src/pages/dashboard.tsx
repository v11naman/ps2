import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMetrics,
  getGetMetricsQueryKey,
  useGetAgentLoad,
  getGetAgentLoadQueryKey,
  useGetTimeline,
  getGetTimelineQueryKey,
  useGetGrid,
  getGetGridQueryKey,
  useListAgents,
  getListAgentsQueryKey,
  useListOrders,
  getListOrdersQueryKey,
  useListAssignments,
  getListAssignmentsQueryKey,
  useDispatchBatch,
  useResetSimulation,
  getGetSimulationStatusQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, AlertTriangle, Clock, RefreshCw, Zap, Users, Package,
  Play, Pause, SkipForward, FastForward
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const SIM_BASELINE_EPOCH = new Date("2026-05-03T09:00:00").getTime();
const SPEED_OPTIONS = [1, 5, 10, 30, 60] as const;
type Speed = (typeof SPEED_OPTIONS)[number];

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
  qc.invalidateQueries({ queryKey: getListAgentsQueryKey() });
  qc.invalidateQueries({ queryKey: getListOrdersQueryKey(undefined) });
  qc.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
  qc.invalidateQueries({ queryKey: getGetTimelineQueryKey() });
  qc.invalidateQueries({ queryKey: getGetAgentLoadQueryKey() });
  qc.invalidateQueries({ queryKey: getGetSimulationStatusQueryKey() });
}

function GridMap() {
  const { data: grid } = useGetGrid({ query: { queryKey: getGetGridQueryKey() } });
  const { data: agents } = useListAgents({ query: { queryKey: getListAgentsQueryKey() } });
  const { data: orders } = useListOrders(undefined, { query: { queryKey: getListOrdersQueryKey(undefined) } });
  const { data: assignments } = useListAssignments({ query: { queryKey: getListAssignmentsQueryKey() } });

  const SIZE = 300;
  const CELL = SIZE / 10;
  const PAD = 20;
  const TOTAL = SIZE + PAD * 2;
  const toSvg = (v: number) => PAD + v * CELL + CELL / 2;

  if (!grid) return <Skeleton className="w-full h-64" />;

  return (
    <svg width="100%" viewBox={`0 0 ${TOTAL} ${TOTAL}`} className="rounded-md bg-card border border-border">
      {Array.from({ length: 11 }, (_, i) => (
        <g key={i}>
          <line x1={PAD + i * CELL} y1={PAD} x2={PAD + i * CELL} y2={PAD + SIZE} stroke="hsl(var(--border))" strokeWidth={0.5} />
          <line x1={PAD} y1={PAD + i * CELL} x2={PAD + SIZE} y2={PAD + i * CELL} stroke="hsl(var(--border))" strokeWidth={0.5} />
        </g>
      ))}
      {grid.edges.map((edge, i) => (
        <line
          key={i}
          x1={toSvg(edge.fromX)} y1={toSvg(edge.fromY)}
          x2={toSvg(edge.toX)} y2={toSvg(edge.toY)}
          stroke={edge.delayMultiplier > 1.1 ? "hsl(45 90% 55%)" : "hsl(var(--primary))"}
          strokeWidth={edge.delayMultiplier > 1.1 ? 1.2 : 0.6}
          opacity={edge.delayMultiplier > 1.1 ? 0.5 : 0.2}
        />
      ))}
      {assignments?.slice(-15).map((asgn, i) =>
        asgn.pathX.length > 1 && (
          <polyline
            key={i}
            points={asgn.pathX.map((x, j) => `${toSvg(x)},${toSvg(asgn.pathY[j])}`).join(" ")}
            fill="none" stroke="hsl(var(--primary))" strokeWidth={1} opacity={0.3} strokeDasharray="3,3"
          />
        )
      )}
      {orders?.filter((o) => o.status === "pending").map((order) => (
        <rect
          key={order.orderId}
          x={toSvg(order.locationX) - 4} y={toSvg(order.locationY) - 4}
          width={8} height={8} rx={1} opacity={0.85}
          fill={order.priority === "high" ? "hsl(0 84% 60%)" : order.priority === "normal" ? "hsl(35 90% 55%)" : "hsl(215 20% 55%)"}
        />
      ))}
      {orders?.filter((o) => o.status === "assigned").map((order) => (
        <rect
          key={order.orderId}
          x={toSvg(order.locationX) - 3} y={toSvg(order.locationY) - 3}
          width={6} height={6} rx={1} opacity={0.5}
          fill="hsl(var(--primary))"
        />
      ))}
      {orders?.filter((o) => o.status === "delivered").map((order) => (
        <circle
          key={order.orderId}
          cx={toSvg(order.locationX)} cy={toSvg(order.locationY)}
          r={3} opacity={0.25}
          fill="hsl(142 70% 50%)"
        />
      ))}
      {agents?.map((agent) => {
        const color = agent.status === "idle" ? "hsl(142 70% 50%)" : agent.status === "busy" ? "hsl(45 90% 55%)" : "hsl(0 84% 60%)";
        return (
          <g key={agent.agentId}>
            <circle cx={toSvg(agent.currentX)} cy={toSvg(agent.currentY)} r={5} fill={color} opacity={0.9} />
            <circle cx={toSvg(agent.currentX)} cy={toSvg(agent.currentY)} r={9} fill="none" stroke={color} strokeWidth={0.8} opacity={0.35} />
          </g>
        );
      })}
      {[0, 2, 4, 6, 8].map((v) => (
        <text key={v} x={toSvg(v)} y={PAD - 6} textAnchor="middle" fontSize={7} fill="hsl(var(--muted-foreground))">{v}</text>
      ))}
    </svg>
  );
}

function MetricCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">{title}</span>
          <Icon className={`w-4 h-4 ${color ?? "text-primary"}`} />
        </div>
        <div className="text-2xl font-bold font-mono">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function slaStatusColor(s: string) {
  if (s === "breached") return "text-destructive";
  if (s === "at_risk") return "text-yellow-400";
  return "text-green-400";
}

function SimulationBar({
  playing, onToggle, speed, onSpeedChange, simElapsed, dispatched, onStep
}: {
  playing: boolean;
  onToggle: () => void;
  speed: Speed;
  onSpeedChange: (s: Speed) => void;
  simElapsed: number;
  dispatched: number;
  onStep: () => void;
}) {
  const simTime = new Date(SIM_BASELINE_EPOCH + simElapsed * 60 * 1000);
  const hh = simTime.getUTCHours().toString().padStart(2, "0");
  const mm = simTime.getUTCMinutes().toString().padStart(2, "0");
  const ss = simTime.getUTCSeconds().toString().padStart(2, "0");

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-md border border-border bg-card text-xs font-mono">
      <span className="text-muted-foreground uppercase tracking-widest text-[10px]">Simulation</span>

      <Button
        size="sm"
        variant={playing ? "default" : "outline"}
        className="h-7 px-3 gap-1.5"
        onClick={onToggle}
        data-testid="button-sim-toggle"
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        {playing ? "Pause" : "Play"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2"
        onClick={onStep}
        disabled={playing}
        data-testid="button-sim-step"
        title="Dispatch next order"
      >
        <SkipForward className="w-3.5 h-3.5" />
      </Button>

      <div className="flex items-center gap-1">
        <FastForward className="w-3 h-3 text-muted-foreground" />
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
              speed === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`button-speed-${s}x`}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-primary tabular-nums">{hh}:{mm}:{ss}</span>
          <span className="text-muted-foreground text-[9px]">sim</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="text-foreground">{dispatched}</span> dispatched
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: metrics, isLoading: mLoading } = useGetMetrics({
    query: { queryKey: getGetMetricsQueryKey(), refetchInterval: 10000 }
  });
  const { data: timeline } = useGetTimeline({
    query: { queryKey: getGetTimelineQueryKey(), refetchInterval: 10000 }
  });

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(10);
  const [simElapsed, setSimElapsed] = useState(0);
  const [dispatched, setDispatched] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simElapsedRef = useRef(simElapsed);
  simElapsedRef.current = simElapsed;

  const dispatchBatch = useDispatchBatch({
    mutation: {
      onSuccess: () => {
        invalidateAll(qc);
        toast({ title: "Dispatch complete", description: "All pending orders dispatched" });
      }
    }
  });

  const resetSim = useResetSimulation({
    mutation: {
      onSuccess: () => {
        invalidateAll(qc);
        setPlaying(false);
        setSimElapsed(0);
        setDispatched(0);
        toast({ title: "Simulation reset", description: "State restored to initial" });
      }
    }
  });

  const runTick = useCallback(async () => {
    const elapsed = simElapsedRef.current;
    const newElapsed = elapsed + speed;
    setSimElapsed(newElapsed);

    try {
      const [stepRes, _autoRes] = await Promise.all([
        fetch(`${BASE_URL}/api/simulation/step`, { method: "POST" }).then((r) => r.json()),
        fetch(`${BASE_URL}/api/simulation/auto-complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ elapsedMinutes: newElapsed }),
        }).then((r) => r.json()),
      ]);

      if (stepRes?.success) {
        setDispatched((d) => d + 1);
      } else if (stepRes?.reason === "No pending orders") {
        setPlaying(false);
      }

      invalidateAll(qc);
    } catch {
      // silently continue
    }
  }, [speed, qc]);

  useEffect(() => {
    if (playing) {
      tickRef.current = setInterval(runTick, 800);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [playing, runTick]);

  const handleStep = async () => {
    const newElapsed = simElapsedRef.current + speed;
    setSimElapsed(newElapsed);
    try {
      const [stepRes] = await Promise.all([
        fetch(`${BASE_URL}/api/simulation/step`, { method: "POST" }).then((r) => r.json()),
        fetch(`${BASE_URL}/api/simulation/auto-complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ elapsedMinutes: newElapsed }),
        }),
      ]);
      if (stepRes?.success) setDispatched((d) => d + 1);
      invalidateAll(qc);
    } catch {
      // silently continue
    }
  };

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const deliveredCount = (metrics as any)?.deliveredOrders ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Dispatch Operations</h1>
          <p className="text-xs text-muted-foreground font-mono">{now.toISOString().replace("T", " ").slice(0, 19)} UTC</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm" variant="outline"
            onClick={() => resetSim.mutate({})}
            disabled={resetSim.isPending}
            data-testid="button-reset-simulation"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={() => dispatchBatch.mutate({})}
            disabled={dispatchBatch.isPending}
            data-testid="button-dispatch-all"
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            {dispatchBatch.isPending ? "Dispatching..." : "Dispatch All"}
          </Button>
        </div>
      </div>

      {/* Simulation bar */}
      <SimulationBar
        playing={playing}
        onToggle={() => setPlaying((p) => !p)}
        speed={speed}
        onSpeedChange={setSpeed}
        simElapsed={simElapsed}
        dispatched={dispatched}
        onStep={handleStep}
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {mLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
          <>
            <MetricCard
              title="Total Orders" value={metrics?.totalOrders ?? 0}
              sub={`${metrics?.pendingOrders ?? 0} pending · ${metrics?.assignedOrders ?? 0} active`}
              icon={Package}
            />
            <MetricCard
              title="SLA Breach Rate"
              value={`${((metrics?.slaBreachRate ?? 0) * 100).toFixed(1)}%`}
              sub={`${metrics?.slaBreachCount ?? 0} breached`}
              icon={AlertTriangle}
              color={(metrics?.slaBreachRate ?? 0) > 0.1 ? "text-destructive" : "text-green-400"}
            />
            <MetricCard
              title="Avg Delivery"
              value={`${(metrics?.avgDeliveryTimeMinutes ?? 0).toFixed(1)}m`}
              sub="estimated"
              icon={Clock}
            />
            <MetricCard
              title="Active Agents"
              value={`${metrics?.activeAgents ?? 0}/${metrics?.totalAgents ?? 0}`}
              sub={`variance: ${(metrics?.loadVariance ?? 0).toFixed(2)}`}
              icon={Users}
            />
          </>
        )}
      </div>

      {/* Map + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Idle</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> Busy</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Full</span>
            <span className="flex items-center gap-1.5 ml-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Pending-High</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block opacity-50" /> Assigned</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block opacity-30" /> Delivered</span>
          </div>
          <GridMap />
        </div>

        <div className="lg:col-span-2">
          <Card className="border-border h-full">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Assignment Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ScrollArea className="h-72">
                {!timeline || timeline.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                    Press Play or click Dispatch All to begin.
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {[...timeline].reverse().slice(0, 40).map((ev, i) => (
                      <div key={i} className="flex items-center gap-2 px-4 py-1.5 border-b border-border/40 text-xs last:border-0">
                        <span className="font-mono text-muted-foreground shrink-0">{ev.orderId}</span>
                        <span className="text-muted-foreground shrink-0">→</span>
                        <span className="font-mono text-primary shrink-0">{ev.agentId}</span>
                        <Badge
                          variant="outline"
                          className={`ml-auto text-[10px] px-1 py-0 shrink-0 ${
                            ev.priority === "high" ? "border-red-500/50 text-red-400" :
                            ev.priority === "normal" ? "border-yellow-500/50 text-yellow-400" :
                            "border-slate-500/50 text-slate-400"
                          }`}
                        >
                          {ev.priority}
                        </Badge>
                        <span className={`shrink-0 ${slaStatusColor(ev.slaStatus)}`}>
                          {ev.slaStatus === "breached" ? "!" : ev.slaStatus === "at_risk" ? "~" : "OK"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="pt-3 pb-3 text-xs">
            <div className="text-muted-foreground mb-1 uppercase tracking-widest">Assigned</div>
            <div className="text-xl font-bold font-mono text-primary">{metrics?.assignedOrders ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-3 pb-3 text-xs">
            <div className="text-muted-foreground mb-1 uppercase tracking-widest">Pending</div>
            <div className="text-xl font-bold font-mono text-yellow-400">{metrics?.pendingOrders ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-3 pb-3 text-xs">
            <div className="text-muted-foreground mb-1 uppercase tracking-widest">Delivered</div>
            <div className="text-xl font-bold font-mono text-green-400">{dispatched}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-3 pb-3 text-xs">
            <div className="text-muted-foreground mb-1 uppercase tracking-widest">Load Variance</div>
            <div className={`text-xl font-bold font-mono ${(metrics?.loadVariance ?? 0) > 0.5 ? "text-yellow-400" : "text-green-400"}`}>
              {(metrics?.loadVariance ?? 0).toFixed(3)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
