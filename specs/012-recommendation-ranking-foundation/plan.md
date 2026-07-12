# Plan : Socle de classement des recommandations

## Contexte technique

BlueJay possede deja les metadonnees de date et de vues dans `IPlatformVideo`, une valeur editoriale derivee des highlights dans `highlightInterest`, et des points de selection Home/Smart TV. Ces chemins utilisent aujourd'hui des formules distinctes ou l'ordre fournisseur.

## Architecture

1. Creer un utilitaire TypeScript pur de classement generique, sans import Smart, qui normalise popularite, fraicheur et signaux facultatifs.
2. Extraire dans `highlightInterest` une valeur editoriale independante de la fraicheur. Cette valeur devient l'entree optionnelle du classement generique.
3. Ajouter de petits adaptateurs Home qui construisent des candidats depuis `IPlatformVideo` et le cache de summaries, puis reutilisent le classement pour les surfaces editoriales.
4. Ajouter au candidat Smart TV un rang video optionnel. Le sequencer conserve les seuils et le score de chapitre, et utilise ce rang seulement pour departager des chapitres comparables.

## Surfaces concernees

- Hero Highlights : oui, avec l'intercalage abonnements/recommandations conserve.
- Watch now : oui.
- Lignes de groupes : oui, sans sortie du groupe.
- Sources et sessions Smart TV : oui.
- Continue watching, Watch later, recherche standard, pages de chaine : non.

## Verification

- Tests unitaires du classificateur : vues logarithmiques, absence de signal, stabilite, pertinence et contenu editorial.
- Tests unitaires de la valeur editoriale : independance vis-a-vis des vues et de la fraicheur.
- Tests Smart TV : le rang video departage deux chapitres de valeur proche sans contourner le minimum de chapitre.
- Tests TypeScript cibles puis build web Vite.

## Decisions de simplicite

- Aucun nouveau store ni reglages : les poids sont des constantes documentees dans un seul module.
- Aucun schema persistant : le classement est recalcule sur les lots deja charges.
- Aucune integration de recherche : les PR 013 et 014 fourniront, facultativement, les signaux semantiques et les resultats externes.
