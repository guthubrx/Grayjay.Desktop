# Specification de fonctionnalite : Smart Prefill Scheduler

**Feature Branch** : `pr/015-smart-prefill-scheduler`  
**Created** : 2026-07-13  
**Status** : In progress  
**Input** : User description: "Prefill automatique des Smart Chapters et des enrichissements des videos utiles, avec un parallélisme LLM global configurable."

## Contexte

BlueJay sait deja enrichir une video avec ses sous-titres, sa traduction, ses Smart Chapters, son resume, son profil de mix, son profil de decouverte et ses segments promotionnels. Ces traitements sont aujourd'hui declenches manuellement, a l'ouverture d'une video ou par des jobs de fond distincts. Le spectateur veut que les videos les plus susceptibles d'etre lues soient pretes avant leur lecture, sans rendre l'application lente ni imposer l'usage d'un LLM.

Le Smart Mix doit rester immediat : il affiche des videos des que les plateformes les retournent. Quand le prechargement est actif, il peut enrichir et mieux classer uniquement la partie non lue du mix au fil de l'eau.

## User Scenarios & Testing

### User Story 1 - Precharger un Smart Mix (Priority: P1)

En tant que spectateur, je veux que les meilleurs candidats d'un Smart Mix soient enrichis automatiquement en arriere-plan afin que les videos suivantes disposent deja de leurs Smart Chapters, sous-titres utiles et signaux de pertinence quand je les atteins.

**Why this priority** : Le Smart Mix est le parcours ou la valeur de l'analyse de la video source peut immediatement ameliorer les videos suivantes.

**Independent Test** : Activer Smart Prefill, creer un Smart Mix depuis une video analysee, puis verifier que le mix demarre sans attendre et que les candidats non lus deviennent progressivement enrichis et reclassees.

**Acceptance Scenarios** :

1. **Given** Smart Prefill actif et une video source ayant un profil de decouverte, **When** le spectateur cree un Smart Mix, **Then** la premiere file est lisible avant la fin des enrichissements des candidats.
2. **Given** un candidat de Smart Mix enrichi apres le debut de lecture, **When** son nouveau signal de pertinence est disponible, **Then** seule la partie non lue de la file peut etre reclassee.
3. **Given** le spectateur a commence une video du mix, **When** les autres candidats sont enrichis, **Then** la video en cours, sa position et les videos deja lues ne changent jamais.

---

### User Story 2 - Choisir la capacite et les surfaces (Priority: P1)

En tant que spectateur, je veux activer ou desactiver le prechargement, choisir les surfaces qui l'alimentent et regler la capacite LLM globale afin d'adapter l'usage de Routr a ma machine et a mes priorites.

**Why this priority** : L'analyse LLM doit rester un choix explicite et une seule limite globale doit empecher que plusieurs ecrans saturent Routr en meme temps.

**Independent Test** : Modifier les reglages, creer simultanement des candidats depuis plusieurs surfaces, puis verifier que le nombre d'analyses LLM actives ne depasse jamais la limite choisie et que seules les surfaces activees ajoutent du travail.

**Acceptance Scenarios** :

1. **Given** Smart Prefill desactive, **When** le spectateur navigue, ouvre un mix ou consulte Highlights, **Then** aucune analyse automatique supplementaire n'est lancee.
2. **Given** une limite LLM de 3, **When** plusieurs sources ajoutent du travail, **Then** au plus trois analyses LLM sont actives simultanement.
3. **Given** les scopes Smart Mix et groupes prioritaires actifs, **When** des videos eligibles apparaissent dans ces deux sources, **Then** leurs travaux rejoignent la meme file et respectent la meme limite LLM.

---

### User Story 3 - Privilegier ce qui sera regarde (Priority: P2)

En tant que spectateur, je veux que le prechargement traite d'abord les videos qui ont le plus de chances d'etre lues afin de ne pas depenser la capacite LLM sur un catalogue lointain.

**Why this priority** : Un prechargement utile doit reduire l'attente percue, pas simplement augmenter le volume d'analyses.

**Independent Test** : Ajouter des videos provenant d'une action explicite, de la suite d'une file, d'un Smart Mix, de Watch now et d'un groupe prioritaire, puis verifier leur ordre de traitement.

**Acceptance Scenarios** :

1. **Given** des travaux de plusieurs origines, **When** une place LLM se libere, **Then** une demande explicite du spectateur est traitee avant les travaux automatiques.
2. **Given** une video suivante dans la file de lecture et des videos de catalogue, **When** les deux sont eligibles, **Then** la video suivante est traitee en premier.
3. **Given** une video deja completement enrichie avec des donnees compatibles avec les reglages courants, **When** elle est proposee au prechargement, **Then** aucun travail LLM redondant n'est lance.

---

### User Story 4 - Preparer une fenetre de lecture utile (Priority: P1)

En tant que spectateur, je veux borner le nombre de videos futures preparees dans une session active afin que la video en cours et la suivante soient privilegiees sans remplir la file avec un catalogue que je ne lirai peut-etre jamais.

**Why this priority** : Le prechargement ne reduit l'attente percue que lorsqu'il anticipe la suite immediate de la lecture.

**Independent Test** : Configurer une profondeur de `1`, lancer un Smart Mix, puis avancer dans la file. Verifier que la video courante et une seule video future sont eligibles au prefill, puis que la fenetre avance a chaque changement de video.

**Acceptance Scenarios** :

1. **Given** une profondeur de preparation de `1`, **When** une session Smart Mix commence, **Then** la premiere video et sa suivante peuvent etre preparees, sans que le reste du mix ne remplisse la file.
2. **Given** le spectateur passe a la deuxieme video, **When** la file contient une troisieme video eligible, **Then** elle entre dans la fenetre de preparation.
3. **Given** la file globale de prefill a atteint son plafond, **When** une video de lecture ou de suite immediate apparait, **Then** elle peut remplacer un travail automatique moins prioritaire encore en attente.

---

### User Story 5 - Continuer sans IA (Priority: P2)

En tant que spectateur ne souhaitant pas utiliser d'IA ou rencontrant une indisponibilite temporaire, je veux conserver la recherche, les playlists et la lecture habituelles sans attente ni erreur bloquante.

**Why this priority** : Les PR Smart restent des options et ne doivent pas devenir une dependance de BlueJay.

**Independent Test** : Desactiver Smart Prefill ou rendre Routr indisponible, puis creer un Smart Mix et naviguer dans Highlights.

**Acceptance Scenarios** :

1. **Given** Smart Prefill desactive, **When** le spectateur cree un Smart Mix, **Then** le comportement de recherche actuel est conserve.
2. **Given** Smart Prefill actif mais Routr indisponible, **When** un enrichissement echoue, **Then** la video reste lisible et le travail peut etre reessayé plus tard sans boucle infinie.

### Edge Cases

- Une meme video est candidate depuis plusieurs surfaces au meme moment : elle ne doit avoir qu'un seul travail actif.
- Les sous-titres plateforme existent mais pas dans la langue souhaitee : ils sont privilegies, puis traduits seulement si le spectateur l'a demande.
- Aucun sous-titre n'est disponible : la politique Whisper existante decide si la transcription est autorisee; le prechargement ne contourne pas cette politique.
- Le spectateur desactive Smart Prefill pendant l'execution : les travaux non commences ne doivent plus demarrer.
- Une video est fermee ou une nouvelle session Smart Mix remplace la precedente : aucun resultat tardif ne doit modifier la nouvelle file.
- Le profil de decouverte est absent ou obsolete : la video reste recommandable avec les signaux existants, sans bloquer le parcours.

## Requirements

### Functional Requirements

- **FR-001** : Le systeme DOIT fournir un reglages Smart Prefill desactive par defaut.
- **FR-002** : Le spectateur DOIT pouvoir choisir les surfaces qui alimentent Smart Prefill : Smart Mix, suite de lecture, Smart TV, Watch now et groupes prioritaires.
- **FR-003** : Le spectateur DOIT pouvoir regler une limite globale d'analyses LLM simultanees entre 1 et 32.
- **FR-004** : Le systeme DOIT appliquer la limite globale a tous les travaux Smart Prefill, quelle que soit leur surface d'origine.
- **FR-005** : Le systeme DOIT dedupliquer les travaux d'une meme video et reutiliser les enrichissements compatibles deja presents.
- **FR-006** : Le systeme DOIT traiter les travaux dans l'ordre suivant : action explicite, prochaine video de lecture, Smart Mix, Smart TV, Watch now, groupes prioritaires, puis catalogue restant.
- **FR-007** : Les traitements declenches par BlueJay en temps reel DOIVENT exiger des sous-titres plateforme VTT exploitables. Une video sans sous-titres reste lisible mais est exclue de l'analyse automatique et ne lance jamais Whisper.
- **FR-008** : Le systeme DOIT produire, lorsque les donnees disponibles le permettent, les enrichissements deja pris en charge par BlueJay : sous-titres traduits, Smart Chapters, resume, profils de mix et de decouverte, et segments promotionnels.
- **FR-009** : Le Smart Mix DOIT pouvoir reclasseer uniquement sa partie non lue quand les donnees de candidats prefills sont disponibles.
- **FR-010** : Le systeme DOIT rendre l'etat du prechargement observable sans rendre la lecture ou la navigation dependante de sa fin.
- **FR-011** : En cas d'erreur, le systeme DOIT conserver un resultat explicite et appliquer une temporisation avant nouvel essai automatique.
- **FR-012** : Sans Smart Prefill, sans Smart Chapters ou sans Routr, les parcours existants DOIVENT conserver leur comportement actuel.
- **FR-013** : Le Smart Mix actif DOIT retenir en priorite des resultats ayant des sous-titres plateforme verifies quand Smart Prefill est actif et qu'une commande compatible est configuree.
- **FR-014** : Le spectateur DOIT pouvoir regler une profondeur de preparation entre `0` et `100`, correspondant au nombre de videos futures preparees apres la video courante.
- **FR-015** : Le spectateur DOIT pouvoir regler un plafond global de travaux automatiques en attente entre `1` et `500`; les travaux manuels ne sont pas bloques par ce plafond.
- **FR-016** : Le fallback Whisper DOIT etre execute uniquement par le LaunchAgent nocturne cible sur les groupes et chaines explicitement configures.

### Key Entities

- **Travail de prechargement** : Demande idempotente d'enrichir une video, portant une source, une priorite, son etat et son prochain instant de tentative.
- **Politique de prechargement** : Preferences du spectateur pour l'activation, les surfaces, la limite LLM, le volume de candidats sondes, la profondeur de lecture et le plafond de file.
- **Disponibilite de sous-titres** : Etat temporairement mis en cache (`available`, `unavailable`, `unknown`) indiquant si une video expose un VTT plateforme exploitable.
- **Signal d'enrichissement** : Indication que les donnees d'une video sont compatibles, absentes, en cours, reussies ou temporairement en echec.
- **Session Smart Mix** : File de videos sourcee par un mix, dont la partie non lue peut etre amelioree sans modifier ce qui est deja joue.

## Success Criteria

### Measurable Outcomes

- **SC-001** : La creation d'un Smart Mix actif affiche une premiere video jouable sans attendre la fin des travaux Smart Prefill.
- **SC-002** : Pendant une session, le nombre d'analyses LLM actives ne depasse jamais la limite globale configuree.
- **SC-003** : Une video candidate depuis plusieurs surfaces ne genere pas plus d'un travail actif pour le meme niveau d'enrichissement.
- **SC-004** : Avec Smart Prefill desactive, aucun appel LLM automatique n'est emis par les surfaces couvertes.
- **SC-005** : Les resultats tardifs ne modifient jamais la video en cours ni les elements deja lus d'une file Smart Mix.
- **SC-006** : Un echec temporaire devient visible et ne genere pas plus d'une nouvelle tentative automatique dans la fenetre de temporisation configuree.
- **SC-007** : Aucun processus lance par BlueJay en temps reel n'execute Whisper, meme quand la video n'a pas de sous-titres.
- **SC-008** : Avec une profondeur de `1`, le Smart Mix ne maintient au plus qu'une video future eligible dans sa fenetre de prefill, hors jobs deja manuels ou en cours.

## Assumptions

- Routr reste l'unique point d'acces LLM et conserve le profil `balanced-cheap` deja configure dans l'environnement local.
- Les analyses existantes et les scripts de generation conservent leurs contrats de donnees; le prechargement les orchestre sans dupliquer leur logique d'analyse.
- Le backfill en cours reste independant du prechargement interactif : une limite strictement commune entre deux processus demanderait un service de coordination dedie, hors perimetre de cette PR.
- Les videos sans transcript exploitable restent lisibles; elles ne sont transcrites que par le LaunchAgent nocturne et seulement pour les groupes ou chaines explicitement autorises.

## Dependances

- PR 012 : socle de classement des recommandations.
- PR 013 : profil de decouverte precompute.
- PR 014 : Smart Mix progressif et remplacement protege de la partie non lue.
- Pre-calcul Smart Chapters existant et Routage Routr local.
