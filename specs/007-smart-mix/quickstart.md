# Verification manuelle : Smart Mix

## Preparation

1. Lancer BlueJay avec plusieurs videos deja analysees, dont au moins trois autour d'un meme sujet et provenant idealement de plusieurs createurs.
2. Ouvrir `Settings > Smart Mix`.
3. Verifier les valeurs initiales : `60 % Meme sujet`, `25 % Elargir`, `15 % Autre angle`.

## Reglages

1. Modifier les valeurs par pas de 5.
2. Verifier que la sauvegarde est desactivee tant que le total n'est pas 100 %.
3. Enregistrer `50 / 30 / 20`, fermer puis rouvrir Settings.
4. Verifier que les valeurs sont conservees.

## Creation

1. Ouvrir une video ayant des Smart Chapters.
2. Ouvrir le menu contextuel de la video puis choisir `Create Smart Mix`.
3. Verifier que la lecture demarre avec des videos completes, sans attente de generation IA.
4. Verifier que la video source n'est pas repetee dans le resultat.
5. Lors de chaque passage, verifier que le contexte indique `Meme sujet`, `Elargit le sujet` ou `Autre angle`.

## Degradation

1. Choisir une video dont le highlight est ancien et ne contient pas `mixProfile`.
2. Creer un mix.
3. Verifier qu'un resultat peut etre construit a partir du resume, des theses et des chapitres, sans erreur ni appel IA.

## Stabilite

1. Lancer un mix puis attendre qu'une nouvelle analyse soit ecrite dans le catalogue.
2. Verifier que l'ordre de la file en cours ne change pas.
3. Relancer explicitement `Create Smart Mix` et verifier que seul ce nouveau calcul peut utiliser les nouvelles donnees.
