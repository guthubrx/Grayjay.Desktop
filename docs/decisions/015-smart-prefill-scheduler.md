# ADR 015 : un ordonnanceur Highlights unique pour le Smart Prefill

**Statut** : accepte  
**Date** : 2026-07-13

## Contexte

BlueJay peut declencher des analyses depuis plusieurs parcours. Lancer directement la commande depuis chaque ecran rendrait le parallelisme, les erreurs et les doublons difficiles a controler.

## Decision

Etendre `StateHighlightsIndexer` avec une priorite, une source, un cooldown et une limite de travailleurs configurable. Les surfaces front-end ne font qu'emettre des demandes idempotentes vers ce point commun.

L'ordonnanceur exige desormais un VTT plateforme materialisable pour chaque travail lance dans BlueJay. Le Smart Mix sonde ses candidats avant de les inserer, puis maintient une fenetre glissante de videos courante et futures. Les sous-titres absents ne constituent pas une erreur de lecture et ne declenchent jamais Whisper dans BlueJay.

Whisper quitte le parcours interactif : la passe reguliere de pre-calcul est sous-titres uniquement, tandis qu'un LaunchAgent nocturne se limite aux groupes ou chaines explicitement declares dans `/Users/moi/Nextcloud/10.Scripts/grayjay/precompute.env`.

## Consequences

- Positives : une seule file observable, priorites previsibles, reutilisation des sous-titres et du WebSocket existants, zero secret duplique; le GPU ne peut plus etre sollicite par Whisper depuis une interaction de lecture.
- Negatives : certains Smart Mix auront moins de candidats, voire aucun, si les resultats de plateforme n'exposent pas de VTT. Le plafond est garanti dans le processus BlueJay, pas pour un script de backfill autonome qui execute ses propres processus.
- Rejet : un scheduler front-end ou une file par ecran aurait augmente le couplage et permis une saturation de Routr.
