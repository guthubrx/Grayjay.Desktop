# Contrat Discovery Search

## Chargement

`POST /smartsearch/Load` accepte en plus du contrat historique :

```json
{
  "discovery": {
    "userLanguage": "fr",
    "axes": [
      {"id": "core", "label": "fonctionnement", "queries": {"en": "heat pump operation", "fr": "fonctionnement pompe a chaleur"}}
    ]
  },
  "languages": ["ja", "ar"],
  "maxParallelism": 3
}
```

La premiere etape est demarree pendant `Load`. L'anglais et les langues configurees restantes sont conservees dans la meme session.

## Etape suivante

`POST /smartsearch/StartNextDiscoveryStage` avec `{ "sessionId": "..." }` demarre la prochaine etape non lancee et retourne le snapshot de session. Un appel supplementaire une fois toutes les etapes lancees ne modifie rien.

## Traducteur

L'operation `translate-query-variants` prend les requetes anglaises par axe et les langues manquantes. Elle renvoie des objets `{ "key", "language", "text" }` dans le meme JSON stdout que les operations existantes.
