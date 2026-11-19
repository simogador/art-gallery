-- Story 7.7 : lien de suivi des commandes d'un acheteur sans compte (AD-14). Migration additive : une valeur d'enum.
ALTER TYPE "UsageJeton" ADD VALUE 'suivi';
