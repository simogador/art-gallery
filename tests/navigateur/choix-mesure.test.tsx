import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'

// Bannière de choix de mesure dans un vrai navigateur : l'appel à /api/mesure est simulé. La
// conservation du choix (cookie d'un an) est celle du serveur, vérifiée dans tests/mesure.test.ts :
// ici, le composant reçoit le choix lu par le serveur (`choix`) et ne montre rien quand il existe.
const fetchSimule = vi.fn()

const { ChoixMesure, BoutonGererMesure } = await import('@/components/ui/ChoixMesure')
const t = fr.mesure

const corpsEnvoyes = () => fetchSimule.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string))

beforeEach(() => {
  fetchSimule.mockReset()
  fetchSimule.mockResolvedValue(new Response('{"ok":true}'))
  vi.stubGlobal('fetch', fetchSimule)
})

describe('ChoixMesure (navigateur)', () => {
  it('premier visiteur : bannière non bloquante, « Accepter » et « Refuser » également visibles, aucun envoi', async () => {
    const ecran = await render(<ChoixMesure choix={null} />)
    await expect.element(ecran.getByText(t.titre)).toBeVisible()
    const accepter = ecran.getByRole('button', { name: t.accepter })
    const refuser = ecran.getByRole('button', { name: t.refuser })
    await expect.element(accepter).toBeVisible()
    await expect.element(refuser).toBeVisible()
    // Même taille, mêmes classes : aucun des deux n'est mis en avant.
    expect(accepter.element().className).toBe(refuser.element().className)
    // Non bloquante : ni fenêtre modale, ni dialogue, ni fond grisé ; la page reste utilisable.
    expect(document.querySelector('dialog, [role="dialog"], [aria-modal="true"]')).toBeNull()
    expect(document.activeElement).toBe(document.body)
    expect(fetchSimule).not.toHaveBeenCalled()
  })

  it('« Accepter » : choix envoyé au serveur, bannière fermée, choix annoncé', async () => {
    const ecran = await render(<ChoixMesure choix={null} />)
    await ecran.getByRole('button', { name: t.accepter }).click()
    await vi.waitFor(() => expect(corpsEnvoyes().filter((c) => c.type === 'consentement')).toHaveLength(1))
    expect(corpsEnvoyes().find((c) => c.type === 'consentement')).toMatchObject({ type: 'consentement', choix: 'accepte' })
    expect(fetchSimule.mock.calls[0]?.[0]).toBe('/api/mesure')
    await expect.element(ecran.getByRole('button', { name: t.accepter })).not.toBeInTheDocument()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.enregistreAccepte)
  })

  it('« Refuser » : choix envoyé, bannière fermée, aucune arrivée ni source envoyée au serveur pour mesure', async () => {
    const ecran = await render(<ChoixMesure choix={null} />)
    await ecran.getByRole('button', { name: t.refuser }).click()
    await vi.waitFor(() => expect(fetchSimule).toHaveBeenCalledTimes(1))
    expect(corpsEnvoyes()[0]).toMatchObject({ type: 'consentement', choix: 'refuse' })
    await expect.element(ecran.getByRole('button', { name: t.refuser })).not.toBeInTheDocument()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.enregistreRefuse)
  })

  it('choix déjà conservé : aucune bannière ; accepté, l’arrivée est transmise une fois ; refusé, rien n’est envoyé', async () => {
    const accepte = await render(<ChoixMesure choix="accepte" />)
    await expect.element(accepte.getByRole('button', { name: t.accepter })).not.toBeInTheDocument()
    await vi.waitFor(() => expect(fetchSimule).toHaveBeenCalledTimes(1))
    expect(corpsEnvoyes()[0]).toMatchObject({ type: 'arrivee' })
    await accepte.unmount()

    fetchSimule.mockClear()
    const refuse = await render(<ChoixMesure choix="refuse" />)
    await expect.element(refuse.getByRole('button', { name: t.refuser })).not.toBeInTheDocument()
    expect(fetchSimule).not.toHaveBeenCalled()
  })

  it('« Gérer la mesure » rouvre la bannière (focus dessus), un nouveau choix est appliqué et le focus revient au lien', async () => {
    const ecran = await render(
      <>
        <BoutonGererMesure />
        <ChoixMesure choix="accepte" />
      </>,
    )
    await vi.waitFor(() => expect(fetchSimule).toHaveBeenCalledTimes(1))
    fetchSimule.mockClear()

    const lien = ecran.getByRole('button', { name: t.gerer })
    ;(lien.element() as HTMLElement).focus()
    await lien.click()
    await expect.element(ecran.getByRole('button', { name: t.refuser })).toBeVisible()
    const region = ecran.getByRole('region', { name: t.titre })
    await expect.element(region).toHaveFocus()

    await ecran.getByRole('button', { name: t.refuser }).click()
    await vi.waitFor(() => expect(fetchSimule).toHaveBeenCalledTimes(1))
    expect(corpsEnvoyes()[0]).toMatchObject({ type: 'consentement', choix: 'refuse' })
    await expect.element(ecran.getByRole('button', { name: t.refuser })).not.toBeInTheDocument()
    await expect.element(lien).toHaveFocus()
  })

  it.each([
    ['réseau coupé', () => fetchSimule.mockRejectedValue(new Error('réseau'))],
    ['refus du serveur (403)', () => fetchSimule.mockResolvedValue(new Response('{"ok":false}', { status: 403 }))],
    ['erreur du serveur (500)', () => fetchSimule.mockResolvedValue(new Response('{"ok":false}', { status: 500 }))],
  ])('envoi en échec (%s) : la bannière reste ouverte, message neutre, rien d’annoncé', async (_nom, preparer) => {
    preparer()
    const ecran = await render(<ChoixMesure choix={null} />)
    await ecran.getByRole('button', { name: t.accepter }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.echec)
    await expect.element(ecran.getByRole('button', { name: t.accepter })).toBeVisible()
    await expect.element(ecran.getByRole('status')).toHaveTextContent('')
    // Le visiteur peut réessayer : un envoi réussi ferme la bannière.
    fetchSimule.mockReset()
    fetchSimule.mockResolvedValue(new Response('{"ok":true}'))
    await ecran.getByRole('button', { name: t.refuser }).click()
    await expect.element(ecran.getByRole('button', { name: t.refuser })).not.toBeInTheDocument()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.enregistreRefuse)
  })

  it('la bannière publie sa hauteur (plafonnée) dans --hauteur-banniere, retirée à la fermeture', async () => {
    const lire = () => document.documentElement.style.getPropertyValue('--hauteur-banniere')
    const ecran = await render(<ChoixMesure choix={null} />)
    await vi.waitFor(() => expect(parseFloat(lire())).toBeGreaterThan(0))
    expect(document.querySelector('section')!.className).toContain('max-h-[30vh]')
    await ecran.getByRole('button', { name: t.accepter }).click()
    await vi.waitFor(() => expect(lire()).toBe(''))
    // Démontage bannière ouverte : variable retirée aussi.
    const autre = await render(<ChoixMesure choix={null} />)
    await vi.waitFor(() => expect(parseFloat(lire())).toBeGreaterThan(0))
    await autre.unmount()
    expect(lire()).toBe('')
  })
})
