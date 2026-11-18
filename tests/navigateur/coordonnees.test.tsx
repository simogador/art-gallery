import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr, formaterDate, formaterHeure, fuseauAppareil } from '@/lib/i18n'
import type { PanierCompose } from '@/lib/panier'
import type { PrixLivre } from '@/lib/livraison/prix'

// Coordonnées sans compte et réservation en heure fixe (story 7.3) dans un vrai navigateur : actions
// serveur, recalcul du panier et routeur simulés ; le store du navigateur est réel (localStorage).
const recalculerPanier = vi.fn()
const envoyerCoordonnees = vi.fn()
const reprendreReservation = vi.fn()
const completerCoordonnees = vi.fn()
const modifierMaCommande = vi.fn()
const refresh = vi.fn()
const push = vi.fn()
vi.mock('@/app/panier/actions', () => ({ recalculerPanier: (slugs: unknown) => recalculerPanier(slugs) }))
vi.mock('@/app/commande/coordonnees/actions', () => ({
  envoyerCoordonnees: (...a: unknown[]) => envoyerCoordonnees(...a),
  reprendreReservation: (...a: unknown[]) => reprendreReservation(...a),
  completerCoordonnees: (...a: unknown[]) => completerCoordonnees(...a),
  modifierMaCommande: (...a: unknown[]) => modifierMaCommande(...a),
}))
vi.mock('@/app/actions/pays', () => ({ choisirPaysLivraison: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }), usePathname: () => '/commande/coordonnees' }))

const { CoordonneesPanier } = await import('@/app/commande/coordonnees/CoordonneesPanier')
const { CoordonneesAssistee } = await import('@/app/commande/coordonnees/CoordonneesAssistee')
const { ReservationHeureFixe } = await import('@/app/commande/coordonnees/ReservationHeureFixe')
const { ModifierCommande } = await import('@/app/commande/coordonnees/ModifierCommande')
const { FocusSiMarque } = await import('@/app/commande/coordonnees/FocusSiMarque')
const { FormulaireCoordonnees } = await import('@/app/commande/coordonnees/FormulaireCoordonnees')
const { PLAFONDS_RESERVATION } = await import('@/lib/reglages')
const { Profiler } = await import('react')
const { MARQUE_ENVOI } = await import('@/app/commande/coordonnees/marque')
const { useCartStore } = await import('@/lib/store/cart')
const t = fr.coordonnees

const livre = (total: number, frais: number): PrixLivre => ({
  livree: true, totalCentimes: total, fraisCentimes: frais, devise: 'EUR', delaiMinJours: 7, delaiMaxJours: 11,
})
const somme = (livrees: number, prix: number, frais: number) => ({
  livrees, nonLivrees: 0, devise: 'EUR', prixCentimes: prix, fraisCentimes: frais, totalCentimes: prix + frais, delaiMinJours: 7, delaiMaxJours: 11,
})
const ligne = (slug: string, titre: string, prixLivre: PrixLivre) => ({
  slug, titre, imageUrl: null, gradient: 'from-neutral-100', accentColor: '#999', prixLivre,
  prixOeuvreCentimes: prixLivre.livree ? prixLivre.totalCentimes - prixLivre.fraisCentimes : null,
})
const panierDeuxArtistes = (): PanierCompose => ({
  pays: { code: 'FR', nom: 'France' },
  commandes: [
    { numero: 1, artiste: { slug: 'kara', nom: 'Kara' }, lignes: [ligne('nuit', 'La nuit', livre(240000, 0))], somme: somme(1, 240000, 0) },
    { numero: 2, artiste: { slug: 'ines', nom: 'Inès' }, lignes: [ligne('aube', 'L’aube', livre(68000, 8000))], somme: somme(1, 60000, 8000) },
  ],
  indisponibles: [],
  total: somme(2, 300000, 8000),
})

type Ecran = Awaited<ReturnType<typeof render>>
const champ = (ecran: Ecran, libelle: string) => ecran.getByLabelText(libelle)
const remplir = async (ecran: Ecran, adresse = '12 rue des Lilas\n75011 Paris') => {
  await champ(ecran, t.champs.email.libelle).fill('claire@exemple.test')
  await champ(ecran, t.champs.nom.libelle).fill('Claire Martin')
  await champ(ecran, t.champs.adresse.libelle).fill(adresse)
}
const soumettre = (ecran: Ecran) => ecran.container.querySelector('form')!.requestSubmit()

beforeEach(() => {
  for (const m of [recalculerPanier, envoyerCoordonnees, reprendreReservation, completerCoordonnees, modifierMaCommande, refresh, push]) m.mockReset()
  localStorage.clear()
  sessionStorage.clear()
  useCartStore.setState({ slugs: [] })
})

describe('CoordonneesPanier (navigateur)', () => {
  it('panier vide : message et lien vers la galerie, pas de formulaire', async () => {
    const ecran = await render(<CoordonneesPanier pays={{ code: 'FR', nom: 'France' }} />)
    await expect.element(ecran.getByText(t.vide.titre)).toBeVisible()
    expect(ecran.getByRole('link', { name: t.vide.parcourir }).element().getAttribute('href')).toBe('/galerie')
    expect(ecran.container.querySelector('form')).toBeNull()
    expect(recalculerPanier).not.toHaveBeenCalled()
  })

  it('commandes par artiste, total et mention des droits, phrase « sans compte », libellés visibles et autocomplete', async () => {
    useCartStore.setState({ slugs: ['nuit', 'aube'] })
    recalculerPanier.mockResolvedValue({ ok: true, panier: panierDeuxArtistes() })
    const ecran = await render(<CoordonneesPanier pays={{ code: 'FR', nom: 'France' }} />)
    await expect.element(ecran.getByRole('heading', { name: fr.panier.commande(1) })).toBeVisible()
    await expect.element(ecran.getByRole('heading', { name: fr.panier.commande(2) })).toBeVisible()
    await expect.element(ecran.getByText(fr.livraison.droitsNonInclus)).toBeVisible()
    await expect.element(ecran.getByText(t.sansCompte)).toBeVisible()
    expect(ecran.container.querySelectorAll('button[aria-label^="Retirer"]')).toHaveLength(0)
    expect(champ(ecran, t.champs.email.libelle).element().getAttribute('autocomplete')).toBe('email')
    expect(champ(ecran, t.champs.nom.libelle).element().getAttribute('autocomplete')).toBe('name')
    expect(champ(ecran, t.champs.adresse.libelle).element().getAttribute('autocomplete')).toBe('street-address')
    expect(champ(ecran, t.champs.telephone.libelle).element().getAttribute('autocomplete')).toBe('tel')
    expect(champ(ecran, t.champs.email.libelle).element().getAttribute('type')).toBe('email')
  })

  it('validation à la sortie du champ (pas à la frappe), puis résumé en tête à l’envoi, adresse obligatoire, rien envoyé', async () => {
    useCartStore.setState({ slugs: ['nuit'] })
    recalculerPanier.mockResolvedValue({ ok: true, panier: panierDeuxArtistes() })
    const ecran = await render(<CoordonneesPanier pays={{ code: 'FR', nom: 'France' }} />)
    const email = champ(ecran, t.champs.email.libelle)
    await email.fill('pas-un-email')
    expect(ecran.container.querySelector('#coordonnees-email-erreur')).toBeNull()
    await champ(ecran, t.champs.nom.libelle).click()
    await vi.waitFor(() => expect(ecran.container.querySelector('#coordonnees-email-erreur')?.textContent).toBe(fr.commandes.erreurs.emailInvalide))
    expect(email.element().getAttribute('aria-invalid')).toBe('true')
    expect(email.element().getAttribute('aria-describedby')).toContain('coordonnees-email-erreur')

    soumettre(ecran)
    await vi.waitFor(() => expect(ecran.container.querySelector('[role="alert"]')?.textContent).toContain(t.resume(3)))
    expect(ecran.container.querySelector('#coordonnees-adresse-erreur')?.textContent).toBe(fr.commandes.erreurs.adresseManquante)
    expect(ecran.container.querySelector('#coordonnees-nom-erreur')?.textContent).toBe(fr.commandes.erreurs.nomManquant)
    expect(envoyerCoordonnees).not.toHaveBeenCalled()
    // Le téléphone est facultatif.
    expect(ecran.container.querySelector('#coordonnees-telephone-erreur')).toBeNull()
    // Saisie conservée.
    await expect.element(email).toHaveValue('pas-un-email')
  })

  it('envoi valide : slugs des œuvres livrées et saisie transmis, page rafraîchie, focus à venir sur la réservation', async () => {
    useCartStore.setState({ slugs: ['nuit', 'aube', 'perdue'] })
    recalculerPanier.mockResolvedValue({ ok: true, panier: panierDeuxArtistes() })
    envoyerCoordonnees.mockResolvedValue({ ok: true })
    const ecran = await render(<CoordonneesPanier pays={{ code: 'FR', nom: 'France' }} />)
    await remplir(ecran)
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(envoyerCoordonnees).toHaveBeenCalledWith(['nuit', 'aube'], {
      email: 'claire@exemple.test', nom: 'Claire Martin', adresse: '12 rue des Lilas\n75011 Paris', telephone: '',
    })
    expect(sessionStorage.getItem(MARQUE_ENVOI)).toBe('1')
    await expect.element(ecran.getByRole('button', { name: t.envoiEnCours })).toBeDisabled()
  })

  it('double appui : une seule réservation demandée', async () => {
    useCartStore.setState({ slugs: ['nuit'] })
    recalculerPanier.mockResolvedValue({ ok: true, panier: panierDeuxArtistes() })
    let fin: (v: unknown) => void = () => {}
    envoyerCoordonnees.mockReturnValue(new Promise((r) => (fin = r)))
    const ecran = await render(<CoordonneesPanier pays={{ code: 'FR', nom: 'France' }} />)
    await remplir(ecran)
    const form = ecran.container.querySelector('form')!
    form.requestSubmit()
    form.requestSubmit()
    expect(envoyerCoordonnees).toHaveBeenCalledTimes(1)
    fin({ ok: true })
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('œuvre devenue indisponible : message nommant l’œuvre, rien réservé, saisie conservée, liste recalculée', async () => {
    useCartStore.setState({ slugs: ['nuit', 'aube'] })
    recalculerPanier.mockResolvedValue({ ok: true, panier: panierDeuxArtistes() })
    envoyerCoordonnees.mockResolvedValue({ ok: false, code: 'oeuvre_indisponible', slug: 'aube' })
    const ecran = await render(<CoordonneesPanier pays={{ code: 'FR', nom: 'France' }} />)
    await remplir(ecran)
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.refus.oeuvreIndisponible('L’aube'))
    expect(refresh).not.toHaveBeenCalled()
    await expect.element(champ(ecran, t.champs.nom.libelle)).toHaveValue('Claire Martin')
    await vi.waitFor(() => expect(recalculerPanier).toHaveBeenCalledTimes(2))
    // Le bouton se libère : un nouvel essai est possible.
    await expect.element(ecran.getByRole('button', { name: t.envoyer })).toBeEnabled()
  })

  it('plafond atteint et refus du serveur : messages sans détail technique', async () => {
    useCartStore.setState({ slugs: ['nuit'] })
    recalculerPanier.mockResolvedValue({ ok: true, panier: panierDeuxArtistes() })
    envoyerCoordonnees.mockResolvedValueOnce({ ok: false, code: 'plafond_atteint' })
    const ecran = await render(<CoordonneesPanier pays={{ code: 'FR', nom: 'France' }} />)
    await remplir(ecran)
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.refus.plafond)
    envoyerCoordonnees.mockRejectedValueOnce(new Error('boom'))
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.refus.indisponible)
    envoyerCoordonnees.mockResolvedValueOnce({ ok: false, code: 'invalide', erreurs: { email: fr.commandes.erreurs.emailInvalide } })
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await vi.waitFor(() => expect(ecran.container.querySelector('#coordonnees-email-erreur')?.textContent).toBe(fr.commandes.erreurs.emailInvalide))
  })

  it('pays non livré : ligne « non livrée », envoi impossible et expliqué', async () => {
    useCartStore.setState({ slugs: ['nuit'] })
    const panier = panierDeuxArtistes()
    panier.pays = { code: 'US', nom: 'États-Unis' }
    panier.commandes = [{ ...panier.commandes[0], lignes: [ligne('nuit', 'La nuit', { livree: false, raison: 'non_livree' })], somme: { ...somme(0, 0, 0), nonLivrees: 1, devise: null } }]
    panier.total = { ...somme(0, 0, 0), nonLivrees: 1, devise: null }
    recalculerPanier.mockResolvedValue({ ok: true, panier })
    const ecran = await render(<CoordonneesPanier pays={{ code: 'US', nom: 'États-Unis' }} />)
    await expect.element(ecran.getByText(fr.panier.nonLivree('États-Unis'))).toBeVisible()
    await expect.element(ecran.getByText(t.nonLivreesBloque)).toBeVisible()
    const bouton = ecran.getByRole('button', { name: t.envoyer })
    await expect.element(bouton).toBeDisabled()
    expect(bouton.element().getAttribute('aria-describedby')).toBe('coordonnees-blocage')
    await remplir(ecran)
    soumettre(ecran)
    expect(envoyerCoordonnees).not.toHaveBeenCalled()
  })

  it('changement de pays : commandes recalculées pendant le chargement (montants masqués), puis annonce', async () => {
    useCartStore.setState({ slugs: ['nuit', 'aube'] })
    recalculerPanier.mockResolvedValueOnce({ ok: true, panier: panierDeuxArtistes() })
    const ecran = await render(<CoordonneesPanier pays={{ code: 'FR', nom: 'France' }} />)
    await expect.element(ecran.getByRole('heading', { name: fr.panier.commande(1) })).toBeVisible()
    let fin: (v: unknown) => void = () => {}
    recalculerPanier.mockReturnValueOnce(new Promise((r) => (fin = r)))
    await ecran.rerender(<CoordonneesPanier pays={{ code: 'BE', nom: 'Belgique' }} />)
    await expect.element(ecran.getByText(t.recalculEnCours, { exact: true }).first()).toBeVisible()
    await expect.element(ecran.getByRole('button', { name: t.envoyer })).toBeDisabled()
    const belgique = panierDeuxArtistes()
    belgique.pays = { code: 'BE', nom: 'Belgique' }
    fin({ ok: true, panier: belgique })
    await vi.waitFor(() => {
      const annonces = Array.from(document.querySelectorAll('[aria-live="polite"]')).map((e) => e.textContent)
      expect(annonces).toContain(fr.panier.recalcule('Belgique'))
    })
    await expect.element(ecran.getByRole('button', { name: t.envoyer })).toBeEnabled()
  })

  it('erreur de recalcul : le formulaire reste monté (saisie conservée), l’envoi est bloqué, « Réessayer » relance', async () => {
    useCartStore.setState({ slugs: ['nuit'] })
    recalculerPanier.mockResolvedValueOnce({ ok: true, panier: panierDeuxArtistes() })
    const ecran = await render(<CoordonneesPanier pays={{ code: 'FR', nom: 'France' }} />)
    await expect.element(ecran.getByRole('heading', { name: fr.panier.commande(1) })).toBeVisible()
    await champ(ecran, t.champs.nom.libelle).fill('Claire Martin')
    const form = ecran.container.querySelector('form')
    recalculerPanier.mockResolvedValueOnce({ ok: false })
    await ecran.rerender(<CoordonneesPanier pays={{ code: 'BE', nom: 'Belgique' }} />)
    await expect.element(ecran.getByText(t.erreur).first()).toBeVisible()
    expect(ecran.container.querySelector('form')).toBe(form)
    await expect.element(champ(ecran, t.champs.nom.libelle)).toHaveValue('Claire Martin')
    await expect.element(ecran.getByRole('button', { name: t.envoyer })).toBeDisabled()
    recalculerPanier.mockResolvedValueOnce({ ok: true, panier: panierDeuxArtistes() })
    await ecran.getByRole('button', { name: t.reessayer }).click()
    await expect.element(ecran.getByRole('heading', { name: fr.panier.commande(1) })).toBeVisible()
    await expect.element(champ(ecran, t.champs.nom.libelle)).toHaveValue('Claire Martin')
    await expect.element(ecran.getByRole('button', { name: t.envoyer })).toBeEnabled()
  })

  it('plus de réservations permises que par e-mail : message distinct, envoi bloqué avant l’appel', async () => {
    const max = PLAFONDS_RESERVATION.parEmail
    const slugs = Array.from({ length: max + 1 }, (_, i) => `o${i}`)
    useCartStore.setState({ slugs })
    const panier = panierDeuxArtistes()
    panier.commandes = [{ ...panier.commandes[0], lignes: slugs.map((sl) => ligne(sl, `Œuvre ${sl}`, livre(100000, 0))), somme: somme(slugs.length, 100000 * slugs.length, 0) }]
    panier.total = somme(slugs.length, 100000 * slugs.length, 0)
    recalculerPanier.mockResolvedValue({ ok: true, panier })
    const ecran = await render(<CoordonneesPanier pays={{ code: 'FR', nom: 'France' }} />)
    await expect.element(ecran.getByText(t.refus.panierTropGrand(max))).toBeVisible()
    expect(t.refus.panierTropGrand(3)).toBe('Trois œuvres au plus peuvent être réservées en même temps pour une adresse e-mail. Retirez-en pour continuer.')
    await expect.element(ecran.getByRole('button', { name: t.envoyer })).toBeDisabled()
    await remplir(ecran)
    soumettre(ecran)
    expect(envoyerCoordonnees).not.toHaveBeenCalled()
  })

  it('refus du serveur selon le cas : plafond déjà détenu, trop de demandes, réservation déjà en cours, prix changé', async () => {
    useCartStore.setState({ slugs: ['nuit'] })
    recalculerPanier.mockResolvedValue({ ok: true, panier: panierDeuxArtistes() })
    const ecran = await render(<CoordonneesPanier pays={{ code: 'FR', nom: 'France' }} />)
    await remplir(ecran)
    const cas: [Record<string, unknown>, string][] = [
      [{ code: 'trop_de_demandes' }, t.refus.tropDeDemandes],
      [{ code: 'reservation_en_cours' }, t.refus.reservationEnCours],
      [{ code: 'prix_change', slug: 'nuit' }, t.refus.prixChange('La nuit')],
      [{ code: 'plafond_atteint' }, t.refus.plafond],
    ]
    for (const [reponse, message] of cas) {
      envoyerCoordonnees.mockResolvedValueOnce({ ok: false, ...reponse })
      soumettre(ecran)
      await vi.waitFor(() => expect(ecran.container.querySelector('[role="alert"]:not(div)')?.textContent).toBe(message))
      await expect.element(ecran.getByRole('button', { name: t.envoyer })).toBeEnabled()
    }
    expect(t.refus.reservationEnCours).not.toMatch(/disponible/)
  })

  it('œuvre indisponible dans le panier : ligne barrée, trois œuvres proches, jamais envoyée au serveur', async () => {
    useCartStore.setState({ slugs: ['nuit', 'vendue'] })
    const panier = panierDeuxArtistes()
    panier.commandes = [panier.commandes[0]]
    panier.total = somme(1, 240000, 0)
    const proche = (id: string) => ({ id, title: `Proche ${id}`, artist: 'Kara', artistId: 'kara', sold: false, hauteurMm: null, largeurMm: null, imageUrl: null, gradient: 'g', accentColor: '#999', prixLivre: livre(30000, 1000) }) as never
    panier.indisponibles = [{ slug: 'vendue', titre: 'La vendue', artisteSlug: 'kara', artisteNom: 'Kara', proches: [proche('p1'), proche('p2'), proche('p3')] }]
    recalculerPanier.mockResolvedValue({ ok: true, panier })
    envoyerCoordonnees.mockResolvedValue({ ok: true })
    const ecran = await render(<CoordonneesPanier pays={{ code: 'FR', nom: 'France' }} />)
    await expect.element(ecran.getByText(fr.panier.indisponible)).toBeVisible()
    for (const id of ['p1', 'p2', 'p3']) await expect.element(ecran.getByText(`Proche ${id}`)).toBeVisible()
    expect(ecran.container.querySelectorAll('button[aria-label^="Retirer"]')).toHaveLength(0)
    await remplir(ecran)
    soumettre(ecran)
    await vi.waitFor(() => expect(envoyerCoordonnees).toHaveBeenCalledTimes(1))
    expect(envoyerCoordonnees.mock.calls[0][0]).toEqual(['nuit'])
  })
})

describe('FormulaireCoordonnees : succès sans effet', () => {
  it('cookie refusé ou page non remplacée : le bouton est réarmé après le délai', async () => {
    const envoyer = vi.fn().mockResolvedValue({ ok: true })
    const surSucces = vi.fn()
    const ecran = await render(
      <FormulaireCoordonnees champs={['adresse']} envoyer={envoyer} libelleEnvoi={t.envoyer} libelleEnCours={t.envoiEnCours} messageRefus={() => ''} surSucces={surSucces} delaiRearmementMs={300} />,
    )
    await champ(ecran, t.champs.adresse.libelle).fill('1 rue X')
    soumettre(ecran)
    await vi.waitFor(() => expect(surSucces).toHaveBeenCalledTimes(1))
    await expect.element(ecran.getByRole('button', { name: t.envoiEnCours })).toBeDisabled()
    await expect.element(ecran.getByRole('button', { name: t.envoyer })).toBeEnabled()
    soumettre(ecran)
    await vi.waitFor(() => expect(envoyer).toHaveBeenCalledTimes(2))
  })
})

describe('CoordonneesAssistee (navigateur)', () => {
  it('adresse et téléphone seulement ; adresse obligatoire ; envoi puis rafraîchissement', async () => {
    completerCoordonnees.mockResolvedValue({ ok: true })
    const ecran = await render(<CoordonneesAssistee />)
    expect(ecran.container.querySelector('#coordonnees-email')).toBeNull()
    expect(ecran.container.querySelector('#coordonnees-nom')).toBeNull()
    soumettre(ecran)
    await vi.waitFor(() => expect(ecran.container.querySelector('#coordonnees-adresse-erreur')?.textContent).toBe(fr.commandes.erreurs.adresseManquante))
    expect(completerCoordonnees).not.toHaveBeenCalled()
    await champ(ecran, t.champs.adresse.libelle).fill('3 quai du Port')
    soumettre(ecran)
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(completerCoordonnees).toHaveBeenCalledWith(expect.objectContaining({ adresse: '3 quai du Port', telephone: '' }))
  })
})

describe('ReservationHeureFixe (navigateur)', () => {
  const dansLeFuseau = (d: Date) => ({ fuseau: fuseauAppareil(), heure: formaterHeure(d, fuseauAppareil()), jour: formaterDate(d, { fuseau: fuseauAppareil(), annee: false }) })
  const memeJour = (d: Date) => formaterDate(d, { fuseau: fuseauAppareil() }) === formaterDate(new Date(), { fuseau: fuseauAppareil() })
  const phrase = (d: Date, echue: boolean) => {
    const { heure, jour } = dansLeFuseau(d)
    if (memeJour(d)) return echue ? t.terminee(heure) : t.reservee(heure)
    return echue ? t.termineeLeJour(jour, heure) : t.reserveeLeJour(jour, heure)
  }

  it('réservation en cours : heure fixe dans le fuseau de l’appareil, sans couleur ni bouton « Continuer »', async () => {
    const fin = new Date(Date.now() + 20 * 60_000)
    const ecran = await render(<ReservationHeureFixe echeance={fin.toISOString()} echue={false} reprise={{ titres: {} }} />)
    await expect.element(ecran.getByRole('status')).toHaveTextContent(phrase(fin, false))
    const p = ecran.getByRole('status').element()
    expect(p.className).not.toMatch(/red|green|amber|yellow|orange/)
    expect(ecran.getByRole('button', { name: t.reprendre }).elements()).toHaveLength(0)
    // Heure fixe : le texte ne change pas avec le temps (aucun compte à rebours).
    const avant = p.textContent
    await new Promise((r) => setTimeout(r, 1200))
    expect(p.textContent).toBe(avant)
  })

  it('phrase exacte du cahier des charges, au format « 15 h 42 »', async () => {
    expect(t.reservee('15 h 42')).toBe('Œuvres réservées pour vous jusqu’à 15 h 42.')
    expect(t.terminee('15 h 42')).toBe('Votre réservation a pris fin à 15 h 42.')
    const fin = new Date(Date.now() + 20 * 60_000)
    const ecran = await render(<ReservationHeureFixe echeance={fin.toISOString()} echue={false} />)
    await vi.waitFor(() => expect(ecran.getByRole('status').element().textContent).toMatch(/^Œuvres réservées pour vous jusqu’(à \d{1,2} h \d{2}|au .+ à \d{1,2} h \d{2})\.$/))
  })

  it('à l’échéance locale : UN rafraîchissement, sans boucle de rendu ; la phrase ne change que sur la réponse du serveur', async () => {
    const fin = new Date(Date.now() + 1000)
    let rendus = 0
    const arbre = (echue: boolean) => (
      <Profiler id="r" onRender={() => void rendus++}>
        <ReservationHeureFixe echeance={fin.toISOString()} echue={echue} reprise={{ titres: {} }} />
      </Profiler>
    )
    const ecran = await render(arbre(false))
    await expect.element(ecran.getByRole('status')).toHaveTextContent(phrase(fin, false))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1), { timeout: 5000 })
    await new Promise((r) => setTimeout(r, 1500))
    const apres = rendus
    await new Promise((r) => setTimeout(r, 1500))
    // Aucun rendu supplémentaire ni second rafraîchissement : pas de boucle.
    expect(rendus).toBe(apres)
    expect(rendus).toBeLessThan(8)
    expect(refresh).toHaveBeenCalledTimes(1)
    // Horloge locale au-delà de l'échéance mais serveur « pas échue » : la phrase d'attente reste.
    await expect.element(ecran.getByRole('status')).toHaveTextContent(phrase(fin, false))
    expect(ecran.getByRole('button', { name: t.reprendre }).elements()).toHaveLength(0)
    // Le serveur confirme : « a pris fin » et « Continuer ».
    await ecran.rerender(arbre(true))
    await expect.element(ecran.getByRole('status')).toHaveTextContent(phrase(fin, true))
    await expect.element(ecran.getByRole('button', { name: t.reprendre })).toBeVisible()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('horloge de l’appareil en avance (échéance déjà dépassée en local, serveur « en cours ») : un rafraîchissement, phrase d’attente conservée', async () => {
    const fin = new Date(Date.now() - 10 * 60_000)
    const ecran = await render(<ReservationHeureFixe echeance={fin.toISOString()} echue={false} reprise={{ titres: {} }} />)
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    await expect.element(ecran.getByRole('status')).toHaveTextContent(phrase(fin, false))
    await new Promise((r) => setTimeout(r, 800))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(ecran.getByRole('button', { name: t.reprendre }).elements()).toHaveLength(0)
  })

  it('prix ou livraison changés à la reprise : message nommant l’œuvre, nouvel essai possible', async () => {
    reprendreReservation.mockResolvedValue({ ok: false, code: 'prix_change', slug: 'aube' })
    const echeance = new Date(Date.now() - 5 * 60_000)
    const ecran = await render(<ReservationHeureFixe echeance={echeance.toISOString()} echue={true} reprise={{ titres: { aube: 'L’aube' } }} />)
    await ecran.getByRole('button', { name: t.reprendre }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.refus.prixChange('L’aube'))
    expect(t.refus.prixChange('L’aube')).toBe('Le prix ou la livraison de « L’aube » a changé : recommencez votre commande.')
    expect(refresh).not.toHaveBeenCalledWith()
    await expect.element(ecran.getByRole('button', { name: t.reprendre })).toBeEnabled()
  })

  it('reprise réussie : le composant survit au rafraîchissement, le focus passe à la nouvelle phrase et la marque est purgée', async () => {
    reprendreReservation.mockResolvedValue({ ok: true })
    const ancienne = new Date(Date.now() - 5 * 60_000)
    const ecran = await render(<ReservationHeureFixe echeance={ancienne.toISOString()} echue={true} reprise={{ titres: {} }} />)
    await ecran.getByRole('button', { name: t.reprendre }).click()
    await vi.waitFor(() => expect(sessionStorage.getItem(MARQUE_ENVOI)).toBe('1'))
    expect(refresh).toHaveBeenCalledTimes(1)
    const nouvelle = new Date(Date.now() + 30 * 60_000)
    await ecran.rerender(<ReservationHeureFixe echeance={nouvelle.toISOString()} echue={false} reprise={{ titres: {} }} />)
    await vi.waitFor(() => expect(document.activeElement).toBe(ecran.container.firstElementChild))
    expect(sessionStorage.getItem(MARQUE_ENVOI)).toBeNull()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(phrase(nouvelle, false))
  })

  it('échue côté serveur : « Continuer » retente la réservation, une seule fois malgré un double clic, puis rafraîchit', async () => {
    let fin: (v: unknown) => void = () => {}
    reprendreReservation.mockReturnValue(new Promise((r) => (fin = r)))
    const echeance = new Date(Date.now() - 5 * 60_000)
    const ecran = await render(<ReservationHeureFixe echeance={echeance.toISOString()} echue={true} reprise={{ titres: {} }} />)
    await expect.element(ecran.getByRole('status')).toHaveTextContent(phrase(echeance, true))
    const bouton = ecran.getByRole('button', { name: t.reprendre })
    bouton.element().click()
    bouton.element().click()
    expect(reprendreReservation).toHaveBeenCalledTimes(1)
    await expect.element(ecran.getByRole('button', { name: t.repriseEnCours })).toBeDisabled()
    fin({ ok: true })
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(sessionStorage.getItem(MARQUE_ENVOI)).toBe('1')
  })

  it('œuvre prise entre-temps : la ligne le dit (titre), rien n’est réservé, nouvel essai possible', async () => {
    reprendreReservation.mockResolvedValue({ ok: false, code: 'oeuvre_indisponible', slug: 'aube' })
    const echeance = new Date(Date.now() - 5 * 60_000)
    const ecran = await render(<ReservationHeureFixe echeance={echeance.toISOString()} echue={true} reprise={{ titres: { aube: 'L’aube' } }} />)
    await ecran.getByRole('button', { name: t.reprendre }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.refus.oeuvreIndisponible('L’aube'))
    expect(refresh).not.toHaveBeenCalled()
    await expect.element(ecran.getByRole('button', { name: t.reprendre })).toBeEnabled()
  })

  it('passage posé par l’équipe : jamais de « Continuer » (la réservation de la vente assistée est reprise)', async () => {
    const echeance = new Date(Date.now() + 36 * 3_600_000)
    const ecran = await render(<ReservationHeureFixe echeance={echeance.toISOString()} echue={false} />)
    await vi.waitFor(() => expect(ecran.getByRole('status').element().textContent).toBe(phrase(echeance, false)))
    expect(ecran.getByRole('button').elements()).toHaveLength(0)
  })

  it('après un envoi réussi, le focus vient sur la réservation une seule fois', async () => {
    sessionStorage.setItem(MARQUE_ENVOI, '1')
    const echeance = new Date(Date.now() + 20 * 60_000)
    const ecran = await render(<ReservationHeureFixe echeance={echeance.toISOString()} echue={false} />)
    await vi.waitFor(() => expect(document.activeElement).toBe(ecran.container.firstElementChild))
    expect(sessionStorage.getItem(MARQUE_ENVOI)).toBeNull()
  })
})

describe('ModifierCommande (navigateur)', () => {
  it('confirmation en deux temps, libération puis retour au panier ; « Garder » annule', async () => {
    modifierMaCommande.mockResolvedValue({ ok: true })
    const ecran = await render(<ModifierCommande />)
    await ecran.getByRole('button', { name: fr.coordonnees.modifier.bouton }).click()
    await expect.element(ecran.getByText(fr.coordonnees.modifier.confirmation)).toBeVisible()
    await ecran.getByRole('button', { name: fr.coordonnees.modifier.garder }).click()
    expect(modifierMaCommande).not.toHaveBeenCalled()
    await ecran.getByRole('button', { name: fr.coordonnees.modifier.bouton }).click()
    const confirmer = ecran.getByRole('button', { name: fr.coordonnees.modifier.confirmer })
    confirmer.element().click()
    confirmer.element().click()
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/panier'))
    expect(modifierMaCommande).toHaveBeenCalledTimes(1)
  })

  it('refus du serveur : message, pas de navigation, nouvel essai possible', async () => {
    modifierMaCommande.mockResolvedValue({ ok: false, code: 'etat_invalide' })
    const ecran = await render(<ModifierCommande />)
    await ecran.getByRole('button', { name: fr.coordonnees.modifier.bouton }).click()
    await ecran.getByRole('button', { name: fr.coordonnees.modifier.confirmer }).click()
    await vi.waitFor(() => expect(document.body.textContent).toContain(fr.coordonnees.modifier.refus))
    expect(push).not.toHaveBeenCalled()
    await expect.element(ecran.getByRole('button', { name: fr.coordonnees.modifier.confirmer })).toBeEnabled()
  })
})

describe('Focus après un envoi (navigateur)', () => {
  it('passage de l’équipe : la confirmation des coordonnées reçoit le focus une seule fois et la marque est purgée', async () => {
    sessionStorage.setItem(MARQUE_ENVOI, '1')
    const ecran = await render(
      <FocusSiMarque>
        <p role="status">{t.enregistrees}</p>
      </FocusSiMarque>,
    )
    await vi.waitFor(() => expect(document.activeElement).toBe(ecran.container.firstElementChild))
    expect(sessionStorage.getItem(MARQUE_ENVOI)).toBeNull()
  })

  it('sans marque : le focus ne bouge pas', async () => {
    const ecran = await render(
      <FocusSiMarque>
        <p>{t.enregistrees}</p>
      </FocusSiMarque>,
    )
    expect(document.activeElement).not.toBe(ecran.container.firstElementChild)
  })
})
