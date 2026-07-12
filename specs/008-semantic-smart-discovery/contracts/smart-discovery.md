# Contrat Smart Discovery

## Entree

- Video source avec `mixProfile` ou `globalSummary`.
- Reglages Smart Search deja persistants : langues, traducteur, sources actives.
- Limite `maxVideos` de Smart TV.

## Sortie

- Une file de lecture fixe, de zero a `maxVideos` videos externes distinctes.
- Aucune mutation de la file actuelle avant qu'au moins une video exploitable soit disponible.

## Degradation

- Sans traducteur : reutilisation du dialogue de configuration Smart Search.
- Sans resultat : notification concise, aucune file creee.
- Sans profil : utilisation du resume ; sans resume : demande de generation des Smart Chapters.
