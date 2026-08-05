# ADR 016 : retrait de la mise a jour FUTO.MDNS non resolvable

**Statut** : accepte
**Date** : 2026-08-05

## Contexte

La branche `pr/016-mdns-memory-backpressure` ne contenait aucune modification du code mDNS. Elle ne faisait que remplacer le pointeur Git du sous-module `FUTO.MDNS`, de `fcd5be928d3740ed13837c2fa7d25c6ef0a0d85f` vers `0999c78c1671627df9ea0e3d5fda61d14ac66821`.

Le commit cible `0999c78c1671627df9ea0e3d5fda61d14ac66821` ne peut pas etre recupere depuis le depot du sous-module. Il n'est pas non plus present dans le clone local existant. Aucune modification effective ne peut donc etre inspectee, testee ou livree.

La verification constate aussi que l'URL actuellement configuree pour `FUTO.MDNS` n'est plus accessible depuis un clone vierge. Cette indisponibilite du depot source est anterieure et distincte du changement introduit par `pr/016-mdns-memory-backpressure`.

## Decision

Annuler le merge de `pr/016-mdns-memory-backpressure` dans `bluejay/all-features` et restaurer le pointeur `FUTO.MDNS` vers `fcd5be928d3740ed13837c2fa7d25c6ef0a0d85f`.

Supprimer la branche locale `pr/016-mdns-memory-backpressure` et son worktree. Aucune proposition vers FUTO ne sera creee a partir de cette branche.

## Consequences

- Positives : le projet revient au pointeur de sous-module utilise par les builds locaux precedents; aucune correction mDNS sans source verifiable ne reste integree.
- Negatives : aucune correction mDNS n'est retenue par cette decision. Il ne faut donc pas attribuer de correction de fuite memoire a cette ancienne branche. Un clone vierge reste bloque tant que la source de `FUTO.MDNS` n'est pas de nouveau accessible.
- Suite : toute nouvelle correction mDNS devra pointer vers un commit publiquement recuperable et etre validee avec le diff de code correspondant. La disponibilite du depot `FUTO.MDNS` doit etre traitee separement.
