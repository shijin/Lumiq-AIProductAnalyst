'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'

interface Props {
  data: { name: string; value: number }[]
}

const INTENT_COLORS: Record<string, string> = {
  bug: '#ef4444',
  complaint: '#f97316',
  feature_request: '#3b82f6',
  churn_signal: '#8b5cf6',
  pricing_feedback: '#eab308',
  praise: '#10b981',
  question: '#94a3b8',
}

export function IntentChart({ data }: Props) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">
        Intent Distribution
      </h3>
      <p className="text-xs text-slate-400 mb-4">
        What users are trying to communicate
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 16, right: 16 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#64748b' }}
            width={110}
            tickFormatter={(v) => v.replace('_', ' ')}
          />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            formatter={(value: number) => [value, 'Feedback rows']}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={INTENT_COLORS[entry.name] || '#94a3b8'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}