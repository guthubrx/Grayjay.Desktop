# ADR 012 : Separer rang de recommandation et valeur editoriale

**Date** : 2026-07-12
**Statut** : Accepte

## Contexte

BlueJay utilise deja des scores de chapitre, une note video derivee des highlights et des tris Home differents. Les vues et la date sont presentes mais non centralisees. L'IA doit rester une extension optionnelle.

## Decision

Creer un calculateur de rang pur, centre sur les metadonnees ordinaires et pouvant recevoir des signaux facultatifs. Conserver la valeur editoriale des Smart Chapters comme une mesure separee, sans vues ni fraicheur.

## Consequences

- Une installation sans IA beneficie du classement de base.
- Les surfaces editoriales convergent vers les memes signaux.
- Les extensions Smart ajoutent des donnees au calcul sans dependency inverse.
- Les etoiles peuvent legerement evoluer car elles ne portent plus le bonus de fraicheur historique; leur signification devient coherente avec leur libelle editorial.
