import Link from 'next/link'
import { fr } from '@/lib/i18n'
import { Cadre } from './Cadre'

// Page « close » du suivi (story 7.7) : lien inconnu, périmé, révoqué ou commandes toutes annulées. UNE seule
// page pour tous ces cas, sans rien indiquer de plus. Le bouton Conseil est reçu en propriété (composant serveur
// rendu par la page ; ici il reste substituable dans un test navigateur).
export function SuiviClos({ conseil }: { conseil: React.ReactNode }) {
  const t = fr.suivi.inactif
  return (
    <Cadre titre={t.titre}>
      <p className="font-sans text-sm text-neutral-600">{t.texte}</p>
      <Link href="/" className="mt-6 inline-flex min-h-touch-target items-center font-sans text-sm underline underline-offset-4">
        {t.accueil}
      </Link>
      <div className="mt-8">{conseil}</div>
    </Cadre>
  )
}
