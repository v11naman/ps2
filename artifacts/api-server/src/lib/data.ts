import path from "path";
import fs from "fs";

const DATA_DIR = path.resolve(process.cwd(), "../../attached_assets");

export interface RawAgent {
  agent_id: string;
  current_x: number;
  current_y: number;
  rating: number;
}

export interface RawOrder {
  order_id: string;
  timestamp: string;
  location_x: number;
  location_y: number;
  prep_time_minutes: number;
  priority: "high" | "normal" | "low";
  sla_minutes: number;
}

export interface RawEdge {
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  distance_minutes: number;
  delay_multiplier: number;
}

export interface RawConstraints {
  max_active_orders_per_agent: number;
  decision_latency_target_seconds: number;
  default_sla_minutes: number;
  priority_weight_high: number;
  priority_weight_normal: number;
  priority_weight_low: number;
}

function parseCSV(filename: string): Record<string, string>[] {
  const filepath = path.join(DATA_DIR, filename);
  const content = fs.readFileSync(filepath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = values[i] ?? "";
    });
    return record;
  });
}

export function loadAgents(): RawAgent[] {
  const rows = parseCSV("agents_1778050639810.csv");
  return rows.map((r) => ({
    agent_id: r.agent_id,
    current_x: parseFloat(r.current_x),
    current_y: parseFloat(r.current_y),
    rating: parseFloat(r.rating),
  }));
}

export function loadOrders(): RawOrder[] {
  const rows = parseCSV("orders_1778050639807.csv");
  return rows.map((r) => ({
    order_id: r.order_id,
    timestamp: r.timestamp,
    location_x: parseFloat(r.location_x),
    location_y: parseFloat(r.location_y),
    prep_time_minutes: parseFloat(r.prep_time_minutes),
    priority: r.priority as "high" | "normal" | "low",
    sla_minutes: parseFloat(r.sla_minutes),
  }));
}

export function loadEdges(): RawEdge[] {
  const rows = parseCSV("environment_edges_1778050639808.csv");
  return rows.map((r) => ({
    from_x: parseFloat(r.from_x),
    from_y: parseFloat(r.from_y),
    to_x: parseFloat(r.to_x),
    to_y: parseFloat(r.to_y),
    distance_minutes: parseFloat(r.distance_minutes),
    delay_multiplier: parseFloat(r.delay_multiplier),
  }));
}

export function loadConstraints(): RawConstraints {
  const rows = parseCSV("constraints_1778050639809.csv");
  const map: Record<string, string> = {};
  rows.forEach((r) => {
    if (r.constraint && r.value) {
      map[r.constraint] = r.value;
    }
  });
  return {
    max_active_orders_per_agent: parseInt(map.max_active_orders_per_agent ?? "2"),
    decision_latency_target_seconds: parseInt(map.decision_latency_target_seconds ?? "5"),
    default_sla_minutes: parseInt(map.default_sla_minutes ?? "50"),
    priority_weight_high: parseFloat(map.priority_weight_high ?? "1.5"),
    priority_weight_normal: parseFloat(map.priority_weight_normal ?? "1.0"),
    priority_weight_low: parseFloat(map.priority_weight_low ?? "0.8"),
  };
}
