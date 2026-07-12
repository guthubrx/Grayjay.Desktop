# Audit de reutilisation

| Besoin | Existant | Decision |
|---|---|---|
| Passage LLM d'analyse | `build_analysis_prompt` et `run_analysis` | Etendre la reponse existante, sans nouvel appel. |
| Cache analyse | `analysis_cache_path` | Inclure la signature de langues, sans second cache. |
| Stockage highlights | `VideoHighlightSet` | Ajouter une propriete optionnelle au contrat existant. |
| Langues de precompute | `precompute.env` et `gen-chapters.sh` | Reutiliser une variable d'environnement deja sourcee. |

## Gate avant tasks

- [x] Aucun endpoint, store, fournisseur ou commande supplementaire n'est propose.
- [x] `mixProfile` n'est pas duplique et reste distinct du profil de requetes.
- [x] Les installations sans Smart Chapters ne chargent ni script ni configuration supplementaire.
