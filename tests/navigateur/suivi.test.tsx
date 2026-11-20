import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'
import type { CommandeSuivie, EtapeSuivi } from '@/lib/commandes'

// Suivi des commandes (story 7.7) dans un vrai navigateur : frise accessible (liste ordonnée, état dit en
// toutes lettres, étape courante), commandes avec leur état, message « close » unique, Conseil reçu en
// propriété, chargement et erreur. Les données viennent du serveur : les composants ne décident de rien.
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('@/app/actions/pays', () => ({ choisirPaysLivraison: vi.fn() }))
vi.mock('@/app/suivi/actions', () => ({ confirmerReception: vi.fn(), preparerPhotoReclamation: vi.fn(), signalerUnProbleme: vi.fn() }))

const { FriseCommande } = await import('@/app/suivi/FriseCommande')
const { ListeSuivi } = await import('@/app/suivi/ListeSuivi')
const { SuiviClos } = await import('@/app/suivi/SuiviClos')
const t = fr.suivi

const etapes = (...e: EtapeSuivi[]): EtapeSuivi[] => e
const recue: EtapeSuivi = { cle: 'recue', faite: true, date: new Date('2026-11-02T10:00:00Z'), fin: null }
const commande = (numero: string, artiste: string, etat: CommandeSuivie['etat'], liste: EtapeSuivi[]): CommandeSuivie => ({
  numero, artiste, etat, oeuvres: [`Titre ${numero}`], delaiMinJours: 8, delaiMaxJours: 12, etapes: liste, peutConfirmerReception: false, peutSignalerProbleme: false, reclamation: null, remboursement: null,
})
const confirmee = etapes(
  recue,
  { cle: 'paiement', faite: true, date: new Date('2026-11-04T09:30:00Z'), fin: null },
  { cle: 'livraison', faite: false, date: new Date('2026-11-12T09:30:00Z'), fin: new Date('2026-11-16T09:30:00Z') },
)
const corps = () => (document.body.textContent ?? '').replace(/\s+/g, ' ')

afterEach(() => refresh.mockClear())

describe('Frise', () => {
  it('liste ordonnée : étapes faites avec leur date, livraison prévue, étape courante annoncée, état jamais par la couleur seule', async () => {
    await render(<FriseCommande commande={commande('ERR-AAAA-BBBB', 'Atelier A', 'confirmee', confirmee)} />)
    const liste = document.querySelector('ol')
    expect(liste?.getAttribute('aria-labelledby')).toBeTruthy()
    const items = Array.from(document.querySelectorAll('ol > li'))
    expect(items.map((li) => li.getAttribute('data-etape'))).toEqual(['recue', 'paiement', 'livraison'])
    expect(items.map((li) => li.getAttribute('data-faite'))).toEqual(['oui', 'oui', 'non'])
    expect(items[0].textContent).toContain(t.frise.etapes.recue)
    expect(items[0].textContent).toContain('2 novembre 2026')
    expect(items[1].textContent).toContain('4 novembre 2026')
    expect(items[2].textContent).toContain(t.frise.prevue('12 novembre 2026', '16 novembre 2026'))
    // Rien n'est « en cours » pour la livraison prévue.
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(0)
    expect(liste?.getAttribute('role')).toBe('list')
    expect(corps()).toContain(t.frise.estimation)
    // Les marqueurs sont décoratifs : l'état est dans le texte.
    expect(Array.from(document.querySelectorAll('ol > li > span')).every((s) => s.getAttribute('aria-hidden') === 'true')).toBe(true)
  })

  it('en attente : paiement et livraison « à venir », aucune date inventée', async () => {
    await render(
      <FriseCommande
        commande={commande('ERR-AAAA-BBBB', 'Atelier A', 'en_attente_paiement', etapes(recue, { cle: 'paiement', faite: false, date: null, fin: null }, { cle: 'livraison', faite: false, date: null, fin: null }))}
      />,
    )
    const items = Array.from(document.querySelectorAll('ol > li'))
    expect(items[1].textContent).toContain(t.frise.aVenir)
    expect(items[2].textContent).toContain(t.frise.aVenir)
    // Le paiement attendu est l'étape courante ; la livraison jamais.
    expect(items[1].getAttribute('aria-current')).toBe('step')
    expect(items[2].getAttribute('aria-current')).toBeNull()
    expect(corps()).not.toContain(t.frise.estimation)
    expect(corps()).not.toMatch(/Prévue/)
  })

  it('délai inconnu : livraison « à venir » sans date', async () => {
    const sansDate = etapes(recue, { cle: 'paiement', faite: true, date: new Date('2026-11-04T09:30:00Z'), fin: null }, { cle: 'livraison', faite: false, date: null, fin: null })
    await render(<FriseCommande commande={commande('ERR-AAAA-BBBB', 'Atelier A', 'confirmee', sansDate)} />)
    expect(document.querySelector('[data-etape="livraison"]')?.textContent).toContain(t.frise.aVenir)
    expect(corps()).not.toContain(t.frise.estimation)
  })

  it('minimum nul : « au plus tard le … »', async () => {
    const borne = etapes(recue, { cle: 'paiement', faite: true, date: new Date('2026-11-04T09:30:00Z'), fin: null }, { cle: 'livraison', faite: false, date: null, fin: new Date('2026-11-09T09:30:00Z') })
    await render(<FriseCommande commande={commande('ERR-AAAA-BBBB', 'Atelier A', 'confirmee', borne)} />)
    expect(document.querySelector('[data-etape="livraison"]')?.textContent).toContain(t.frise.auPlusTard('9 novembre 2026'))
  })

  it('annulée après un paiement constaté : paiement daté puis annulée, renvoi vers l’équipe sans délai', async () => {
    await render(
      <FriseCommande
        commande={commande('ERR-AAAA-BBBB', 'Atelier A', 'annulee', etapes(recue, { cle: 'paiement', faite: true, date: new Date('2026-11-04T09:30:00Z'), fin: null }, { cle: 'annulee', faite: true, date: null, fin: null }))}
      />,
    )
    const items = Array.from(document.querySelectorAll('ol > li'))
    expect(items.map((li) => li.getAttribute('data-etape'))).toEqual(['recue', 'paiement', 'annulee'])
    expect(items[1].textContent).toContain('4 novembre 2026')
    expect(items[2].textContent).toContain(t.frise.annuleePayee)
    expect(corps()).not.toMatch(/\d+ (jours?|heures?)/)
  })

  it('annulée : reçue puis annulée, sans date ni étape à venir', async () => {
    await render(<FriseCommande commande={commande('ERR-AAAA-BBBB', 'Atelier A', 'annulee', etapes(recue, { cle: 'annulee', faite: true, date: null, fin: null }))} />)
    expect(corps()).toContain(t.frise.etapes.annulee)
    expect(corps()).toContain(t.frise.annulee)
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(0)
    expect(corps()).not.toContain(t.frise.aVenir)
  })
})

describe('Commandes et page close', () => {
  it('mixte : chaque carte à son état, numéros, artiste, œuvres, délai ; Conseil reçu ; ni adresse ni compte', async () => {
    await render(
      <ListeSuivi
        commandes={[commande('ERR-AAAA-BBBB', 'Atelier A', 'confirmee', confirmee), commande('ERR-CCCC-DDDD', 'Atelier B', 'annulee', etapes(recue, { cle: 'annulee', faite: true, date: null, fin: null }))]}
        conseil={<a href="https://wa.me/0?text=ERR-AAAA-BBBB">Conseil</a>}
      />,
    )
    const etat = (n: string) => document.querySelector(`#commande-${n}`)?.closest('section')?.querySelector('[data-etat]')?.textContent
    expect(etat('ERR-AAAA-BBBB')).toBe(t.etats.confirmee)
    expect(etat('ERR-CCCC-DDDD')).toBe(t.etats.annulee)
    for (const attendu of ['ERR-AAAA-BBBB', 'Atelier A', 'Titre ERR-AAAA-BBBB', t.delai(8, 12)]) expect(corps()).toContain(attendu)
    expect(document.querySelectorAll('ol')).toHaveLength(2)
    expect(document.querySelector('a[href^="https://wa.me/"]')?.textContent).toBe('Conseil')
    expect(corps()).not.toMatch(/compte|connexion|inscri|rembours/i)
  })

  it('en attente seule : message d’attente, jamais « Confirmée »', async () => {
    await render(<ListeSuivi commandes={[commande('ERR-AAAA-BBBB', 'Atelier A', 'en_attente_paiement', etapes(recue, { cle: 'paiement', faite: false, date: null, fin: null }, { cle: 'livraison', faite: false, date: null, fin: null }))]} conseil={null} />)
    expect(corps()).toContain(t.attente)
    expect(corps()).not.toContain(t.etats.confirmee)
  })

  it('page close : message unique, lien vers l’accueil, Conseil reçu, aucune donnée de commande', async () => {
    const ecran = await render(<SuiviClos conseil={<a href="https://wa.me/0">Conseil</a>} />)
    const h1 = ecran.getByRole('heading', { level: 1 }).element()
    expect(h1.textContent).toBe(t.inactif.titre)
    expect(h1.hasAttribute('tabindex')).toBe(false)
    expect(corps()).toContain('Ce lien de suivi n’est plus actif : la commande est close.')
    expect(document.querySelector('a[href="/"]')?.textContent).toBe(t.inactif.accueil)
    expect(document.querySelector('a[href^="https://wa.me/"]')).not.toBeNull()
    expect(document.querySelectorAll('ol, section')).toHaveLength(0)
  })
})

describe('Chargement et erreur', () => {
  it('chargement : message pour les lecteurs d’écran, région occupée', async () => {
    const { default: Chargement } = await import('@/app/suivi/loading')
    const ecran = await render(<Chargement />)
    expect(ecran.getByRole('status').element().getAttribute('aria-busy')).toBe('true')
    expect(corps()).toContain(t.chargement)
  })

  it('erreur : « Réessayer » relance le rendu serveur et la frontière', async () => {
    const { default: Erreur } = await import('@/app/suivi/error')
    const reset = vi.fn()
    const ecran = await render(<Erreur error={new Error('x')} reset={reset} />)
    expect(ecran.getByRole('alert').element().textContent).toContain(t.panne)
    await ecran.getByRole('button', { name: t.reessayer }).click()
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(reset).toHaveBeenCalled()
  })
})
