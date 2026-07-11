# Modele De Donnees

## SubscriptionFeedSnapshot

| Champ | Type | Regle |
|---|---|---|
| `formatVersion` | entier | Permet d'ignorer un format devenu incompatible. |
| `createdAt` | date ISO | Date de la derniere reconstruction reussie. |
| `videos` | liste de videos | Maximum borne, triee par date descendante, videos seulement. |

Le snapshot est derive. La base `subscriptionCache` reste la source de verite pour le cache durable complet.

## Invariants

- Une video doit avoir une URL, un auteur et une date utilisables.
- Aucun element non video ne figure dans le snapshot de demarrage.
- Une lecture vide ou invalide est equivalente a l'absence de snapshot.
- Une video dont l'auteur ne figure plus parmi les abonnements actifs est retiree a la lecture.
- Le snapshot ne transporte pas d'etat de lecture, de session navigateur, de cookies ou d'authentification.

## Cycle De Vie

1. Le cache d'abonnements existant est enrichi ou mis a jour.
2. Une reconstruction debounced du snapshot est demandee en arriere-plan.
3. Le nouveau contenu est ecrit atomiquement dans le repertoire applicatif Grayjay.
4. Au prochain lancement, le endpoint de bootstrap lit le fichier sans reconstruire les pagers.
5. Le frontend affiche ces videos provisoirement puis les remplace avec les pagers cache et live existants.
