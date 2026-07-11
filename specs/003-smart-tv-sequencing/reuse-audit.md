# Audit de reutilisation de l'existant - Sequencement editorial Smart TV

## Decision

Statut: PASS
Date: 2026-07-11
Feature dir: `specs/003-smart-tv-sequencing`

Le plan etend le constructeur de sessions fixes Smart TV, le contrat de metadonnees de file, l'overlay existant et le groupe de reglages deja presents. Il ne cree ni file parallele, ni cache parallele, ni endpoint. Le seul element nouveau est un calcul pur de sequencement, sans equivalent existant et justifie par le besoin de tester des invariants editoriaux hors du composant Home.

Le script SpecKit de preflight refuse la branche locale `pr/smart-tv-sequencing`, car sa convention n'accepte que les prefixes numeriques. La feature est donc resolue de maniere deterministe par `.specify/feature.json`, conforme au branchement deja etabli pour les PR BlueJay.

## Synthese

| Metrique | Valeur |
|---|---:|
| Items extraits du plan | 8 |
| Items audites | 8 |
| Reutilisations deja prevues | 7 |
| Existants potentiellement pertinents | 1 |
| Duplications evidentes | 0 |
| Regles/memoires applicables | 6 |
| Specs existantes applicables | 1 |

## Reutilisations correctement identifiees

| Item du plan | Existant reutilise | Preuve | Commentaire |
|---|---|---|---|
| Session fixe et historique de chapitres | `SmartTvSession`, `loadPlayedSmartTvChapterKeys`, `markSmartTvChapterPlayed` | `Grayjay.Desktop.Web/src/pages/Home/index.tsx:116`, `:161`, `:683` | Conserver la persistance locale et les cles de chapitre ; aucune nouvelle base. |
| Contraintes de session | `capSmartTvEntries` et reglages resolus | `Grayjay.Desktop.Web/src/pages/Home/index.tsx:364`, `:174` | Remplacer le tri local par le sequenceur en preservant les plafonds. |
| Score de video de repli | `interestScoreFromSummary` | `Grayjay.Desktop.Web/src/utils/highlightInterest.ts:157` | Conserver le calcul de score existant lorsque le chapitre ne porte pas de score. |
| Donnees de chapitre et these | `IVideoHighlightSet` et `IVideoHighlightSegment` | `Grayjay.Desktop.Web/src/backend/models/highlights/IVideoHighlightSet.ts:4`, `IVideoHighlightSegment.ts:1` | Reutiliser titres, resumes, theses et `thesisId`, sans schema nouveau. |
| Reglages Smart TV | `XrayPanel.SmartTv` | `Grayjay.ClientServer/Settings/GrayjaySettings.cs:486` | Ajouter deux dropdowns dans le groupe existant. |
| Passage vers la lecture | `VideoQueueItemMeta` et `setQueue` | `Grayjay.Desktop.Web/src/contexts/VideoProvider.tsx:27`, `:307` | Ajouter une metadonnee optionnelle, sans nouveau store. |
| Presentation du contexte | overlay Smart TV de `VideoDetailView` | `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx:281`, `:2320` | Rendre le label dans l'overlay existant. |

## Existant potentiellement pertinent non mentionne

| Item du plan | Existant proche | Preuve | Decision attendue |
|---|---|---|---|
| Signal de groupe par candidat | `GroupCarousel` construit depuis les groupes d'abonnements | `Grayjay.Desktop.Web/src/pages/Home/index.tsx:503` | Etendre `SmartTvSource` d'un groupe optionnel uniquement pour les sources creees depuis une ligne de groupe ; ne pas reconstruire une taxonomie globale. |

## Duplications evidentes

Aucune duplication evidente detectee.

## Memoires et regles applicables

| Source | Regle | Impact sur le plan |
|---|---|---|
| `AGENTS.md` utilisateur | Francais, PR isolees, degradation gracieuse | Documents en francais ; aucune dependance imposee a Smart Chapters hors Smart TV. |
| `.specify/memory/constitution.md` | Constitution globale obligatoire | Gates documentes dans `plan.md`. |
| `~/.speckit/constitution.md` Article III | Cycle SpecKit complet | Spec, plan, audit, taches, analyse et implementation sont sequencés. |
| `~/.speckit/constitution.md` Article VII | ADR pour choix structurant | ADR 002 ajoute avant implementation. |
| `~/.speckit/constitution.md` Articles XIX/XX | Minimalisme et maintenabilite | Un module pur limite, aucun service global ou dependance. |
| `~/.speckit/ref/standards-frontend.md` | TypeScript strict et tests co-localises | Types explicites et test Node co-localise au sequenceur, adaptes au stack Solid/Vite reel. |

## Specs livrees applicables

| Spec | Pattern deja etabli | Impact |
|---|---|---|
| `specs/002-playback-prefetch` | `VideoQueueItemMeta` transporte des metadonnees optionnelles sans affecter les files standard | Reutiliser la meme extension additive pour le label de transition. |

## Journal de recherche

| Requete | Portee | Resultat |
|---|---|---|
| `rg SmartTvSession, capSmartTvEntries, smartTvSettingsFromObject` | `Grayjay.Desktop.Web/src/pages/Home/index.tsx` | Sessions, persistance, contraintes et composition de file deja presentes. |
| `rg VideoQueueItemMeta, smartTvIntro` | `Grayjay.Desktop.Web/src` | Contrat de file et overlay de presentation reutilisables. |
| `rg SmartTvSettings, repeatVideoPenalty` | `Grayjay.ClientServer/Settings` | Groupe de dropdowns compatible avec les deux nouveaux reglages. |
| `rg IVideoHighlightSet, IVideoHighlightSegment` | modeles highlights | Textes et theses deja disponibles. |
| `rg sequence, editorial, transition` | code et specs existantes | Aucun sequenceur editorial concurrent detecte ; la seule transition proche est le prechargement de lecture. |

## Arbitrages

| Sujet | Decision | Justification | Date |
|---|---|---|---|
| Constructeur de session | etendre l'existant | `Home` est deja proprietaire des sources, de l'historique et de la file Smart TV. | 2026-07-11 |
| Sequenceur pur | creer nouveau | Aucun equivalent ; necessaire pour tester un calcul deterministic sans ouvrir Home ou le lecteur. | 2026-07-11 |
| Diversite de groupe | approfondir seulement si disponible | Les groupes sont disponibles sur certaines lignes mais pas comme taxonomie globale de tous les candidats. | 2026-07-11 |
| Preflight SpecKit | conserver la branche PR | La branche fait partie de la convention BlueJay et `.specify/feature.json` identifie sans ambiguite la spec. | 2026-07-11 |

## Gate avant tasks

- [x] Aucune duplication evidente non arbitree
- [x] Chaque item extrait du plan a une ligne d'audit
- [x] Les regles projet applicables ont ete lues
- [x] Les specs existantes proches ont ete verifiees
- [x] Le plan.md a ete refactoré ou les divergences sont justifiees
