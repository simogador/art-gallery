// Story 3.1 (décision du porteur du 2026-11-05) : pages pas encore refaites, exemptées du scan
// des classes interdites de tests/interface-accessible.test.ts (couleurs de texte, directions
// physiques). Le socle global (lien d'évitement, focus, mouvement réduit) vaut aussi pour elles.
// Fichiers nommés un à un (un nouveau fichier n'est jamais exempté) ; un fichier qui passe le
// scan doit être retiré (le test le vérifie). Cette liste ne fait que diminuer : chaque story
// qui refait une de ces pages la retire ; la CI échoue si une entrée y est ajoutée
// (scripts/verifier-exceptions-prisma.cjs origin/main tests/exceptions-interface.cjs).
module.exports = [
  'src/app/galerie/[id]/ArtworkDetail.tsx', // fiche, stories 3.5 à 3.8
]
