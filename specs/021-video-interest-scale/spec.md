# Feature Specification: Echelle d'interet a dix paliers

**Feature Branch**: `pr/021-video-interest-scale`
**Created**: 2026-08-06
**Status**: In Progress
**Input**: User description: "Remplacer l'echelle d'interet video par les cinq etoiles et leurs demi-etoiles : dix paliers gradues et des libelles francais."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lire un interet gradue (Priority: P1)

Comme spectateur, je veux voir l'interet d'une video sur dix paliers de demi-etoiles, afin de distinguer deux videos qui etaient auparavant toutes les deux affichees avec le meme nombre entier d'etoiles.

**Why this priority**: L'echelle actuelle condense trop fortement les differences entre videos deja analysees.

**Independent Test**: Consulter deux videos dont le score d'interet se situe de part et d'autre d'un seuil de demi-etoile et constater une note et un libelle differents.

**Acceptance Scenarios**:

1. **Given** une video avec un signal d'interet disponible, **When** son interet est affiche, **Then** sa note appartient exactement a l'un des dix paliers `0,5`, `1,0`, `1,5` jusqu'a `5,0`.
2. **Given** une note comprenant une demi-etoile, **When** elle est affichee dans Smart Analysis, le hero ou son overlay, **Then** la demi-etoile est visible et une valeur textuelle non ambigue est disponible.
3. **Given** deux scores voisins mais places de part et d'autre d'un seuil, **When** ils sont affiches, **Then** ils ne sont plus artificiellement ramenes au meme palier entier.

---

### User Story 2 - Comprendre la note en francais (Priority: P2)

Comme spectateur francophone, je veux que chaque palier soit accompagne d'un libelle francais distinct, afin de comprendre immediatement le niveau d'interet sans devoir interpreter une note anglaise generique.

**Why this priority**: Les libelles actuels sont en anglais et ne distinguent que cinq niveaux, alors que l'interface expose deja cinq etoiles.

**Independent Test**: Verifier les dix paliers dans les emplacements qui affichent l'interet et constater leur libelle francais associe.

**Acceptance Scenarios**:

1. **Given** une note de `0,5` a `5,0`, **When** le libelle est affiche, **Then** il est en francais et correspond de maniere deterministe au palier.
2. **Given** une video avec plusieurs chapitres, **When** l'interet video est affiche, **Then** le libelle de video ne modifie pas les scores ni les couleurs des chapitres individuels.

---

### User Story 3 - Conserver les donnees et usages existants (Priority: P3)

Comme utilisateur, je veux que les anciennes analyses Smart Chapters continuent de produire une note sans regeneration, afin que la nouvelle echelle soit disponible immediatement et reste optionnelle pour les surfaces qui ne disposent pas encore d'un signal d'interet.

**Why this priority**: La graduation est une presentation derivee de donnees locales existantes ; elle ne doit ni imposer un appel LLM ni casser les anciens fichiers highlights.

**Independent Test**: Charger une ancienne analyse avec scores, une analyse sans score et une video sans Smart Chapters.

**Acceptance Scenarios**:

1. **Given** un ancien fichier highlights contenant des scores de chapitres, **When** l'interet video est calcule, **Then** il obtient un palier de demi-etoile sans migration du fichier.
2. **Given** une video sans score exploitable, **When** elle est affichee, **Then** l'interface garde son comportement actuel et n'affiche pas une note inventee.
3. **Given** une vue qui n'utilise pas l'indicateur d'interet, **When** elle est ouverte, **Then** son ordre de recommandation et son comportement restent inchanges.

---

### User Story 4 - Identifier une video interessante dans une grille (Priority: P1)

Comme spectateur, je veux voir la note d'interet directement sur la miniature d'une video deja analysee, afin de pouvoir comparer les videos d'une grille sans ouvrir chacune de leurs fiches.

**Why this priority**: Le score n'est utile a la selection que s'il est visible avant l'ouverture de la video.

**Independent Test**: Ouvrir une grille contenant une video analysee et une autre sans Smart Chapters, puis constater que seule la premiere montre une note en haut a gauche sans recouvrir sa duree, son icone de source ou son menu.

**Acceptance Scenarios**:

1. **Given** une carte correspondant a une video avec un resume Smart Chapters score, **When** la carte est rendue, **Then** elle affiche la note graduee existante en haut a gauche de la miniature.
2. **Given** une carte sans score exploitable, **When** la carte est rendue, **Then** aucun badge ni espace reserve n'est affiche.
3. **Given** un rafraichissement des highlights, **When** les donnees d'index changent, **Then** les cartes se mettent a jour sans requete individuelle ni conservation du resume textuel.

### Edge Cases

- Un score absent, non fini ou hors de la plage attendue ne doit pas creer de note invalide.
- Une note exactement egale a un seuil doit toujours etre attribuee au meme palier documente.
- Une demi-etoile doit rester lisible sur fond clair ou sombre et annoncer sa valeur aux technologies d'assistance.
- Les textes de details existants ne doivent pas pretendre que la note est une probabilite de satisfaction ni une valeur absolue universelle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le systeme MUST convertir tout score d'interet video utilisable en un des dix paliers reguliers de demi-etoiles, de `0,5` a `5,0` inclus.
- **FR-002**: Le systeme MUST conserver les frontieres historiques des etoiles entieres lorsqu'il ajoute les paliers intermediaires, sauf pour separer le niveau inferieur en `0,5` et `1,0`.
- **FR-003**: Le systeme MUST associer un libelle francais unique a chacun des dix paliers : `Très faible`, `Faible`, `Anecdotique`, `À picorer`, `Utile`, `Intéressante`, `Très intéressante`, `Remarquable`, `Excellente` et `Passionnante`.
- **FR-004**: Les vues existantes qui presentent l'interet video MUST afficher la demi-etoile et sa valeur textuelle sans modifier les donnees de Smart Chapters.
- **FR-005**: Le systeme MUST continuer de calculer l'interet a partir des anciens highlights et ne MUST lancer aucune analyse, transcription ou requete reseau pour cette seule graduation.
- **FR-006**: Le systeme MUST laisser les scores de chapitres et le rang de recommandation existant inchanges par cette fonctionnalite.
- **FR-007**: Le systeme MUST fournir une sortie accessible, indiquant la note sur cinq et son libelle, y compris lorsqu'une demi-etoile est presente.
- **FR-008**: Le systeme MUST afficher cette meme note sur les cartes videos lorsque le resume Smart Chapters correspondant fournit un signal exploitable.
- **FR-009**: Le cache d'etat partage par les cartes MUST ne conserver que les champs numeriques utiles au calcul d'interet, sans conserver les resumes textuels.

### Key Entities *(include if feature involves data)*

- **Signal d'interet video**: Score derive deja disponible pour presenter l'interet d'une video, distinct des scores de ses chapitres et de sa priorite de recommandation.
- **Palier d'interet**: Une des dix valeurs visibles de demi-etoile avec son seuil minimal, son libelle francais et sa representation accessible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Les dix paliers et leurs seuils sont verifies par des tests unitaires, y compris chaque valeur exacte de frontiere.
- **SC-002**: Les deux composants existants et leurs trois contextes d'affichage rendent une note de demi-etoile et un libelle francais pour chaque palier.
- **SC-003**: Les calculs realises sur les highlights existants ne changent ni le score brut d'interet ni les scores des chapitres.
- **SC-004**: Le build frontend reussit sans nouvelle dependance de production.
- **SC-005**: Une video sans signal d'interet ne montre aucune note artificielle et ne declenche aucun travail d'analyse supplementaire.
- **SC-006**: Une grille de cartes affiche la note d'une video analysee sans requete reseau additionnelle par carte et sans chevauchement avec les elements existants de la miniature.

## Assumptions

- Cette feature gradue l'affichage du signal d'interet video existant ; elle ne constitue pas encore une calibration editoriale inter-videos par jugement humain.
- Les dix libelles francais sont des niveaux d'interet affiches, pas une promesse de qualite objective ou de satisfaction personnelle.
- Une prochaine feature pourra introduire une valeur editoriale calibree et distincte, sans changer le contrat des scores de chapitres.
- Les seuils intermediaires conservent les seuils des etoiles entieres existantes afin d'eviter un reclassement brutal des donnees deja presentes.
