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

## Decision 5 - Profil editorial multidimensionnel, score derive

**Decision**: Le modele produit sept dimensions normalisees : `substance`, `rigor`, `clarity`, `distinctiveness`, `audienceValue`, `temporalSensitivity` et `confidence`. Le score editorial stable est calcule localement a partir des cinq premieres dimensions ; la fraicheur et la confiance restent des signaux distincts.

**Rationale**: Une rubrique multidimensionnelle rend le jugement plus inspectable qu'une note LLM globale. Elle permet d'evaluer un documentaire, un test produit, une news ou un tutoriel selon une definition commune : valeur potentielle pour un spectateur interesse, et non conformite a une opinion. La recherche LLM-Rubric recommande une decomposition explicite plutot qu'une note monolithique ; les travaux recents sur les LLM juges relevent un biais de position des echelles et soutiennent l'usage d'ancrages et de validations par comparaisons. [LLM-Rubric](https://arxiv.org/abs/2501.00274) [Position bias](https://arxiv.org/abs/2602.02219)

**Alternatives considered**:

- Note absolue unique produite par le LLM : rejetee, opaque et trop sensible a la formulation du prompt.
- Score relatif entre les chapitres : conserve pour la navigation intra-video uniquement ; rejetee pour comparer les videos.
- Score depend de la date : rejetee, car une video durable ne doit pas perdre sa valeur editoriale.

## Decision 6 - Fraicheur contextuelle et degradation gracieuse

**Decision**: La `temporalSensitivity` determine uniquement l'horizon de fraicheur utilise par les listes de recommandations. Les candidats sans profil gardent la formule de fraicheur historique. Le backfill lit uniquement les fichiers de highlights et de transcript deja presents ; il ne passe jamais par Whisper ou yt-dlp.

**Rationale**: Le moteur de classement central existe deja et combine interet, fraicheur, pertinence semantique et popularite. Ajouter un horizon optionnel conserve cette separation et evite de rendre un documentaire ancien artificiellement faible. Les jugements LLM restent imparfaits ; le profil conserve donc une `confidence` et le backfill est idempotent, ce qui autorise une validation humaine ulterieure par comparaisons de paires. [Efficient Inference for Noisy LLM-as-a-Judge](https://arxiv.org/abs/2601.05420)
