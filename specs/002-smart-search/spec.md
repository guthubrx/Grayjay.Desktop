# Specification: Smart Search

**Feature branch**: `session-002-smart-search`
**Created**: 2026-07-12
**Status**: Draft
**Input**: Recherche internationale optionnelle qui traduit une requete initiale vers des langues choisies, recherche les variantes en parallele et rend les titres compréhensibles dans la langue de l'utilisateur.

## User Scenarios & Testing

### User Story 1 - Explorer un sujet par plusieurs langues (Priority: P1)

Comme utilisateur, je veux lancer une recherche habituelle depuis BlueJay puis demander des angles dans plusieurs langues, afin de decouvrir des publications et formulations locales sans devoir ecrire manuellement chaque requete.

**Independent test**: Activer Smart Search pour une requete francaise et choisir japonais, chinois simplifie, arabe et russe. Verifier que chaque variante de requete est identifiee par sa langue et que les resultats correspondants sont regroupes dans la meme recherche.

**Acceptance scenarios**:

1. **Given** une recherche normale, **When** Smart Search est desactive, **Then** le comportement, les sources et les resultats existants restent inchanges.
2. **Given** une recherche normale et plusieurs langues selectionnees, **When** Smart Search est lance, **Then** la recherche normale reste disponible sans attendre les resultats internationaux.
3. **Given** plusieurs langues selectionnees, **When** leurs variantes sont disponibles, **Then** les recherches correspondantes sont limitees, executees sans doublonner une meme video, et leur provenance linguistique reste visible.
4. **Given** une langue ou une source echoue, **When** les autres recherches reussissent, **Then** les resultats disponibles restent utilisables et l'echec est circonscrit a la langue concernee.

### User Story 2 - Comprendre les resultats et leur provenance (Priority: P1)

Comme utilisateur francophone, je veux lire un titre original et sa traduction francaise, ainsi que connaitre la langue qui a produit le resultat, afin de comparer des points de vue sans perdre le texte source.

**Independent test**: Obtenir des resultats non francais, puis verifier que le titre original demeure affiche, qu'une traduction francaise est ajoutee quand elle est disponible, et que l'interface reste lisible si la traduction echoue.

**Acceptance scenarios**:

1. **Given** un titre non francais, **When** sa traduction est obtenue, **Then** le titre original reste visible et la traduction est distincte, sans remplacer la source.
2. **Given** une traduction indisponible, **When** les resultats s'affichent, **Then** le titre original et son etiquette de langue restent affiches sans bloquer la navigation.
3. **Given** une video trouvee par plusieurs variantes, **When** les resultats sont fusionnes, **Then** la video ne figure qu'une fois et conserve la liste de ses angles linguistiques.

### User Story 3 - Garder une recherche rapide et maitrisable (Priority: P2)

Comme utilisateur, je veux que Smart Search soit progressif, borne et annulable, afin que la recherche internationale ne rende pas l'application lente ni couteuse.

**Independent test**: Lancer une recherche avec quatre langues puis modifier la requete. Verifier que la recherche precedente ne remplace pas la nouvelle et que les appels sont bornes au nombre de langues et de resultats visibles.

**Acceptance scenarios**:

1. **Given** une recherche internationale, **When** la requete change, **Then** les resultats obsoletes ne sont pas associes a la nouvelle requete.
2. **Given** plusieurs langues selectionnees, **When** Smart Search interroge les sources, **Then** il ne charge qu'un premier lot borne par langue et ne pagine pas chaque langue sans action explicite.
3. **Given** une requete ou un titre deja traite, **When** la meme demande est repetee, **Then** le resultat mis en cache est reutilise quand il est encore valide.

### User Story 4 - Rester optionnel et respectueux des dependances (Priority: P3)

Comme utilisateur ou contributeur, je veux que Smart Search reste une extension desactivee tant que son traducteur local n'est pas configure, afin que Grayjay standard et les installations sans Routr continuent de fonctionner.

**Independent test**: Utiliser BlueJay sans commande Smart Search configuree, puis ouvrir une recherche normale et verifier qu'aucune requete additionnelle ni erreur ne survient.

**Acceptance scenarios**:

1. **Given** aucune commande Smart Search configuree, **When** l'utilisateur utilise la recherche normale, **Then** celle-ci fonctionne exactement comme avant.
2. **Given** Smart Search est demande sans configuration, **When** l'utilisateur l'active, **Then** BlueJay explique localement comment configurer la commande sans exposer de secret.
3. **Given** la commande de traduction est indisponible, **When** Smart Search est lance, **Then** la recherche normale reste utilisable et l'erreur est actionnable.

## Edge Cases

- Une traduction renvoie une valeur vide, dupliquee ou ne correspondant pas a la langue demandee : ignorer uniquement cette variante.
- Une video apparait dans plusieurs resultats ou plateformes : dedoublonner seulement quand l'identifiant stable ou l'URL canonique correspond.
- Un titre est deja francais, ou est vide : ne pas appeler le traducteur pour le titre.
- Une recherche comporte des operateurs, des guillemets, des noms propres ou du code : les conserver sans invention dans les variantes traduites.
- Une source ne supporte pas un alphabet ou une requete : conserver les autres resultats et signaler la langue en erreur.
- Une reponse arrive apres une nouvelle recherche : ne jamais l'afficher dans la nouvelle session.

## Requirements

### Functional Requirements

- **FR-001**: Le systeme MUST conserver la recherche normale comme chemin initial et utilisable independamment de Smart Search.
- **FR-002**: Le systeme MUST permettre de choisir un ensemble borne de langues de recherche internationale.
- **FR-003**: Le systeme MUST produire au plus une variante de requete validee par langue selectionnee.
- **FR-004**: Le systeme MUST identifier chaque resultat international par au moins une langue ou un angle de recherche d'origine.
- **FR-005**: Le systeme MUST dedoublonner les contenus correspondant a la meme URL ou au meme identifiant stable tout en preservant leurs angles linguistiques.
- **FR-006**: Le systeme MUST afficher le titre original et, lorsque disponible, une traduction dans la langue de l'utilisateur.
- **FR-007**: Le systeme MUST traiter la traduction des titres par lots bornes, sans bloquer l'affichage du titre original.
- **FR-008**: Le systeme MUST limiter le premier chargement international par langue et ne charger aucune page supplementaire sans demande explicite.
- **FR-009**: Le systeme MUST reutiliser des resultats de traduction locaux encore valides pour les requetes et titres identiques.
- **FR-010**: Le systeme MUST permettre une configuration locale du traducteur sans stocker de cle de fournisseur dans les reglages Grayjay.
- **FR-011**: Le systeme MUST transmettre uniquement la requete et les titres publics necessaires au traducteur configure.
- **FR-012**: Le systeme MUST degrader gracieusement sans Smart Search configure et sans modifier le plugin YouTube.

### Non-Functional Requirements

- **NFR-001**: La recherche standard doit pouvoir etre lancee sans attendre le traducteur Smart Search.
- **NFR-002**: Les appels externes doivent etre annules ou ignores lorsqu'une nouvelle recherche devient active.
- **NFR-003**: Les erreurs doivent etre localisees par langue ou par phase, sans vider les resultats deja disponibles.
- **NFR-004**: Les commandes externes doivent recevoir les donnees utilisateur par variables d'environnement ou entree standard, jamais par interpolation shell non protegee.
- **NFR-005**: L'interface doit rester exploitable avec les titres originaux seuls.

### Key Entities

- **Session Smart Search**: une execution associee a une requete utilisateur et un identifiant de session.
- **Variante linguistique**: une requete source, une langue cible, la requete obtenue et son statut.
- **Resultat enrichi**: un contenu de plateforme, ses angles linguistiques et une traduction optionnelle de son titre.
- **Cache de traduction**: resultat local associe a un texte source, une langue cible et une date d'expiration.

## Success Criteria

- **SC-001**: Avec quatre langues activees, une recherche standard demeure visible avant l'arrivee des resultats internationaux.
- **SC-002**: Les resultats internationaux affiches ne contiennent pas deux fois la meme URL canonique.
- **SC-003**: Un titre non francais peut etre lu dans son original et sa traduction francaise sans remplacer ni tronquer silencieusement l'original.
- **SC-004**: Sans configuration Smart Search, tous les tests de recherche existants et le parcours manuel normal restent inchanges.
- **SC-005**: Chaque recherche internationale limite son premier lot a une page par langue et chaque traduction de titre a un lot configurable et borne.

## Out of Scope

- Modifier le script ou la locale du plugin YouTube.
- Simuler une adresse IP ou une session YouTube dans un pays donne.
- Traduire les descriptions, commentaires, transcriptions ou contenus video complets.
- Ajouter un compte fournisseur, une cle API ou un suivi distant dans Grayjay.
- Modifier le classement editorial Smart TV ou Smart Chapters.
