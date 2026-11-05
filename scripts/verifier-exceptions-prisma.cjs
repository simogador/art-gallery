// Story 1.6 (AD-1) : la liste d'exceptions Prisma ne peut que raccourcir par rapport à main.
// Story 3.1 : même contrôle pour la liste d'exceptions d'interface (tests/exceptions-interface.cjs).
// Usage : node scripts/verifier-exceptions-prisma.cjs [référence git, par défaut origin/main] [liste]
// (liste par défaut : eslint/exceptions-prisma.cjs)
const { execFileSync } = require('node:child_process')
const { existsSync, mkdtempSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')

const reference = process.argv[2] || 'origin/main'
const CHEMIN = process.argv[3] || 'eslint/exceptions-prisma.cjs'
const PRISMA = CHEMIN === 'eslint/exceptions-prisma.cjs'
const NOM = PRISMA ? 'Exceptions Prisma' : `Exceptions de ${CHEMIN}`

// La liste est chargée comme ESLint la charge (require), quelle que soit sa mise en forme.
// Fichier supprimé = liste vide (toutes les exceptions ont été migrées).
const charger = (fichier) => (existsSync(fichier) ? new Set(require(path.resolve(fichier))) : new Set())

try {
  execFileSync('git', ['rev-parse', '--verify', '--quiet', `${reference}^{commit}`], { stdio: 'ignore' })
} catch {
  console.error(`Référence ${reference} introuvable : récupérez-la (git fetch origin main).`)
  process.exit(2)
}

let sourceReference
try {
  sourceReference = execFileSync('git', ['show', `${reference}:${CHEMIN}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
} catch {
  console.log(`${CHEMIN} absent de ${reference} : rien à comparer.`)
  process.exit(0)
}

const copie = path.join(mkdtempSync(path.join(tmpdir(), 'exceptions-')), 'reference.cjs')
writeFileSync(copie, sourceReference)
const avant = charger(copie)
const apres = charger(CHEMIN)
const ajouts = [...apres].filter((f) => !avant.has(f))

if (ajouts.length > 0) {
  console.error(`${NOM} ajoutées par rapport à ${reference} (la liste ne fait que diminuer) :`)
  for (const f of ajouts) console.error(`  - ${f}`)
  console.error(
    PRISMA
      ? 'Passez par un module de src/lib/<module>/ au lieu d’ajouter une exception.'
      : 'Corrigez le fichier (règles d’interface, story 3.1) au lieu d’ajouter une exception.',
  )
  console.error(`Si ces entrées ont été retirées sur ${reference} par une autre PR, fusionnez ${reference} dans votre branche.`)
  process.exit(1)
}
console.log(`${NOM} : ${apres.size} (${avant.size} sur ${reference}), aucun ajout.`)
