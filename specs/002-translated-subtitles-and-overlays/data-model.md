# Modèle de données

## Transcript traduit

Fichier local associé à une vidéo et une langue cible.

| Champ | Rôle |
|---|---|
| `schemaVersion` | Version du format de cache. |
| `videoUrl` | Identité de la vidéo. |
| `targetLanguage` | Langue cible explicite. |
| `sourceTranscriptHash` | Empreinte du transcript source; invalide le cache si les cues changent. |
| `createdAt` | Date de création. |
| `cues` | Cues traduits avec `start`, `end`, `text`. |

## Invariants

- Une cue traduite garde les bornes de temps source correspondantes.
- Les entrées invalides, vides ou sans bornes valides sont rejetées.
- L'absence du fichier est un état normal: les sous-titres source restent disponibles.
- Les highlights existants restent compatibles; seule leur génération future utilise la langue configurée.
