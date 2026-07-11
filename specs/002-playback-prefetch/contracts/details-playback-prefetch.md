# Contrat local Details — Préchargement de lecture

## Préparer la prochaine vidéo

`GET /details/VideoPrepare?url={encodedUrl}`

En-tête existant obligatoire : `WindowID`.

Réponse `200` :

```json
{
  "url": "https://example/video",
  "status": "prepared",
  "elapsedMs": 842,
  "sourceReady": true,
  "manifestReady": true
}
```

Valeurs de `status` :

- `prepared` : résultat frais disponible ;
- `deduplicated` : une préparation identique était déjà disponible ou en cours ;
- `superseded` : la cible a été remplacée avant sa résolution ;
- `disabled` : réglage de préchargement désactivé ;
- `failed` : échec non bloquant, journalisé ; la lecture utilisera le chemin normal.

L'endpoint ne modifie jamais la vidéo active et ne déclenche aucun effet d'historique, de progression, de live chat ou de lecture.
`sourceReady` indique que la sélection automatique est disponible. `manifestReady` indique que le manifeste nécessaire est déjà généré, ou qu'aucun manifeste local n'est requis pour cette source.

## Annuler la préparation

`DELETE /details/VideoPrepare`

En-tête existant obligatoire : `WindowID`.

Réponse `200` sans contenu métier. Le résultat prêt est libéré et la cible désirée est invalidée. Un appel plugin synchrone déjà engagé peut terminer, mais son résultat ne peut plus être publié.

## Charger une vidéo

Contrat existant : `GET /details/VideoLoad?url={encodedUrl}`.

Champs ajoutés, rétrocompatibles :

```json
{
  "video": {},
  "local": null,
  "prefetched": true,
  "sourceReady": true,
  "manifestReady": true,
  "source": {
    "url": "/details/SourceDash?...",
    "type": "application/dash+xml",
    "videoIndex": 0,
    "audioIndex": 0,
    "subtitleIndex": -1,
    "videoIsLocal": false,
    "audioIsLocal": false,
    "subtitleIsLocal": false
  }
}
```

- `prefetched=false` ou champ absent conserve le comportement historique.
- `source` est optionnel ; son absence impose le flux `SourceAuto` existant.
- Une source jointe reste liée au `DetailsState` activé par ce même appel.
- Le cache de manifeste et les exécuteurs préparés sont transférés avant que le lecteur ne demande `SourceDash`.
