import {
  useListAgents,
  getListAgentsQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MapPin, Package, AlertTriangle } from "lucide-react";

function statusBadge(s: string) {
  const cls =
    s === "idle" ? "border-green-500/60 text-green-400 bg-green-500/10" :
    s === "busy" ? "border-yellow-500/60 text-yellow-400 bg-yellow-500/10" :
    "border-red-500/60 text-red-400 bg-red-500/10";
  return <Badge variant="outline" className={`text-[10px] ${cls}`}>{s.toUpperCase()}</Badge>;
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground font-mono">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function Agents() {
  const { data: agents, isLoading } = useListAgents({
    query: { queryKey: getListAgentsQueryKey(), refetchInterval: 5000 }
  });

  const idle = agents?.filter((a) => a.status === "idle").length ?? 0;
  const busy = agents?.filter((a) => a.status === "busy").length ?? 0;
  const full = agents?.filter((a) => a.status === "full").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">Agent Fleet</h1>
        <div className="flex gap-3 text-xs font-mono">
          <span className="text-green-400">{idle} idle</span>
          <span className="text-yellow-400">{busy} busy</span>
          <span className="text-red-400">{full} full</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {isLoading
          ? Array.from({ length: 15 }).map((_, i) => <Skeleton key={i} className="h-36" />)
          : agents?.map((agent) => (
              <Card
                key={agent.agentId}
                className={`border-border hover:border-primary/40 transition-colors ${agent.status === "full" ? "border-red-500/30" : ""}`}
                data-testid={`card-agent-${agent.agentId}`}
              >
                <CardContent className="pt-3 pb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-primary text-sm">{agent.agentId}</span>
                    {statusBadge(agent.status)}
                  </div>

                  <RatingStars rating={agent.rating} />

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span className="font-mono">({agent.currentX},{agent.currentY})</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Package className="w-3 h-3" />
                      <span>{agent.activeOrders}/2 active</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Package className="w-3 h-3 opacity-50" />
                      <span>{agent.totalDeliveries} done</span>
                    </div>
                  </div>

                  {agent.slaBreaches > 0 && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{agent.slaBreaches} breach{agent.slaBreaches > 1 ? "es" : ""}</span>
                    </div>
                  )}

                  <div className="w-full bg-muted rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all ${
                        agent.activeOrders === 0 ? "bg-green-400" :
                        agent.activeOrders === 1 ? "bg-yellow-400" :
                        "bg-red-500"
                      }`}
                      style={{ width: `${(agent.activeOrders / 2) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}
