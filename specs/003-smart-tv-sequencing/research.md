# Recherche technique et produit - Sequencement editorial Smart TV

## Sources examinees

- Rapport de recherche long : `/Users/moi/Nextcloud/12.Recherches/RECHERCHE_20260711T161808_comment-concevoir-une-programmation-éditoriale-pour-une/99_Rapport_Final.md`.
- Validation mecanique du rapport : le rapport est exploitable pour ses principes et ses limites, mais sa validation exhaustive signale 27 erreurs de couverture de sources. Il ne sert donc pas a justifier des seuils chiffres universels.
- Implementation actuelle : `Grayjay.Desktop.Web/src/pages/Home/index.tsx`, les modeles `IVideoHighlight*`, l'overlay Smart TV et `Grayjay.ClientServer/Settings/GrayjaySettings.cs`.

## Decision 1 - Contraintes d'abord, score ensuite

**Decision** : Conserver les plafonds durs deja exposes et les exclusions de chapitres joues, puis comparer les candidats restants avec un score editorial.

**Justification** : La recherche ne soutient pas un ratio universel de decouverte ou de repetition. Elle soutient en revanche une architecture a deux niveaux : garde-fous explicites, puis pertinence calibree. C'est egalement le comportement que le code actuel approche deja avec les limites de duree et de video.

**Alternatives considerees** :

- Tri exclusif par score : rejete car il ne rend ni la variete ni les raisons de transition inspectables.
- Quotas fixes de type un passage sur trois : rejete car les sources ne valident aucun ratio transferible de la radio vers des chapitres video personnels.

**Impact mainteneur** : les contraintes restent dans les reglages existants ; les poids souples sont limites a des profils nommes et documentes.

## Decision 2 - Utiliser les signaux deja calcules

**Decision** : Construire la proximite de sujet et le signal de changement d'angle a partir des titres, resumes, theses, createurs et dates presents dans les ensembles Smart Chapters.

**Justification** : Une session doit se calculer a son lancement, sans declencher une nouvelle transcription ni une requete IA. Les theses et resumes stockes sont suffisants pour une premiere heuristique explicable.

**Alternatives considerees** :

- Appel LLM a chaque recalcul : rejete car il rallonge le demarrage, rend l'ordre non reproductible et lie la lecture a un service optionnel.
- Embeddings ou classification supplementaire : reporte. Cela necessiterait un schema et un pipeline d'indexation Smart Chapters distinct, donc une PR dediee.

**Impact mainteneur** : aucun changement dans le generateur de Smart Chapters ni dependance au routeur IA.

## Decision 3 - Trois intentions comme preferences, non comme cycle

**Decision** : Proposer les profils `Balanced`, `Stay on topic` et `Explore`, qui modulent continuite, decouverte et changement d'angle sans imposer une sequence periodique.

**Justification** : La recherche avertit que la diversite generique ne surpasse pas systematiquement la pertinence. Le score reste dominant. Le profil de l'utilisateur agit comme une preference d'arbitrage lorsque plusieurs candidats sont proches.

**Alternatives considerees** :

- Un unique mix cache : rejete car l'absence de controle rend la programmation personnelle difficile a comprendre et a corriger.
- Trois playlists independantes : rejete dans cette PR car il multiplierait les sessions, les tuiles et les conventions avant d'avoir mesure l'usage.

**Impact mainteneur** : un enum compact et deux dropdowns, sans moteur de regles declaratif generique.

## Decision 4 - Repetition souple sauf l'identique deja joue

**Decision** : Un chapitre deja joue est exclu. Les repetitions de video, createur, sujet et groupe connu sont des penalites souples, soumises aux plafonds deja existants.

**Justification** : Le rapport distingue la repetition d'un item identique de l'homogeneite ressentie du flux. Il recommande de tester les penalites localement plutot que de figer une duree de burn pretendument universelle.

**Alternatives considerees** :

- Exclure toutes les videos deja vues : rejete car une video peut contenir plusieurs chapitres utiles et non joues.
- Exclure strictement un createur ou un sujet apres une occurrence : rejete car cela peut ecarter le meilleur approfondissement.

**Impact mainteneur** : reutilise les cles de chapitre et le `repeatVideoPenalty` existants ; ajoute seulement une preference de variete de createur.

## Decision 5 - Explication dans l'overlay de lecture existant

**Decision** : Ajouter la raison de transition aux metadonnees de file et l'afficher dans l'overlay Smart TV deja present.

**Justification** : L'utilisateur arrive au milieu d'une video. L'overlay affiche deja chaine, titre, resume et timing ; y ajouter l'intention repond au besoin sans creer un ecran de diagnostic.

**Alternatives considerees** :

- Un panneau de session permanent : rejete car il augmente la surface UI sans aider l'instant de transition.
- Aucun label : rejete car le sequenceur deviendrait une boite noire.

**Impact mainteneur** : extension optionnelle de la metadonnee de file, retrocompatible avec toutes les files non Smart TV.

## Decision 6 - Le continu est une PR distincte

**Decision** : Cette feature ne touche ni le rafraichissement du catalogue pendant la lecture ni la selection de la prochaine entree d'un flux infini.

**Justification** : Une session fixe est un snapshot. La lecture en continu introduit un contrat different : rafraichissement, gestion des videos non encore recues par Grayjay, reprise et re-evaluation de la prochaine entree.

**Impact mainteneur** : les invariants de session restent simples et les tests ne melangent pas deux comportements de produit.
