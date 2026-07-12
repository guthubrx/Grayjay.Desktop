# Recherche technique : Smart Mix

**Date** : 2026-07-12  
**Portee** : construire localement un mix de videos entieres a partir d'analyses Smart Chapters deja disponibles.

## Contraintes verifiees

| Contrainte | Constat | Consequence |
|---|---|---|
| Routr ne fournit pas d'embeddings | `/Users/moi/Nextcloud/10.Scripts/45.routr/specs/004-audit-remediation-complete/implementation.md` documente `POST /v1/embeddings` en `501` explicite. | Aucun index vectoriel ni appel d'embeddings ne peut etre une dependance de la fonction. |
| Smart Chapters produit deja un JSON structure | `tools/generate_smart_chapters.py` produit `transcriptLanguage`, `globalSummary` et `theses`, valides puis ecrits en highlight. | Le profil de mix est ajoute a cette meme analyse, sans second appel LLM pour les nouvelles videos. |
| Le transcript brut n'est pas stocke dans le highlight | `VideoHighlightSet` ne porte que les resultats d'analyse, les segments et les sous-titres traduits. | Le mix conserve ce principe de minimisation des donnees. |
| Smart TV possede deja une file fixe et des limites | `Grayjay.Desktop.Web/src/pages/Home/index.tsx` et `Grayjay.ClientServer/Settings/GrayjaySettings.cs`. | Le mix reutilise les plafonds de duree, de videos et de variete existants. |
| La similarite actuelle est lexicale | `Grayjay.Desktop.Web/src/utils/smartTvSequencer.ts` applique un Jaccard sur un texte de sujet. | Un profil a vocabulaire canonique rend ce calcul nettement plus stable, sans dependance supplementaire. |

## Recherche externe

| Source | Enseignement retenu | Application au Smart Mix |
|---|---|---|
| [Google Research - Accuracy and Diversity](https://research.google/pubs/towards-unified-metrics-for-accuracy-and-diversity-for-recommender-systems/) | La pertinence et la diversite sont des objectifs distincts, a equilibrer explicitement. | Les proportions `Proche`, `Connexe` et `Autre angle` deviennent des objectifs visibles plutot qu'un bonus cache. |
| [Google Research - Values of Exploration](https://research.google/pubs/values-of-exploration-in-recommender-systems/) | L'exploration peut ameliorer la diversite, la nouveaute et la serendipite sans se limiter a l'exploitation du meilleur score. | Les sujets connexes ne sont pas des erreurs de classement : ils disposent d'un quota regle par l'utilisateur. |
| [Google Research - Diversity and Inclusion Metrics](https://research.google/pubs/diversity-and-inclusion-metrics-for-subset-selection/) | Une bonne selection doit concilier adequation au but de l'utilisateur et diversite du sous-ensemble. | Une categorie n'est jamais remplie par un contenu hors sujet ; les quotas se redistribuent seulement entre candidats pertinents. |
| [Anthropic - Increase output consistency](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/increase-consistency) | Les sorties structurees et un schema explicite reduisent les incoherences de donnees LLM. | Le profil est un petit objet JSON borne et valide, pas un texte libre reutilise comme regle metier. |
| [Nielsen Norman Group - User control and freedom](https://www.nngroup.com/articles/user-control-and-freedom/) | Une action automatisee doit rester visible, annulable et controlee. | Le mix est fixe, explicable et recalcule uniquement par une action utilisateur. |

## Decisions

### D1 - Profil compact produit avec l'analyse existante

**Decision** : ajouter au premier passage d'analyse un `mixProfile` compose de listes bornees : `topics`, `relatedTopics` et `angleLabels`.

Les libelles internes sont en anglais canonique, meme lorsque le resume visible est dans une autre langue. Ils ne sont pas affiches tels quels a l'utilisateur. Ce choix rend la comparaison entre une video japonaise, arabe et francaise possible sans appeler un traducteur ni un service d'embeddings au clic.

**Pourquoi** : le transcript est deja present dans le prompt de l'analyse. Ajouter quelques champs JSON augmente faiblement le cout du pre-calcul et ne cree aucune nouvelle dependance.

**Alternative ecartee** : un index vectoriel multilingue. Il serait plus general, mais Routr ne fournit pas l'endpoint necessaire et ajouter un modele local ou une base vectorielle excederait le besoin prouve.

### D2 - Classement local par categories editoriales

**Decision** : comparer les profils canoniques et les textes de repli avec la similarite Jaccard deja employee par Smart TV, puis repartir les meilleurs candidats entre trois categories :

- `Proche` : sujets principaux communs ;
- `Connexe` : lien entre sujets principaux et sujets connexes ;
- `Autre angle` : sujet commun mais angle analytique distinct.

Chaque categorie est classee par pertinence, interet des Smart Chapters, fraicheur legere, non-visionnage et variete de createur. Les quotas sont ensuite attribues par la methode du plus fort reste, puis redistribues sans ajouter de contenu hors sujet.

**Pourquoi** : le calcul est explicable, deterministe, en O(n log n) pour n candidats, et ne depend pas d'un appel reseau.

### D3 - Videos completes, chapitres comme preuves de pertinence

**Decision** : le mix ajoute des videos completes a la file de lecture. Le chapitre le plus pertinent est conserve comme metadonnee et raison d'affichage, mais ne tronque pas la lecture.

**Pourquoi** : `Mix inspire par ce titre`, analogue a Deezer, porte sur des videos et non sur une succession de clips. Le resultat reste toutefois transparent lorsque le lien est localise dans une partie de la video.

### D4 - Projection locale unique des candidats

**Decision** : ajouter un endpoint highlights dedie qui retourne, en un appel local, les donnees compactes necessaires a la composition : video, profils, scores, resumes et metadonnees utiles des chapitres.

**Pourquoi** : appeler `Get` une fois par video produirait un N+1 local, visible sur un catalogue de centaines de highlights. Le nouveau contrat reste une projection de `StateHighlights`, sans nouveau store ni cache du transcript.

### D5 - Reglages sur une surface dediee

**Decision** : ajouter `Settings > Smart Mix` a cote de `Smart Search`, avec trois champs de pourcentage par pas de 5 et un total explicite. La sauvegarde est impossible tant que le total n'est pas 100 %.

**Pourquoi** : les trois proportions sont une intention editoriale comprehensible ; elles ne doivent pas etre encodees par des coefficients internes ou par un dropdown ambigu.

## Risques et reponses

| Risque | Reponse |
|---|---|
| Des anciens highlights n'ont pas de profil | Repli sur resume, theses et titres de chapitres existants ; aucune reanalyse massive. |
| Le profil LLM est imparfait | Les listes sont bornees, validees et ne remplacent pas le score d'interet ni les textes existants. |
| Un quota n'a pas assez de candidats | Redistribution vers les autres categories pertinentes ; jamais vers du contenu hors sujet. |
| Le meme createur occupe le catalogue | La variete est une preference, pas une exclusion : elle se relache si aucun autre candidat pertinent n'existe. |
| Le routeur est indisponible | Le clic de creation n'en depend pas ; seules les analyses futures produisent progressivement des profils plus riches. |

## Verification research

- Consultation DevKMS demandee par la constitution : `mem context` et `mem search` ont ete tentes, mais la commande `mem` est absente de cet environnement (`command not found`). Les decisions sont donc documentees dans cette recherche et dans l'ADR de la feature.
- Les sources live et leur usage sont conserves dans ce document pour rendre la conduite editoriale re-evaluable.
