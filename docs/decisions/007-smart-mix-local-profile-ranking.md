# ADR 007 : Profil semantique compact et classement local pour Smart Mix

**Date** : 2026-07-12  
**Statut** : Accepte

## Contexte

BlueJay doit creer un mix de videos inspire par une video analysee, a partir des transcriptions deja traitees. La fonction doit etre rapide au clic, multilingue, explicable et ne pas dependre des recommandations de plateforme.

Le routeur local Routr expose `/v1/embeddings` en erreur `501`. Ajouter un modele vectoriel ou une base vectorielle serait une dependance et un flux d'exploitation nouveaux qui ne sont pas justifies par le catalogue actuel.

## Decision

Le generateur Smart Chapters ajoute, dans son analyse JSON existante, un `mixProfile` optionnel et borne en anglais canonique : sujets principaux, sujets connexes et angles analytiques.

BlueJay calcule ensuite le Smart Mix localement depuis ce profil. En absence de profil, il derive une representation de repli des resumes, theses et chapitres existants. Les videos sont lues integralement ; les chapitres justifient seulement la pertinence de leur presence.

## Consequences

### Positives

- Aucune requete LLM, plateforme ou embeddings au clic.
- Compatibilite avec les analyses existantes et absence de migration massive.
- Fonctionnement transversal aux langues grace au vocabulaire canonique interne.
- Classement deterministe, explicable et testable.
- Aucun transcript supplementaire stocke.

### Negatives

- La qualite semantique depend de la regularite des profils LLM et reste moins generale qu'un vrai index vectoriel.
- Les anciens highlights utilisent temporairement une similarite moins precise.
- Les profils ne sont enrichis automatiquement que lors des analyses futures ou rafraichies.

## Alternatives rejetees

- **Embeddings via Routr** : endpoint explicitement indisponible.
- **Embeddings locaux + base vectorielle** : dependances, telechargements et complexite non justifies a cette echelle.
- **Classement LLM au clic** : latence, cout, indisponibilite reseau et resultat moins reproductible.
- **Reanalyse immediate de tous les highlights** : cout et latence incompatibles avec une livraison incrementale.
