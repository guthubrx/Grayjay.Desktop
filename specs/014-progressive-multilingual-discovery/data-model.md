# Modele de donnees

## SmartSearchQueryVariant

- `id` : identifiant stable dans la session (`etape:langue:axe`).
- `language` : langue BCP-47 cible.
- `query` : requete deja exploitable par une plateforme.
- `axis` : `core`, `context`, `impact` ou `debate` lorsque la variante provient de Smart Mix.
- `stage` : `0` langue utilisateur, `1` anglais, `2` autres langues.

## SmartSearchSession

Les variantes conservent leurs resultats et leur statut. La session serveur conserve des variantes en attente et un limiteur partage jusqu'a la fin de son cycle de vie normal.

## Queue Smart Mix

Chaque metadata de queue Smart Mix porte un `sessionId`. Une mise a jour tardive ne peut remplacer la queue apres l'index courant que si ce meme `sessionId` est encore actif.
