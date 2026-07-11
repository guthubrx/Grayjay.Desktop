# Contrat: Subscription Bootstrap

## Endpoint

`GET /subscriptions/SubscriptionsBootstrapLoad`

## Reponse

La reponse suit la forme existante `PagerResult<PlatformVideo>`.

| Champ | Signification |
|---|---|
| `results` | videos de demarrage bornee, deja filtrees contre les abonnements actifs. |
| `hasMore` | toujours `false`. Le snapshot n'est pas un pager complet. |
| `exception` | message optionnel en cas de lecture impossible ; le client traite alors le resultat comme vide. |

## Garanties

- Aucune requete source ou reseau n'est lancee par cet endpoint.
- Aucun `Pager` de cache n'est construit par cet endpoint.
- Une absence ou corruption de snapshot retourne une liste vide et non une erreur HTTP.
- Le contrat reste exploitable sans les fonctionnalites Smart Chapters, Smart TV et Smart Block.

## Consommation Frontend

Le resultat est converti localement en pager statique, exclusivement comme etat provisoire. Les endpoints `SubscriptionsCacheLoad`, `SubscriptionsLoadLazy` et les endpoints de groupes conservent leur semantique actuelle et prennent la releve des qu'ils disposent de donnees.
