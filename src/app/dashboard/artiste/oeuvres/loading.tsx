// État de chargement de « Mes œuvres » (story 2.8) : lignes fantômes, annoncé aux lecteurs d'écran.
export default function ChargementOeuvres() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">Chargement de vos œuvres…</p>
      <div className="mb-10">
        <div className="h-3 w-24 bg-neutral-100 rounded-sm mb-4" />
        <div className="h-9 w-56 bg-neutral-100 rounded-sm" />
      </div>
      <div className="flex flex-col gap-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 border border-neutral-200 rounded-sm motion-safe:animate-pulse">
            <div className="w-12 h-14 bg-neutral-100 rounded-sm" />
            <div className="flex-1">
              <div className="h-4 w-1/2 bg-neutral-100 rounded-sm mb-2" />
              <div className="h-3 w-1/3 bg-neutral-100 rounded-sm" />
            </div>
            <div className="h-6 w-24 border border-dashed border-neutral-200 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  )
}
