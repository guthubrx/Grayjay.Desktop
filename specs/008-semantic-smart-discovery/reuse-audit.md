# Audit de reutilisation

## Resultat

| Element envisage | Equivalent existant | Decision |
|---|---|---|
| Recherche multilingue | `SmartSearchBackend` et `StateSmartSearch` | Reutiliser integralement. Aucun endpoint ni reglage nouveau. |
| Session fixe | `video.actions.setQueue` et metadonnees Smart Mix | Reutiliser. |
| Reglages de taille | `smartTvSettings` | Reutiliser `maxVideos`. |
| Classement local | `smartTvSequencer` | Etendre le candidat existant ; pas de second sequencer. |
| Profil semantique | `IVideoHighlightMixProfile` | Reutiliser sans schema additionnel. |

## Gate avant tasks

- [x] Aucun endpoint, fournisseur, store ou configuration duplique n'est propose.
- [x] Le comportement local Smart TV et la decouverte externe restent separes et explicables.
