# Specification de fonctionnalite : Decouverte progressive multilingue

**Branche** : `pr/014-progressive-multilingual-discovery`
**Dependances** : PR 012 et PR 013
**Statut** : Validee pour implementation autonome

## Intention

Create Smart Mix doit rechercher sur les plateformes des videos inspirees par une video analysee. Il utilise les quatre axes precalcules par Smart Chapters au lieu d'une longue phrase de resume, ramene les resultats progressivement et ne modifie jamais la video en cours ni les elements deja joues.

## User stories

### US1 - Rechercher avec des axes explicables (P1)

En tant que spectateur, je veux que mon Smart Mix interroge les plateformes avec les axes sujet, contexte, impacts et debat de la video source afin que la selection soit elargie sans devenir une recherche generique de mots du resume.

Acceptation :
1. Les profils `discoveryProfile` de la PR 013 fournissent les requetes quand ils existent.
2. Les recherches prioritaires sont la langue de l'utilisateur, puis l'anglais, puis les langues configurees restantes.
3. Les requetes absentes sont traduites par un unique appel groupe au traducteur existant, sans Whisper ni nouvelle analyse de transcript.
4. Un highlight historique sans profil conserve le comportement precedent fonde sur son resume.

### US2 - Charger sans saturer les sources (P1)

En tant que spectateur, je veux que les recherches de Smart Mix progressent avec un parallelisme reglable afin d'obtenir vite un premier choix sans multiplier sans borne les requetes vers YouTube ou les autres plateformes.

Acceptation :
1. Le parallelisme est applique au lancement effectif des recherches plugin, partage par toute la session de decouverte.
2. Il est reglable de 1 a 32 dans Smart Search, avec 3 par defaut.
3. Les recherches standards et les installations sans Smart Chapters gardent leur comportement actuel.

### US3 - Faire evoluer la playlist sans surprendre (P1)

En tant que spectateur, je veux que le premier lot disponible lance le Smart Mix puis que les resultats suivants enrichissent seulement la suite afin que ma lecture en cours ne saute jamais.

Acceptation :
1. Le premier lot de resultats ouvre la file Smart Mix des qu'au moins une video est disponible.
2. Les etapes suivantes remplacent uniquement la queue apres l'element courant du meme Smart Mix.
3. Si l'utilisateur change de file ou ferme le lecteur, aucun resultat tardif ne peut modifier sa nouvelle file.
4. Les resultats sont dedupliques, excluent la video source et sont classes par le ranker generique de la PR 012 avec pertinence de l'axe, interet optionnel, fraicheur et popularite.

## Exigences

- **FR-001** : Le backend Smart Search DOIT accepter des variantes de requetes pre-traduites, avec axe et etape optionnels, sans casser les appels existants.
- **FR-002** : La session de decouverte DOIT pouvoir demarrer l'etape suivante sans recreer sa session ni perdre les resultats precedents.
- **FR-003** : Les appels plugin d'une session DOIVENT partager une limite de parallelisme.
- **FR-004** : Le traducteur DOIT pouvoir traduire plusieurs requetes d'axe vers plusieurs langues dans un seul appel Routr.
- **FR-005** : Le Smart Mix DOIT afficher un retour de progression et reutiliser la file existante seulement si son identifiant de session correspond.
- **FR-006** : Le resultat de Smart Mix DOIT utiliser `rankRecommendationCandidates` de la PR 012; les etoiles editoriales ne changent pas.
- **FR-007** : Les limites de langue, de variantes et de parallelisme DOIVENT etre validees cote serveur.

## Hors perimetre

- Modifier la recherche standard, ses filtres ou ses resultats.
- Forcer une analyse IA pour les videos qui n'ont pas de Smart Chapters.
- Persister une playlist Smart Mix comme playlist utilisateur.
- Ajouter des appels de recherche a l'ouverture normale d'une video.
