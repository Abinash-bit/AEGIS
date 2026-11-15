import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'
const KEY = 'aegis.theme'

function current(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/** Day print / night print. The choice is saved; the first visit follows the system setting (see index.html). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem(KEY, theme) } catch { /* storage unavailable */ }
  }, [theme])
  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button onClick={toggle} aria-label={dark ? 'Switch to day mode' : 'Switch to night mode'} title={dark ? 'Day mode' : 'Night mode'}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink-3/60 text-ink-2 transition hover:border-ink hover:text-ink ${className}`}>
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}
