# Plan D'Implementation: Snapshot de Feed au Demarrage

**Branche**: `pr/persistent-cold-start-feed-cache`
**Date**: 2026-07-11
**Spec**: [spec.md](spec.md)

## Resume Technique

Ajouter un snapshot durable et borne dans le stockage applicatif backend, derive de `StateCache`. Le frontend le charge une fois depuis `StateGlobal`, l'emploie comme premier pager de Souscriptions et comme graine de Highlights, puis conserve les flux cache et live actuels comme sources d'autorite.

## Fichiers Attendus

| Fichier | Responsabilite |
|---|---|
| `Grayjay.ClientServer/States/StateCache.cs` | Planifier, construire, lire et invalider le snapshot derive. |
| `Grayjay.ClientServer/Models/Subscriptions/SubscriptionFeedSnapshot.cs` | Porter le format borne et versionne du snapshot. |
| `Grayjay.ClientServer/Controllers/SubscriptionsController.cs` | Exposer le chargement rapide sans pager. |
| `Grayjay.Desktop.Web/src/backend/SubscriptionsBackend.ts` | Declarer l'appel du contrat existant de pager. |
| `Grayjay.Desktop.Web/src/state/StateGlobal.tsx` | Charger une fois le bootstrap pour toute l'application. |
| `Grayjay.Desktop.Web/src/pages/Subscriptions/index.tsx` | Privilegier le pager statique de bootstrap jusqu'a ce que les pagers existants soient prets. |
| `Grayjay.Desktop.Web/src/pages/Home/index.tsx` | Alimenter hero et lignes de groupes a partir du bootstrap avant le cache reconstruit ou le live. |
| Tests C# et TypeScript cibles | Verifier lecture, filtrage, borne et priorite de rendu. |

## Strategie

1. Introduire le format de snapshot independant et ses tests de lecture/ecriture atomique.
2. Construire le snapshot en arriere-plan apres les mises a jour de `StateCache`, avec debounce et taille limitee.
3. Ajouter le endpoint backend de lecture directe et son contrat frontend.
4. Centraliser la ressource bootstrap dans `StateGlobal` pour eviter des appels concurrents depuis Souscriptions et Highlights.
5. Faire de Souscriptions un rendu stale-while-revalidate: bootstrap, cache pager, puis pager live.
6. Faire de Highlights un rendu stale-while-revalidate: bootstrap pour hero/lignes, puis cache global, cache de groupes et live.
7. Ajouter les tests, construire l'application et realiser le protocole de demarrage a froid.

## Non Objectifs Techniques

- Ne pas modifier les parametres CEF `user-data-dir` ou `cache-path`.
- Ne pas modifier le port aleatoire du serveur local.
- Ne pas utiliser `localStorage` comme garantie de persistance entre lancements.
- Ne pas changer les endpoints de refresh ni leurs politiques de rate limit.

## Gates De Qualite

- Aucun appel reseau depuis le chemin `SubscriptionsBootstrapLoad`.
- Ecriture atomique et lecture tolerante aux corruptions.
- Pas de regression si le snapshot n'existe pas.
- Aucun couplage avec Smart Chapters.
- Build frontend, build backend et tests cibles reussis avant integration.
