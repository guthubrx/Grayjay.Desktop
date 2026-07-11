# Audit De Reutilisation

**Feature**: `004-persistent-cold-start-feed-cache`
**Statut**: PASS
**Date**: 2026-07-11

## Inventaire

| Besoin propose | Existant reutilisable | Decision |
|---|---|---|
| Source de verite des videos | `StateCache` et `DBSubscriptionCacheIndex` | Reutiliser. Le snapshot est uniquement derive. |
| Stockage durable applicatif | `Directories.Base`, `StateApp.ReadTextFile`, `StateApp.WriteTextFile` | Reutiliser le repertoire backend ; encapsuler le fichier dans un type testable. |
| Serialisation de videos polymorphes | `GJsonSerializer` | Reutiliser pour conserver les convertisseurs de contenu existants. |
| Planification differee | `Debouncer` | Reutiliser, sans creer de timer concurrent maison. |
| Endpoint de feed | `SubscriptionsController` | Ajouter une action dans le controleur existant. |
| Client API | `SubscriptionsBackend` | Ajouter une methode au client existant. |
| Ressource partagee | `StateGlobal` | Ajouter une seule ressource bootstrap globale. |
| Pager provisoire | `createStaticPager` dans Souscriptions | Reutiliser puis deplacer seulement si Home doit aussi le consommer. |
| Lignes Highlights | `buildGroupCarousels`, `upsertGroupCarousel` | Reutiliser avec les videos bootstrap. |

## Doubles Ecartes

- Aucun cache `localStorage` supplementaire : il ne survit pas au modele CEF de Grayjay.
- Aucun nouveau store de base de donnees : `subscriptionCache` est deja le cache complet.
- Aucun changement de profil CEF, port serveur ou parametre de confidentialite.
- Aucun nouveau systeme de refresh : les pagers cache/live existants restent responsables de l'actualisation.

## Gate Avant Tasks

- [x] Le snapshot ne duplique pas une source de verite.
- [x] Le controleur et le client API existants sont les points d'extension appropries.
- [x] La strategie de debounce reutilise une classe locale.
- [x] Les composants de rendu existants peuvent rendre les donnees bootstrap.
- [x] Aucun refactor architectural ambigu n'est necessaire avant implementation.

## Conclusion

Le plan peut continuer. Le nouveau code se limite a une projection durable du cache existant et a son adoption par les deux pages deja concernees.
