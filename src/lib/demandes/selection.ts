import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { DOUBLON_DEMANDE_MINUTES, LIMITES_DEMANDE_SELECTION } from '@/lib/reglages'
import { validerSelection, type ErreursSelection } from './selection-regles'

// Demande de sélection personnalisée (story 4.2, FR-8). Le module demandes est seul propriétaire de
// ces données et des coordonnées du visiteur. Jamais d'adresse, de téléphone ni de texte saisi dans
// les journaux ni dans l'événement (id de la demande seulement). Les limites d'envoi portent sur des
// empreintes salées (table `TentativeInscription`, clés distinctes de celles de la maintenance).

export type ResultatDemandeSelection =
  | { ok: true }
  | { ok: false; code: 'invalide'; erreurs: ErreursSelection }
  | { ok: false; code: 'trop_de_demandes' }

function empreinte(type: 'conseil-ip' | 'conseil-email', valeur: string): string {
  const sel = process.env.AUTH_SECRET ?? ''
  return `${type}:${createHash('sha256').update(`${sel}:${valeur}`).digest('hex')}`
}

/**
 * Enregistre une demande valide à l'état `nouvelle` et écrit l'événement `DemandeSelectionRecue`
 * dans la même transaction, puis le répartit (accusé au visiteur, alerte à l'équipe) avant de rendre
 * la main. Une saisie invalide n'est ni enregistrée ni comptée. Au-delà du seuil par IP ou par
 * e-mail : refus `trop_de_demandes`. Un envoi identique répété dans la fenêtre de
 * `DOUBLON_DEMANDE_MINUTES` (double appui) ne crée pas de seconde demande.
 */
export async function enregistrerDemandeSelection(
  brut: unknown,
  ip: string | null,
  maintenant = new Date(),
): Promise<ResultatDemandeSelection> {
  const lu = validerSelection(brut)
  if (!lu.ok) return { ok: false, code: 'invalide', erreurs: lu.erreurs }
  const { valeur } = lu

  // Limites souples (comme la maintenance) : des envois strictement simultanés peuvent dépasser le
  // seuil d'une ou deux unités. IP absente : une clé commune, pour que la limite ne disparaisse pas.
  const { fenetreMinutes, parIp, parEmail } = LIMITES_DEMANDE_SELECTION
  const depuis = new Date(maintenant.getTime() - fenetreMinutes * 60_000)
  const cles = [
    { cle: empreinte('conseil-ip', ip ?? 'inconnue'), seuil: parIp },
    { cle: empreinte('conseil-email', valeur.email), seuil: parEmail },
  ]
  for (const { cle, seuil } of cles) {
    if ((await prisma.tentativeInscription.count({ where: { cle, createdAt: { gte: depuis } } })) >= seuil) {
      return { ok: false, code: 'trop_de_demandes' }
    }
  }
  await prisma.$transaction([
    // Seulement les traces de ce formulaire : celles de la maintenance ont leur propre fenêtre.
    prisma.tentativeInscription.deleteMany({ where: { cle: { startsWith: 'conseil-' }, createdAt: { lt: depuis } } }),
    prisma.tentativeInscription.createMany({ data: cles.map(({ cle }) => ({ cle })) }),
  ])

  const evenementId = await prisma.$transaction(async (tx): Promise<string | null> => {
    // Deux envois simultanés du même e-mail se suivent : le second voit le premier.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`demande-selection:${valeur.email}`}))`
    const doublon = await tx.demandeSelection.findFirst({
      where: {
        email: valeur.email,
        espace: valeur.espace,
        budgetCentimes: valeur.budgetCentimes,
        // Tout ce qui est enregistré : une demande corrigée n'est pas absorbée comme un doublon.
        ambiances: { equals: valeur.ambiances },
        precision: valeur.precision,
        telephone: valeur.telephone,
        createdAt: { gte: new Date(maintenant.getTime() - DOUBLON_DEMANDE_MINUTES * 60_000) },
      },
      select: { id: true },
    })
    if (doublon) return null
    const demande = await tx.demandeSelection.create({
      data: {
        espace: valeur.espace,
        ambiances: valeur.ambiances,
        precision: valeur.precision,
        budgetCentimes: valeur.budgetCentimes,
        email: valeur.email,
        telephone: valeur.telephone,
      },
      select: { id: true },
    })
    return ecrireEvenement(tx, { nom: 'DemandeSelectionRecue', charge: { demandeId: demande.id } })
  })
  if (evenementId) await repartirApresValidation([evenementId])
  return { ok: true }
}
