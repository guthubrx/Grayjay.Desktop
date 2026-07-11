# Modele de donnees - Sequencement editorial Smart TV

## SmartTvCandidate

Representation temporaire d'un chapitre eligible avant le calcul de session.

| Champ | Type logique | Regle |
|---|---|---|
| `chapterKey` | chaine | Identifie une plage precise de video ; deja utilise pour l'historique Smart TV. |
| `score` | nombre entre 0 et 1 | Signal principal de pertinence. |
| `durationSeconds` | nombre positif | Compte dans la duree cible. |
| `videoKey` | chaine | Sert aux plafonds et a la penalite video existante. |
| `creatorKey` | chaine optionnelle | Sert a la variete de createur lorsque disponible. |
| `sourceGroup` | chaine optionnelle | Sert a la variete de groupe seulement lorsqu'il est connu. |
| `publishedAt` | instant optionnel | Departage deux candidats de qualite et de sujet comparables. |
| `subjectText` | texte | Concatene titre, resume, these et resume global disponibles ; aucune generation nouvelle. |
| `angleSignal` | booleen | Vrai seulement si le texte contient un indice explicite de limite, risque, critique, consequence ou comparaison. |

## SmartTvTransition

Explication persistante associee a une entree de session, sauf l'ancrage initial.

| Champ | Valeurs | Regle |
|---|---|---|
| `kind` | `same-topic`, `discover`, `new-angle`, `best-available` | Une valeur par passage apres l'ancrage. |
| `label` | chaine courte | Texte rendu dans l'overlay sans devoir recalculer la session. |
| `similarity` | nombre entre 0 et 1 | Signal interne optionnel, utilise pour le diagnostic et les tests, pas comme promesse semantique. |

## SmartTvEditorialSettings

Preferences resolues a partir des dropdowns Smart TV existants.

| Champ | Valeurs | Regle |
|---|---|---|
| `editorialMix` | `balanced`, `stay-on-topic`, `explore` | Regle les poids souples des intentions ; ne change jamais une session deja lancee. |
| `creatorVarietyPenalty` | nombre positif | Penalise une repetition recente de createur, sans devenir une exclusion dure. |
| `repeatVideoPenalty` | nombre positif | Reglage existant conserve. |
| Plafonds existants | duree, videos, chapitres, chapitres/video, score minimal | Contraintes dures evaluees avant les intentions. |

## SmartTvSessionEntry et compatibilite

La session stockee garde ses champs actuels et ajoute `transition?: SmartTvTransition`.

- Une session historique sans `transition` reste lisible et est affichee comme `Best available` quand un label est necessaire.
- `playedChapterKeys` et l'historique global de chapitres restent les sources d'exclusion ; aucun historique de video parallele n'est introduit.
- Les donnees de transition sont un snapshot : elles ne sont pas recalculees pendant la lecture.

## Invariants

- Aucun candidat deja joue ne passe l'etape d'eligibilite.
- Aucun candidat selectionne ne depasse les plafonds durs.
- Le premier candidat est l'ancrage avec le meilleur score admissible, avec un departage stable.
- Tout passage apres l'ancrage porte une intention ou le repli explicite `best-available`.
- Un meme jeu de candidats et de reglages produit le meme ordre.
