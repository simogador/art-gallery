import { randomInt } from 'node:crypto'

// Numéro lisible d'une commande (décision du porteur du 2026-11-11) : « ERR- » puis huit caractères
// aléatoires en deux groupes de quatre (ex. ERR-7K4M-9Q2X), sans lettres ni chiffres ambigus
// (pas de 0, 1, I, L, O, U). Seul générateur du module ; l'unicité est garantie par la base.

export const PREFIXE_NUMERO = 'ERR-'
export const ALPHABET_NUMERO = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
export const FORME_NUMERO = /^ERR-[ABCDEFGHJKMNPQRSTVWXYZ2-9]{4}-[ABCDEFGHJKMNPQRSTVWXYZ2-9]{4}$/

function groupe(): string {
  let texte = ''
  for (let i = 0; i < 4; i++) texte += ALPHABET_NUMERO[randomInt(ALPHABET_NUMERO.length)]
  return texte
}

/** Un numéro tiré au hasard (non vérifié contre la base). */
export function genererNumero(): string {
  return `${PREFIXE_NUMERO}${groupe()}-${groupe()}`
}
