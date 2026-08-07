# Feature Specification: Echelle d'interet et profil editorial video

**Feature Branch**: `pr/021-video-interest-scale`
**Created**: 2026-08-06
**Status**: In Progress
**Input**: Produire une note editorialement comparable entre videos analysees, distincte de la fraicheur et de la pertinence contextuelle.

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

### User Story 5 - Comparer la valeur editoriale (Priority: P1)

Comme spectateur, je veux que la note visible de deux videos analysees soit derivee d'une grille editoriale commune, afin que `4,5 / 5` signifie le meme niveau de valeur potentielle pour un spectateur interesse par le sujet, quel que soit le genre de la video.

**Independent Test**: Fournir deux profils editoriaux aux memes dimensions mais avec des dates de publication differentes et verifier qu'ils produisent la meme note.

**Acceptance Scenarios**:

1. **Given** une analyse recente qui fournit un profil editorial valide, **When** la note video est calculee, **Then** elle est derivee deterministiquement de ses dimensions editoriales et non des scores relatifs de ses chapitres.
2. **Given** une video documentaire, un test produit et une news, **When** leurs profils sont analyses, **Then** chacun est evalue selon les memes dimensions transversales, avec le genre conserve comme contexte et non comme bonus automatique.
3. **Given** une video sans profil editorial, **When** elle est affichee, **Then** son comportement historique reste disponible sans requete ni note inventee.

### User Story 6 - Distinguer valeur et actualite (Priority: P1)

Comme spectateur, je veux qu'une excellente video durable conserve sa valeur editoriale tandis que les listes "a regarder maintenant" tiennent compte de l'actualite, afin de ne pas confondre qualite et nouveaute.

**Independent Test**: Classer deux videos de meme valeur avec une sensibilite temporelle differente et verifier que la note reste identique tandis que le signal de fraicheur varie.

**Acceptance Scenarios**:

1. **Given** une valeur editoriale identique, **When** une video est plus ancienne, **Then** sa note editoriale ne change pas.
2. **Given** une video fortement sensible au temps, **When** elle vieillit, **Then** son signal de fraicheur decroit plus vite que celui d'un documentaire peu sensible au temps.
3. **Given** un candidat sans profil editorial, **When** il est classe, **Then** la formule de classement historique reste applicable.

### User Story 7 - Enrichir sans retranscrire (Priority: P1)

Comme utilisateur, je veux pouvoir enrichir les analyses existantes a partir de leurs resumes, theses et chapitres, afin d'obtenir la nouvelle note sur mon corpus sans relancer Whisper ni telecharger les videos.

**Independent Test**: Executer le backfill sur un highlight existant avec transcript cache et verifier qu'il ajoute un profil editorial sans modifier les chapitres, les sous-titres ou le transcript.

**Acceptance Scenarios**:

1. **Given** un highlight existant sans profil editorial, **When** le backfill est lance, **Then** il appelle uniquement le modele de texte avec les donnees locales existantes.
2. **Given** un highlight deja enrichi, **When** le backfill standard est relance, **Then** il est ignore sans nouvel appel modele.
3. **Given** une erreur de modele sur une video, **When** le backfill continue, **Then** les autres videos sont traitees et le fichier en erreur reste intact.

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
- **FR-010**: Le highlight MAY contenir un profil editorial versionne avec les dimensions `substance`, `rigor`, `clarity`, `distinctiveness`, `audienceValue`, `temporalSensitivity` et `confidence`, toutes bornees dans `[0, 1]`.
- **FR-011**: Lorsqu'un profil editorial valide est disponible, la note visible MUST etre derivee de ses dimensions stables et MUST rester independante de la date de publication.
- **FR-012**: La fraicheur utilisee pour classer les recommandations MUST pouvoir employer `temporalSensitivity` sans modifier le comportement des candidats qui ne fournissent pas ce signal.
- **FR-013**: Le generateur MUST produire le profil editorial dans sa passe d'analyse normale, sans nouvel appel pour une nouvelle video.
- **FR-014**: Le backfill MUST pouvoir enrichir les highlights existants a partir de donnees locales, sans recuperer de media, de sous-titres ni lancer Whisper.
- **FR-015**: Le profil ne MUST ni noter l'accord ideologique avec une these ni presenter sa valeur comme une verite objective ; il estime une valeur potentielle pour un spectateur interesse par le sujet.

### Key Entities *(include if feature involves data)*

- **Signal d'interet video**: Score derive deja disponible pour presenter l'interet d'une video, distinct des scores de ses chapitres et de sa priorite de recommandation.
- **Palier d'interet**: Une des dix valeurs visibles de demi-etoile avec son seuil minimal, son libelle francais et sa representation accessible.
- **Profil editorial video**: Dimensions versionnees et expliquees qui estiment la substance et la qualite de traitement d'une video, independamment de sa nouveaute.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Les dix paliers et leurs seuils sont verifies par des tests unitaires, y compris chaque valeur exacte de frontiere.
- **SC-002**: Les deux composants existants et leurs trois contextes d'affichage rendent une note de demi-etoile et un libelle francais pour chaque palier.
- **SC-003**: Les calculs realises sur les highlights existants ne changent ni le score brut d'interet ni les scores des chapitres.
- **SC-004**: Le build frontend reussit sans nouvelle dependance de production.
- **SC-005**: Une video sans signal d'interet ne montre aucune note artificielle et ne declenche aucun travail d'analyse supplementaire.
- **SC-006**: Une grille de cartes affiche la note d'une video analysee sans requete reseau additionnelle par carte et sans chevauchement avec les elements existants de la miniature.
- **SC-007**: Deux profils editoriaux identiques produisent la meme note, quelle que soit leur date de publication.
- **SC-008**: Le backfill d'un highlight existant ne modifie ni `segments`, ni `translatedSubtitles`, ni les fichiers de transcript cache.
- **SC-009**: Les tests couvrent les bornes de validation du profil, la priorite de son score sur le signal historique et la degradation gracieuse en son absence.

## Assumptions

- Cette feature fournit une grille editoriale stable et une calibration operationnelle par rubriques ; une calibration personnalisee par comparaisons humaines restera une evolution distincte.
- Les dix libelles francais sont des niveaux d'interet affiches, pas une promesse de qualite objective ou de satisfaction personnelle.
- Une prochaine feature pourra introduire une valeur editoriale calibree et distincte, sans changer le contrat des scores de chapitres.
- Les seuils intermediaires conservent les seuils des etoiles entieres existantes afin d'eviter un reclassement brutal des donnees deja presentes.
