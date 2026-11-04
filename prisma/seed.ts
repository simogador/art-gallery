import { config } from "dotenv";
config({ path: ".env.local" });

import { amorcageInterdit, AmorcageProductionInterdit } from "../src/lib/garde-production";

// Story 2.9 (FR-16) : le seed ne crée plus aucun catalogue de démonstration (œuvres, artistes,
// expositions) et refuse de s'exécuter sur la production. Les données réelles se créent depuis
// l'application : zones de départ par scripts/sql/zones-depart.sql (ou /dashboard/admin/zones),
// artistes par invitation (/dashboard/admin/artistes), œuvres par le dépôt puis la curation.
// Les artistes et œuvres de démonstration déjà en base restent masqués du site public par la règle
// « accord signé requis » (module disponibilite), sans modification des données.

function main(env: Record<string, string | undefined> = process.env) {
  if (amorcageInterdit(env)) throw new AmorcageProductionInterdit();
  console.log("Aucun catalogue de démonstration n'est créé (story 2.9) : rien à amorcer.");
  console.log("Zones de livraison : scripts/sql/zones-depart.sql ; artistes : invitation depuis /dashboard/admin/artistes.");
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
