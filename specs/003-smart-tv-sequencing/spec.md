# Specification de fonctionnalite : Sequencement editorial Smart TV

**Branche de fonctionnalite** : `pr/smart-tv-sequencing`
**Creee le** : 2026-07-11
**Statut** : Brouillon valide pour planification
**Entree** : Composer une session Smart TV fixe qui transforme des Smart Chapters deja analyses en un parcours editorial coherent : approfondir un sujet, l'elargir, puis changer d'angle de facon explicable. Le mode de lecture en continu reste hors perimetre.

## Scenarios utilisateur et tests *(obligatoire)*

### User Story 1 - Lancer un parcours editorial coherent (Priorite : P1)

En tant que spectateur, je veux lancer une session Smart TV fixe qui enchaine des passages pertinents avec une intention editoriale lisible, afin de decouvrir un sujet sans avoir l'impression que les videos sont juxtaposees au hasard.

**Pourquoi cette priorite** : Une session fixe n'apporte de valeur que si sa suite constitue une conduite editoriale, pas seulement un tri par score.

**Test independant** : Avec un corpus de chapitres analyses couvrant plusieurs sujets et createurs, lancer une session et verifier que chaque passage apres le premier est selectionne pour une raison affichable : continuer, decouvrir ou changer d'angle.

**Scenarios d'acceptation** :

1. **Etant donne** un ensemble de chapitres elegibles, **quand** l'utilisateur lance une session fixe, **alors** le premier passage constitue un point d'entree fort et les suivants forment un parcours avec des intentions de transition explicites.
2. **Etant donne** un passage sur un sujet, **quand** des passages suffisamment pertinents permettent de l'approfondir, **alors** la session peut continuer ce sujet avant de l'elargir vers un autre createur ou groupe.
3. **Etant donne** un sujet deja suffisamment developpe, **quand** un passage propose une limite, une consequence, une critique ou un contrepoint pertinent, **alors** la session peut l'utiliser comme changement d'angle plutot que de passer arbitrairement a un autre sujet.
4. **Etant donne** que plusieurs intentions sont possibles, **quand** la session est construite, **alors** elle n'applique pas un cycle rigide et conserve la qualite du passage comme priorite de selection.

---

### User Story 2 - Eviter la repetition sans perdre les bons passages (Priorite : P1)

En tant que spectateur, je veux que Smart TV se souvienne des chapitres deja joues et evite les repetitions de video, createur, groupe et sujet, afin que la session reste variee tout en conservant les meilleurs contenus.

**Pourquoi cette priorite** : Un mix semble pauvre si le meme contenu revient ou si la diversification efface tous les passages forts.

**Test independant** : Jouer plusieurs chapitres, recalculer une session puis verifier que les chapitres deja joues ne reparaissent pas et que les plafonds configures par video sont respectes sans exclure automatiquement tous les autres chapitres utiles de cette video.

**Scenarios d'acceptation** :

1. **Etant donne** un chapitre deja joue dans une session Smart TV precedente, **quand** une nouvelle session est calculee, **alors** ce chapitre n'est pas repropose.
2. **Etant donne** plusieurs chapitres elegibles issus de la meme video, **quand** une session est construite, **alors** leur nombre ne depasse pas le plafond configure pour une video.
3. **Etant donne** un seul chapitre deja joue dans une video par ailleurs pertinente, **quand** la session est calculee, **alors** un autre chapitre non joue de cette video peut rester eligible dans la limite du plafond configure.
4. **Etant donne** plusieurs candidats de qualite voisine, **quand** une video, un createur, un groupe ou un sujet vient d'etre beaucoup represente, **alors** la session prefere un candidat moins repetitif lorsque cela ne deteriore pas sensiblement la pertinence.

---

### User Story 3 - Garder une session stable et controlable (Priorite : P2)

En tant que spectateur, je veux comprendre la raison de l'enchainement, choisir l'equilibre du mix et recalculer deliberement une session, afin de garder le controle sans perdre le contexte de lecture.

**Pourquoi cette priorite** : Une programmation personnelle doit etre explicable et rester une aide, non une boite noire qui change pendant la lecture.

**Test independant** : Lancer une session, verifier qu'elle reste identique pendant sa lecture, modifier une preference puis recalculer et verifier que la session suivante applique la preference sans modifier la session deja en cours.

**Scenarios d'acceptation** :

1. **Etant donne** une session fixe lancee, **quand** de nouvelles videos sont publiees ou que le catalogue est reindexe, **alors** l'ordre de la session en cours ne change pas spontanement.
2. **Etant donne** une transition dans une session, **quand** le lecteur arrive au nouveau passage, **alors** l'utilisateur peut identifier si l'enchainement continue le sujet, propose une decouverte ou apporte un autre angle.
3. **Etant donne** des reglages de mix, de plafonds et de duree, **quand** l'utilisateur recalcule une session, **alors** le nouveau calcul respecte ces reglages et conserve les exclusions de chapitres deja joues.
4. **Etant donne** un catalogue sans analyse Smart Chapters exploitable, **quand** l'utilisateur ouvre Smart TV ou les surfaces associees, **alors** l'application reste utilisable et ne presente ni erreur ni session trompeuse.

### Cas limites

- Le corpus ne contient qu'un seul sujet, une seule video ou un seul chapitre eligible.
- Aucun candidat ne satisfait l'intention editoriale souhaitable apres un passage donne.
- Un chapitre est lie a une video supprimee, devenue indisponible ou sans source de lecture valide.
- Un reglage de plafond rend impossible l'atteinte de la duree ou du nombre cible de chapitres.
- Un chapitre est marque joue tandis qu'une session fixe qui le contient est encore ouverte dans une autre fenetre.
- Les donnees Smart Chapters, leurs scores ou leurs resumes sont absents, incomplets ou plus anciens que la video.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : Le systeme DOIT construire une session Smart TV fixe a partir des seuls chapitres disposant de donnees d'analyse exploitables au moment du calcul.
- **FR-002** : Le systeme DOIT classer les candidats en privilegiant leur interet calcule avant les preferences de varietes ou de transitions.
- **FR-003** : Le systeme DOIT produire un premier passage fort, puis choisir les passages suivants avec une intention editoriale parmi continuite, decouverte et changement d'angle.
- **FR-004** : Le systeme NE DOIT PAS imposer une alternance rigide entre les intentions editoriales lorsque les candidats pertinents ne la justifient pas.
- **FR-005** : Le systeme DOIT privilegier une continuite lorsque des passages permettent d'approfondir la meme these ou le meme sujet sans repetition excessive.
- **FR-006** : Le systeme DOIT privilegier une decouverte lorsqu'un passage apporte un lien pertinent depuis un autre createur, groupe ou cadrage.
- **FR-007** : Le systeme DOIT privilegier un changement d'angle lorsqu'un passage apporte une limite, une consequence, une critique ou un contrepoint pertinent au sujet precedent.
- **FR-008** : Lorsque aucune intention editoriale ne peut etre satisfaite, le systeme DOIT retenir le meilleur candidat encore eligible et signaler que la transition est un repli de pertinence.
- **FR-009** : Le systeme DOIT respecter les reglages existants de duree cible, de nombre maximal de chapitres, de nombre maximal de videos et de chapitres par video.
- **FR-010** : Le systeme DOIT eviter les repetitions immediates de meme video, createur, sujet et, lorsque cette information est connue, groupe source, si des alternatives de qualite comparable existent.
- **FR-011** : Le systeme DOIT conserver un historique persistant des chapitres joues par Smart TV, independamment de l'historique de lecture des videos.
- **FR-012** : Par defaut, le systeme DOIT exclure de toute nouvelle session un chapitre deja joue et conserver eligible un autre chapitre non joue de la meme video.
- **FR-013** : Le systeme DOIT conserver l'ordre et la composition d'une session fixe apres son lancement, jusqu'a une action explicite de recalcul ou de demarrage d'une nouvelle session.
- **FR-014** : Le systeme DOIT afficher une raison concise et coherente pour chaque transition : continuite, decouverte, changement d'angle ou repli de pertinence.
- **FR-015** : Le systeme DOIT permettre de regler l'equilibre entre continuite, decouverte et changement d'angle, et appliquer ce choix au prochain calcul sans muter une session fixe en cours.
- **FR-016** : Le systeme DOIT degrader gracieusement lorsque Smart Chapters ou les donnees necessaires sont indisponibles : aucune session invalide, aucune erreur bloquante et aucune dependance imposee aux autres fonctionnalites.
- **FR-017** : Le systeme DOIT ignorer les chapitres dont la video ne peut plus etre lue et poursuivre le calcul avec les candidats valides.
- **FR-018** : Le systeme DOIT conserver la compatibilite avec les Smart TV existantes generees avant cette fonctionnalite, en les laissant lisibles ou en les recalculant a la demande sans perte de controle utilisateur.
- **FR-019** : Le mode de lecture en continu, son rafraichissement du catalogue et sa prochaine entree non deterministe NE DOIVENT PAS etre implementes dans cette fonctionnalite.

### Entites cles

- **Session Smart TV fixe** : Selection ordonnee, stable apres lancement, de chapitres et de points de lecture.
- **Candidat editorial** : Chapitre eligible avec son score d'interet, ses informations de sujet et son contexte de video, createur et groupe.
- **Intention de transition** : Raison de l'enchainement entre deux passages : continuite, decouverte, changement d'angle ou repli de pertinence.
- **Historique Smart TV** : Ensemble persistant des chapitres deja joues, separe de l'historique global des videos.
- **Profil de mix** : Preference utilisateur qui module l'equilibre des intentions lors du prochain calcul.

## Criteres de succes *(obligatoire)*

### Resultats mesurables

- **SC-001** : Sur un corpus contenant au moins six chapitres elegibles repartis sur au moins deux sujets, chaque session de huit passages comporte au moins deux intentions editoriales distinctes, sauf si les plafonds ou les exclusions l'empechent explicitement.
- **SC-002** : Dans 100 % des sessions testees, aucun chapitre deja joue ne reapparait lors de deux recalculs consecutifs utilisant le meme historique Smart TV.
- **SC-003** : Dans 100 % des sessions testees, le nombre de chapitres issus d'une video ne depasse jamais le plafond configure par video.
- **SC-004** : Pour un meme catalogue, un meme historique et les memes reglages, deux calculs produisent le meme ordre de session ou des ordres equivalemment justifies par les memes intentions affichees.
- **SC-005** : Lors de la lecture d'une session fixe de douze passages, aucun ajout, retrait ou reordonnancement ne survient sans action explicite de l'utilisateur.
- **SC-006** : Dans 100 % des cas ou une analyse Smart est absente ou incomplete, les ecrans concernés restent consultables et aucune session de mauvaise qualite n'est lancee automatiquement.
- **SC-007** : Dans un test manuel de dix transitions, l'utilisateur peut identifier la raison de chaque transition depuis l'interface sans devoir consulter un journal technique.

## Hypotheses

- Les scores, resumes et informations de sujet deja produits par Smart Chapters constituent la matiere editoriale ; le calcul d'une session ne demande pas une nouvelle analyse de video.
- Le profil initial est equilibre : il donne une place aux trois intentions sans sacrifier un candidat nettement plus interessant.
- Les reglages de volume et de plafonds deja exposes par Smart TV restent les controles principaux de taille de session ; cette fonctionnalite ajoute seulement les controles necessaires a la conduite editoriale et a l'historique.
- La premiere livraison cible Smart TV Desktop et les sessions fixes. Le mode en continu fera l'objet d'une specification et d'une PR distinctes.
- Les labels de transition sont des explications de selection concises ; ils ne pretendent pas etablir une verite editoriale absolue.
