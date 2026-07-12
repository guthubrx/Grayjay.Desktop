# Audit de reutilisation de l'existant — Smart Search

## Decision

Statut: PASS
Date: 2026-07-12
Feature dir: `/Volumes/8TB2/50-repos-archives/11.Repositories/grayjay-session-002-smart-search/specs/002-smart-search`

Conclusion courte: Le plan ne recree ni le moteur des sources ni la recherche standard. Il reutilise `StatePlatform.SearchLazy`, les cartes/actions existantes et le precedent de configuration locale Smart Chapters. Un state compose est justifie car l'unique pager de recherche standard serait ecrase par les variantes linguistiques. La commande Smart Search adopte deliberement un contrat standard input/output plus sur que la substitution shell historique de Smart Chapters.

## Synthese

| Metrique | Valeur |
|---|---:|
| Items extraits du plan | 9 |
| Items audites | 9 |
| Reutilisations deja prevues | 5 |
| Existants potentiellement pertinents | 3 |
| Duplications evidentes | 0 |
| Regles/memoires applicables | 6 |
| Specs existantes applicables | 1 |

## Reutilisations correctement identifiees

| Item du plan | Existant reutilise | Preuve | Commentaire |
|---|---|---|---|
| Recherche multi-sources | `StatePlatform.SearchLazy` | `Grayjay.ClientServer/States/StatePlatform.cs:278` | Une instance est creee par variante validee; les plugins ne sont pas reimplementes. |
| Filtres et sources actives | `SearchController.SearchModel` | `Grayjay.ClientServer/Controllers/SearchController.cs:25` | Les memes type, filtres et exclusions traversent la session Smart Search. |
| Recherche normale initiale | `SearchBackend.searchPagerLazy` | `Grayjay.Desktop.Web/src/backend/SearchBackend.ts:23` | Le flux normal reste le premier rendu. |
| Persistance de commande locale | `StateHighlightsIndexer.ts` | `Grayjay.Desktop.Web/src/state/StateHighlightsIndexer.ts:7` | Meme mecanisme `PersistGet`/`PersistSet`, avec cle distincte. |
| Routage Routr | `generate_smart_chapters.py` | `tools/generate_smart_chapters.py:1502` | Le script de reference reutilise les en-tetes sans copier les secrets dans C#. |
| Navigation et actions de cartes | `ContentGrid` et vues de contenu | `Grayjay.Desktop.Web/src/components/containers/ContentGrid/index.tsx:1` | La vue enrichie delegue les actions existantes au lieu de creer un second menu. |

## Existant potentiellement pertinent non mentionne

| Item du plan | Existant proche | Preuve | Decision attendue |
|---|---|---|---|
| State de session compose | `SearchController.SearchState.SearchPager` | `Grayjay.ClientServer/Controllers/SearchController.cs:17` | Ne pas l'etendre : il est unique et reserve au flux normal; creer un state Smart Search distinct et borne. |
| Recherche asynchrone | `RefreshDistributionContentPager` | `Grayjay.ClientServer/States/StatePlatform.cs:601` | Reutiliser les pagers internes par langue; ajouter seulement l'agregation et l'etiquetage manquants. |
| Execution de commande externe | `StateHighlightsIndexer.RunCommand` | `Grayjay.ClientServer/States/StateHighlightsIndexer.cs:216` | Ne pas copier la substitution `{url}` via `/bin/sh`; Smart Search utilise standard input/output et un executable fixe pour eviter l'injection de texte utilisateur. |

## Duplications evidentes

| Item propose | Doublon existant | Preuve | Action requise |
|---|---|---|---|
| Aucun | Aucun | N/A | N/A |

## Memoires et regles applicables

| Source | Regle | Impact sur le plan |
|---|---|---|
| `~/.speckit/constitution.md` | Article III, cycle complet SpecKit | Spec, plan, audit, tasks, analyse et implementation sont conserves dans la feature. |
| `~/.speckit/constitution.md` | Article VII, ADR obligatoire | ADR 002 documente la frontiere commande externe/BlueJay. |
| `~/.speckit/constitution.md` | Article XIX/XX | Pas de dependance, pas de plugin modifie, contrats explicites et cache borne. |
| `AGENTS.md` | PRs optionnelles et degradation gracieuse | Smart Search reste inactif sans commande et sans Routr. |
| `AGENTS.md` | Debugger avant correction | Les tests de contrat et les donnees runtime precederont toute correction de routage. |
| `~/.speckit/research/10-data-privacy.md` | Minimisation des donnees | La commande ne recoit que requete volontaire et titres publics visibles. |

## Specs livrees applicables

| Spec | Pattern deja etabli | Impact |
|---|---|---|
| `001-sponsorblock-smart-chapters` | Contrat optionnel, degradation gracieuse, outil externe local | Smart Search reprend le meme principe d'activation explicite et de compatibilite sans configuration. |

## Journal de recherche

| Requete | Portee | Resultat |
|---|---|---|
| `rg -n "SearchLazy|SearchPager|SearchLoadLazy"` | backend + frontend | Pager standard unique et mecanisme de recherche distribue trouves. |
| `rg -n "routr|openai|translator"` | outils + app | Routage Routr existe uniquement dans l'outil Smart Chapters. |
| `rg -n "generatorCommand|PersistGet|PersistSet"` | frontend + backend | Precedent de commande locale configuree trouve. |
| `rg -n "smart search|smartsearch|translationCache"` | depot + specs | Aucun equivalent Smart Search ou cache de traduction. |
| `rg -n "ContentGrid|VideoThumbnailView"` | frontend | Actions/cartes de contenu reutilisables localisees. |

## Arbitrages

| Sujet | Decision | Justification | Date |
|---|---|---|---|
| Composition des langues | creer `StateSmartSearch` | Le pager normal est unique; l'etendre ecraserait les recherches ordinaires. | 2026-07-12 |
| Execution de commande | creer un petit executeur stdin/stdout dedie | Le precedent existe mais son interpolation shell ne convient pas a une requete utilisateur. | 2026-07-12 |
| Cartes enrichies | etendre les cartes/actions existantes | Seules les metadonnees titre/langue sont nouvelles; navigation et menus restent uniques. | 2026-07-12 |

## Gate avant tasks

- [x] Aucune duplication evidente non arbitree
- [x] Chaque item extrait du plan a une ligne d'audit
- [x] Les regles projet applicables ont ete lues
- [x] Les specs existantes proches ont ete verifiees
- [x] Le plan.md a ete refactore ou les divergences sont justifiees
