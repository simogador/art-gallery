import Link from 'next/link'
import { fr } from '@/lib/i18n'
import type { CommandeDeLArtiste } from '@/lib/commandes'
import { ListeCommandes } from './ListeCommandes'

// Bloc « À expédier » de l'accueil de l'artiste (story 8.1, UX-DR33) : premier bloc, avec le compteur des
// commandes à prendre en charge (`count-badge`, masqué à zéro). Absent s'il n'y a aucune commande confirmée ni
// prise en charge. Les commandes à prendre en charge sont listées ; les autres sont sur la page Commandes.
// Composant serveur.

const t = fr.commandesArtiste.bloc

export function BlocAExpedier({ commandes }: { commandes: CommandeDeLArtiste[] }) {
  // Compteur et liste tirés de la même lecture. Le bloc liste ce qu'il reste à faire : commandes à prendre en
  // charge, puis prises en charge à expédier (story 8.2) ; le compteur reste celui des prises en charge à faire (8.1).
  const aExpedier = commandes.filter((c) => c.etat === 'confirmee' || c.etat === 'prise_en_charge')
  if (aExpedier.length === 0) return null
  const nombre = aExpedier.filter((c) => c.etat === 'confirmee').length
  return (
    <section aria-labelledby="a-expedier" className="mb-10">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="a-expedier" className="flex items-center gap-2 font-sans text-xs uppercase tracking-[0.2em] text-neutral-600">
          {t.titre}
          {nombre > 0 && (
            <span data-compteur>
              <span
                aria-hidden="true"
                className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-sm bg-foreground px-1.5 font-sans text-[11px] tracking-normal text-neutral-200"
              >
                {nombre}
              </span>
              <span className="sr-only">{t.badge(nombre)}</span>
            </span>
          )}
        </h2>
        <Link
          href="/dashboard/artiste/commandes"
          className="inline-flex min-h-touch-target items-center font-sans text-xs uppercase tracking-widest text-neutral-600 transition-colors duration-200 hover:text-foreground"
        >
          {t.toutVoir}
        </Link>
      </div>
      <p className="mb-4 font-sans text-sm text-neutral-600">{nombre > 0 ? t.aPrendre(nombre) : t.aucuneAPrendre}</p>
      <ListeCommandes commandes={aExpedier} />
    </section>
  )
}
