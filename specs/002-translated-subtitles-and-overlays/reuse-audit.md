# Audit de réutilisation

## Éléments proposés et existant réutilisable

| Besoin | Existant | Décision |
|---|---|---|
| Cues horodatés | `tools/generate_smart_chapters.py` (`TranscriptCue`, cache transcript) | Réutiliser. |
| Appel de traduction | fournisseur OpenAI-compatible existant via `call_model` et wrapper Routr | Étendre sans dépendance. |
| Pistes locales | flux `subtitleIsLocal`, `StreamLocalSubtitleSource`, sélecteur de sous-titres local | Réutiliser avec une source traduite identifiée. |
| Plein écran | `NextUpOverlay` et son `Portal` suivant `document.fullscreenElement` | Extraire/adopter le même pattern pour les modales globales. |
| Smart Analysis | `GenerationLanguageName()` et placeholder `{language}` | Conserver comme source de vérité. |

## Décision

Pas de doublon structurel détecté. Le plan étend des contrats et chemins existants plutôt que d’introduire un service séparé.

## Gate avant tâches

- [x] Aucun nouveau service persistant.
- [x] Aucun nouveau fournisseur externe.
- [x] Aucun nouveau composant de sous-titres.
- [x] Aucune duplication du mécanisme plein écran.
