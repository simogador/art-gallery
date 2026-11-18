'use client'

import { useRouter } from 'next/navigation'
import { fr } from '@/lib/i18n'
import { completerCoordonnees, type ReponseCoordonnees } from './actions'
import { FormulaireCoordonnees } from './FormulaireCoordonnees'

// Passage posé par l'équipe (story 7.3, décision 3A) : l'e-mail et le nom sont déjà connus ; l'acheteur
// complète adresse (obligatoire) et téléphone. Aucune nouvelle réservation : celle de la vente assistée est reprise.

const t = fr.coordonnees

export function CoordonneesAssistee() {
  const routeur = useRouter()
  const message = (reponse: Extract<ReponseCoordonnees, { ok: false }>) => (reponse.code === 'ferme' ? t.refus.ferme : t.refus.indisponible)
  return (
    <FormulaireCoordonnees
      champs={['adresse', 'telephone']}
      envoyer={(saisie) => completerCoordonnees(saisie)}
      libelleEnvoi={t.enregistrer}
      libelleEnCours={t.envoiEnCours}
      messageRefus={message}
      surSucces={() => routeur.refresh()}
    />
  )
}
