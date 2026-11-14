export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <main className="screen">
      <h1 className="screen-title">{title}</h1>
      <p className="muted">{note}</p>
    </main>
  )
}
