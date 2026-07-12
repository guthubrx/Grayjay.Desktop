# ADR 014 : Recherche de Smart Mix par etapes et parallelisme borne

**Statut** : Accepte

## Decision

Smart Mix reutilise les quatre requetes precalculees. Il lance d'abord la langue de l'utilisateur, puis l'anglais, puis les langues configurees restantes. Les appels vers les plateformes sont limites par session au point de creation des pagers, car c'est la que Grayjay lance reellement une tache par plugin.

## Consequences

- Les premiers resultats arrivent plus vite et les resultats tardifs enrichissent seulement la queue non lue.
- Les profils precomputes evitent les appels Routr au clic; les langues absentes utilisent un unique lot de traduction de secours.
- Le parallelisme reste un compromis configurable entre vitesse et pression sur les plateformes.
