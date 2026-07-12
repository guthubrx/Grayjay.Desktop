# ADR 013 : Precalculer les requetes de decouverte avec les Smart Chapters

**Statut** : Accepte

## Decision

Le premier appel LLM Smart Chapters produit aussi les axes et requetes de decouverte. Les traductions sont stockees dans le highlight, indexees par langue. Les langues absentes restent enrichissables plus tard; elles ne demandent ni Whisper ni regeneration de chapitres.

## Consequences

- Create Smart Mix peut partir de requetes courtes et explicables.
- Le cout marginal est une sortie JSON plus grande dans un appel deja realise.
- Le schema reste optionnel, donc Grayjay standard et les highlights historiques restent compatibles.
