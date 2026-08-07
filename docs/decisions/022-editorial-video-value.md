# ADR 022 - Valeur editoriale stable et fraicheur separee

**Statut** : Accepte

## Contexte

Les scores Smart Chapters sont volontairement relatifs a une video : ils servent a choisir et enchainer ses passages. Ils ne permettent pas de comparer directement le dernier segment fort de deux videos tres differentes. Une notation monolithique qui inclurait la fraicheur ferait en outre vieillir artificiellement les contenus durables.

## Decision

Ajouter aux highlights un profil editorial versionne, produit a la generation puis enrichissable par backfill sans media. Il contient cinq dimensions stables, la sensibilite temporelle et la confiance. Le frontend derive la note editoriale de maniere deterministe. Le classement conserve sa formule centralisee et ne traite la sensibilite temporelle que comme un parametre optionnel de fraicheur.

## Consequences

Positives : la note est plus explicable, plus stable et mieux comparable ; le corpus existant peut etre enrichi sans Whisper ; la popularite, la date et la pertinence gardent leur role propre.

Negatives : le jugement LLM reste une estimation. Une calibration personnalisee par comparaisons de paires devra etre ajoutee dans une evolution distincte avant toute promesse de precision subjective.
