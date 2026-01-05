"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { TrafficSource } from "@/lib/hooks/useInsights";

interface TrafficSourcesChartProps {
  data: TrafficSource[];
  title?: string;
  height?: number;
}

const COLORS = ["#8e44ad", "#ff007f", "#ff9f43", "#3498db", "#2ecc71", "#9b59b6"];

const sourceLabels: Record<string, string> = {
  feed: "Feed",
  search: "Search",
  profile: "Profile",
  community: "Community",
  direct: "Direct Link",
  relay: "Relay",
};

export default function TrafficSourcesChart({
  data,
  title = "Traffic Sources",
  height = 300,
}: TrafficSourcesChartProps) {
  const chartData = data.map((d, i) => ({
    name: sourceLabels[d.source] || d.source,
    value: d.count,
    percentage: d.percentage,
    color: COLORS[i % COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-4 py-3 rounded-xl shadow-lg border border-black/10">
          <p className="font-ui text-sm text-ink font-medium mb-1">{data.name}</p>
          <p className="font-body text-sm text-muted">
            <span className="font-medium" style={{ color: data.color }}>
              {data.value.toLocaleString()}
            </span>{" "}
            views ({data.percentage.toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = () => (
    <div className="flex flex-wrap gap-3 justify-center mt-4">
      {chartData.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="font-ui text-xs text-muted">
            {entry.name} ({entry.percentage.toFixed(0)}%)
          </span>
        </div>
      ))}
    </div>
  );

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
        <h3 className="font-ui text-sm font-medium text-ink mb-4">{title}</h3>
        <div
          className="flex items-center justify-center text-muted font-body text-sm"
          style={{ height }}
        >
          No traffic data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
      <h3 className="font-ui text-sm font-medium text-ink mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {renderLegend()}
    </div>
  );
}
