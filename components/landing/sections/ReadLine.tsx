/**
 * Splits a statement into words the scroll-read effect lights one by one.
 * The scene writes --read on [data-read]; globals.css turns it into each
 * word's opacity from --i and --n.
 */
export function ReadLine({ text, gold = [] }: { text: string; gold?: string[] }) {
  const words = text.split(' ')
  return (
    <span data-read style={{ ['--n' as string]: words.length }}>
      {words.map((word, i) => (
        <span key={i} className={`read-word ${gold.includes(word) ? 'text-accent' : ''}`} style={{ ['--i' as string]: i }}>
          {word}{' '}
        </span>
      ))}
    </span>
  )
}
