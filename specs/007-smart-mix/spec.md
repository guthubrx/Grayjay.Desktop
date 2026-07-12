# Specification de fonctionnalite : Smart Mix inspire par une video

**Branche de fonctionnalite** : `007-smart-mix`  
**Creee le** : 2026-07-12  
**Statut** : Validee pour implementation  
**Entree** : Depuis une video disposant d'une analyse Smart Chapters, permettre de creer un mix de videos sur le meme sujet, sans l'enfermer dans un seul createur ou un seul angle, avec des proportions editoriales reglables.

## Scenarios utilisateur et tests *(obligatoire)*

### User Story 1 - Creer un mix depuis une video analysee (Priorite : P1)

En tant que spectateur, je veux demander un Smart Mix depuis une video analysee, afin de recevoir une session de videos qui approfondit le sujet source sans dependre des recommandations de plateforme.

**Pourquoi cette priorite** : La valeur principale est de transformer une video comprise par BlueJay en parcours de decouverte local et explicable.

**Test independant** : Avec une video source et un catalogue de plusieurs videos analysees sur le meme sujet, lancer `Create Smart Mix` depuis le menu de la video et verifier qu'une session fixe de videos pertinentes est construite et peut etre lue immediatement.

**Scenarios d'acceptation** :

1. **Etant donne** une video disposant de Smart Chapters exploitables, **quand** l'utilisateur demande un Smart Mix, **alors** BlueJay construit une session fixe composee de videos analysees, sans consulter une recommandation externe.
2. **Etant donne** une video source avec plusieurs chapitres, **quand** une video candidate ne traite le sujet source que dans un de ses chapitres, **alors** le mix peut l'inclure mais identifie ce chapitre pour expliquer sa pertinence, tout en lisant la video complete comme dans un mix Deezer.
3. **Etant donne** une video sans Smart Chapters exploitables, **quand** l'utilisateur demande un Smart Mix, **alors** l'application explique que l'analyse doit etre disponible et ne presente pas un mix trompeur.
4. **Etant donne** une session creee, **quand** de nouvelles analyses arrivent, **alors** la session reste stable jusqu'a une demande explicite de recalcul.

---

### User Story 2 - Regler la conduite editoriale du mix (Priorite : P1)

En tant que spectateur, je veux repartir mon mix entre videos proches, sujets connexes et autres angles, afin de choisir entre approfondissement, elargissement et pluralite de points de vue.

**Pourquoi cette priorite** : La pertinence seule produit une liste repetitive ; la decouverte seule produit une liste arbitraire. Les proportions rendent le compromis visible et controllable.

**Test independant** : Regler les proportions `Proche`, `Connexe` et `Autre angle`, creer une session assez longue avec un corpus fournissant les trois categories, puis verifier que le nombre de videos par categorie respecte la repartition demandee a l'arrondi pres.

**Scenarios d'acceptation** :

1. **Etant donne** les reglages par defaut, **quand** un mix est cree, **alors** il cible 60 % de videos proches, 25 % de sujets connexes et 15 % d'autres angles.
2. **Etant donne** les trois reglages de proportion, **quand** l'utilisateur modifie une proportion, **alors** les deux autres et la presentation du total permettent de conserver exactement 100 %.
3. **Etant donne** un nombre de videos qui ne permet pas une repartition exacte, **quand** le mix est cree, **alors** BlueJay applique un arrondi deterministe qui minimise l'ecart aux proportions configurees.
4. **Etant donne** qu'une categorie ne contient pas assez de videos pertinentes, **quand** le mix est cree, **alors** ses places restantes vont aux autres categories pertinentes sans inserer de contenu hors sujet.
5. **Etant donne** une video qui formule une opinion, **quand** BlueJay choisit un autre angle, **alors** il recherche un cadrage, une consequence, une limite, une methode ou un point de vue different sans qualifier une position de vraie ou de fausse.

---

### User Story 3 - Comprendre et controler le resultat (Priorite : P2)

En tant que spectateur, je veux savoir pourquoi chaque video est dans le mix et pouvoir relancer le calcul, afin de garder le controle sur une recommandation personnalisee.

**Pourquoi cette priorite** : Une recommandation utile doit etre lisible et annullable, pas une boite noire.

**Test independant** : Ouvrir une session Smart Mix, verifier que chaque entree affiche une raison courte (`Meme sujet`, `Elargit le sujet` ou `Autre angle`), puis recalculer et verifier que la session precedente n'est pas modifiee pendant sa lecture.

**Scenarios d'acceptation** :

1. **Etant donne** une session Smart Mix, **quand** elle est affichee ou lancee, **alors** chaque video dispose d'une raison editoriale courte et indique le chapitre qui a motive sa selection lorsque celui-ci est connu.
2. **Etant donne** un mix compose de videos comparables, **quand** plusieurs candidats sont valables, **alors** BlueJay privilegie la variete de createur et evite les doublons de video.
3. **Etant donne** des videos deja vues, **quand** des alternatives equivalentes existent, **alors** BlueJay prefere les videos non vues.
4. **Etant donne** une session en cours, **quand** l'utilisateur demande un nouveau calcul, **alors** une nouvelle session est creee deliberement sans modifier la session deja jouee.

---

### User Story 4 - Rester rapide et degradable (Priorite : P2)

En tant que spectateur, je veux que le mix apparaisse sans attente liee a une IA ou au reseau, afin que cette fonction reste utilisable au moment ou je choisis une video.

**Pourquoi cette priorite** : L'analyse lourde appartient au pre-calcul ; le clic utilisateur ne doit pas devenir une file d'attente LLM.

**Test independant** : Couper l'acces au routeur d'IA apres avoir analyse un corpus, creer un Smart Mix et verifier que sa construction locale reussit avec les donnees deja stockees.

**Scenarios d'acceptation** :

1. **Etant donne** une video source et un catalogue deja analyses, **quand** l'utilisateur cree un mix, **alors** aucune requete vers Routr, un LLM, YouTube ou une autre plateforme n'est necessaire au calcul du classement.
2. **Etant donne** une ancienne analyse sans profil de mix enrichi, **quand** elle est candidate, **alors** BlueJay utilise son resume, ses theses et ses chapitres comme repli plutot que de la rendre inutilisable.
3. **Etant donne** une nouvelle analyse, **quand** elle est ecrite, **alors** elle contient les donnees compactes necessaires au classement futur sans stocker le transcript brut dans le jeu de highlights.
4. **Etant donne** des donnees incompletes, supprimees ou incompatibles, **quand** le mix est construit, **alors** elles sont ignorees individuellement sans empecher les autres videos pertinentes d'apparaitre.

## Cas limites

- Le catalogue ne contient que la video source ou moins de deux videos analysees pertinentes.
- Toutes les videos pertinentes viennent du meme createur ou ont deja ete vues.
- Le sujet source est trop general, trop court ou absent des resumes disponibles.
- Une categorie editoriale configuree a une forte proportion ne fournit aucun candidat pertinent.
- Un highlight ancien ne contient ni profil enrichi ni chapitres exploitables.
- La video source ou une candidate devient indisponible apres la creation de la session.
- Le lecteur est deja dans une session Smart TV differente.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : Le systeme DOIT exposer une action `Create Smart Mix` depuis une video analysee.
- **FR-002** : Le systeme DOIT creer une session fixe de videos, distincte d'une playlist de plateforme et bornee par les limites Smart TV existantes.
- **FR-003** : Le systeme DOIT n'utiliser comme candidats que les videos possedant une analyse locale exploitable derivee d'un transcript.
- **FR-004** : Le systeme DOIT repartir les candidats entre `Proche`, `Connexe` et `Autre angle` selon des proportions reglables qui totalisent exactement 100 %.
- **FR-005** : Les proportions par defaut DOIVENT etre `60 % Proche`, `25 % Connexe`, `15 % Autre angle`.
- **FR-006** : Le systeme DOIT conserver la pertinence semantique comme contrainte avant toute diversification ; une place sans candidat pertinent ne peut pas etre remplie par une video sans lien.
- **FR-007** : Le systeme DOIT privilegier les videos non vues, la variete de createur et l'absence de doublons lorsque ces preferences ne reduisent pas sensiblement la pertinence.
- **FR-008** : Le systeme DOIT persister la session obtenue et ne jamais la modifier automatiquement pendant sa lecture.
- **FR-009** : Le systeme DOIT presenter une raison editoriale courte pour chaque entree du mix.
- **FR-010** : Le systeme DOIT utiliser le chapitre le plus pertinent d'une video candidate pour calculer sa raison et l'indiquer a l'utilisateur, sans transformer le mix en liste de chapitres ni tronquer la lecture de la video.
- **FR-011** : Le calcul d'un mix depuis des analyses disponibles DOIT etre local et ne DOIT PAS declencher de requete reseau ou LLM.
- **FR-012** : Le systeme DOIT rester utilisable lorsqu'aucun profil enrichi n'est disponible, en degradant vers les resumes, theses et chapitres deja enregistres.
- **FR-013** : Le systeme DOIT enrichir les nouvelles analyses avec un profil compact, independant de la langue d'affichage, sans conserver le transcript brut dans les highlights.
- **FR-014** : La fonctionnalite DOIT se desactiver gracieusement lorsqu'aucun Smart Chapter n'est installe ou lorsqu'aucune analyse locale n'est disponible.

### Exigences non fonctionnelles

- **NFR-001** : Pour un catalogue de 500 analyses locales, la construction d'une session ne doit pas effectuer de lecture reseau ni produire de blocage perceptible de l'interface.
- **NFR-002** : Le classement doit etre deterministe a donnees, preferences et historique identiques.
- **NFR-003** : Les nouvelles donnees persistantes doivent etre optionnelles et compatibles avec les fichiers de highlights existants.
- **NFR-004** : Les algorithmes de selection doivent documenter leur complexite et eviter les recherches lineaires repetees dans des boucles de classement.
- **NFR-005** : Les reglages de proportions doivent rester comprehensibles sans exposer de coefficients algorithmiques internes.

## Hors perimetre

- Une recherche ou recommandation aupres de YouTube, Google ou d'une plateforme externe.
- Un service d'embeddings, une base vectorielle ou une dependance a Routr pendant le clic utilisateur.
- La conservation du transcript brut dans les fichiers de highlights.
- Un jugement automatique de verite, de fiabilite ou de qualite politique d'une opinion.
- Le mode Smart TV en continu et le recalcul automatique de sa file de lecture.
- Une reanalyse massive immediate de tous les anciens highlights.

## Criteres de succes

- Un utilisateur peut creer et lancer un Smart Mix depuis une video deja analysee en une action.
- Avec un catalogue qui contient les trois categories, la repartition finale s'ecarte d'au plus une video de chaque proportion cible.
- Le mix ne contient pas deux fois la meme video et ne s'appuie sur aucune recommandation de plateforme.
- Une coupure de Routr apres le pre-calcul n'empeche pas la creation d'un mix.
- Les anciens fichiers de highlights continuent a etre lus et peuvent contribuer au mix avec une pertinence degradee mais sans erreur.
