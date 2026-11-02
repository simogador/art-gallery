import { CONTACT_EQUIPE } from '@/lib/reglages'

// Lien d'invitation inconnu, expiré, déjà utilisé ou remplacé (story 2.4).
export function LienExpire() {
  return (
    <div className="flex flex-col items-start gap-6">
      <h1 className="font-serif font-light text-foreground text-3xl">Ce lien d&apos;invitation a expiré.</h1>
      <p className="font-sans text-sm text-neutral-600">
        Il a peut-être déjà servi, ou une invitation plus récente l&apos;a remplacé. L&apos;équipe Errancy peut
        vous en envoyer un nouveau.
      </p>
      <a
        href={`mailto:${CONTACT_EQUIPE}?subject=${encodeURIComponent('Mon lien d’invitation a expiré')}`}
        className="inline-flex items-center min-h-[44px] px-6 bg-foreground text-background font-sans text-xs uppercase tracking-widest rounded-sm"
      >
        Écrire à l&apos;équipe
      </a>
    </div>
  )
}
