# Audit de reutilisation

## Resultat

| Element envisage | Equivalent existant | Decision |
|---|---|---|
| Valeur editoriale | `highlightInterest.ts` | Reutiliser et clarifier son perimetre; ne pas creer une seconde note de chapitre. |
| Metadonnees video | `IPlatformVideo` | Reutiliser `viewCount`, `dateTime`, auteur et URL. |
| Diversite Smart TV | `smartTvSequencer.ts` | Conserver les penalites de sequencement; ne pas dupliquer la diversite dans le score intrinsinseque. |
| Cache Highlights | `smartChapterSummaryByKey` dans Home | Reutiliser pour fournir l'interet editorial quand disponible. |
| Tri de groupe | `buildGroupCarousels` | Brancher le classificateur au lieu d'ajouter un autre pager ou cache. |

## Gate avant tasks

- [x] Aucun fournisseur IA, endpoint, schema ou store supplementaire n'est propose.
- [x] Le classificateur est unique et pur; il ne duplique ni Smart TV ni `highlightInterest`.
- [x] Les listes personnelles et la recherche standard restent hors perimetre.
