# Contrat HTTP : Smart Prefill

## `POST /highlights/GeneratePrefill`

Ajoute un travail automatique deduplique a l'ordonnanceur Highlights existant.

```json
{
  "url": "https://www.youtube.com/watch?v=example",
  "command": "/absolute/path/gen-chapters.sh {url} {subtitles} {language}",
  "translationSourceLanguages": ["ja", "ar"],
  "priority": "smart-mix",
  "source": "smart-mix"
}
```

Reponse : le `IndexJob` existant, enrichi de `priority` et `source`.

Regles :

- le serveur valide l'URL, la commande et la priorite ;
- le job est `skipped` si la sortie compatible existe deja ;
- un job automatique en cooldown est `skipped` avec une raison non sensible ;
- le meme URL deja `queued` ou `running` retourne le job existant ;
- le plafond de travailleurs est lu dans la configuration serveur envoyee par `POST /highlights/ConfigurePrefill`.
- les jobs BlueJay exigent une commande qui contient `{subtitles}` et un VTT plateforme materialisable; sinon ils deviennent `skipped` sans demarrer le generateur.

## `POST /highlights/ConfigurePrefill`

Met a jour la limite de travailleurs du processus BlueJay.

```json
{ "parallelism": 3, "maxQueuedJobs": 24 }
```

`parallelism` est borne de `1` a `32`; `maxQueuedJobs` est borne de `1` a `500`. Cette API ne contient ni secret, ni commande externe, ni preference de surface. Lorsqu'une file automatique est pleine, un job de priorite superieure peut remplacer un job automatique moins prioritaire encore en attente.

## `POST /highlights/ProbeSubtitles`

Sonde en parallele limite les metadonnees plateforme de videos candidates. La reponse est mise en cache cote serveur : six heures lorsqu'un VTT est disponible, une heure lorsqu'il est absent ou illisible.

```json
{ "urls": ["https://www.youtube.com/watch?v=example"] }
```

```json
[{ "url": "https://www.youtube.com/watch?v=example", "available": true }]
```

Le Smart Mix n'utilise ces resultats que lorsque Smart Prefill et sa commande de generation sont actifs. Sans cette option, le parcours de mix historique reste disponible.

## Compatibilite

Les endpoints existants `Generate`, `GenerateIfNeeded` et `QueueStatus` conservent leur forme. `Generate` est traite comme une action `manual`; `GenerateIfNeeded` comme une demande automatique de priorite `current-video`. Depuis cette extension, les deux passent un VTT materialise au generateur : ils ne peuvent pas lancer Whisper depuis BlueJay.
