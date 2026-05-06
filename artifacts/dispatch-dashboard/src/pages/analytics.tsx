import {
  useGetMetrics,
  getGetMetricsQueryKey,
  useGetAgentLoad,
  getGetAgentLoadQueryKey,
  useGetTimeline,
  getGetTimelineQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend
} from "recharts";

const COLORS = {
  primary: "hsl(190, 90%, 50%)",
  yellow: "hsl(45, 90%, 55%)",
  red: "hsl(0, 84%, 60%)",
  green: "hsl(142, 70%, 50%)",
  muted: "hsl(215, 20%, 45%)",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border px-3 py-2 rounded text-xs font-mono">
        <div className="text-muted-foreground mb-1">{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}</div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const { data: metrics, isLoading: mLoading } = useGetMetrics({
    query: { queryKey: getGetMetricsQueryKey(), refetchInterval: 10000 }
  });
  const { data: agentLoad, isLoading: aLoading } = useGetAgentLoad({
    query: { queryKey: getGetAgentLoadQueryKey(), refetchInterval: 10000 }
  });
  const { data: timeline } = useGetTimeline({
    query: { queryKey: getGetTimelineQueryKey(), refetchInterval: 10000 }
  });

  const slaData = metrics ? [
    { name: "On Track", value: (metrics.assignedOrders - metrics.slaBreachCount) },
    { name: "Breached", value: metrics.slaBreachCount },
  ] : [];

  const priorityCounts = timeline?.reduce((acc, ev) => {
    acc[ev.priority] = (acc[ev.priority] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  const priorityData = Object.entries(priorityCounts).map(([k, v]) => ({ name: k, count: v }));

  const timelineChartData = timeline?.slice(-30).map((ev, i) => ({
    i: i + 1,
    eta: ev.estimatedMinutes,
    sla: ev.slaMinutes,
    priority: ev.priority,
  })) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold tracking-tight">Performance Analytics</h1>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {mLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />) : (
          <>
            <Card className="border-border">
              <CardContent className="pt-3 pb-3">
                <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">SLA Breach Rate</div>
                <div className={`text-2xl font-bold font-mono ${(metrics?.slaBreachRate ?? 0) > 0.1 ? "text-destructive" : "text-green-400"}`}>
                  {((metrics?.slaBreachRate ?? 0) * 100).toFixed(1)}%
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-3 pb-3">
                <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Avg Delivery</div>
                <div className="text-2xl font-bold font-mono text-primary">
                  {(metrics?.avgDeliveryTimeMinutes ?? 0).toFixed(1)}m
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-3 pb-3">
                <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Load Variance</div>
                <div className={`text-2xl font-bold font-mono ${(metrics?.loadVariance ?? 0) > 0.5 ? "text-yellow-400" : "text-green-400"}`}>
                  {(metrics?.loadVariance ?? 0).toFixed(3)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-3 pb-3">
                <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Utilization</div>
                <div className="text-2xl font-bold font-mono text-primary">
                  {metrics?.totalAgents ? `${((metrics.activeAgents / metrics.totalAgents) * 100).toFixed(0)}%` : "0%"}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agent Load Distribution */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Agent Load Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {aLoading ? <Skeleton className="h-48" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={agentLoad} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="agentId" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "monospace" }} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="totalDeliveries" name="Deliveries" fill={COLORS.primary} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* SLA Breakdown Pie */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">SLA Compliance</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {mLoading ? <Skeleton className="h-48" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={slaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    <Cell fill={COLORS.green} />
                    <Cell fill={COLORS.red} />
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace" }} />
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ETA vs SLA Timeline */}
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">ETA vs SLA — Last 30 Assignments</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {timelineChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">No assignment data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={timelineChartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="i" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="eta" name="ETA (min)" stroke={COLORS.primary} strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="sla" name="SLA (min)" stroke={COLORS.yellow} strokeWidth={1} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Priority breakdown */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Orders by Priority</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {priorityData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={priorityData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "monospace" }} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Count" radius={[2, 2, 0, 0]}>
                    <Cell fill={COLORS.red} />
                    <Cell fill={COLORS.yellow} />
                    <Cell fill={COLORS.muted} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Agent Rating vs Breach Count */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Agent Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {aLoading ? <Skeleton className="h-48" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={agentLoad} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="agentId" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "monospace" }} />
                  <YAxis domain={[4, 5]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="rating" name="Rating" fill={COLORS.yellow} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
