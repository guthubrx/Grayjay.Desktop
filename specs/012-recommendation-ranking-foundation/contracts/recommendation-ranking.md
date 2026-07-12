# Contrat de classement des recommandations

## Entree

Un lot de candidats videos avec metadonnees ordinaires et, facultativement, des signaux d'interet editorial ou de pertinence.

## Sortie

Une liste stable de resultats comportant un score final et le detail des signaux utilises. A signaux egaux, l'ordre fournisseur `fallbackOrder`, puis la cle stable, determinent le resultat.

## Invariants

- Aucun signal absent ne vaut artificiellement zero.
- Les compteurs de vues ne sont jamais stockes ou actualises par le classificateur.
- Le classificateur ne deplace pas une video hors du lot que son appelant lui fournit.
- Les listes personnelles et la recherche standard ne lui passent pas leurs elements.

## Degradation

- Sans date ni vues, un candidat peut etre classe par son ordre de repli et son interet editorial s'il existe.
- Sans Smart Chapters, le signal editorial est absent sans erreur ni appel supplementaire.
