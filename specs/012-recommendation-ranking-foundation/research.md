# Recherche : Socle de classement des recommandations

## Decision : separer valeur editoriale et rang de recommandation

**Pourquoi** : un score de chapitre decrit la valeur du contenu; les vues decrivent un signal de traction. Les melanger dans les etoiles ferait dire qu'une video populaire est meilleure analytiquement. Le rang de recommandation peut combiner les deux sans modifier l'affichage editorial.

**Consequence** : `highlightInterest` devient la source de la seule valeur editoriale. Le nouveau classement accepte cette valeur comme signal optionnel.

## Decision : normaliser la popularite dans le lot avec une echelle logarithmique

**Pourquoi** : les compteurs de vues varient de plusieurs ordres de grandeur selon la plateforme, la langue et la taille de la chaine. `log1p(viewCount)` limite ces ecarts; une normalisation par lot ne pretend pas comparer absolument YouTube, Nebula et un petit site.

**Limite acceptee** : un lot tres petit donne un signal de popularite peu informatif. Dans ce cas la ponderation faible et les autres signaux restent dominants.

## Decision : conserver la diversite dans le sequencement

**Pourquoi** : la diversite depend de ce qui a deja ete choisi dans une liste, ce n'est pas une propriete intrinsinseque d'une video. Le score de base reste pur et explicable; Smart TV applique ses penalites de repetition existantes au moment de composer la session.

## Decision : aucun appel IA dans cette PR

**Pourquoi** : le classement de base doit etre utile sur Grayjay standard. Les signaux Smart sont des enrichissements facultatifs, jamais des prerequis. Cette limite rend le noyau reutilisable et testable sans infrastructure locale.

## Alternatives rejetees

- **Vues brutes comme tri principal** : favorise les grandes chaines et les videos anciennes.
- **Un score unique affiche en etoiles** : confond popularite, actualite et valeur editoriale.
- **Un algorithme distinct par carrousel** : recree les divergences deja presentes entre Home, Smart TV et les mixes.
