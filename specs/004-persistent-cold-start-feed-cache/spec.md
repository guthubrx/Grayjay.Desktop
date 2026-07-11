# Feature Specification: Affichage immediat des feeds au demarrage

<!-- SPEC-FORMALISM:START -->
## Fiche Synthese

Spec: 004-persistent-cold-start-feed-cache
Titre: Affichage immediat des feeds au demarrage
Statut: In Progress
Priorite: P1
Taches: 8/10 (80%)
Tests: 7/8 (88%)

Resume:
- Contexte: les pages Souscriptions et Highlights restent vides pendant le chargement initial, malgre des videos precedemment connues par BlueJay.
- Objectif: afficher immediatement le dernier etat local exploitable, puis actualiser les donnees en arriere-plan.
- Dependances: SPEC-002-playback-prefetch, SPEC-003-smart-tv-sequencing.

Fichiers:
- spec.md: oui
- tasks.md: non
- plan.md: non
<!-- SPEC-FORMALISM:END -->

**Feature Branch**: `pr/persistent-cold-start-feed-cache`
**Created**: 2026-07-11
**Status**: In Progress
**Priority**: P1
**Dependencies**: SPEC-002-playback-prefetch, SPEC-003-smart-tv-sequencing

## Contexte

BlueJay conserve deja les videos d'abonnements dans son stockage local. Pourtant, apres un redemarrage de l'application, les ecrans Souscriptions et Highlights peuvent rester vides plusieurs secondes avant d'afficher leurs vignettes. Les donnees visibles dans la session precedente ne doivent pas disparaitre pendant que BlueJay actualise les sources.

## Scenarios Utilisateur Et Tests

### US1 - Reprendre les abonnements sans ecran vide (P1)

En tant qu'utilisateur qui relance BlueJay, je veux voir les dernieres videos connues dans Souscriptions sans attendre la mise a jour des sources, afin de pouvoir choisir une video immediatement.

**Scenario d'acceptation**:
1. BlueJay dispose d'au moins une video d'abonnement deja enregistree.
2. L'utilisateur quitte puis relance l'application hors ligne ou avec une source lente.
3. Il ouvre Souscriptions.
4. Les vignettes locales apparaissent avant la fin du rafraichissement des sources.
5. Les nouvelles donnees remplacent ou completent ensuite cet etat sans action de l'utilisateur.

### US2 - Retrouver les lignes Highlights au redemarrage (P1)

En tant qu'utilisateur qui ouvre Highlights apres un redemarrage, je veux retrouver une selection et les lignes de groupes deja calculees, afin que la page reste utile pendant l'actualisation en arriere-plan.

**Scenario d'acceptation**:
1. BlueJay dispose d'un etat local de feed et de groupes contenant des videos.
2. L'utilisateur relance l'application puis ouvre Highlights.
3. Les lignes derivables de cet etat sont rendues avant la fin de la recuperation live.
4. Le hero peut utiliser ces videos locales lorsqu'aucune recommandation live n'est encore disponible.

### US3 - Continuer normalement sans snapshot (P1)

En tant qu'utilisateur sans donnees locales exploitables, je veux que les pages conservent leur comportement de chargement actuel, afin qu'un premier lancement ou un cache indisponible ne provoque ni erreur ni ecran bloque.

**Scenario d'acceptation**:
1. Aucun etat de demarrage n'est disponible, ou il est invalide.
2. L'utilisateur ouvre Souscriptions ou Highlights.
3. L'interface utilise le flux de chargement existant et affiche les donnees lorsqu'elles deviennent disponibles.
4. Aucun message d'erreur technique ni crash n'est affiche.

### Cas Limites

- Le snapshot est vide, obsolete, incomplet ou illisible.
- Une chaine ou un groupe a ete retire depuis la creation du snapshot.
- L'actualisation live echoue ou prend plusieurs dizaines de secondes.
- Les sources fournissent des contenus non video, sans miniature ou sans auteur.
- Le snapshot est ecrit pendant l'arret de l'application.

## Exigences Fonctionnelles

- **FR-001**: BlueJay DOIT conserver localement un etat de demarrage borne des videos d'abonnements utilisables pour le rendu initial.
- **FR-002**: Souscriptions DOIT afficher cet etat lorsqu'il existe, avant que la mise a jour live ne soit terminee.
- **FR-003**: Highlights DOIT utiliser le meme etat pour fournir une selection initiale, un hero de repli et les lignes de groupes derivables.
- **FR-004**: La mise a jour live existante DOIT continuer en arriere-plan et remplacer les donnees de demarrage des qu'elle est disponible.
- **FR-005**: Les videos deja regardees, ignorees ou devenues invalides DOIVENT rester filtrees selon les regles existantes de chaque ecran.
- **FR-006**: Le snapshot DOIT etre borne et ne contenir que les donnees necessaires au premier rendu.
- **FR-007**: Le snapshot DOIT etre invalide sans erreur visible s'il ne peut pas etre lu ou ne correspond plus aux abonnements actuels.
- **FR-008**: La fonctionnalite NE DOIT PAS rendre le profil navigateur persistant, fixer le port local ni modifier les donnees de session, cookies ou authentifications des sources.
- **FR-009**: Les pages continuent de fonctionner si Smart Chapters, Smart TV ou les autres PR BlueJay ne sont pas disponibles.

## Criteres De Succes

- **SC-001**: Avec un snapshot local valide, Souscriptions affiche au moins une vignette locale avant la fin d'un rafraichissement live volontairement ralenti.
- **SC-002**: Avec le meme snapshot, Highlights affiche au moins une zone de contenu issue des abonnements avant le rafraichissement live.
- **SC-003**: Le parcours de demarrage ne depend pas du stockage navigateur, de son profil ou du port local courant.
- **SC-004**: Sans snapshot, les deux ecrans retombent sur le comportement actuel sans erreur non geree.
- **SC-005**: La creation ou la mise a jour d'un snapshot ne bloque pas l'interaction utilisateur ni le rafraichissement des abonnements.

## Entites

- **Snapshot de feed**: photographie locale bornee de videos recentes et de son horodatage, utilisable au prochain lancement.
- **Video de demarrage**: video valide provenant du snapshot et eligible au rendu initial.
- **Groupe d'abonnements**: regroupement existant permettant de repartir les videos de demarrage en lignes Highlights.

## Hypotheses

- Le stockage applicatif backend de Grayjay survit aux redemarrages et peut contenir un petit fichier derive supplementaire.
- L'utilisateur prefere voir des videos potentiellement legerement anciennes plutot qu'un ecran vide.
- Le nombre de videos necessaire au premier rendu reste borne et distinct du cache complet des abonnements.

## Hors Scope

- Modifier les criteres editoriaux de Smart TV ou la selection de ses chapitres.
- Conserver les cookies, les sessions de sources ou tout profil Chromium entre deux lancements.
- Forcer une actualisation reseau au demarrage.
- Modifier la semantique des videos vues, ignorees, Watch Later ou de l'historique.
