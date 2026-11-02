// Charte artiste (story 2.4), acceptée à l'activation de l'invitation. Version provisoire rédigée
// à partir des décisions du porteur (docs/decisions-porteur.md), à relire par lui. Toute
// modification du texte change la version : l'acceptation enregistre la version lue.

export const CHARTE_ARTISTE_VERSION = '2026-11-02-provisoire'

export const CHARTE_ARTISTE: { titre: string; texte: string }[] = [
  {
    titre: 'Des œuvres originales',
    texte:
      'Vous ne proposez que des œuvres originales dont vous êtes l’auteur et dont vous pouvez disposer librement. Vous les décrivez fidèlement : technique, dimensions, année, état.',
  },
  {
    titre: 'Des photos fidèles',
    texte:
      'Vos photos montrent l’œuvre telle qu’elle est, en lumière du jour, sans retouche qui en change les couleurs ou l’aspect.',
  },
  {
    titre: 'Une disponibilité à jour',
    texte:
      'Si une œuvre est vendue ailleurs ou retirée, vous l’indiquez sans délai dans votre espace, pour qu’elle ne soit jamais vendue deux fois.',
  },
  {
    titre: 'Un envoi soigné et dans les délais',
    texte:
      'Vous emballez l’œuvre avec soin et l’expédiez dans les délais que vous avez annoncés pour la zone de l’acheteur, avec un numéro de suivi.',
  },
  {
    titre: 'La reprise en cas de retour',
    texte:
      'Vous acceptez de reprendre une œuvre retournée, dans les conditions de retour qu’Errancy vous communiquera avant l’ouverture des ventes en ligne.',
  },
  {
    titre: 'La commission d’Errancy',
    texte:
      'Vous restez le vendeur de vos œuvres ; Errancy est l’intermédiaire et perçoit une commission de 30 % sur chaque vente réalisée par le site.',
  },
  {
    titre: 'La sélection par l’équipe',
    texte:
      'Chaque œuvre est relue par l’équipe Errancy avant d’être publiée. L’équipe peut demander des compléments, refuser une œuvre ou retirer une œuvre qui ne respecte pas cette charte.',
  },
]
