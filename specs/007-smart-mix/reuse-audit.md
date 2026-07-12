# Audit de reutilisation : Smart Mix

**Date** : 2026-07-12  
**Feature** : `007-smart-mix`  
**Conclusion courte** : le plan reutilise les composants et etats proprietaires existants. Aucun equivalent semantique par transcript ni composeur de videos avec quotas editoriaux n'existe. Les nouveaux artefacts sont limites au profil de donnees, a une projection bulk et au composeur pur necessaire pour ce comportement distinct.

## Inventaire du plan

| Element propose | Equivalent recherche | Decision |
|---|---|---|
| `VideoHighlightMixProfile` | `VideoHighlightSet` possede deja resume, theses et segments mais aucun profil de recommandation. | Etendre le modele existant de maniere optionnelle. |
| Projection `MixCandidates` | `GetSummaries()` retourne uniquement les statistiques et `globalSummary`; `Get()` impose un appel par video. | Ajouter une projection bulk dediee a `StateHighlights` et `HighlightsController`. |
| Composeur `smartMixComposer.ts` | `smartTvSequencer.ts` ordonne des chapitres apres un premier choix, mais ne selectionne pas des videos completes selon des quotas de categories. | Creer un composeur pur distinct ; reutiliser les conventions de determinisme et les libelles de transition. |
| Reglages Smart Mix | `SmartSearchSettings` persiste une configuration custom et est integre a `SettingsPage`. | Reutiliser exactement ce patron, sous une cle dediee. |
| Lecture des videos | `VideoProvider.actions.setQueue` prend une file de videos completes et persiste deja la queue. | Reutiliser sans nouvelle playlist ni store de session. |
| Explication au passage video | Overlay Smart TV base sur `VideoQueueItemMeta`. | Generaliser le filtre de source a `smart-mix`, sans creer un second overlay. |

## Services et composants existants verifies

| Brique existante | Emplacement | Ce qu'elle couvre | Impact Smart Mix |
|---|---|---|---|
| Analyse Smart Chapters | `tools/generate_smart_chapters.py` | Prompt JSON, cache d'analyse, validation et ecriture de highlights. | Ajouter le profil au schema d'analyse existant. |
| Etat highlights | `Grayjay.ClientServer/States/StateHighlights.cs` | Lecture, validation, resumes et cache video. | Construire la projection bulk au meme endroit. |
| API highlights | `Grayjay.ClientServer/Controllers/HighlightsController.cs` | Endpoints `Get`, `GetAll`, `Import`, `CreateOrUpdate`. | Ajouter `MixCandidates` dans ce controleur, pas un nouveau controleur. |
| Recommandations locales | `Grayjay.ClientServer/Controllers/LocalRecommendationsController.cs` | Videos recentes de groupes/abonnements voisins. | Ne pas reutiliser : aucun transcript, aucune analyse semantique, classement par date. |
| Smart TV | `Grayjay.Desktop.Web/src/pages/Home/index.tsx` | Sessions de chapitres, persistance et contraintes. | Reutiliser les plafonds et conventions, sans detourner les sessions de chapitres. |
| Sequenceur Smart TV | `Grayjay.Desktop.Web/src/utils/smartTvSequencer.ts` | Transitions entre chapitres apres selection. | Ne pas l'etendre artificiellement : unite de selection et quotas differents. |
| File de lecture | `Grayjay.Desktop.Web/src/contexts/VideoProvider.tsx` | Queue, metadonnees, persistence et prefetch. | Reutiliser directement. |
| Parametres custom | `Grayjay.Desktop.Web/src/components/settings/SmartSearchSettings/` et `StateSmartSearch.ts` | Chargement, normalisation et persistence de preferences frontend. | Reutiliser le meme pattern pour trois pourcentages. |

## Recherche anti-duplication

| Requete | Portee | Resultat |
|---|---|---|
| `rg "SmartTv|Global mix|Watch now"` | frontend et serveur | Smart TV est le seul flux de session analyse ; il selectionne des segments, pas des videos inspirees par une source. |
| `rg "LocalRecommendations|Recommendations"` | frontend et serveur | Le seul equivalent local filtre par groupe/chaine/date et ne consulte pas les highlights. |
| `rg "GetAll|GetSummaries|VideoHighlightSummary"` | highlights | Aucun endpoint retourne en bulk theses, profil et segments necessaires a un classement semantique. |
| `rg "setQueue|VideoQueueItemMeta"` | frontend | La queue et ses metadonnees sont deja generiques et reutilisables. |
| `rg "PersistGet|persistSet"` | frontend state/settings | Pattern de settings custom etabli par Smart Search. |

## Arbitrages

| Sujet | Decision | Justification |
|---|---|---|
| Profil vs embeddings | Profil compact | Endpoint embeddings Routr indisponible ; pas de dependance nouvelle. |
| Extension du sequenceur Smart TV | Composeur distinct | Smart TV preserve une semantique chapitre ; une surcharge masquerait deux invariants differents. |
| Endpoint bulk | Ajouter | Evite un N+1 et ne duplique pas une projection existante. |
| Session persistee dediee | Ne pas ajouter | `VideoProvider` persiste deja la queue active ; une seconde persistence ne porte aucun comportement demande. |
| Reglages C# generiques | Ne pas etendre | Une contrainte somme=100 exige une validation UI que le formulaire generique ne porte pas. |

## Gate avant tasks

- [x] Aucune duplication evidente non arbitree
- [x] Chaque item du plan a une strategie de reutilisation documentee
- [x] Les regles projet applicables ont ete lues
- [x] Les specs et implementations Smart TV, Smart Search et highlights proches ont ete verifiees
- [x] Les alternatives plus simples sont ecartees avec justification
