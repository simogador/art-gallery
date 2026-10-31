// Pays (ISO 3166-1 alpha-2), sans accès à la base : importable côté client (story 2.3).
// Les 249 codes officiels, plus XK (Kosovo, code d'usage reconnu par les transporteurs et Stripe).

const CODES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS
BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE
EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM
HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC
LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA
NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO
TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK
`

export const CODES_PAYS: readonly string[] = CODES.trim().split(/\s+/)

const ENSEMBLE = new Set(CODES_PAYS)

export function estCodePays(code: string): boolean {
  return ENSEMBLE.has(code)
}

const NOMS = new Intl.DisplayNames(['fr'], { type: 'region' })

/** Nom français d'un pays (« Maroc », « Côte d'Ivoire ») ; le code lui-même si inconnu. */
export function nomPays(code: string): string {
  try {
    return NOMS.of(code) ?? code
  } catch {
    return code
  }
}

/** Codes sans doublon, triés par nom français. */
export function trierParNom(codes: Iterable<string>): string[] {
  return [...new Set(codes)].sort((a, b) => nomPays(a).localeCompare(nomPays(b), 'fr'))
}

/** Pays que « Cocher tous les pays sans zone » ajoute : ni dans une autre zone, ni déjà cochés. */
export function paysSansZone(autresZones: Record<string, unknown>, coches: ReadonlySet<string>): string[] {
  return trierParNom(CODES_PAYS).filter((c) => !(c in autresZones) && !coches.has(c))
}
