# Quickstart de validation — Préchargement de lecture

## Validation automatique

Depuis la racine du worktree :

```bash
dotnet test Grayjay.Desktop.Tests/Grayjay.Desktop.Tests.csproj
npm run build --prefix Grayjay.Desktop.Web
dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj
```

## Validation manuelle contrôlée

1. Ouvrir les réglages Player et vérifier que `Prefetch next video` est actif.
2. Construire une file de deux vidéos distantes non live.
3. Démarrer la première et vérifier dans les logs un événement `playback_prefetch prepared sourceReady=True manifestReady=True` pour la seconde.
4. Passer à la seconde avec Next.
5. Vérifier un événement backend `hit sourceReady=True manifestReady=True`, puis un événement frontend contenant `prefetched=true` et `elapsedMs`.
6. Vérifier que la miniature reste visible derrière le loader jusqu'au début effectif de la lecture.
7. Refaire la mesure dix fois avec le préchargement activé, puis dix fois désactivé, sur le même réseau et les mêmes vidéos.
8. Confirmer une réduction médiane d'au moins 50 % et l'absence d'écran noir supérieur à 250 ms lorsque la miniature existe.

## Replis

- Réordonner la file pendant la préparation : seule la nouvelle prochaine URL doit devenir consommable.
- Cliquer sur une autre vidéo : le chargement normal doit réussir.
- Désactiver le réglage : aucun nouvel événement `started` ne doit apparaître.
- Tester une vidéo indisponible : `failed` doit être journalisé sans popup anticipée ; la popup normale n'apparaît que si l'utilisateur tente réellement de lire cette vidéo.
- Activer le mode aléatoire : aucune cible non déterministe ne doit être préparée.
- Fermer le lecteur : la préparation doit être invalidée avec la fenêtre.
