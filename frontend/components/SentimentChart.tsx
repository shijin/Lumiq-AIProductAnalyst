'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Props { data: { name: string; value: number; color: string }[] }

export function SentimentChart({ data }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="anim-scale-in d-200 card p-6">
      <div className="mb-5">
        <h3 className="font-display text-base font-semibold"
          style={{ color: 'var(--text-primary)' }}>
          Sentiment Breakdown
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          How users feel across all feedback
        </p>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%"
            innerRadius={68} outerRadius={96}
            paddingAngle={3} dataKey="value"
            animationBegin={300} animationDuration={900}
          >
            {data.map((e, i) => (
              <Cell key={i} fill={e.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-md)'
            }}
            formatter={(v: number) => [
              `${v} · ${Math.round((v / total) * 100)}%`, ''
            ]}
          />
          <Legend iconType="circle" iconSize={7}
            formatter={v => (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {v}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}