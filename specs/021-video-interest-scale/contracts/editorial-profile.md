# Contrat de donnees - Profil editorial video

## Persistance highlight

```json
{
  "editorialProfile": {
    "version": 1,
    "genre": "documentary",
    "substance": 0.86,
    "rigor": 0.78,
    "clarity": 0.81,
    "distinctiveness": 0.72,
    "audienceValue": 0.84,
    "temporalSensitivity": 0.18,
    "confidence": 0.82,
    "rationale": "Evidence-based contextual documentary with concrete testimony and clear limits."
  }
}
```

## Validation

- `version` vaut exactement `1`.
- `genre` appartient a la liste canonique documentee par le generateur.
- Chaque valeur numerique est finie et comprise entre `0` et `1`.
- `rationale` est factuel, optionnel et limite a 280 caracteres.
- Aucun champ ne mesure l'accord avec les opinions exprimees dans la video.

## Lecture frontend

- La note visible derive des cinq dimensions stables.
- `temporalSensitivity` est transmise au classement comme parametre optionnel de fraicheur.
- `rationale` n'est pas conserve dans l'index compact des cartes.
