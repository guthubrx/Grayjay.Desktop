# Recherche Technique: Snapshot de Feed au Demarrage

## Faits Observes

1. Les caches d'interface introduits par les commits `0f0fc1f1` et `036fa242` sont bien presents. Ils utilisent `localStorage`.
2. Le serveur Grayjay ecoute sur un port local aleatoire (`Listen(IPAddress.Loopback, 0)` dans `GrayjayServer.cs`). Le port fait partie de l'origine navigateur, donc le stockage web ne peut pas etre retrouve au prochain lancement.
3. Le lanceur CEF donne a Chromium un repertoire `chrome_<GUID>` sous le repertoire temporaire. `Directories.Temporary` est supprime puis recree a chaque demarrage. Les donnees navigateur sont donc intentionnellement ephemeres.
4. Les videos d'abonnements sont deja durablement stockees dans `StateCache`, au format `ManagedDBStore<DBSubscriptionCacheIndex, PlatformContent>`.
5. `SubscriptionsCacheLoad` reconstruit un `DedupContentPager` a partir de ce cache. Cette reconstruction et la deserialisation sont exactement le travail a eviter sur le chemin critique du premier rendu.

## Options Evaluees

### A. Rendre le profil CEF persistant et fixer le port local

Rejetee. Cela modifierait les proprietes de confidentialite de Grayjay, introduirait les collisions de ports et conserverait implicitement des donnees de navigation ou de source qui sont aujourd'hui temporaires.

### B. Conserver les caches frontend existants

Rejetee. Ils ne survivent pas a la rotation de l'origine et du profil CEF. Ils restent sans danger comme optimisation intra-session, mais ne peuvent pas assurer le demarrage a froid.

### C. Lire le cache complet a chaque ouverture de page

Rejetee comme solution principale. C'est le comportement actuel et il reconstruit le pager avant de pouvoir rendre une vignette.

### D. Ecrire un snapshot borne dans le stockage applicatif backend

Retenue. Le snapshot est derive du cache d'abonnements existant apres ses mises a jour, ecrit atomiquement en arriere-plan et lu directement au lancement. Il ne remplace ni la base de cache, ni les pagers, ni le rafraichissement live.

## Decision De Conception

- Le backend possede un snapshot borne de videos recentes, avec horodatage et version de format.
- Un planificateur debounce reconstruit ce snapshot apres les modifications du cache existant, hors du chemin de rendu.
- Le snapshot est filtre au chargement contre les abonnements et sources actuellement actifs. Une desinscription ne peut donc pas faire reapparaitre une video obsolete.
- Un endpoint explicite renvoie uniquement ce snapshot. Il ne construit pas de pager ni ne declenche de requete reseau.
- Le frontend consomme ce resultat comme pager statique provisoire. Les endpoints cache et live existants continuent en parallele puis remplacent ce resultat lorsqu'ils sont prets.
- Highlights utilise le meme resultat pour le hero de repli et les lignes de groupes, sans dependance a Smart Chapters ou Smart TV.

## Risques Et Mitigations

| Risque | Mitigation |
|---|---|
| Snapshot corrompu apres une interruption | Ecriture atomique et lecture tolerante renvoyant un resultat vide. |
| Snapshot obsolete | Horodatage, borne de taille, filtrage des abonnements actifs, puis actualisation live existante. |
| Ecriture frequente pendant un refresh | Debounce et une seule reconstruction en arriere-plan a la fois. |
| Cout de construction | Le cout est deplace apres la mise a jour du cache ; il n'est jamais execute par l'endpoint de demarrage. |
| Couplage aux PR BlueJay | Le flux repose uniquement sur le cache et les pages standards ; Smart Chapters reste facultatif. |

## Consequence De Mesure

Le test de validation compare le chemin snapshot au chemin live ralenti : les premieres vignettes doivent etre rendues avant la fin du rafraichissement. La qualite editoriale ou la fraicheur maximale ne font pas partie de ce test, car elles appartiennent au rafraichissement deja existant.
