# Audit de reutilisation : Smart Prefill Scheduler

**Date** : 2026-07-13  
**Statut** : PASS

## Elements proposes et equivalents existants

| Besoin du plan | Equivalent existant | Decision |
|---|---|---|
| File de travaux, lancement de commande, WebSocket | `Grayjay.ClientServer/States/StateHighlightsIndexer.cs` | Etendre ce composant. Aucun second scheduler. |
| Endpoint generation et statut | `HighlightsController.Generate`, `GenerateIfNeeded`, `QueueStatus` | Ajouter seulement les variantes de prefill/configuration. |
| Persistence de preferences front-end | `StateSmartSearch.ts`, `StateSmartMix.ts` et `SettingsBackend.persistSet` | Suivre ce pattern avec `StateSmartPrefill.ts`. |
| Requetes Smart Mix et remplacement protege | `VideoDetailView/index.tsx`, `utils/smartDiscovery.ts`, `replaceUnplayedSmartMixTail` | Ajouter le prefill apres la construction de candidats ; ne pas modifier le remplacement PR 014. |
| Sources Highlights, Watch now et groupes | `pages/Home/index.tsx` | Reutiliser les memos de sources existants, sans reconstruire les carrousels. |
| Sous-titres et politique Whisper | `StateHighlightsIndexer.MaterializeSubtitle` et le script de generation | Reutiliser sans nouvelle logique de transcription. |
| Classement de recommendations | `utils/recommendationRanking.ts` | Hors du scheduler ; aucun nouveau score n'est introduit. |

## Services, composants et contrats lus

- `Grayjay.ClientServer/States/StateHighlightsIndexer.cs`
- `Grayjay.ClientServer/Controllers/HighlightsController.cs`
- `Grayjay.Desktop.Web/src/state/StateHighlightsIndexer.ts`
- `Grayjay.Desktop.Web/src/backend/HighlightsBackend.ts`
- `Grayjay.Desktop.Web/src/state/StateSmartSearch.ts`
- `Grayjay.Desktop.Web/src/pages/Settings/index.tsx`
- `Grayjay.Desktop.Web/src/components/settings/SmartSearchSettings/index.tsx`
- `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx`
- `Grayjay.Desktop.Web/src/pages/Home/index.tsx`
- `/Users/moi/Nextcloud/10.Scripts/grayjay/refresh-highlights.py`

## Risques identifies

1. `StateHighlightsIndexer` deduplique actuellement uniquement les jobs actifs. Le prefill doit aussi refroidir les echecs automatiques pour ne pas etre relance par un re-rendu.
2. Les scripts autonomes peuvent lancer directement le generateur. Le plafond de l'application est donc strict seulement pour les travaux qui passent par l'API BlueJay.
3. Les carrousels Home sont reactifs ; l'emission de demandes doit etre dedupliquee au niveau de la session front-end pour ne pas ajouter de jobs a chaque recalcul de memo.
4. Les profils de decouverte sont produits par le generateur externe. Le scheduler ne doit pas les utiliser comme condition de reexecution, sinon une ancienne commande pourrait boucler.

## Gate avant tasks

- [x] Les services et composants proposes ont ete recherches par `rg` et lus.
- [x] Le scheduler existant est reutilise.
- [x] Aucun doublon evident de persistence, de file ou de contrat HTTP ne reste dans le plan.
- [x] Aucun arbitrage utilisateur supplementaire n'est requis : la limite est garantie dans le processus BlueJay et cette frontiere est documentee.
