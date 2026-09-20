# Verification manuelle : Smart Prefill

1. Configurer la commande de generation existante dans BlueJay.
2. Ouvrir **Settings > Smart Prefill**.
3. Activer **Enable Smart Prefill**, choisir le parallelisme, une profondeur de `1` et un plafond de file.
4. Generer un Smart Mix depuis une video deja analysee : la lecture doit commencer sans attendre l'analyse. Les candidats sans sous-titre plateforme ne doivent pas entrer dans la file du mix.
5. Ouvrir le menu Smart Chapters de la video en lecture : le statut doit passer de `queued` a `running`, puis `done`, sans declencher Whisper.
6. Passer a la video suivante : avec une profondeur de `1`, la video courante et sa suivante sont preparees ; augmenter la profondeur a `2` ajoute une video d'avance supplementaire.
7. Essayer une video sans sous-titre : le job doit etre marque `skipped` sans lancement de GPU/Whisper.
8. Desactiver Smart Prefill, naviguer dans Highlights et creer un autre Smart Mix : aucun nouveau job automatique ne doit apparaitre.
