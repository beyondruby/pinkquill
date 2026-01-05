"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { FollowerGrowthData, MemberGrowthData } from "@/lib/hooks/useInsights";

interface GrowthChartProps {
  data: FollowerGrowthData | MemberGrowthData;
  title?: string;
  height?: number;
  type?: "followers" | "members";
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

export default function GrowthChart({
  data,
  title = "Growth",
  height = 300,
  type = "followers",
}: GrowthChartProps) {
  const chartData = data.history.map((d) => ({
    ...d,
    dateLabel: formatDate(d.date),
  }));

  const hasPositiveGrowth = data.netChange > 0;
  const hasNegativeGrowth = data.netChange < 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="bg-white px-4 py-3 rounded-xl shadow-lg border border-black/10">
          <p className="font-ui text-sm text-ink font-medium mb-1">{label}</p>
          <div className="space-y-1">
            <p className="font-body text-sm text-muted">
              Count:{" "}
              <span className="text-purple-primary font-medium">
                {formatNumber(point.count || 0)}
              </span>
            </p>
            <p className="font-body text-sm text-muted">
              Change:{" "}
              <span
                className={`font-medium ${
                  point.netChange > 0
                    ? "text-green-500"
                    : point.netChange < 0
                    ? "text-red-500"
                    : "text-muted"
                }`}
              >
                {point.netChange > 0 ? "+" : ""}
                {point.netChange || 0}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (data.history.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
        <h3 className="font-ui text-sm font-medium text-ink mb-4">{title}</h3>
        <div
          className="flex items-center justify-center text-muted font-body text-sm"
          style={{ height }}
        >
          No growth data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-ui text-sm font-medium text-ink">{title}</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-body text-xs text-muted">
              {type === "followers" ? "Gained" : "Joined"}
            </span>
            <span className="font-ui text-sm text-green-500 font-medium">
              +{"gained" in data ? data.gained : data.joined}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-body text-xs text-muted">{type === "followers" ? "Lost" : "Left"}</span>
            <span className="font-ui text-sm text-red-500 font-medium">
              -{"lost" in data ? data.lost : data.left}
            </span>
          </div>
          <div className="flex items-center gap-2 pl-2 border-l border-black/10">
            <span className="font-body text-xs text-muted">Net</span>
            <span
              className={`font-ui text-sm font-medium ${
                hasPositiveGrowth
                  ? "text-green-500"
                  : hasNegativeGrowth
                  ? "text-red-500"
                  : "text-muted"
              }`}
            >
              {data.netChange > 0 ? "+" : ""}
              {data.netChange}
            </span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={hasPositiveGrowth ? "#22c55e" : "#8e44ad"}
                stopOpacity={0.2}
              />
              <stop
                offset="95%"
                stopColor={hasPositiveGrowth ? "#22c55e" : "#8e44ad"}
                stopOpacity={0}
              />
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
            dataKey="count"
            stroke={hasPositiveGrowth ? "#22c55e" : "#8e44ad"}
            strokeWidth={2}
            fill="url(#growthGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
