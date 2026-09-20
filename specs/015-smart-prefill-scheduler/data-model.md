# Modele de donnees : Smart Prefill Scheduler

## Politique persistante

Cle : `smartPrefill.settings`

```ts
interface SmartPrefillSettings {
  enabled: boolean;
  llmParallelism: number; // 1..32
  maxCandidatesPerSource: number; // 1..100, candidats sondes par source
  preparationDepth: number; // 0..100, videos futures dans une session active
  maxQueuedJobs: number; // 1..500, travaux automatiques en attente
  smartMix: boolean;
  nextInQueue: boolean;
  smartTv: boolean;
  watchNow: boolean;
  priorityGroup: boolean;
}
```

Valeurs par defaut : fonctionnalite desactivee, parallelisme `3`, `12` candidats sondes par source, profondeur `1` et plafond de file `24` ; toutes les surfaces actives pour que l'activation globale soit comprehensible.

## Travail d'indexation

Le contrat JSON existant `IndexJob` est enrichi sans casser les consommateurs :

```ts
interface IndexJob {
  url: string;
  status: "queued" | "running" | "done" | "error" | "skipped";
  error?: string;
  priority?: "manual" | "next-in-queue" | "smart-mix" | "smart-tv" | "watch-now" | "priority-group" | "catalog";
  source?: string;
  nextAttemptAt?: string;
}
```

`Queued`, `running`, `done`, `error` et `skipped` restent les etats exposes. Un echec automatique memorise un instant de nouvelle eligibilite pendant quinze minutes. Une action manuelle n'est jamais bloquee par ce cooldown.

## Regle de completude

Un prefill est evite lorsque le jeu existant contient des segments et satisfait les conditions de traduction existantes. Il ne reexecute pas une video simplement parce que le profil de decouverte manque : ce profil depend de la version du generateur configuree et ne doit pas causer une boucle de cout.

Un travail lance par BlueJay exige une commande contenant `{subtitles}` et un VTT plateforme effectivement materialisable. L'absence de VTT produit `skipped`; elle n'est ni une erreur de lecture ni une raison d'invoquer Whisper.

## Priorite

La priorite est fixe, puis FIFO a priorite egale :

1. action manuelle ;
2. video suivante de la file ;
3. candidats Smart Mix ;
4. session Smart TV ;
5. Watch now ;
6. groupes prioritaires ;
7. catalogue eventuel.

Une session active conserve une fenetre glissante de `preparationDepth` videos futures. La video effectivement ouverte est rehaussee au-dessus de cette fenetre; une video suivante est devant les candidats de catalogue.
