# Audit de reutilisation

| Besoin | Existant | Decision |
|---|---|---|
| Recherche plugins | `StateSmartSearch` et `StatePlatform.SearchLazy` | Etendre le contrat et injecter une limite optionnelle; aucun second moteur de recherche. |
| Traduction Routr | `StateSmartSearchCommand` et `smart_search_translator.py` | Ajouter une operation groupee au script existant. |
| Profil d'axes | `VideoHighlightSet.discoveryProfile` de la PR 013 | Consommer directement le contrat optionnel. |
| Classement | `rankRecommendationCandidates` de la PR 012 | Reutiliser pour les candidats externes. |
| Protection de lecture | `VideoProvider` et `VideoQueueItemMeta` | Ajouter une operation ciblee de remplacement de queue non lue. |

## Gate avant tasks

- [x] Aucun service IA parallele ni cache de transcripts n'est ajoute.
- [x] La limite de parallelisme entoure le point qui lance reellement les recherches plugin.
- [x] La recherche standard conserve son chemin historique.
- [x] La mutation de queue est isolee et protegee par identifiant de session.
