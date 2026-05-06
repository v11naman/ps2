import {
  useListAssignments,
  getListAssignmentsQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { CheckCircle, AlertTriangle, Clock } from "lucide-react";

function slaBadge(s: string) {
  if (s === "breached") return (
    <Badge variant="outline" className="border-red-500/60 text-red-400 bg-red-500/10 text-[10px] gap-1">
      <AlertTriangle className="w-2.5 h-2.5" /> BREACHED
    </Badge>
  );
  if (s === "at_risk") return (
    <Badge variant="outline" className="border-yellow-500/60 text-yellow-400 bg-yellow-500/10 text-[10px] gap-1">
      <Clock className="w-2.5 h-2.5" /> AT RISK
    </Badge>
  );
  return (
    <Badge variant="outline" className="border-green-500/60 text-green-400 bg-green-500/10 text-[10px] gap-1">
      <CheckCircle className="w-2.5 h-2.5" /> ON TRACK
    </Badge>
  );
}

export default function Assignments() {
  const { data: assignments, isLoading } = useListAssignments({
    query: { queryKey: getListAssignmentsQueryKey(), refetchInterval: 5000 }
  });

  const breached = assignments?.filter((a) => a.slaStatus === "breached").length ?? 0;
  const atRisk = assignments?.filter((a) => a.slaStatus === "at_risk").length ?? 0;
  const onTrack = assignments?.filter((a) => a.slaStatus === "on_track").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">Assignment Log</h1>
        <div className="flex gap-3 text-xs font-mono">
          <span className="text-green-400">{onTrack} on track</span>
          <span className="text-yellow-400">{atRisk} at risk</span>
          <span className="text-red-400">{breached} breached</span>
        </div>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-card hover:bg-card">
              <TableHead className="text-xs text-muted-foreground">#</TableHead>
              <TableHead className="text-xs text-muted-foreground">ORDER</TableHead>
              <TableHead className="text-xs text-muted-foreground">AGENT</TableHead>
              <TableHead className="text-xs text-muted-foreground">ASSIGNED AT</TableHead>
              <TableHead className="text-xs text-muted-foreground">ETA</TableHead>
              <TableHead className="text-xs text-muted-foreground">SCORE</TableHead>
              <TableHead className="text-xs text-muted-foreground">PATH LENGTH</TableHead>
              <TableHead className="text-xs text-muted-foreground">SLA STATUS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : assignments?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-12">
                      No assignments yet. Go to the Dashboard and click Dispatch All.
                    </TableCell>
                  </TableRow>
                )
              : [...(assignments ?? [])].reverse().map((asgn) => (
                  <TableRow key={asgn.id} className="border-border text-xs font-mono" data-testid={`row-assignment-${asgn.id}`}>
                    <TableCell className="text-muted-foreground">{asgn.id}</TableCell>
                    <TableCell className="text-primary font-bold">{asgn.orderId}</TableCell>
                    <TableCell className="text-primary">{asgn.agentId}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(asgn.assignedAt).toISOString().slice(11, 19)}
                    </TableCell>
                    <TableCell className={asgn.slaStatus === "breached" ? "text-destructive" : asgn.slaStatus === "at_risk" ? "text-yellow-400" : "text-green-400"}>
                      {asgn.estimatedDeliveryMinutes.toFixed(1)}m
                    </TableCell>
                    <TableCell className="text-muted-foreground">{asgn.agentScore.toFixed(4)}</TableCell>
                    <TableCell className="text-muted-foreground">{asgn.pathX.length} nodes</TableCell>
                    <TableCell>{slaBadge(asgn.slaStatus)}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {assignments && assignments.length > 0 && (
        <div className="text-xs text-muted-foreground font-mono">
          {assignments.length} total assignments
        </div>
      )}
    </div>
  );
}
