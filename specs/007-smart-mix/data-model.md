# Modele de donnees : Smart Mix

## `VideoHighlightMixProfile`

Champ optionnel ajoute a un `VideoHighlightSet`.

| Champ | Type | Regle |
|---|---|---|
| `topics` | `string[]` | 1 a 6 libelles canoniques anglais, sujets principaux de la video. |
| `relatedTopics` | `string[]` | 0 a 6 libelles canoniques anglais, sujets qui elargissent naturellement le sujet principal. |
| `angleLabels` | `string[]` | 0 a 4 libelles canoniques anglais, cadrages, methodes, consequences ou limites presentes. |

Invariants :

- Chaque libelle est nettoye, non vide et borne a 80 caracteres.
- Chaque liste est dedupliquee de facon insensible a la casse.
- Les champs sont optionnels pour lire les anciens JSON sans migration destructive.
- Le profil ne contient pas de transcript, de cue, de donnees utilisateur ni de jugement de verite.

Exemple :

```json
{
  "topics": ["artificial intelligence agents", "software development"],
  "relatedTopics": ["developer productivity", "enterprise adoption"],
  "angleLabels": ["implementation workflow", "risk assessment"]
}
```

## `VideoHighlightMixCandidate`

Projection locale retournee au frontend lors de la creation d'un mix.

| Champ | Source | Usage |
|---|---|---|
| `videoUrl`, `video`, `updatedAt` | highlight et cache video | lecture et deduplication |
| `mixProfile` | highlight | classement semantique prioritaire |
| `globalSummary`, `theses` | highlight | repli pour les anciens highlights |
| `averageScore`, `topScore`, `interestingDuration` | resume d'interet | qualite de video |
| `segments` | highlight, projection compacte | identifier le chapitre le plus pertinent et sa raison |

La projection ne transporte aucun sous-titre ni transcript brut.

## `SmartMixSettings`

Persistance locale sous la cle `smartMix.settings`.

| Champ | Type | Defaut |
|---|---|---|
| `closePercentage` | entier multiple de 5 | 60 |
| `relatedPercentage` | entier multiple de 5 | 25 |
| `newAnglePercentage` | entier multiple de 5 | 15 |

Invariant de persistence : les trois valeurs sont entre 0 et 100, multiples de 5 et leur somme vaut 100. Une valeur corrompue ou absente revient aux valeurs par defaut.

## `SmartMixEntry`

Resultat fixe passe a la file de lecture.

| Champ | Description |
|---|---|
| `video` | Video complete a lire. |
| `category` | `close`, `related` ou `new-angle`. |
| `reason` | Libelle utilisateur : `Meme sujet`, `Elargit le sujet`, `Autre angle`. |
| `relevantChapter` | Chapitre ayant apporte le meilleur lien, optionnel et uniquement informatif. |
| `rank` | Rang local de stabilite pour rendre le calcul reproductible. |

## Compatibilite

- `VideoHighlightSet.SchemaVersion` avance de maniere additive.
- Les clients anciens ignorent `mixProfile`.
- Les anciens highlights sans `mixProfile` sont convertis en candidat de repli a partir de `globalSummary`, `theses` et des segments.
- L'absence de Smart Chapters supprime seulement l'action Smart Mix ; elle ne modifie pas les autres surfaces de BlueJay.
