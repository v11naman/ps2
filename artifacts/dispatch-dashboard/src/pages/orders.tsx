import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListOrders,
  getListOrdersQueryKey,
  useDispatchOrder,
  useListAssignments,
  getListAssignmentsQueryKey,
  useGetMetrics,
  getGetMetricsQueryKey,
  useGetTimeline,
  getGetTimelineQueryKey,
  useGetAgentLoad,
  getGetAgentLoadQueryKey,
  useListAgents,
  getListAgentsQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Zap, Filter, CheckCircle2, CheckCheck } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type StatusFilter = "all" | "pending" | "assigned" | "delivered" | "breached";

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: getListOrdersQueryKey(undefined) });
  qc.invalidateQueries({ queryKey: getListOrdersQueryKey({ status: "pending" }) });
  qc.invalidateQueries({ queryKey: getListOrdersQueryKey({ status: "assigned" }) });
  qc.invalidateQueries({ queryKey: getListOrdersQueryKey({ status: "delivered" }) });
  qc.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
  qc.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
  qc.invalidateQueries({ queryKey: getGetTimelineQueryKey() });
  qc.invalidateQueries({ queryKey: getGetAgentLoadQueryKey() });
  qc.invalidateQueries({ queryKey: getListAgentsQueryKey() });
}

function priorityBadge(p: string) {
  const cls =
    p === "high" ? "border-red-500/60 text-red-400 bg-red-500/10" :
    p === "normal" ? "border-yellow-500/60 text-yellow-400 bg-yellow-500/10" :
    "border-slate-500/60 text-slate-400 bg-slate-500/10";
  return <Badge variant="outline" className={`text-[10px] font-mono ${cls}`}>{p.toUpperCase()}</Badge>;
}

function statusBadge(s: string) {
  const cls =
    s === "pending" ? "border-blue-500/60 text-blue-400 bg-blue-500/10" :
    s === "assigned" ? "border-yellow-500/60 text-yellow-400 bg-yellow-500/10" :
    s === "delivered" ? "border-green-500/60 text-green-400 bg-green-500/10" :
    s === "breached" ? "border-red-500/60 text-red-400 bg-red-500/10" :
    "border-slate-500/60 text-slate-400 bg-slate-500/10";
  return <Badge variant="outline" className={`text-[10px] font-mono ${cls}`}>{s.toUpperCase()}</Badge>;
}

export default function Orders() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [completingAll, setCompletingAll] = useState(false);

  const { data: orders, isLoading } = useListOrders(
    filter !== "all" ? { status: filter as "pending" | "assigned" | "delivered" | "breached" } : undefined,
    {
      query: {
        queryKey: getListOrdersQueryKey(filter !== "all" ? { status: filter as "pending" | "assigned" | "delivered" | "breached" } : undefined),
        refetchInterval: 5000
      }
    }
  );

  const { data: allOrders } = useListOrders(undefined, {
    query: { queryKey: getListOrdersQueryKey(undefined) }
  });

  const dispatchOrder = useDispatchOrder({
    mutation: {
      onSuccess: (result) => {
        if (result.success) {
          invalidateAll(qc);
          toast({ title: `Assigned ${result.orderId}`, description: `Agent ${result.assignedAgentId} — ETA ${result.estimatedDeliveryMinutes?.toFixed(1)}m` });
        } else {
          toast({ title: "Dispatch failed", description: result.reason ?? "No available agents", variant: "destructive" });
        }
      }
    }
  });

  const handleComplete = async (orderId: string) => {
    setCompleting((s) => new Set(s).add(orderId));
    try {
      const res = await fetch(`${BASE_URL}/api/orders/${orderId}/complete`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        invalidateAll(qc);
        toast({ title: `Order ${orderId} delivered`, description: `Agent ${data.agentId} is now free` });
      } else {
        toast({ title: "Complete failed", description: data.reason ?? "Unknown error", variant: "destructive" });
      }
    } finally {
      setCompleting((s) => { const n = new Set(s); n.delete(orderId); return n; });
    }
  };

  const handleCompleteAll = async () => {
    const assigned = allOrders?.filter((o) => o.status === "assigned") ?? [];
    if (assigned.length === 0) {
      toast({ title: "No assigned orders", description: "There are no active orders to complete" });
      return;
    }
    setCompletingAll(true);
    try {
      await Promise.all(assigned.map((o) =>
        fetch(`${BASE_URL}/api/orders/${o.orderId}/complete`, { method: "POST" })
      ));
      invalidateAll(qc);
      toast({ title: `${assigned.length} orders delivered`, description: "All agents are now free for new assignments" });
    } finally {
      setCompletingAll(false);
    }
  };

  const assignedCount = allOrders?.filter((o) => o.status === "assigned").length ?? 0;
  const filters: StatusFilter[] = ["all", "pending", "assigned", "delivered"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-bold tracking-tight">Orders</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {assignedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 border-green-500/40 text-green-400 hover:bg-green-500/10"
              onClick={handleCompleteAll}
              disabled={completingAll}
              data-testid="button-complete-all"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {completingAll ? "Completing..." : `Complete All (${assignedCount})`}
            </Button>
          )}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            {filters.map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilter(f)}
                data-testid={`filter-${f}`}
              >
                {f.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-card hover:bg-card">
              <TableHead className="text-xs text-muted-foreground w-20">ORDER</TableHead>
              <TableHead className="text-xs text-muted-foreground">TIME</TableHead>
              <TableHead className="text-xs text-muted-foreground">LOC</TableHead>
              <TableHead className="text-xs text-muted-foreground">PREP</TableHead>
              <TableHead className="text-xs text-muted-foreground">SLA</TableHead>
              <TableHead className="text-xs text-muted-foreground">PRIORITY</TableHead>
              <TableHead className="text-xs text-muted-foreground">STATUS</TableHead>
              <TableHead className="text-xs text-muted-foreground">AGENT</TableHead>
              <TableHead className="text-xs text-muted-foreground">ETA</TableHead>
              <TableHead className="text-xs text-muted-foreground w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : orders?.map((order) => (
                  <TableRow
                    key={order.orderId}
                    className={`border-border text-xs font-mono ${order.status === "delivered" ? "opacity-50" : ""}`}
                    data-testid={`row-order-${order.orderId}`}
                  >
                    <TableCell className="text-primary font-bold">{order.orderId}</TableCell>
                    <TableCell className="text-muted-foreground">{order.timestamp.slice(11, 16)}</TableCell>
                    <TableCell>({order.locationX},{order.locationY})</TableCell>
                    <TableCell>{order.prepTimeMinutes}m</TableCell>
                    <TableCell className={order.estimatedDeliveryMinutes && order.estimatedDeliveryMinutes > order.slaMinutes ? "text-destructive" : ""}>
                      {order.slaMinutes}m
                    </TableCell>
                    <TableCell>{priorityBadge(order.priority)}</TableCell>
                    <TableCell>{statusBadge(order.status)}</TableCell>
                    <TableCell className="text-primary">{order.assignedAgentId ?? "—"}</TableCell>
                    <TableCell>
                      {order.estimatedDeliveryMinutes != null ? (
                        <span className={order.estimatedDeliveryMinutes > order.slaMinutes ? "text-destructive" : "text-green-400"}>
                          {order.estimatedDeliveryMinutes.toFixed(1)}m
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {order.status === "pending" && (
                        <Button
                          size="sm" variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={() => dispatchOrder.mutate({ data: { orderId: order.orderId } })}
                          disabled={dispatchOrder.isPending}
                          data-testid={`button-dispatch-${order.orderId}`}
                        >
                          <Zap className="w-3 h-3 mr-1" />Dispatch
                        </Button>
                      )}
                      {order.status === "assigned" && (
                        <Button
                          size="sm" variant="outline"
                          className="h-6 text-[10px] px-2 border-green-500/40 text-green-400 hover:bg-green-500/10"
                          onClick={() => handleComplete(order.orderId)}
                          disabled={completing.has(order.orderId)}
                          data-testid={`button-complete-${order.orderId}`}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {completing.has(order.orderId) ? "..." : "Complete"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {orders && (
        <div className="text-xs text-muted-foreground font-mono">
          {orders.length} orders · {orders.filter((o) => o.status === "pending").length} pending · {orders.filter((o) => o.status === "assigned").length} assigned · {orders.filter((o) => o.status === "delivered").length} delivered
        </div>
      )}
    </div>
  );
}
