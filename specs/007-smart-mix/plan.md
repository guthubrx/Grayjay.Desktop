# Plan d'implementation : Smart Mix inspire par une video

**Branche** : `007-smart-mix`  
**Date** : 2026-07-12  
**Spec** : [spec.md](spec.md)

## Resume

Ajouter un Smart Mix de videos completes a partir d'une video analysee. L'analyse Smart Chapters existante produit un profil semantique compact et canonique ; au clic, BlueJay recupere une projection locale de candidats, applique un classement deterministe en trois categories editoriales et lance une file fixe de videos completes.

## Contexte technique

**Langages** : Python 3, C#/.NET, TypeScript/SolidJS  
**Dependances** : dependances existantes uniquement  
**Stockage** : fichiers JSON locaux `highlights`, preferences persistantes existantes et file de lecture BlueJay  
**Tests** : Python `unittest`, test Node co-localise pour le composeur, build frontend, build .NET, build BlueJay complet  
**Plateforme** : Grayjay Desktop / BlueJay macOS  
**Performance cible** : aucun appel externe durant le clic ; une projection locale unique puis un classement O(n log n) pour n candidats  
**Contrainte majeure** : `/v1/embeddings` de Routr retourne explicitement `501` ; aucune dependance a un modele vectoriel ou a une base vectorielle  
**Confidentialite** : aucun transcript brut supplementaire stocke ou envoye ; le profil est produit dans l'appel d'analyse deja autorise/configure par l'utilisateur.

## Constitution Check

- **Minimalisme (XIX)** : reutilisation de l'analyse, des highlights, des preferences persistantes, de la file et des limites Smart TV. Aucun service, cache global, dependance ou base vectorielle nouveau.
- **Responsabilite LLM (XX)** : le LLM ne produit qu'un profil borne et valide ; le classement, les quotas et les replis sont deterministes et testes localement.
- **Complexite (XVIII)** : une projection bulk evite le N+1 ; les index `Map` et `Set` sont construits avant les boucles de selection. Le composeur documente son O(n log n).
- **Degradation** : `mixProfile` est optionnel ; les anciens highlights conservent un chemin de repli.
- **Git** : branche et worktree dedies ; aucun push ni commit automatique.

## Conception

### 1. Enrichir l'analyse existante

`tools/generate_smart_chapters.py` et les contrats highlights gagnent `mixProfile`.

Le prompt d'analyse existant demande deja une sortie JSON. Il ajoute trois listes courtes de concepts canoniques anglais. Les validateurs bornent, dedupliquent et acceptent l'absence du champ pour les caches anciens. Aucune analyse de masse n'est declenchee : les analyses futures l'obtiennent sans appel supplementaire et les anciennes utilisent le repli.

### 2. Exposer une projection bulk locale

`StateHighlights` construit un `VideoHighlightMixCandidate` a partir des fichiers highlights et de la video cachee. `HighlightsController` expose `GET /highlights/MixCandidates`.

La projection contient les donnees necessaires au classement et au chapitre explicatif, mais pas les sous-titres ni le transcript. Elle remplace une boucle frontend de `GET /highlights/Get` par candidat.

### 3. Composer un mix pur et testable

Un utilitaire frontend `smartMixComposer.ts` :

1. normalise un profil enrichi ou derive un profil de repli depuis resume, theses et segments ;
2. compare les sujets et classe les candidats `close`, `related` ou `new-angle` ;
3. ecarte la video source, les doublons et les videos sans source de lecture ;
4. calcule les quotas par methode du plus fort reste ;
5. choisit les meilleurs candidats en privilegiant l'interet, les videos non vues, la fraicheur legere et la variete de createur ;
6. redistribue les quotas incomplets uniquement vers les autres candidats pertinents ;
7. retourne un ordre deterministe et une raison explicable.

Le composeur ne modifie aucune donnee et ne fait ni I/O ni appel LLM. Sa complexite est documentee `O(n log n)` : les candidats sont indexes une fois, classes une fois par categorie et consommes par pointeurs.

Les limites Smart TV deja configurees sont extraites de `Home` vers un petit utilitaire partage `smartTvSettings.ts`. L'accueil et le Smart Mix liront donc exactement les memes valeurs de duree, de nombre maximal de videos et de variete de createur, sans recopier les tables d'indices C# dans le lecteur.

### 4. Preferences de proportions

`StateSmartMix.ts` persiste les trois pourcentages sous `smartMix.settings`. `SmartMixSettings` expose trois steppers a pas de 5, un total visible et un bouton de sauvegarde disponible uniquement a 100 %.

Le composant est ajoute a la page Settings sur le meme patron que `SmartSearchSettings`, sans modifier le formulaire de settings generique de FUTO.

### 5. Action et lecture

`VideoDetailView` affiche `Create Smart Mix` lorsque la video courante a un highlight exploitable. L'action charge la projection bulk, compose le mix, puis reutilise la file de lecture existante avec des videos completes et des metadonnees `smart-mix` pour les raisons d'enchainement.

Le composant de contexte Smart TV est generalise minimalement pour presenter `Meme sujet`, `Elargit le sujet` ou `Autre angle` lors d'une transition de Smart Mix. Aucun changement de comportement n'est applique aux files standard, SponsorBlock ou Smart TV existantes.

## Structure projet

```text
tools/
└── generate_smart_chapters.py

Grayjay.ClientServer/
├── Controllers/HighlightsController.cs
├── Models/Highlights/
│   ├── VideoHighlightSet.cs
│   ├── VideoHighlightMixProfile.cs
│   └── VideoHighlightMixCandidate.cs
└── States/StateHighlights.cs

Grayjay.Desktop.Web/src/
├── backend/
│   ├── HighlightsBackend.ts
│   └── models/highlights/
├── components/
│   ├── contentDetails/VideoDetailView/index.tsx
│   └── settings/SmartMixSettings/
├── pages/Settings/index.tsx
├── state/StateSmartMix.ts
└── utils/
    ├── smartMixComposer.ts
    └── smartMixComposer.test.ts
    └── smartTvSettings.ts
```

## Decisions explicites

| Sujet | Decision | Alternative ecartee |
|---|---|---|
| Similarite | profils canoniques + Jaccard local | embeddings indisponibles via Routr et dependance vectorielle injustifiee |
| Unite lue | video complete | succession de chapitres, deja couverte par Smart TV |
| Profil absent | repli deterministe | reanalyse massive ou blocage de la fonctionnalite |
| Preferences | composant dedie avec total 100 % | trois dropdowns incoherents dans les settings generiques |
| Chargement candidats | endpoint bulk local | N+1 frontend sur tous les highlights |
| Contrat de file | reutiliser `source?: string` | `VideoQueueItemMeta` transporte deja une origine libre et les raisons editoriales existantes ; aucune extension de contrat n'est necessaire |

## Complexite

- Projection serveur : lecture O(n) des n highlights existants, comme `GetAll` deja utilise par les resumes.
- Composition frontend : indexation et classification O(n), tri des categories O(n log n), consommation O(k), ou k est borne par `maxVideos`.
- Aucun appel externe dans le chemin interactif.

## Verification manuelle

Voir [quickstart.md](quickstart.md).
