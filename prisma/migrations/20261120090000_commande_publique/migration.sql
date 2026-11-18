-- Story 7.3 : jeton qui rattache le navigateur d'un acheteur sans compte à son passage en caisse (AD-14). Migration additive : une valeur d'enum.
ALTER TYPE "UsageJeton" ADD VALUE 'commande_publique';
