# Modele de donnees

## RecommendationCandidate

Representation transitoire et generique d'une video classable :

- `key` : identifiant stable pour les egalites de rang;
- `publishedAt` : date optionnelle de publication;
- `viewCount` : compteur optionnel de vues;
- `contentInterest` : score editorial optionnel compris entre 0 et 1;
- `semanticRelevance` : pertinence optionnelle comprise entre 0 et 1, reservee aux extensions futures;
- `fallbackOrder` : ordre stable du fournisseur pour les egalites.

## RecommendationScore

Resultat calculable sans effet de bord :

- `score` : rang final normalise;
- `signals` : valeurs normalisees effectivement utilisees;
- `usedSignals` : liste qui explique les signaux disponibles.

Le resultat n'est pas persiste. Les video listes et les sessions Smart TV existantes conservent leurs contrats actuels.

## VideoInterest

Le type existant garde son champ `score`, interprete comme valeur editoriale uniquement. La fraicheur est retiree de son calcul pour eviter un double comptage dans `RecommendationScore`.
