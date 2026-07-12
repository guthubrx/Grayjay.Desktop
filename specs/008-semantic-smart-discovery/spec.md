# Specification de fonctionnalite : Smart Discovery et Smart TV semantique

**Branche de fonctionnalite** : `pr/010-semantic-smart-discovery`
**Creee le** : 2026-07-12
**Statut** : Validee pour implementation

## Scenarios utilisateur et tests

### User Story 1 - Des Smart TV coherentes dans les groupes Highlights (P1)

En tant que spectateur, je veux que le Smart TV d'un groupe existant (AI, Decouvertes AI, News...) utilise la signification deja extraite des videos afin que la session relie les sujets sans sortir des videos de ce groupe.

**Test independant** : avec deux videos dont les titres sont differents mais les profils portent le meme sujet canonique, une session de groupe identifie une continuite pertinente et privilegie cette transition a score comparable.

Scenarios d'acceptation :
1. Les sources d'un Smart TV de groupe restent exclusivement celles du groupe.
2. Les profils enrichis ameliorent la reconnaissance de meme sujet, d'elargissement et d'autre angle.
3. Sans profil, le sequencement existant fonde sur les chapitres et resumes reste disponible sans erreur.
4. La creation d'une session Smart TV ne declenche ni recherche externe ni appel de traduction.

### User Story 2 - Decouvrir Internet depuis une video comprise (P1)

En tant que spectateur, je veux lancer un mix inspire par une video analysee afin que BlueJay cherche de nouvelles videos sur mes sources actives et dans les langues configurees, au lieu de se limiter au catalogue deja analyse.

**Test independant** : depuis une video avec un profil de mix, l'action cree une session fixe de videos resultantes d'une recherche internationale dont la requete est derivee des sujets de la video et exclut la video source.

Scenarios d'acceptation :
1. L'action ne devient disponible que lorsque la video source dispose de Smart Chapters et d'un profil ou d'un resume exploitable.
2. La recherche utilise les langues, le traducteur local et les sources actives deja choisis dans Smart Search.
3. La session contient au plus le nombre de videos configure pour Smart TV, sans doublon de video ni repetition de la source.
4. La session est fixe apres sa creation ; elle ne change pas lors de l'arrivee de nouveaux resultats.
5. Une video decouverte garde le flux normal d'indexation automatique lorsqu'elle est lue, selon les reglages existants.

### User Story 3 - Echec explicable et sans regression (P2)

En tant que spectateur, je veux savoir si la decouverte ne peut pas etre executee, sans que les playlists, la recherche standard ou les Smart TV existants cessent de fonctionner.

Scenarios d'acceptation :
1. Sans traducteur Smart Search configure, BlueJay propose la configuration existante puis relance l'action.
2. Si aucune source ne renvoie de video, BlueJay explique que la recherche n'a rien retourne et ne cree pas de file vide.
3. Une erreur ou un delai de Smart Search ne modifie pas la file actuellement lue.
4. Les actions et sessions locales preexistantes restent utilisables lorsque Smart Search ou le routeur sont indisponibles.

## Exigences

- **FR-001** : Un Smart TV de groupe DOIT rester borne a ses sources de groupe.
- **FR-002** : Le sequencement Smart TV DOIT utiliser les labels semantiques disponibles en priorite sur la seule similarite textuelle des chapitres.
- **FR-003** : Les donnees Smart Chapters historiques sans profil DOIVENT conserver le comportement de repli actuel.
- **FR-004** : L'action `Create Smart Mix` DOIT lancer une recherche externe explicite a partir d'une requete derivee du profil de la video source.
- **FR-005** : La recherche DOIT reutiliser les langues, le traducteur et les sources actives de Smart Search ; elle ne DOIT PAS ajouter un second fournisseur de recherche ou une seconde configuration de traduction.
- **FR-006** : Une session de decouverte DOIT etre dedupliquee, bornee par `maxVideos`, et exclure la video source.
- **FR-007** : La recherche externe DOIT etre attendue avant de remplacer la file de lecture ; aucune file partielle ne doit demarrer.
- **FR-008** : L'absence de Smart Chapters, de profil, de traducteur ou de resultat DOIT etre signalee de facon concise et ne jamais bloquer les autres fonctions.

## Cas limites

- Le profil ne contient qu'un sujet tres general ou aucun label ; le resume devient la requete de repli.
- Une meme video est retournee dans plusieurs langues ou par plusieurs sources.
- Les resultats sont des contenus non video, sans URL, ou la video source elle-meme.
- Une recherche externe depasse son delai de consultation ; seuls les resultats deja retournes peuvent etre utilises.
- Le groupe Highlights ne contient aucun profil enrichi.

## Criteres de succes

- Une session Smart TV de groupe n'inclut jamais une video hors groupe.
- Une session de decouverte comporte uniquement des videos externes distinctes, hors video source, et respecte `maxVideos`.
- La requete de decouverte est construite sans appel LLM supplementaire dans BlueJay.
- Les Smart TV existantes, la recherche standard et Smart Search continuent de fonctionner sans configuration additionnelle.

## Hors perimetre

- Ajouter automatiquement les videos trouvees dans un groupe d'abonnements.
- Reranquer les resultats externes avec une nouvelle transcription avant lecture.
- Creer une base vectorielle, un service d'embeddings ou une API de recherche additionnelle.
- Modifier les sessions Smart TV deja persistees.
