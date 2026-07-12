# Specification: Sous-titres traduits et modales globales

**Feature Branch**: `session-001-translated-subtitles`
**Created**: 2026-07-11
**Status**: Draft

## Objectif

Permettre à un utilisateur de regarder une vidéo dont les sous-titres source sont dans une langue qu'il ne lit pas, avec une piste de sous-titres traduite dans sa langue préférée. Les Smart Chapters, le résumé et le panneau Smart doivent employer cette même langue. Les boîtes de dialogue globales doivent rester utilisables au-dessus du lecteur dans tous ses modes.

## Scénarios utilisateur

### US1 - Lire une vidéo étrangère avec des sous-titres traduits (P1)

Un utilisateur francophone ouvre une vidéo japonaise qui possède un transcript horodaté mais aucune piste française. Il peut sélectionner une piste `Français traduit` et voir des sous-titres synchronisés pendant la lecture.

**Critères d'acceptation**

1. Une vidéo disposant d'un transcript horodaté peut obtenir une piste traduite dans la langue préférée de l'utilisateur.
2. La piste traduite conserve une synchronisation utilisable avec la parole; elle ne dépend pas de la disponibilité réseau pendant la lecture.
3. Si la piste n'existe pas encore, l'interface indique qu'elle est en préparation sans interrompre la vidéo ni masquer les pistes source.
4. Si la traduction échoue ou si aucun transcript n'existe, les sous-titres source restent accessibles et aucune erreur bloquante n'est affichée.

### US2 - Comprendre les informations Smart dans sa langue (P1)

Un utilisateur choisit le français comme langue de Smart Analysis. Les résumés, thèses et chapitres nouvellement calculés pour une vidéo étrangère sont en français, y compris dans le panneau latéral et les vues Highlights/Smart TV.

**Critères d'acceptation**

1. La langue de génération Smart existante reste la source de vérité pour les nouvelles analyses.
2. Les analyses existantes dans une autre langue peuvent être régénérées sans supprimer le transcript ou les autres données utiles.
3. Les vues qui affichent `globalSummary`, thèses ou chapitres présentent la même version linguistique des données.

### US3 - Réutiliser les résultats sans coût répété (P1)

Quand un même transcript est demandé plusieurs fois dans la même langue cible, l'application réutilise le résultat déjà calculé au lieu de redemander une traduction.

**Critères d'acceptation**

1. Le cache distingue au minimum la vidéo, la langue cible et la version du transcript source.
2. Un changement de transcript ou une demande explicite de rafraîchissement rend le résultat traduit obsolète.
3. La génération batch peut préparer les traductions en même temps que les analyses sans effectuer de travail inutile pour les vidéos déjà à jour.

### US4 - Ouvrir une boîte de dialogue au-dessus du lecteur (P1)

Depuis une vidéo maximisée, une vue théâtre ou une vidéo normale, l'utilisateur ouvre Partager, Télécharger, Ajouter à une playlist ou une autre modale globale. La boîte est visible, reçoit le clic et peut être fermée.

**Critères d'acceptation**

1. Une modale globale recouvre visuellement le lecteur, ses menus et ses contrôles.
2. Le comportement fonctionne aussi si le navigateur place le lecteur dans un élément plein écran.
3. La correction ne change pas l'ordre relatif voulu des menus contextuels et panneaux propres au lecteur.

### US5 - Adapter l’apparence des sous-titres (P1)

Un utilisateur règle l’apparence des sous-titres une fois dans les paramètres du lecteur. Les pistes source et les pistes traduites appliquent le même rendu pendant la lecture.

**Critères d'acceptation**

1. Les réglages proposent la taille, la police, la couleur du texte, le style et la couleur d’ombre, le fond du texte et la fenêtre de sous-titres.
2. La fenêtre entoure les lignes de sous-titres actives, sans recouvrir toute la surface vidéo.
3. Une configuration absente conserve le rendu historique des pistes source: Inter blanc 24 px, fond noir à 50 %, sans fenêtre.
4. Les réglages sont persistés dans les paramètres de lecture et s’appliquent également aux Smart Subtitles.
5. La taille propose une échelle de 16 à 40 px par pas de 2 px, sans modifier la taille visuelle des configurations existantes.

## Exigences fonctionnelles

- **FR-001**: L'application DOIT conserver ou réutiliser les cues horodatés utilisés pour les Smart Chapters afin de produire une piste traduite.
- **FR-002**: L'utilisateur DOIT pouvoir choisir une langue de sous-titres traduits parmi des langues prises en charge, avec le français disponible.
- **FR-003**: Une piste traduite DOIT apparaître dans le sélecteur de sous-titres avec une étiquette explicite, distincte de la piste source.
- **FR-004**: Le système NE DOIT PAS traduire à chaque affichage; il DOIT réutiliser un résultat local valide.
- **FR-005**: Les traductions DOIVENT être effectuées avant la lecture ou en tâche de fond identifiable, jamais dans la boucle critique de lecture.
- **FR-006**: La langue de Smart Analysis DOIT rester configurable indépendamment du choix de piste source et être appliquée à toutes les sorties Smart nouvellement générées.
- **FR-007**: Les données absentes, partielles ou anciennes DOIVENT se dégrader gracieusement vers les pistes et analyses déjà disponibles.
- **FR-008**: Le conteneur de modales globales DOIT être au-dessus de toutes les couches de l'application et être rendu dans le contexte plein écran approprié lorsqu'il existe.
- **FR-009**: La correction d'empilement DOIT couvrir Partager et les autres dialogues qui passent par le gestionnaire global existant.
- **FR-010**: Les réglages d’apparence des sous-titres DOIVENT être communs aux pistes source et traduites, persistés dans les réglages de lecture et compatibles avec une configuration existante.

## Entités clés

- **Transcript horodaté**: suite de cues source avec texte, début et fin.
- **Piste traduite**: cues traduits dans une langue cible, associés à une version du transcript source.
- **Préférence de langue**: langue de génération Smart et langue cible des sous-titres traduits.
- **Modale globale**: dialogue d’application devant rester au-dessus de la surface vidéo.

## Hypothèses et limites

- Le transcript existant est l’unique source de vérité temporelle; aucune reconnaissance vocale additionnelle n’est lancée lorsqu’il est complet.
- Les traductions utilisent le fournisseur configuré pour l’analyse Smart et respectent son profil économique actuel.
- La première version cible les langues déjà proposées par Smart Analysis; elle n’essaie pas de traduire l’interface entière de Grayjay.
- Une piste traduite peut être générée à la demande ou lors du précompute, mais elle ne bloque jamais le démarrage de la vidéo.

## Critères de succès

- Sur une vidéo japonaise avec transcript, un utilisateur francophone peut obtenir et sélectionner une piste française sans rechargement de la page.
- Après la première génération, une seconde sélection de la même piste n’entraîne aucun appel de traduction.
- Une analyse Smart française nouvellement générée n’affiche pas de titre, résumé ou thèse japonaise dans les surfaces Smart.
- Partager reste visible et cliquable au-dessus du lecteur dans les trois modes: normal, théâtre et maximisé/plein écran.
