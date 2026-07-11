# Plan d'implémentation : Préchargement de lecture

**Branche** : `pr/playback-prefetch` | **Date** : 2026-07-11 | **Spec** : [spec.md](spec.md)
**Entrée** : Spécification de `specs/002-playback-prefetch/spec.md`

## Résumé

Préparer en arrière-plan les détails, la source automatique et le manifeste DASH de la prochaine entrée déterministe, sans muter le `DetailsState` actif. Le backend conserve une seule préparation temporaire par fenêtre, déduplique les demandes identiques et transfère atomiquement ses ressources lors de `VideoLoad`. Le frontend déclenche cette préparation depuis la file standard, utilise directement la source prête lors d'un hit et maintient la miniature jusqu'à la première image jouée.

## Contexte technique

**Langages/versions** : C# 12 / .NET 8 ; TypeScript 5 / SolidJS 1.9
**Dépendances principales** : ASP.NET Core existant, Grayjay.Engine, SolidJS, Luxon, lecteur HLS.js/Dash.js existant
**Stockage** : cache éphémère en mémoire par `WindowState` ; réglage booléen dans `settings.json` existant
**Tests** : MSTest (`Grayjay.Desktop.Tests`), build Vite, tests manuels de transition chronométrés
**Plateforme cible** : Grayjay Desktop macOS, Linux et Windows
**Type de projet** : application Desktop avec backend local C# et frontend web SolidJS
**Objectifs de performance** : réduction médiane d'au moins 50 % du délai vers la première image ; p95 inférieur à 2 s sur sources préparées en environnement contrôlé
**Contraintes** : aucun état Smart Chapters ; aucun fragment média prébufferisé ; une seule résolution anticipée à la fois ; aucun changement du suivi/historique de la vidéo active
**Échelle/périmètre** : une préparation par fenêtre, une prochaine entrée déterministe, cache non persistant avec durée de vie bornée

## Vérification de constitution

*GATE initial : PASS. Re-vérifié après design : PASS.*

- **Processus SpecKit** : spec, plan, recherche, audit de réutilisation, tâches, analyse, implémentation et audit prévus.
- **Worktree** : développement isolé dans `.worktrees/002-playback-prefetch`. Six worktrees sont actifs ; le seuil constitutionnel de cinq produit un avertissement connu, sans partage de fichiers modifiés.
- **ADR** : la séparation résolution/préparation/promotion est documentée dans `docs/decisions/001-isolated-playback-prefetch.md`.
- **Minimalisme XIX/XX** : réutilisation de `DetailsState`, `VideoLoad`, `VideoProvider`, `GrayjaySettings` et `VideoPlayerView`. Aucun package, service global, base persistante ou moteur média secondaire.
- **Complexité XVIII** : toutes les opérations du cache sont O(1) ; une seule préparation est conservée par fenêtre.
- **Observabilité** : logs existants enrichis par statut et durée ; aucune nouvelle pile de métriques disproportionnée pour un backend local mono-utilisateur.
- **Tests** : tests unitaires des invariants du cache avant intégration, builds backend/frontend et protocole manuel reproductible.
- **Responsabilité future** : le cache porte une règle de concurrence réelle et reste contenu dans le domaine du lecteur ; pas de wrapper générique hypothétique.

## Réutilisation de l'existant

- `Grayjay.ClientServer/Controllers/DetailsController.cs` reste l'unique frontière de résolution et d'activation d'une vidéo.
- `DetailsController.DetailsState` porte la préparation, cohérente avec l'isolation existante par `WindowState`.
- `Grayjay.Desktop.Web/src/contexts/VideoProvider.tsx` reste la source de vérité de la file ; aucun modèle de file parallèle.
- `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx` orchestre la prochaine entrée et le résultat de `VideoLoad`.
- `Grayjay.Desktop.Web/src/components/player/VideoPlayerView/index.tsx` conserve le moteur média existant et ajoute uniquement le poster de transition.
- `Grayjay.ClientServer/Settings/GrayjaySettings.cs` expose l'activation dans le groupe Player existant.

## Flux conçu

1. La vidéo courante est chargée et la file possède une prochaine entrée déterministe.
2. Le frontend appelle la préparation pour cette URL si le réglage est actif.
3. Le backend résout les détails, sélectionne la source et termine le manifeste DASH dans un état isolé, sans appeler les effets d'activation de `ChangeVideo`.
4. Une modification de file remplace la cible désirée ; un doublon partage le travail en cours.
5. À la transition, `VideoLoad` attend ou consomme la préparation correspondante si elle est encore fraîche.
6. `ChangeVideo` réalise alors, et alors seulement, l'historique, le tracker et les autres effets existants.
7. Sur hit, le backend transfère le manifeste et les exécuteurs préparés vers l'état actif, puis joint la source prête au résultat.
8. Le lecteur garde la miniature de la nouvelle entrée jusqu'au premier événement de lecture.
9. Toute absence, erreur, expiration ou incompatibilité repasse par le flux `VideoLoad` historique.

## Structure du projet

### Documentation de cette feature

```text
specs/002-playback-prefetch/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── reuse-audit.md
├── quickstart.md
├── contracts/
│   └── details-playback-prefetch.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Code source concerné

```text
Grayjay.ClientServer/
├── Controllers/DetailsController.cs
└── Settings/GrayjaySettings.cs

Grayjay.Desktop.Web/src/
├── backend/DetailsBackend.ts
└── components/
    ├── contentDetails/VideoDetailView/index.tsx
    └── player/VideoPlayerView/
        ├── index.tsx
        └── index.module.css

Grayjay.Desktop.Tests/
└── PlaybackPreparationTests.cs

docs/decisions/
└── 001-isolated-playback-prefetch.md
```

**Décision de structure** : modification ciblée des frontières déjà responsables du chargement. Le comportement concurrent testable reste dans `DetailsState` plutôt que dans un nouveau service global. Les tests accèdent à une petite classe de préparation imbriquée portant les invariants de déduplication, fraîcheur et consommation unique.

## Vérification post-design

- Aucun `NEEDS CLARIFICATION` restant.
- Aucun ajout de dépendance.
- Le fonctionnement sans Smart Chapters est structurel, pas conditionnel.
- Le prébuffer de fragments média et le double lecteur sont explicitement hors périmètre.
- Les effets de `ChangeVideo` ne sont jamais exécutés pendant la préparation.
- Les ressources sont bornées à une valeur et un travail sérialisé par fenêtre.

## Suivi de complexité

Aucune violation constitutionnelle nécessitant une exception.
