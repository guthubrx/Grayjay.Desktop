# Specification de fonctionnalite : Profil de decouverte precompute

**Branche** : `pr/013-precomputed-discovery-profile`
**Statut** : Validee pour implementation

## Intention

Lorsqu'une video recoit des Smart Chapters, BlueJay doit aussi recevoir une carte de decouverte exploitable immediatement : quatre angles editoriaux et de courtes requetes de recherche, deja traduites dans les langues ciblees. Cette extension reste inactive sans generateur Smart Chapters.

## User stories

### US1 - Preparer la decouverte pendant l'analyse (P1)

En tant que spectateur, je veux que la meme analyse qui produit le resume produise aussi les axes de decouverte de la video afin que Create Smart Mix ne doive plus transformer une phrase de resume en requete vague.

Acceptation :
1. Une analyse reussie produit quatre axes distincts : sujet central, contexte, impacts ou consequences, angle de debat ou limites.
2. Chaque axe contient une requete concise par langue de decouverte demandee.
3. Cette information est obtenue dans le premier appel LLM deja necessaire a l'analyse, sans second appel de planification.

### US2 - Reutiliser les langues et degrader proprement (P1)

En tant que spectateur, je veux que les langues de decouverte puissent venir du precompute ou de l'application sans rendre les highlights inutilisables si elles sont absentes ou changees.

Acceptation :
1. Sans variable de langue, le profil contient au moins les requetes anglaises.
2. Une langue invalide est ignoree et ne bloque jamais la generation.
3. Un highlight historique sans profil reste lisible; les appels futurs peuvent le rafraichir en mode analyse seule.

### US3 - Rendre le profil disponible sans imposer Smart (P1)

En tant que developpeur de BlueJay, je veux que le profil soit expose par le meme contrat Highlights et reste optionnel afin que les PR non Smart et Grayjay standard ne dependent pas de lui.

Acceptation :
1. Les modeles C#, TypeScript et JSON representent le profil de maniere facultative.
2. Les donnees historiques sans profil restent deserialisables.
3. Le classement generique de la PR 012 ne depend pas de ce type.

## Exigences

- **FR-001** : Le generateur DOIT demander et valider un profil de quatre axes dans son JSON d'analyse.
- **FR-002** : Le generateur DOIT ajouter les requetes dans les langues de `--discovery-languages` ou `GRAYJAY_DISCOVERY_LANGUAGES`; `en` est le repli minimal.
- **FR-003** : Chaque axe DOIT avoir un identifiant stable, un libelle court et des requetes distinctes non vides.
- **FR-004** : Le cache d'analyse DOIT tenir compte des langues de decouverte et de la version du profil.
- **FR-005** : L'ecriture normale et `--analysis-only` DOIVENT persister le profil sans toucher aux chapitres lorsque ce mode est choisi.
- **FR-006** : Les contrats C# et TypeScript DOIVENT exposer le profil comme optionnel.
- **FR-007** : Aucun appel reseau supplementaire ne doit etre ajoute au clic sur une video par cette PR.

## Hors perimetre

- Lancer les recherches externes, les classer ou modifier une playlist pendant son chargement.
- Ajouter un ecran de reglages ou une nouvelle dependance IA.
- Regenerer automatiquement tout l'historique existant.
