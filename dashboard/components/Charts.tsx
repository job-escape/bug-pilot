"use client";

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const STATUS_COLORS = ["#22c55e", "#eab308", "#ef4444", "#6b7280"];
const FEATURE_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8", "#4f46e5", "#3730a3", "#312e81"];

interface PieData { name: string; value: number }
interface BarData { name: string; value: number }

export function StatusPie({ data }: { data: PieData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
          {data.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", color: "#e4e4e7" }} />
        <Legend wrapperStyle={{ color: "#a1a1aa", fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function FeaturePie({ data }: { data: PieData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
          {data.map((_, i) => <Cell key={i} fill={FEATURE_COLORS[i % FEATURE_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", color: "#e4e4e7" }} />
        <Legend wrapperStyle={{ color: "#a1a1aa", fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BuildBar({ data }: { data: BarData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
        <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
        <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", color: "#e4e4e7" }} />
        <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} name="Bugs" />
      </BarChart>
    </ResponsiveContainer>
  );
}
