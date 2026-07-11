# Spécification de fonctionnalité : Préchargement de lecture

**Branche de fonctionnalité** : `pr/playback-prefetch`
**Créée le** : 2026-07-11
**Statut** : Implémentée et validée dans BlueJay
**Entrée** : Précharger de manière générique la prochaine vidéo d'une file sans modifier la lecture active, afin de réduire le délai et l'écran noir lors des transitions. Smart TV doit pouvoir en bénéficier sans créer de dépendance à Smart Chapters.

## Scénarios utilisateur et tests *(obligatoire)*

### User Story 1 - Passer rapidement à la vidéo suivante (Priorité : P1)

En tant que spectateur qui lit une file de vidéos, je veux que la prochaine vidéo soit préparée pendant que je regarde la vidéo courante afin que le changement soit sensiblement plus rapide.

**Pourquoi cette priorité** : La latence de transition et l'écran noir interrompent directement l'écoute. La préparation générique de la prochaine entrée apporte de la valeur aux playlists, à la file manuelle, au mode binge et à tout consommateur futur de la file standard.

**Test indépendant** : Lire une file de deux vidéos compatibles, laisser au moins quinze secondes de préparation, puis passer à la suivante et comparer le délai jusqu'à la première image avec le préchargement désactivé.

**Scénarios d'acceptation** :

1. **Étant donné** une vidéo en cours et une prochaine entrée connue, **quand** la lecture approche de sa transition, **alors** la prochaine entrée est préparée sans interrompre ni remplacer la vidéo courante.
2. **Étant donné** une prochaine entrée préparée, **quand** l'utilisateur avance manuellement ou que la vidéo se termine, **alors** la transition réutilise la préparation disponible au lieu de recommencer tout le chargement.
3. **Étant donné** une file standard sans donnée Smart Chapters, **quand** elle contient une prochaine vidéo, **alors** elle bénéficie du même préchargement.
4. **Étant donné** une prochaine vidéo compatible DASH, **quand** sa préparation aboutit, **alors** la source automatique et son manifeste sont prêts avant la transition.

---

### User Story 2 - Conserver une transition visuelle continue (Priorité : P2)

En tant que spectateur, je veux voir une image représentative de la prochaine vidéo pendant sa mise en route afin de ne pas subir un écran noir.

**Pourquoi cette priorité** : Même lorsqu'un premier segment média nécessite encore un court délai, une transition visuelle maîtrisée rend l'application plus réactive et compréhensible.

**Test indépendant** : Forcer une source dont la première image met plus d'une seconde à arriver et vérifier que l'illustration de la prochaine vidéo reste visible jusqu'à ce que la vidéo puisse réellement être affichée.

**Scénarios d'acceptation** :

1. **Étant donné** une prochaine vidéo avec une miniature, **quand** la transition commence, **alors** cette miniature reste visible jusqu'à la première image décodable.
2. **Étant donné** une prochaine vidéo sans miniature, **quand** la transition commence, **alors** le lecteur utilise son état de chargement existant sans afficher d'information erronée.
3. **Étant donné** une préparation qui échoue, **quand** la transition commence, **alors** la lecture normale reste disponible et l'utilisateur n'est pas bloqué.

---

### User Story 3 - Contrôler le préchargement (Priorité : P3)

En tant qu'utilisateur attentif à ses requêtes réseau, je veux pouvoir désactiver le préchargement afin de conserver le comportement historique lorsque je le souhaite.

**Pourquoi cette priorité** : Même bornée à une seule prochaine entrée, la préparation déclenche une résolution anticipée auprès de la source. Ce comportement doit rester contrôlable.

**Test indépendant** : Tester successivement le préchargement désactivé puis activé et vérifier respectivement l'absence puis la présence d'une préparation de la prochaine entrée.

**Scénarios d'acceptation** :

1. **Étant donné** le préchargement désactivé, **quand** une file est lue, **alors** aucune prochaine vidéo n'est préparée.
2. **Étant donné** le préchargement activé, **quand** une prochaine entrée est connue, **alors** ses informations de lecture sont préparées sans téléchargement média anticipé volontaire.

### Cas limites

- La file est modifiée, réordonnée, remplacée ou fermée pendant une préparation.
- L'utilisateur choisit une autre vidéo que celle préparée.
- La prochaine entrée est identique à la vidéo courante mais commence à un autre instant.
- La prochaine vidéo est un direct, un média local, une source expirée ou une source devenue indisponible.
- La préparation se termine après que la transition a déjà commencé.
- Plusieurs demandes successives ciblent la même URL.
- La source change de qualité, de piste audio ou de sous-titres entre la préparation et la lecture.
- Le réseau disparaît, ralentit fortement ou refuse les premières données.
- La lecture est envoyée vers un appareil de cast.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : Le système DOIT détecter la prochaine entrée déterministe de toute file de lecture standard, indépendamment de Smart Chapters ou de Smart TV.
- **FR-002** : Le système DOIT préparer la prochaine entrée sans remplacer, arrêter ni modifier l'état de suivi de la vidéo active.
- **FR-003** : Le système DOIT limiter la préparation à une seule prochaine entrée par fenêtre de lecture.
- **FR-004** : Le système DOIT invalider et libérer une préparation lorsque la file, la prochaine entrée, la fenêtre ou le mode de préchargement change.
- **FR-005** : Le système DOIT réutiliser une préparation valide lors d'une transition automatique ou manuelle vers l'entrée correspondante.
- **FR-006** : Le système DOIT revenir au chargement normal si la préparation est absente, expirée, incompatible ou en erreur.
- **FR-007** : Le système DOIT conserver une miniature valide jusqu'à ce que la première image de la nouvelle vidéo soit prête à être affichée.
- **FR-008** : L'utilisateur DOIT pouvoir activer ou désactiver le préchargement de la prochaine vidéo.
- **FR-009** : Le système NE DOIT PAS télécharger volontairement de données média avant la transition ; il prépare uniquement les informations nécessaires à la résolution de lecture.
- **FR-010** : Les flux en direct DOIVENT conserver leur comportement de chargement normal.
- **FR-011** : Une entrée locale PEUT être reconnue comme immédiatement disponible sans lecture anticipée inutile.
- **FR-012** : Le système DOIT distinguer dans ses diagnostics une préparation réussie, réutilisée, annulée, expirée ou échouée, ainsi que le délai de transition jusqu'à la première image.
- **FR-013** : Deux demandes identiques et simultanées DOIVENT partager le même travail de préparation plutôt que le dupliquer.
- **FR-014** : Les changements de qualité, de pistes ou de source DOIVENT invalider toute préparation devenue incompatible.
- **FR-015** : Le comportement existant du lecteur, des files, de la reprise, de l'historique, du cast et des téléchargements DOIT rester inchangé en dehors de l'accélération de transition.
- **FR-016** : Une préparation compatible DOIT sélectionner la source automatique et terminer la génération de son manifeste DASH sans muter le `DetailsState` actif.
- **FR-017** : Lors de la consommation, le système DOIT transférer atomiquement la source, le manifeste et les exécuteurs associés vers l'état actif, puis libérer toute ressource préparée non consommée.

### Entités clés

- **Candidat de préchargement** : Prochaine entrée déterministe d'une file, avec son identité, sa position éventuelle et son contexte de sélection de lecture.
- **Préparation de lecture** : Résultat temporaire associé à un candidat, avec son état, sa fraîcheur, sa compatibilité et les ressources à libérer.
- **Politique de préchargement** : Choix utilisateur entre préchargement désactivé ou activé.
- **Mesure de transition** : Chronologie d'une préparation et d'une bascule jusqu'à la première image, utilisée pour vérifier le bénéfice et diagnostiquer les replis.

## Critères de succès *(obligatoire)*

### Résultats mesurables

- **SC-001** : Sur un jeu contrôlé de vidéos compatibles et après au moins quinze secondes de préparation, le délai médian entre la demande de transition et la première image est réduit d'au moins 50 % par rapport au préchargement désactivé.
- **SC-002** : Sur ce même jeu contrôlé, 95 % des transitions préparées affichent leur première image en moins de 2 secondes.
- **SC-003** : Lorsque la prochaine vidéo possède une miniature, aucune transition testée ne présente plus de 250 ms d'écran noir avant la première image.
- **SC-004** : Dans 100 % des scénarios d'échec, d'expiration ou d'invalidation testés, la vidéo suivante reste lisible par le chemin normal sans action supplémentaire de l'utilisateur.
- **SC-005** : Lors de trente transitions préparées, aucune interruption, modification de position ou attribution d'historique incorrecte n'est observée sur la vidéo encore active.
- **SC-006** : Les diagnostics permettent d'identifier, pour chaque transition testée, si la préparation a été utilisée et le temps écoulé jusqu'à la première image.
- **SC-007** : Une playlist ou file manuelle sans aucune donnée Smart Analysis obtient le même bénéfice qu'une file créée par une fonctionnalité Smart.
- **SC-008** : À tout instant, au maximum une prochaine entrée par fenêtre consomme des ressources de préparation ou de prébuffer.

## Hypothèses

- La première version cible le lecteur Desktop ; la lecture castée conserve son chemin actuel.
- La file standard constitue le contrat commun. Smart TV pourra fournir une prochaine entrée et une échéance plus précise sans être une dépendance du préchargement.
- Le mode par défaut prépare la prochaine entrée, sa source et son manifeste sans téléchargement de fragment média anticipé ; l'utilisateur peut le désactiver.
- Une préparation est temporaire, non persistante entre les redémarrages et limitée à la fenêtre de lecture concernée.
- Le préchargement de plusieurs vidéos, le prébuffer de fragments média, le double lecteur, la lecture sans coupure audio garantie et la prévision d'une prochaine vidéo non déterministe sont hors périmètre.
- Les sources peuvent expirer ; une préparation trop ancienne doit être rejetée au profit du chemin normal.
- La fonctionnalité réutilise les réglages, la file, le lecteur et les mécanismes de diagnostic existants plutôt que de créer une file parallèle.
