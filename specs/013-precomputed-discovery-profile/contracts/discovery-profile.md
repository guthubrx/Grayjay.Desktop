# Contrat DiscoveryProfile

## Entree

Transcript, langues demandees et premier passage Smart Chapters.

## Sortie

Quand le premier passage le fournit, un profil valide contient au moins une requete anglaise par axe. Les requetes n'ont ni URL inventee, ni operateur technique, ni phrase de resume longue.

## Degradation

Sans profil, le client conserve les chemins historiques fondes sur le resume. Un JSON mal forme invalide seulement le profil et ne doit pas invalider les Smart Chapters eux-memes; il n'est pas reutilise par le cache d'analyse.
