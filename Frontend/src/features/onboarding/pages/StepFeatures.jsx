/* StepFeatures — feature showcase cards */
const FEATURES = [
  { emoji: '🤖', title: 'AI Summaries',  desc: 'Get the gist of any story instantly with one tap.' },
  { emoji: '🎧', title: 'Read Aloud',    desc: 'Listen to stories hands-free while commuting or cooking.' },
  { emoji: '🏆', title: 'Competitions',  desc: 'Enter writing competitions and win featured placements.' },
  { emoji: '❓', title: 'Questions',     desc: 'Ask the community anything. Get thoughtful answers.' },
]

export default function StepFeatures() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {FEATURES.map(f => (
        <div key={f.title} className="p-5 bg-[var(--color-surface)] rounded-[20px] border border-[var(--color-border)]">
          <div className="text-[28px] mb-[10px]">{f.emoji}</div>
          <p className="font-bold text-[14px] mb-1.5 text-[var(--color-text)]">{f.title}</p>
          <p className="text-[13px] text-[var(--color-text-secondary)] leading-[1.6]">{f.desc}</p>
        </div>
      ))}
    </div>
  )
}
