'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props { data: { name: string; value: number }[] }

const COLORS: Record<string, string> = {
  bug:              '#EF4444',
  complaint:        '#F97316',
  feature_request:  '#3B82F6',
  churn_signal:     '#8B5CF6',
  pricing_feedback: '#F59E0B',
  praise:           '#22C55E',
  question:         '#94A3B8',
}

export function IntentChart({ data }: Props) {
  return (
    <div className="anim-scale-in d-300 card p-6">
      <div className="mb-5">
        <h3 className="font-display text-base font-semibold"
          style={{ color: 'var(--text-primary)' }}>
          Intent Distribution
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          What users are trying to communicate
        </p>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} layout="vertical"
          margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name"
            tick={{ fontSize: 11, fill: 'var(--text-secondary)', fontFamily: 'Satoshi' }}
            width={115} axisLine={false} tickLine={false}
            tickFormatter={v => v.replace(/_/g, ' ')}
          />
          <Tooltip
            cursor={{ fill: 'var(--bg-card-hover)', radius: 6 }}
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-md)'
            }}
            formatter={(v: number) => [v, 'Feedback rows']}
          />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}
            animationBegin={400} animationDuration={900}>
            {data.map((e, i) => (
              <Cell key={i} fill={COLORS[e.name] || '#94A3B8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}