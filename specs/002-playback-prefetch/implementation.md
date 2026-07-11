# Journal d'implémentation — Préchargement de lecture

## Métadonnées

- **Spec** : `002-playback-prefetch`
- **Branche** : `pr/playback-prefetch`
- **Démarré** : 2026-07-11
- **Terminé** : 2026-07-11
- **Commit** : commit local dédié sur `pr/playback-prefetch`

## Progression

Les résultats de chaque tâche et les commandes de validation sont consignés ici au fil de l'implémentation.

### Analyse préalable

- Le validateur `check-prerequisites.sh` ne reconnaît pas la branche explicitement demandée `pr/playback-prefetch`, car il impose un préfixe numérique.
- Le contexte de feature reste déterministe via `.specify/feature.json` et `specs/002-playback-prefetch/` ; l'analyse croisée a donc été exécutée manuellement sans renommer la branche.
- Couverture : 15 exigences fonctionnelles, 8 critères de succès et 20 tâches ; aucune contradiction critique ni exigence sans tâche.

### Mise en place

- T001 : aucun changement de dépendance requis ; les sous-modules du worktree sont initialisés aux révisions verrouillées par le dépôt.
- T002 : ce journal est actif et mis à jour à chaque checkpoint.

### Implémentation

- T003 : cinq tests couvrent déduplication, sérialisation/remplacement, expiration, consommation unique et annulation. Le rouge attendu a été observé pour le type absent.
- T004-T006 : cache mono-entrée par fenêtre, résolution sans effet de bord, endpoints de préparation/annulation et consommation dans `VideoLoad`.
- T007-T010 : contrat frontend typé, planification sur file déterministe, réutilisation de la source sélectionnée et diagnostics `playback_prefetch`/`playback_transition`.
- T011-T013 : miniature cible affichée jusqu'au premier état `playing`, sans capturer les interactions.
- T014-T015 : toggle Player actif par défaut et annulation des cibles obsolètes.

### Validations intermédiaires

- `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj --no-restore -v:minimal` : PASS, 0 avertissement, 0 erreur.
- `npm run build` dans `Grayjay.Desktop.Web` : PASS ; avertissements Vite/CSS préexistants uniquement.
- Le projet de tests complet est actuellement bloqué avant exécution par les erreurs préexistantes de `ProxyTests.cs` autour de `HttpHeaders`; aucune correction hors périmètre n'a été appliquée.

### Validation finale et audit

- Tests ciblés : PASS, 5/5, via un projet MSTest temporaire supprimé après exécution.
- Backend : PASS, 0 avertissement, 0 erreur.
- Frontend : PASS, 497 modules transformés ; quatre avertissements CSS historiques et l'avertissement de taille de bundle restent inchangés.
- `git diff --check` et contrôle du test non suivi : PASS.
- Audit v14 fix + scoring readonly : A-, 0 finding ouvert, validation déterministe à 0 erreur et 0 avertissement.
- Finding corrigé pendant l'audit : la cible consommée est maintenant libérée afin que la vidéo N+1 puisse être préparée après chaque transition.
- T020 : protocole manuel non lancé afin de ne pas remplacer la build Blue Jay active par ce worktree isolé basé directement sur FUTO ; blocage explicitement consigné.

### Extension source-ready

- T021 : quatre tests ajoutés pour la libération sur remplacement, annulation et expiration, ainsi que le transfert sans destruction ; un test supplémentaire couvre le déplacement du cache DASH.
- T022-T023 : la préparation conserve désormais un paquet isolé comprenant les détails, la source automatique et le manifeste DASH prêt. `VideoLoad` adopte ce cache après `ChangeVideo`, sans effet anticipé sur l'historique ou le lecteur actif.
- T024 : les résultats et logs exposent `sourceReady` et `manifestReady`. Le loader websocket est désactivé pendant la génération anticipée.
- Tests ciblés : PASS, 10/10 avec `DOTNET_ROLL_FORWARD=Major` dans un projet temporaire isolant les erreurs historiques de `ProxyTests.cs`.
- T025 : build BlueJay complète installée dans `/Applications/BlueJay.app`, puis validation sur une session Smart TV YouTube. La vidéo N+1 a été préparée en 1 144 ms (`sourceReady=True`, `manifestReady=True`) et consommée par un `hit`. La vidéo N+2 a ensuite été préparée automatiquement en 1 317 ms avec les mêmes garanties.

## État final

- **Terminé** : implémentation, validations automatisées et validation réelle dans BlueJay
- **Commit** : commit local dédié sur `pr/playback-prefetch`
