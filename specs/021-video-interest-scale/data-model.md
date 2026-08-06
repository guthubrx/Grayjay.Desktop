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
- Les fichiers highlights ne recoivent aucun nouveau champ persistant.
- `segment.score` et `recommendationScore` ne sont pas lus ni ecrits par la conversion de palier.
