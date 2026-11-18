import { fr } from '@/lib/i18n'

// « Suivre mes commandes » (story 7.6) : élément inactif et expliqué tant que le suivi par lien (story 7.7)
// n'existe pas. `aria-disabled` sans `disabled` : il reste atteignable au clavier, son explication est lue
// (`aria-describedby`) et le clic n'a aucun effet (aucun gestionnaire, `type="button"`).
export function SuivreCommandes() {
  return (
    <div className="mt-8">
      <button
        type="button"
        aria-disabled="true"
        aria-describedby="suivre-aide"
        className="inline-flex min-h-touch-target cursor-not-allowed items-center border border-neutral-200 px-6 font-sans text-sm text-neutral-600"
      >
        {fr.confirmation.suivre}
      </button>
      <p id="suivre-aide" className="mt-2 font-sans text-sm text-neutral-600">
        {fr.confirmation.suivreAide}
      </p>
    </div>
  )
}
