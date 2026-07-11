# Recherche technique — Préchargement de lecture

## Décision 1 — Réchauffer la résolution, pas créer un second lecteur

**Décision** : Précharger les détails et la sélection de source, puis conserver un poster jusqu'à la première image. Ne pas prébufferiser les octets média dans cette PR.

**Justification** : Le lecteur actuel possède une seule pile HLS/DASH liée à un élément vidéo. Un vrai prébuffer transférable nécessiterait une seconde pile média, des états proxy temporaires et un mécanisme de promotion des buffers. Ce volume augmenterait fortement le risque de régression pour un gain non encore mesuré.

**Alternatives considérées** :

- Second élément vidéo caché : rejeté, car les buffers MSE ne sont pas transférables simplement au lecteur visible.
- Préchargement manuel de segments HLS/DASH : rejeté, car il dupliquerait les parseurs existants sans garantie de réutilisation du cache HTTP.
- Mutation anticipée du `DetailsState` courant : rejetée, car les proxys, l'historique et le suivi de lecture dépendent de cet état.

## Décision 2 — Une préparation isolée par fenêtre

**Décision** : Héberger un cache mono-entrée dans `DetailsController.DetailsState`.

**Justification** : Grayjay isole déjà la page de détail par `WindowState`. Une préparation appartient donc à la même fenêtre et doit être libérée avec elle. Cette localisation évite un dictionnaire global, une clé de fenêtre supplémentaire et des fuites interfenêtres.

**Alternatives considérées** :

- Cache global par URL : rejeté, car les sources, réglages, plugins et fenêtres peuvent diverger.
- Cache frontend seul : rejeté, car la résolution coûteuse est exécutée côté backend/plugin.

## Décision 3 — Séparer résolution et activation

**Décision** : Extraire la résolution sans effet de bord du chemin `VideoLoad`, puis conserver `ChangeVideo` comme unique activation.

**Justification** : `VideoLoad` mélange actuellement récupération des détails et mutations de lecture. La préparation doit exécuter uniquement la première partie. Au moment de la consommation, l'activation existante reste inchangée afin de préserver historique, tracker, abonnement et live chat.

**Alternatives considérées** : Dupliquer `VideoLoad` dans un endpoint de préchargement. Rejeté à cause de la dérive future des erreurs et types supportés.

## Décision 4 — Déduplication et sérialisation O(1)

**Décision** : Une demande identique partage sa tâche. Une nouvelle cible remplace la cible désirée et attend la fin de l'unique résolution en cours avant de démarrer.

**Justification** : Les plugins exposent une API synchrone et ne garantissent pas une annulation coopérative. La sérialisation empêche deux résolutions anticipées concurrentes tout en éliminant les doublons.

**Alternatives considérées** : Lancer toutes les résolutions et jeter les résultats obsolètes. Rejeté car cela viole la borne d'une préparation active et peut augmenter les appels aux plateformes.

## Décision 5 — Préparation immédiate de la prochaine entrée déterministe

**Décision** : Déclencher après activation de la vidéo courante, uniquement si la file n'est pas en mode aléatoire et si une prochaine URL distincte est connue.

**Justification** : Les détails constituent l'étape la plus lente et leur coût mémoire est borné à une entrée. Attendre les dernières secondes réduirait le bénéfice lors d'un clic manuel sur Next.

**Alternatives considérées** : Seuil temporel de 15 à 30 secondes. Rejeté pour cette version car la durée n'est pas toujours connue et le clic manuel peut survenir avant le seuil.

## Décision 6 — Durée de vie de deux heures

**Décision** : Considérer une préparation valide pendant deux heures, puis revenir au chemin normal.

**Justification** : La préparation commence au début de la vidéo courante et doit rester utile aux formats longs, tout en évitant de réutiliser indéfiniment des URLs de source susceptibles d'expirer.

**Alternatives considérées** : Dix minutes, insuffisant pour de nombreuses vidéos ; persistance disque, inutile et risquée pour des sources temporaires.

## Décision 7 — Réglage Player booléen

**Décision** : Ajouter un toggle `Prefetch next video`, actif par défaut.

**Justification** : Le comportement ne télécharge pas volontairement le média et ne prépare qu'une entrée, mais il provoque un appel anticipé au plugin. Un toggle dans le groupe Player suit le pattern existant et permet le retour au comportement historique.

## Décision 8 — Observabilité locale ciblée

**Décision** : Journaliser `started`, `prepared`, `hit`, `miss`, `stale`, `cancelled`, `failed` avec URL et durée ; journaliser côté frontend le délai jusqu'au premier état de lecture.

**Justification** : Ces événements suffisent à mesurer le gain et diagnostiquer un repli dans une application locale. Ajouter Prometheus ou une base de traces serait disproportionné.
