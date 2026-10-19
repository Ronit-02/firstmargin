import { useOutletContext } from 'react-router-dom'
import PageFrame from '@/shared/components/layout/PageFrame'
import ProfileSettings from '../../components/ProfileSettings'

export default function SettingsPage() {
  const { themePreference, setTheme } = useOutletContext()
  return <PageFrame>
    <header className="mb-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">Your app</p>
      <h1 className="mt-3 text-[clamp(30px,5vw,48px)] font-bold tracking-[-0.05em] text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>Settings</h1>
    </header>
    <ProfileSettings themePreference={themePreference} setTheme={setTheme} />
  </PageFrame>
}
