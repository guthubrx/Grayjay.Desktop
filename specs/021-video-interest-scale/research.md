# Recherche technique - echelle d'interet a dix paliers

## Decision 1 - Dix demi-paliers visibles, pas dix scores semantiques

**Decision**: Convertir le score d'interet video derive existant en une des dix valeurs `0,5`, `1,0`, `1,5` jusqu'a `5,0`. Chaque valeur recoit un libelle francais distinct.

**Rationale**: L'utilisateur demande explicitement les cinq etoiles et leurs demi-etoiles. Les demi-etoiles sont une convention deja employee par des medias de critique allemands tels que FILMSTARTS, alors que les echelles editoriales verbales restent courtes chez Telerama. [FILMSTARTS](https://www.filmstarts.de/kritiken/141184/pressespiegel/) [Telerama](https://www.telerama.fr/ecrans/avec-ses-tttt-telerama-donne-plus-de-relief-a-ses-critiques-7009452.php)

**Alternatives considered**:

- Dix libelles sans demi-etoile : rejetee, moins lisible et moins conventionnelle.
- Scores decimaux libres : rejetee, precision non justifiee et charge cognitive plus forte.
- Conserver cinq etoiles entieres : rejetee par l'arbitrage utilisateur.

## Decision 2 - Preserver les seuils entiers existants

**Decision**: Les anciens seuils `0,30`, `0,48`, `0,66` et `0,82` restent les bornes superieures des anciennes etoiles entieres. Chaque bande est coupee en deux demi-paliers ; la premiere bande est elle-meme decoupee pour introduire `0,5` etoile.

| Score brut d'interet | Note visible | Libelle |
|---:|---:|---|
| `< 0,15` | 0,5 | Très faible |
| `0,15 - < 0,30` | 1,0 | Faible |
| `0,30 - < 0,39` | 1,5 | Anecdotique |
| `0,39 - < 0,48` | 2,0 | À picorer |
| `0,48 - < 0,57` | 2,5 | Utile |
| `0,57 - < 0,66` | 3,0 | Intéressante |
| `0,66 - < 0,74` | 3,5 | Très intéressante |
| `0,74 - < 0,82` | 4,0 | Remarquable |
| `0,82 - < 0,91` | 4,5 | Excellente |
| `>= 0,91` | 5,0 | Passionnante |

**Rationale**: Cela ajoute la finesse demandee sans deplacer brutalement les classes entieres existantes. La borne haute `0,91` separe le nouveau palier `4,5` du sommet `5,0` sans toucher aux scores bruts.

**Alternatives considered**:

- Bornes uniformes de 0,10 : rejetee, elle modifierait fortement les regroupements historiques.
- Bornes par quantiles du cache local : rejetee, elles changeraient a mesure du backfill et rendraient une meme video instable.

## Decision 3 - Ne pas melanger score de chapitre, interet et recommandation

**Decision**: Cette PR ne modifie ni les scores `segment.score`, ni les filtres Smart Chapters, ni `recommendationRanking.ts`.

**Rationale**: Le prompt Smart Chapters note explicitement ses segments relativement a leur video. Ce signal reste adequat pour naviguer dans une video mais ne constitue pas une calibration editoriale inter-videos. YouTube et Netflix utilisent plusieurs signaux et distinguent la selection des rangs, des titres et de leur ordre. [YouTube](https://support.google.com/youtube/answer/16089387?hl=en) [Netflix](https://help.netflix.com/fr/node/100639)

**Alternatives considered**:

- Ajouter une nouvelle note LLM de video maintenant : rejetee, elle demanderait une calibration humaine et une migration/backfill qui depassent le besoin de graduation.
- Modifier les scores de chapitres : rejetee, cela casserait Smart TV et les filtres existants.

## Decision 4 - Rendu graphique et texte accessible

**Decision**: Utiliser un composant graphique d'etoiles avec une demi-etoile CSS, accompagne d'une valeur visible `x,5 / 5` et d'un libelle exploitable par lecteur d'ecran.

**Rationale**: Le symbole textuel seul ne garantit pas un rendu correct d'une demi-etoile. Une representation CSS a cinq positions fixes evite les decalages de layout tout en fournissant une alternative textuelle. Les patterns WAI-ARIA demandent un nom accessible pour les controles et indications de notation. [WAI-ARIA](https://www.w3.org/WAI/ARIA/apg/patterns/radio/examples/radio-rating/)

**Alternatives considered**:

- Glyphe Unicode de demi-etoile : rejetee, support typographique incertain.
- SVG dessine a la main : rejetee, plus couteux a maintenir et inutile.

## Validation live et limites

- La recherche multilingue complete est archivee dans `/Users/moi/Nextcloud/12.Recherches/RECHERCHE_20260806T123230_recherche-comparative-en-francais-anglais-espagnol-allem/RAPPORT.md`.
- La note affichee restera un signal d'interet derive. Elle n'est ni une probabilite de satisfaction ni une mesure universelle entre langues et cultures.
