# Specification de fonctionnalite : Socle de classement des recommandations

**Branche de fonctionnalite** : `pr/012-recommendation-ranking-foundation`
**Creee le** : 2026-07-12
**Statut** : Validee pour implementation

## Intention

BlueJay doit pouvoir classer ses propres recommandations de facon coherente sans rendre les fonctions Smart ou un fournisseur IA obligatoires. Les informations issues des Smart Chapters enrichissent le classement lorsqu'elles existent, mais les metadonnees natives restent suffisantes pour un classement utile.

## Scenarios utilisateur et tests

### User Story 1 - Des recommandations utiles sans fonctions Smart (P1)

En tant que spectateur utilisant Grayjay sans Smart Chapters ni routeur, je veux que les lignes de recommandation de BlueJay tiennent compte de la date, des vues et de la diversite afin que l'application reste utile sans dependance IA.

**Test independant** : avec un lot de videos non analysees, une video recente et raisonnablement regardee remonte devant une video ancienne peu regardee; une video sans compteur de vues reste classable.

Scenarios d'acceptation :
1. Le classement ne declenche aucun appel IA, reseau supplementaire, transcription ou indexation.
2. L'absence de date, de vues ou de notation laisse les autres signaux operer; elle ne transforme pas la video en candidat invalide.
3. Les vues sont compressees et comparees dans leur lot: un compteur brut ne peut pas ecraser a lui seul tous les autres signaux.

### User Story 2 - Une valeur editoriale enrichit le meme classement (P1)

En tant que spectateur ayant active les Smart Chapters, je veux que la valeur editoriale deja calculee pour une video enrichisse les memes recommandations sans que ses etoiles deviennent une mesure de popularite.

**Test independant** : a metadonnees egales, une video ayant un meilleur interet editorial remonte; modifier seulement le nombre de vues ne modifie pas ses etoiles.

Scenarios d'acceptation :
1. Le score editorial reste distingue du score de recommandation.
2. La fraicheur ne doit pas etre comptee deux fois entre ces deux scores.
3. Les donnees de Smart Chapters restent optionnelles et ne sont jamais lues par le noyau de classement generique.

### User Story 3 - Des surfaces BlueJay coherentes (P1)

En tant que spectateur, je veux que les surfaces ou BlueJay choisit des videos utilisent la meme logique explicable, tout en preservant les listes que j'ai moi-meme organisees.

**Test independant** : sur un lot identique, Watch now, les lignes de groupes et la selection Smart TV utilisent les memes signaux de video; Continue watching et Watch later conservent leur ordre propre.

Scenarios d'acceptation :
1. Watch now, le carrousel Highlights, les lignes de groupes et la selection de videos Smart TV utilisent le socle de classement.
2. Le sequencement Smart TV continue de choisir un chapitre par sa valeur de chapitre, puis utilise le rang video comme signal secondaire de selection.
3. Continue watching, Watch later, l'historique, les pages de chaine et la recherche standard ne sont pas reordonnes.
4. La recommandation Home conserve l'intercalage abonnements/recommandations, la deduplication, les exclusions de videos vues et les exclusions manuelles existantes.

## Exigences fonctionnelles

- **FR-001** : Le noyau de classement DOIT etre un utilitaire pur ne dependant ni des types Smart Chapters, ni du routeur, ni d'un appel reseau.
- **FR-002** : Le noyau DOIT exposer les signaux normalises de popularite, fraicheur, pertinence et interet editorial, ainsi qu'un score final explicable.
- **FR-003** : Un signal absent DOIT etre exclu de la ponderation, et non assimile a une note nulle.
- **FR-004** : La popularite DOIT utiliser une echelle logarithmique et une normalisation au sein du lot de candidats.
- **FR-005** : Les etoiles et libelles d'interet DOIVENT rester fondes sur le contenu des Smart Chapters, sans vues ni fraicheur.
- **FR-006** : Le classement de recommandation DOIT pouvoir utiliser facultativement l'interet editorial existant comme un signal de qualite.
- **FR-007** : Les surfaces Home concernees DOIVENT reutiliser le meme utilitaire plutot que recopier une formule locale.
- **FR-008** : Le classement Smart TV DOIT garder ses contraintes existantes de chapitres, de duree, de groupe et de diversite de createurs.
- **FR-009** : Aucun nouveau reglage visible, endpoint, fournisseur, schema persistant ou dependance ne doit etre ajoute par cette PR.

## Cas limites

- Toutes les videos du lot ont un nombre de vues identique ou inconnu.
- Une date de publication est invalide ou absente.
- Une video est analysee mais n'a que des chapitres historiques sans score.
- Une video est disponible simultanement dans plusieurs lignes Home.
- Le lot ne contient qu'une seule video ou plusieurs videos du meme createur.

## Criteres de succes

- Une installation sans Smart Chapters compile et affiche les lignes Home sans nouvelle configuration.
- Les tests prouvent que les vues seules ne dominent pas la pertinence, la valeur editoriale ou la fraicheur.
- Les etoiles d'une video sont identiques avant et apres une modification de son compteur de vues.
- Les listes geres par l'utilisateur et la recherche standard conservent leur ordre.
- Les tests TypeScript cibles et le build web reussissent.

## Hors perimetre

- Generer, traduire ou persister des profils semantiques de decouverte.
- Reclasser les resultats de Smart Search, de la recherche standard ou des plateformes.
- Ajouter des boutons de ponderation ou un ecran de reglages.
- Modifier les Smart Chapters, la transcription, les appels Routr ou les scripts de precompute.
