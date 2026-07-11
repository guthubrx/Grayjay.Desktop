# ADR 003: Snapshot de Feed dans le Backend

**Statut**: Accepte
**Date**: 2026-07-11

## Contexte

Le cache frontend de demarrage repose sur `localStorage`, mais Grayjay cree une nouvelle origine locale et un nouveau profil CEF temporaire a chaque lancement. Ce cache n'est donc pas disponible au redemarrage.

## Decision

Conserver un snapshot borne et derive du feed dans le repertoire applicatif backend. Le snapshot est mis a jour en arriere-plan a partir du cache d'abonnements existant, lu sans construire de pager et remplace ensuite par les flux cache/live existants.

## Consequences

### Positives

- Le resultat survit au redemarrage sans changer la confidentialite du navigateur embarque.
- Le chemin du premier rendu n'attend plus la reconstruction du cache complet.
- Souscriptions et Highlights reutilisent le meme contenu de demarrage.

### Negatives

- Une petite duplication derivee existe a cote de la base de cache.
- Le premier lancement apres installation reste soumis au chargement normal.
- Le snapshot peut etre legerement ancien jusqu'a ce que le live le remplace.

## Alternatives Rejetees

- Profil Chromium permanent et port fixe.
- Relying uniquement sur `localStorage`.
- Reconstruction complete du cache au montage de chaque page.
