# Plan d’implémentation

## Contexte technique

- Le générateur Python stocke déjà les transcripts horodatés.
- Routr est déjà le fournisseur de génération configuré par le wrapper local.
- Le lecteur SolidJS sait afficher des sous-titres source; les cues traduits sont transportés dans les highlights puis rendus dans sa couche de sous-titres existante.
- Les modales sont centralisées dans `OverlayModals`; le lecteur possède des couches plus hautes.

## Phases

1. Ajouter au générateur le cache des cues traduits, avec validation et tests unitaires Python.
2. Exposer les cues traduits depuis le modèle highlights backend sans modifier les sources distantes.
3. Ajouter la piste traduite au sélecteur de sous-titres et conserver les états de chargement/erreur sans bloquer la lecture.
4. Aligner la langue de génération Smart et les scripts LaunchAgent pour les nouveaux calculs et les régénérations explicites.
5. Établir une couche globale de modales au-dessus du lecteur, y compris son contexte plein écran, puis vérifier Partager et les dialogues voisins.
6. Compiler frontend/backend, exécuter les tests ciblés et valider manuellement la vidéo japonaise fournie.
7. Ajouter une apparence de sous-titres persistée dans les réglages Player et l’appliquer aux cues source et traduits via le même cadre de légende.

## Constitution check

- Réutilisation: générateur, cache transcript, Routr, lecteur et gestionnaire de modales existants.
- Vie privée: pas de nouvelles données utilisateur; uniquement le transcript nécessaire est envoyé au fournisseur déjà configuré et les résultats sont locaux.
- Complexité: aucune dépendance nouvelle; format JSON simple et supprimable.
- Accessibilité: focus trap conservé; la modale active doit rester l’unique surface interactive.
