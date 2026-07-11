# Plan d'implementation : Sequencement editorial Smart TV

**Branche** : `pr/smart-tv-sequencing` | **Date** : 2026-07-11 | **Spec** : [spec.md](spec.md)
**Entree** : Specification de `specs/003-smart-tv-sequencing/spec.md`

## Resume

Remplacer le tri actuel des Smart Chapters par score dans les sessions Smart TV fixes par un sequenceur editorial deterministe. Il appliquera d'abord les contraintes existantes, puis ordonnera les candidats a l'aide de signaux deja pre-calcules : score, texte de chapitre, resume, these, createur, groupe lorsqu'il est connu et date de publication.

Chaque passage apres le premier portera une raison courte : `Same topic`, `Discover`, `New angle` ou `Best available`. Le calcul reste local, ne lance aucune nouvelle analyse IA, ne modifie pas une session fixe demarree et ne traite pas le futur mode de lecture en continu.

## Contexte technique

**Langages/versions** : TypeScript 5.9, SolidJS 1.9 ; C# 12 et .NET 8 pour les reglages existants
**Dependances principales** : Vite et SolidJS existants, aucune dependance nouvelle
**Stockage** : `settings.json` existant pour les preferences ; sessions et historique Smart TV deja persistants dans le stockage local du client
**Tests** : tests unitaires du sequenceur avec le runner Node 26 integre ; `npm run build` Vite ; protocole manuel dans BlueJay
**Plateforme cible** : Grayjay Desktop macOS, Linux et Windows
**Type de projet** : application Desktop avec frontend SolidJS et backend local C#
**Objectifs de performance** : Calculer une session de 100 candidats au maximum sans nouvelle requete d'analyse et sans bloquer l'ouverture de la page ; conserver un ordre stable a entrees et reglages identiques
**Contraintes** : pas de requete LLM a la lecture, pas de flux continu, pas de nouvelle base de donnees, pas de dependance aux Smart Chapters pour les autres ecrans
**Echelle/perimetre** : une session fixe par tuile Smart TV, plafonnee par les reglages deja presents ; les anciens enregistrements de session doivent rester lisibles

## Verification de constitution

*GATE initial : PASS. Re-verifie apres design : PASS.*

- **Processus SpecKit** : specification, recherche, plan, audit de reutilisation, taches, analyse et implementation sont prevus dans `specs/003-smart-tv-sequencing/`.
- **Recherche** : la recherche longue consacree a la conduite editoriale est reprise dans `research.md`. Ses heuristiques sont documentees comme hypotheses a tester, non comme des ratios universels.
- **ADR** : `docs/decisions/002-local-smart-tv-editorial-sequencing.md` explicite le choix d'un sequenceur local et explicable plutot qu'un appel IA dynamique.
- **Minimalisme XIX/XX** : extension de `Home`, `VideoProvider`, l'overlay Smart TV et `GrayjaySettings`. Le seul nouveau module est un calcul pur, necessaire pour tester les regles de selection sans rendre `Home/index.tsx` plus opaque.
- **Dependances** : aucune. Node 26 present permet les tests TypeScript par effacement de types, sans ajouter Vitest pour une seule fonction pure.
- **Observabilite** : les raisons de transition sont rendues a l'utilisateur et conservees dans les sessions. Aucune pile de telemetrie n'est ajoutee a une application locale.
- **Responsabilite future** : les poids sont groupes dans des profils nommes et les plafonds existants restent des contraintes inspectables. Le calcul ne depend d'aucun contexte LLM cache.

## Reutilisation de l'existant

- `Grayjay.Desktop.Web/src/pages/Home/index.tsx:50-184` contient deja les cles de persistance, les reglages resolus et les sessions fixes Smart TV.
- `Grayjay.Desktop.Web/src/pages/Home/index.tsx:341-408` contient les identifiants de chapitre, les statistiques et le capping score/duree/video a remplacer par l'appel au sequenceur.
- `Grayjay.Desktop.Web/src/pages/Home/index.tsx:674-811` charge les ensembles de Smart Chapters, exclut l'historique persistant, persiste la session et remplit la file de lecture. Ces responsabilites restent dans Home.
- `Grayjay.Desktop.Web/src/backend/models/highlights/IVideoHighlightSet.ts:4-14` expose deja les resumes, theses et `thesisId` utiles au sequencement, sans schema supplementaire.
- `Grayjay.Desktop.Web/src/contexts/VideoProvider.tsx:27-37` transporte deja les metadonnees de chapitre vers la lecture. Il est etendu d'une information de transition optionnelle.
- `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx:281-318,2320-2360` affiche deja le contexte Smart TV et recevra le label de transition dans ce meme overlay.
- `Grayjay.ClientServer/Settings/GrayjaySettings.cs:486-529` est le groupe de reglages Smart TV a etendre, suivant ses dropdowns existants.

## Flux concu

1. Home rassemble les candidats issus d'une tuile Smart TV et charge leurs ensembles Smart Chapters comme aujourd'hui.
2. Il enrichit chaque chapitre avec une cle de video, son createur, son groupe source optionnel, un texte de sujet et le signal de changement d'angle obtenu depuis les titres, resumes et theses deja stockes.
3. Le sequenceur pur retire les chapitres joues et ceux qui violent les contraintes dures existantes. Il choisit le premier ancrage sur le score.
4. Pour chaque position suivante, il evalue chaque candidat admissible selon le score de chapitre, le profil editorial, la proximite de sujet, la nouveaute de createur/groupe et les repetitions recentes. Les profils ne sont pas des cycles obligatoires.
5. La selection attache a chaque entree une intention et une phrase courte. En l'absence de transition defendable, elle choisit le meilleur candidat eligible et declare le repli `Best available`.
6. Home persiste le snapshot de session avec son intention par entree, puis fournit ces informations a la file de lecture existante.
7. L'overlay deja affiche au changement de video rend le label de transition a cote du contexte de chapitre. La session reste inchangee jusqu'au recalcul explicite.
8. Les reglages `Editorial mix` et `Creator variety` ne prennent effet qu'au prochain calcul. Sans ces nouveaux champs, les valeurs par defaut conservent le comportement compatible des reglages precedents.

## Structure du projet

### Documentation de cette fonctionnalite

```text
specs/003-smart-tv-sequencing/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── reuse-audit.md
├── quickstart.md
├── contracts/
│   └── smart-tv-session.md
├── checklists/
│   └── requirements.md
├── implementation.md
└── tasks.md
```

### Code source concerne

```text
Grayjay.ClientServer/Settings/GrayjaySettings.cs
Grayjay.Desktop.Web/src/contexts/VideoProvider.tsx
Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx
Grayjay.Desktop.Web/src/pages/Home/index.tsx
Grayjay.Desktop.Web/src/utils/smartTvSequencer.ts
Grayjay.Desktop.Web/src/utils/smartTvSequencer.test.ts
docs/decisions/002-local-smart-tv-editorial-sequencing.md
```

**Decision de structure** : le chargement de donnees, la persistance et la composition de file restent dans `Home`. Le nouveau module est volontairement limite a l'evaluation pure et deterministe d'une liste de candidats. Cette frontiere permet de tester les invariants de programmation sans creer de service global, de route HTTP ou de second store.

## Verification post-design

- Aucun `NEEDS CLARIFICATION` restant.
- Aucun package ou endpoint nouveau.
- Les sessions historiques sans intention de transition restent lisibles et prennent le comportement compatible `Best available`.
- Les groupes ne sont utilises comme facteur de diversification que lorsqu'un candidat porte effectivement un groupe source ; une tuile de groupe unique ne fabrique pas de fausse diversification.
- Les ressemblances textuelles et les signaux de contrepoint sont des heuristiques explicables. Ils n'affirment pas une semantique certaine et retombent sur la pertinence lorsque leur preuve est insuffisante.
- Le continu, le rafraichissement pendant lecture et l'indexation Smart Chapters sont hors perimetre.

## Suivi de complexite

Aucune violation constitutionnelle necessitant une exception.
