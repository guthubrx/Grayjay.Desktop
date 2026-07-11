# Tâches: Sous-titres traduits et modales globales

## P1 - Fondations et données

- [ ] T001 Ajouter des arguments et un format de cache pour les cues traduits dans `tools/generate_smart_chapters.py`.
- [ ] T002 Traduire les cues en blocs en préservant `start/end`, puis les stocker dans les highlights et les valider.
- [ ] T003 Ajouter des tests Python ciblés pour cache valide, cache obsolète et cues invalides.
- [ ] T004 Étendre le wrapper `/Users/moi/Nextcloud/10.Scripts/grayjay/gen-chapters.sh` et le précompute pour préparer la langue Smart configurée sans traductions répétées.

## P1 - Application

- [ ] T005 Exposer depuis `Grayjay.ClientServer` les cues de sous-titres traduits, sans modifier les pistes source.
- [ ] T006 Ajouter la piste traduite et son état de préparation au sélecteur de sous-titres de `VideoDetailView`.
- [ ] T007 Faire suivre le contexte plein écran à `OverlayModals` et établir un niveau de couche global au-dessus du lecteur.
- [ ] T008 Vérifier que Partager, Télécharger et Ajouter à une playlist restent visibles, focalisables et fermables.

## P1 - Vérification

- [ ] T009 Compiler le générateur, le frontend et le backend; vérifier les tests ciblés.
- [ ] T010 Vérifier manuellement la vidéo `https://www.youtube.com/watch?v=WpZj1kF1nHc` avec une piste française et les trois modes du lecteur.
