# Modele de donnees - echelle d'interet a dix paliers

## Signal d'interet video existant

| Champ | Type | Regle |
|---|---|---|
| `score` | nombre `[0, 1]` | Conserve tel quel ; aucun algorithme de calcul ne change. |
| `stars` | nombre | Devient une des dix valeurs de `0,5` a `5,0`. |
| `label` | texte | Devient le libelle francais associe au palier. |
| `ratingText` | texte derive | Forme accessible et visible, par exemple `3,5 / 5`. |

## Palier d'interet derive

| Champ | Type | Regle |
|---|---|---|
| `minimumScore` | nombre | Borne incluse documentee dans `research.md`. |
| `stars` | nombre | Multiple de `0,5`, compris entre `0,5` et `5`. |
| `label` | texte | Un des dix libelles francais stables. |

## Invariants

- Un score non fini est borne a `0` avant conversion.
- La note derivee n'est jamais `0`, `> 5` ni un multiple autre que `0,5`.
- Les anciens fichiers highlights sans `editorialProfile` restent lisibles avec le calcul historique.
- `segment.score` et `recommendationScore` ne sont pas lus ni ecrits par la conversion de palier.

## Profil editorial versionne

| Champ | Type | Regle |
|---|---|---|
| `version` | entier | `1` pour cette premiere grille. |
| `genre` | texte | Contexte descriptif parmi les genres canoniques ; il ne donne aucun bonus direct. |
| `substance` | nombre `[0, 1]` | Densite de contenu utile, explications et specificite. |
| `rigor` | nombre `[0, 1]` | Ancrage des affirmations, nuances, limites et elements concrets. |
| `clarity` | nombre `[0, 1]` | Structure, pedagogie et facilite a suivre. |
| `distinctiveness` | nombre `[0, 1]` | Angle, exemples ou traitement qui apportent plus qu'une repetition generique. |
| `audienceValue` | nombre `[0, 1]` | Utilite pratique ou force narrative pour un spectateur interesse. |
| `temporalSensitivity` | nombre `[0, 1]` | Vitesse a laquelle l'actualite reduit la priorite de recommandation, jamais la valeur editoriale. |
| `confidence` | nombre `[0, 1]` | Confiance de l'analyse au regard du transcript et des informations disponibles. |
| `rationale` | texte court | Justification factuelle visible pour audit, exclue de l'index compact des cartes. |

Le score editorial est derive localement :

```text
0,28 * substance + 0,25 * rigor + 0,20 * clarity
+ 0,15 * distinctiveness + 0,12 * audienceValue
```

Cette formule est stable et ne lit ni la date, ni le nombre de vues, ni la popularite.
