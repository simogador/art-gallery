import Link from 'next/link'
import type { OeuvreEnFile } from '@/lib/curation'
import { dateLisible } from '@/lib/curation/curation-regles'

// File de curation (story 2.7) : œuvres envoyées par les artistes, de la plus anciennement envoyée
// à la plus récente, avec l'artiste, la date d'envoi et l'accord signé (porté par le texte).

export function FileDeCuration({ file, erreur }: { file: OeuvreEnFile[]; erreur?: string }) {
  if (erreur) {
    return (
      <section aria-labelledby="titre-file-curation" className="mb-12">
        <h2 id="titre-file-curation" className="font-serif font-light text-foreground text-2xl mb-1">
          À relire
        </h2>
        <p role="alert" className="font-sans text-sm text-red-700">
          La file de curation n’a pas pu être lue : {erreur}
        </p>
      </section>
    )
  }
  return (
    <section aria-labelledby="titre-file-curation" className="mb-12">
      <h2 id="titre-file-curation" className="font-serif font-light text-foreground text-2xl mb-1">
        À relire
      </h2>
      <p className="font-sans text-sm text-neutral-600 mb-4">
        {file.length === 0
          ? 'Aucune œuvre à relire.'
          : `${file.length} œuvre${file.length > 1 ? 's' : ''} en curation, de la plus ancienne à la plus récente.`}
      </p>
      {file.length > 0 && (
        <ol className="flex flex-col gap-2">
          {file.map((o) => (
            <li key={o.slug}>
              <Link
                href={`/dashboard/admin/oeuvres/${o.slug}`}
                className="flex flex-wrap items-center gap-x-6 gap-y-1 min-h-[44px] p-4 border border-neutral-200 rounded-sm hover:border-foreground transition-colors duration-200"
              >
                <span className="font-serif text-base font-light text-foreground flex-1 min-w-[12rem]">{o.titre || 'Sans titre'}</span>
                <span className="font-sans text-sm text-neutral-600">{o.artiste.nom}</span>
                <span className="font-sans text-sm text-neutral-600">
                  {o.envoyeeLe ? `Envoyée le ${dateLisible(o.envoyeeLe)}` : 'Date d’envoi inconnue'}
                </span>
                <span
                  className={`font-sans text-xs uppercase tracking-widest px-2 py-1 rounded-sm border ${
                    o.accordSigneLe ? 'border-emerald-200 text-emerald-800' : 'border-amber-300 text-amber-800'
                  }`}
                >
                  {o.accordSigneLe ? 'Accord signé' : 'Accord non signé'}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
