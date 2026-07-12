# Implementation Plan: Smart Search

**Branch**: `002-smart-search` | **Date**: 2026-07-12 | **Spec**: [spec.md](spec.md)

## Summary

Ajouter une recherche internationale optionnelle au-dessus de la recherche Grayjay existante. Elle conserve d'abord le chemin normal, puis compose des requetes traduites par langue et affiche les resultats enrichis de titres traduits. Les appels de modele restent dans une commande locale configuree par l'utilisateur, selon le precedent Smart Chapters. Le plugin YouTube n'est pas modifie.

## Technical Context

**Language/Version**: C#/.NET, TypeScript/SolidJS, Python 3
**Primary Dependencies**: composants et pagers Grayjay existants, bibliotheque standard Python, endpoint OpenAI-compatible de l'utilisateur via Routr
**Storage**: `ManagedStore` local pour le cache de traduction; stockage persistant existant pour la commande utilisateur
**Testing**: tests unitaires C# sur validation/dedoublonnage/cache, tests Python contractuels sans appel reseau, build frontend, build C#, verification manuelle BlueJay
**Target Platform**: Grayjay Desktop / BlueJay local
**Performance Goals**: recherche normale non bloquee; au plus 4 langues internationales et une premiere page par langue; au plus 24 titres dans un lot de traduction initial
**Constraints**: pas de cle ou URL provider dans `GrayjaySettings`; pas de modification du plugin YouTube; aucune interpolation de texte utilisateur dans un shell; degradation gracieuse sans commande
**Scale/Scope**: une session Smart Search active par fenetre/utilisateur, resultats de premiere page seulement dans cette PR

## Constitution Check

- **SpecKit**: artefacts dans `specs/002-smart-search/`; branch conforme `002-smart-search`.
- **Minimalisme Article XIX**: etendre la page Search, le controller et les mecanismes de persistance existants; pas de nouvelle dependance ni de seconde page de recherche.
- **Responsabilite Article XX**: contrat JSON explicite; chaque resultat conserve son titre original et son angle linguistique; cache limite et observable.
- **Privacy**: les seuls textes transmis a la commande externe sont la requete volontaire de l'utilisateur et les titres publics visibles; les secrets restent dans l'environnement de la commande.
- **Robustesse**: aucune reponse tardive ne peut modifier une session plus recente; une langue en echec ne vide pas la recherche standard.
- **Git anonymat**: aucun commit automatique, aucun trailer ni mention d'outil dans les messages.

## Architecture

### 1. Recherche standard inchangee

`SearchController.SearchLoadLazy` et `SearchBackend.searchPagerLazy` restent le chemin par defaut. La page Search commence cette recherche exactement comme aujourd'hui.

### 2. Session Smart Search isolee

Un `StateSmartSearch` porte une session independante de `SearchState.SearchPager`. Il :

1. valide la requete, les langues et l'identifiant de session;
2. demande les variantes au traducteur externe en une seule invocation;
3. cree un pager distribue existant `StatePlatform.SearchLazy` par variante;
4. compose les resultats de premiere page, les dedoublonne et preserve les langues sources;
5. met en cache les variantes et les titres traduits;
6. expose une reponse initiale et des mises a jour associees a `sessionId`.

Le state ne remplace jamais `SearchState.SearchPager`. Il reemploie `StatePlatform.SearchLazy` pour conserver les filtres, les sources actives et les placeholders propres a Grayjay.

### 3. Commande locale de traduction

Une commande persistante `smartSearch.translatorCommand` est configuree au premier usage, comme `highlights.generatorCommand`. BlueJay lance l'executable fixe avec `UseShellExecute=false`, transmet une requete JSON sur standard input et lit le JSON de standard output. Les arguments de la commande ne contiennent pas la requete utilisateur.

Le nouveau script `tools/smart_search_translator.py` est une implementation de reference locale. Il lit la meme configuration Routr environnementale que le script Smart Chapters et ajoute les en-tetes `X-Routr-*` appropries. Il supporte deux operations : `translate-queries` et `translate-titles`.

### 4. Resultats enrichis et interface progressive

La page Search conserve son `ContentGrid` pour les resultats normaux. Lorsqu'une session Smart Search est active :

- un controle compact de langues apparait dans les filtres de recherche;
- les variantes internationalisees s'affichent en sections distinctes, avec langue, requete traduite et etat;
- les videos sont rendues par un composant de carte qui conserve le titre original et affiche la traduction francaise sous celui-ci;
- les resultats en doublon sont fusionnes, avec plusieurs etiquettes de langue;
- les erreurs par langue restent dans leur section; aucune erreur globale ne masque les resultats ordinaires.

La traduction des titres est demandee apres l'arrivee des resultats, seulement pour les cartes visibles et absentes du cache. Les titres originaux s'affichent immediatement.

### 5. Cache et invalidation

Utiliser un `ManagedStore` local dedie avec deux durees :

- variantes de requete : 24 heures;
- titres traduits : 30 jours, invalide si le texte source ou la langue cible change.

Le cache n'est jamais necessaire au bon fonctionnement. Il limite uniquement les appels externes repetes.

## Project Structure

```text
Grayjay.ClientServer/
├── Controllers/
│   └── SmartSearchController.cs             # endpoints de session et traduction
├── Models/SmartSearch/
│   ├── SmartSearchRequest.cs
│   ├── SmartSearchResult.cs
│   └── SmartSearchTranslatorContract.cs
├── States/
│   └── StateSmartSearch.cs                  # orchestration, cache et dedoublonnage
└── Tests/
    └── SmartSearch/                         # validation et dedoublonnage si le projet existant le permet

Grayjay.Desktop.Web/src/
├── backend/
│   ├── SmartSearchBackend.ts
│   └── models/smartSearch/
├── components/search/
│   ├── SmartSearchControls/
│   ├── SmartSearchSection/
│   └── SmartSearchVideoView/
├── pages/Search/
│   ├── index.tsx                            # integration sans remplacer le flux normal
│   └── index.module.css
└── state/
    └── StateSmartSearch.ts                  # commande locale et session UI

tools/
└── smart_search_translator.py               # reference Routr/OpenAI-compatible

specs/002-smart-search/
└── ...                                      # artefacts de cette feature
```

## Reutilisation de l'existant

| Besoin | Existant | Decision |
|---|---|---|
| Recherche multi-sources | `StatePlatform.SearchLazy` | Reutiliser par variante linguistique; ne pas reimplementer les plugins. |
| Pager de recherche normal | `SearchController` et `SearchBackend` | Garder intact; Smart Search porte son propre state afin de ne pas ecraser le pager global. |
| Persistance locale d'une commande | `StateHighlightsIndexer.ts` + `SettingsBackend.persist*` | Reprendre le mecanisme sous une cle distincte. |
| Processus externe securise | `StateHighlightsIndexer.RunCommand` | Extraire ou reproduire uniquement le chemin `ProcessStartInfo` sans shell ni interpolation de query. |
| Routage Routr | `tools/generate_smart_chapters.py` | Reprendre les en-tetes et le contrat OpenAI-compatible dans le script de reference, sans deplacer les secrets dans C#. |
| Cartes de resultats et navigation | `ContentGrid`, `VideoThumbnailView`, menus existants | Etendre par une vue de carte legere pour les metadonnees Smart Search; ne pas reimplementer la navigation. |

## Divergences volontaires

- Un state et endpoint Smart Search nouveaux sont necessaires car le pager standard unique ne peut pas recevoir plusieurs variantes sans se remplacer. Cette responsabilite est explicite et bornee a une session internationale.
- Une carte dediee est necessaire uniquement pour rendre le titre original, la traduction et les etiquettes de langue ensemble. Elle reutilise les actions et la navigation existantes au lieu de les dupliquer.

## Phases

### Phase 0 - Fondations verifiables

Ajouter les modeles de contrat, la validation de session et le cache local. Ajouter le script de reference avec validation stricte JSON et tests sans reseau.

### Phase 1 - Variantes et recherche composee

Configurer et appeler la commande de traduction, creer les recherches par langue avec le pager existant, composer/dedoublonner le premier lot et signaler les etats par session.

### Phase 2 - Interface progressive

Ajouter le choix de langues, l'activation explicite, les sections internationalisees et les cartes avec source/original visible. La recherche ordinaire demeure le premier affichage.

### Phase 3 - Traduction des titres et degradation

Traduire les titres visibles par lots, afficher les resultats caches, traiter les erreurs de commande/langue et ajouter les controles de configuration locale.

### Phase 4 - Verification et documentation

Executer les tests, les builds, un parcours manuel avec Routr et une degradation sans commande. Relire les changements versus le style Futo : petits controllers, state explicite, composants frontend existants et absence de dependance.

## Verification Strategy

- Tests unitaires : validation des langues, coherence du contrat de commande, cle de dedoublonnage, fusion d'angles, expiration du cache, rejet de reponse obsolete.
- Tests Python : JSON valide/invalide, cardinalite query/title, conservation des noms propres et absence d'appel reseau avec fixture.
- Integration backend : une commande de fixture retourne des variantes; verifier qu'une session Smart Search n'ecrase pas `SearchState.SearchPager`.
- Frontend : build TypeScript et verification de l'activation/desactivation sans commande.
- Manuel : lancer une recherche francaise, activer quatre langues, constater le flux progressif puis modifier la requete avant la fin; verifier que les anciennes sections ne reviennent pas.
