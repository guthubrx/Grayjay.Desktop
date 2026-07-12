# Modele de donnees

## DiscoveryProfile

- `version` : version du contrat, actuellement `1`.
- `axes` : exactement quatre `DiscoveryAxis`, sans doublon d'identifiant.

## DiscoveryAxis

- `id` : `core`, `context`, `impact` ou `debate`.
- `label` : libelle court dans la langue du resume.
- `queries` : dictionnaire BCP-47 vers une courte requete de videos.

Le profil est optionnel dans `VideoHighlightSet`. Il ne remplace pas `mixProfile`, qui reste le contrat canonique local de rapprochement entre videos.
