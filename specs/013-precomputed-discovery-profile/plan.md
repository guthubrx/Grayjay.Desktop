# Plan : Profil de decouverte precompute

## Architecture

1. Etendre le JSON du premier passage de `generate_smart_chapters.py` avec `discoveryProfile`.
2. Normaliser les langues et valider le profil avant cache/ecriture, avec `en` comme repli.
3. Persister le profil dans `VideoHighlightSet` et son miroir TypeScript avec des types optionnels.
4. Ne pas connecter encore Create Smart Mix : la PR 014 consommera ce contrat et executera la recherche.

## Decision de langues

Le precompute lit `GRAYJAY_DISCOVERY_LANGUAGES`, configure dans l'environnement deja source par `gen-chapters.sh`; le defaut est `en`. Cela garde l'indexeur standard independant de Smart Search. Une future recherche peut completer des langues absentes a partir du profil, sans retelecharger ni retranscrire la video.

## Verification

- Tests Python : profil valide, rejet des axes incomplets, cache invalide quand les langues changent, preservation en analyse seule.
- Tests TypeScript : compilation des types optionnels par le build web.
- Build web et build ClientServer si disponible.
