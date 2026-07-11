# Contrat local Smart TV - Session editoriale fixe

Cette fonctionnalite n'ajoute aucun endpoint HTTP. Le contrat est interne entre le constructeur de session, `VideoProvider` et l'overlay de lecture.

## Reglages reflechis par le backend

Dans `XrayPanel.SmartTv` :

```text
EditorialMix: 0 = Balanced, 1 = Stay on topic, 2 = Explore
CreatorVariety: 0 = None, 1 = Light, 2 = Medium, 3 = Strong
```

Les valeurs absentes de profils precedents sont resolues respectivement vers `Balanced` et `Light`.

## Entree de session persistee

Extension retrocompatible de l'entree Smart TV locale :

```json
{
  "chapterKey": "youtube:example:120-270",
  "score": 0.91,
  "transition": {
    "kind": "same-topic",
    "label": "Same topic",
    "similarity": 0.67
  }
}
```

- `transition` est optionnel afin de lire les sessions creees avant cette PR.
- La premiere entree peut ne pas posseder de `transition`.
- `best-available` signifie un repli de pertinence, pas une affirmation semantique.

## Metadonnee de file

`VideoQueueItemMeta` accepte deux champs Smart TV optionnels :

```text
transitionKind?: 'same-topic' | 'discover' | 'new-angle' | 'best-available'
transitionLabel?: string
```

Les files non Smart TV ne les renseignent pas. L'overlay affiche le label seulement lorsqu'il est present.

## Garanties de compatibilite

- L'API de reglages existante continue de serialiser les nouveaux dropdowns avec les autres champs Smart TV.
- Aucune modification du contrat de lecture, de l'historique general, du prechargement, du cast ou de Smart Chapters n'est necessaire.
- En absence de Smart Chapters, aucune session nouvelle n'est construite et l'application conserve le comportement Home habituel.
