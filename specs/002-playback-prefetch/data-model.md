# Modèle de données — Préchargement de lecture

## PlaybackPreparation

Préparation éphémère appartenant à une fenêtre de lecture.

| Champ | Type logique | Règle |
|---|---|---|
| `Url` | chaîne | URL exacte de la prochaine entrée |
| `RequestedAt` | instant UTC | moment de la dernière demande pour cette cible |
| `PreparedAt` | instant UTC optionnel | défini uniquement après résolution réussie |
| `Status` | état | `idle`, `running`, `ready`, `failed`, `cancelled`, `consumed` |
| `Result` | vidéo résolue optionnelle | détails vidéo et copie locale associée, sans effets d'activation |
| `Task` | travail partagé optionnel | partagé entre les demandes identiques |
| `Source` | source automatique optionnelle | sélectionnée dans l'état isolé |
| `SourceState` | état média isolé optionnel | porte le manifeste DASH et les exécuteurs jusqu'au transfert |

### Invariants

- Une seule cible désirée et une seule résolution sont actives par fenêtre.
- Un résultat n'est consommable qu'une fois.
- Une URL différente invalide le résultat précédent.
- Un résultat plus ancien que deux heures n'est jamais promu.
- Une erreur de préparation ne devient jamais une erreur bloquante de lecture.

### Transitions

```text
idle -> running -> ready -> consumed -> idle
                  |          |
                  -> stale --+
running -> failed -> idle
running/ready -> cancelled -> idle
```

## ResolvedVideo

Résultat sans effet de bord produit par la résolution commune à la préparation et à `VideoLoad`.

| Champ | Type logique | Règle |
|---|---|---|
| `Video` | détails vidéo optionnels | absent uniquement si une copie locale suffit |
| `Local` | copie locale optionnelle | peut compléter ou remplacer les détails distants |

## VideoLoadResult enrichi

| Champ | Type logique | Règle |
|---|---|---|
| `Video` | détails vidéo | comportement existant |
| `Local` | copie locale | comportement existant |
| `Prefetched` | booléen | vrai uniquement si une préparation fraîche a été consommée |
| `Source` | source sélectionnée optionnelle | fournie sur hit pour éviter l'appel `SourceAuto` séparé |
| `SourceReady` | booléen | la source automatique a été préparée |
| `ManifestReady` | booléen | le manifeste est prêt ou inutile pour la source directe |

## TransitionMeasurement

Événement de diagnostic, non persisté.

| Champ | Type logique | Règle |
|---|---|---|
| `Url` | chaîne | vidéo cible |
| `Prefetched` | booléen | préparation consommée ou non |
| `StartedAt` | instant monotone | début du changement d'URL courante |
| `FirstPlayingAt` | instant monotone | premier événement de lecture de la nouvelle source |
| `ElapsedMs` | nombre | différence des deux instants |
