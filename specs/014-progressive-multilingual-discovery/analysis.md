# Analyse de coherence 014

## Spec versus implementation

- Les quatre axes, les trois etapes et les bornes sont representes par le contrat Smart Search et valides dans `StateSmartSearch`.
- Le semaphore partage atteint `StatePlatform.SearchLazy`, qui est le lieu ou une recherche lance les travaux par plugin.
- La queue porte un identifiant de session et l'utilitaire ne remplace que les elements apres l'index courant.
- Le classement externe appelle le ranker generique de la PR 012; aucune etoile editoriale n'est modifiee.

## Points verifies

- Les champs `discovery` et `maxParallelism` sont optionnels : le flux Smart Search existant utilise toujours `query` et `languages`.
- Le profil 013 est consomme sans exiger de nouvelle analyse ou de Whisper.
- Le traducteur est appele seulement si une langue demandee n'est pas deja dans le profil ou dans son cache.

## Risque residuel

Les plateformes peuvent encore appliquer leurs propres limites de debit. Le semaphore borne les recherches plugin lancees en parallele par une session Smart Mix, mais ne contourne volontairement aucune limite distante.
