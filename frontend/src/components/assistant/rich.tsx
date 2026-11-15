import type { ReactNode } from 'react'

/** Tiny renderer for assistant text: paragraphs, "- " lists, **bold**, and [n] citation chips. */
export function Rich({ text, onCite, known }: { text: string; onCite: (n: number) => void; known?: (n: number) => boolean }) {
  // group consecutive lines into paragraphs and "- " lists (a heading line followed by list items works too)
  const isItem = (l: string) => /^\s*[-•]\s+/.test(l)
  const groups: { list: boolean; lines: string[] }[] = []
  // the model sometimes writes "Intro: - **A:** … - **B:** …" on one line; break those into list lines
  const normalised = text.replace(/\r/g, '').replace(/(^|[^\n])\s+-\s+(?=\*\*)/g, '$1\n- ')
  for (const raw of normalised.split('\n')) {
    if (!raw.trim()) { groups.push({ list: false, lines: [] }); continue }
    const list = isItem(raw)
    const last = groups[groups.length - 1]
    if (last && last.lines.length && last.list === list) last.lines.push(raw)
    else groups.push({ list, lines: [raw] })
  }
  return (
    <>
      {groups.filter((g) => g.lines.length).map((g, i) => g.list ? (
        <ul key={i} className="my-2 space-y-1.5 pl-1">
          {g.lines.map((l, j) => (
            <li key={j} className="flex gap-2"><span className="text-ink-3">–</span><span>{inline(l.replace(/^\s*[-•]\s+/, ''), onCite, known)}</span></li>
          ))}
        </ul>
      ) : (
        <p key={i} className="my-2">{inline(g.lines.join(' '), onCite, known)}</p>
      ))}
    </>
  )
}

function inline(s: string, onCite: (n: number) => void, known?: (n: number) => boolean): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|\[\d+\])/g).filter(Boolean).map((part, i) => {
    const cite = part.match(/^\[(\d+)\]$/)
    if (cite) {
      const n = Number(cite[1])
      return known && !known(n)
        ? <sup key={i} className="font-mono text-[10px] text-ink-3">[{n}]</sup>
        : <CiteChip key={i} n={n} onClick={() => onCite(n)} />
    }
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
    return <span key={i}>{part}</span>
  })
}

export function CiteChip({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <button onClick={onClick} title="Show NASA source"
            className="mx-[1px] inline-flex -translate-y-[3px] items-center border border-ink-3/70 bg-paper px-1 font-mono text-[10px] leading-[14px] text-ink-2 hover:border-ink hover:text-ink">
      {n}
    </button>
  )
}
