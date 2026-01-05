"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { DailyStats } from "@/lib/hooks/useInsights";

interface ViewsChartProps {
  data: DailyStats[];
  title?: string;
  height?: number;
  showArea?: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export default function ViewsChart({
  data,
  title = "Views Over Time",
  height = 300,
  showArea = true,
}: ViewsChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    dateLabel: formatDate(d.date),
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 rounded-xl shadow-lg border border-black/10">
          <p className="font-ui text-sm text-ink font-medium mb-1">{label}</p>
          <p className="font-body text-sm text-muted">
            <span className="text-purple-primary font-medium">
              {formatNumber(payload[0].value)}
            </span>{" "}
            views
          </p>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
        <h3 className="font-ui text-sm font-medium text-ink mb-4">{title}</h3>
        <div
          className="flex items-center justify-center text-muted font-body text-sm"
          style={{ height }}
        >
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
      <h3 className="font-ui text-sm font-medium text-ink mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        {showArea ? (
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8e44ad" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#8e44ad" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 12, fill: "#777" }}
              tickLine={false}
              axisLine={{ stroke: "#f0f0f0" }}
            />
            <YAxis
              tickFormatter={formatNumber}
              tick={{ fontSize: 12, fill: "#777" }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="views"
              stroke="#8e44ad"
              strokeWidth={2}
              fill="url(#viewsGradient)"
            />
          </AreaChart>
        ) : (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 12, fill: "#777" }}
              tickLine={false}
              axisLine={{ stroke: "#f0f0f0" }}
            />
            <YAxis
              tickFormatter={formatNumber}
              tick={{ fontSize: 12, fill: "#777" }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="views"
              stroke="#8e44ad"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: "#8e44ad" }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
