# Smart Analysis et Smart TV dans BlueJay

Smart Analysis est optionnel. Il ajoute à une vidéo des informations produites localement : résumé global, thèses principales, Smart Chapters notés et, sur la branche expérimentale Smart Block, segments promotionnels. BlueJay continue de fonctionner normalement lorsqu'aucune analyse n'est disponible.

## Chaîne Smart Chapters

1. Configurez une commande de génération Smart Chapters dans BlueJay.
2. Lancez **Generate Smart Chapters** depuis le menu contextuel d'une vidéo, ou exécutez le générateur sur des URL, une playlist ou un média local.
3. Quand la commande contient `{subtitles}`, BlueJay demande d'abord les sous-titres à son propre plugin de source et les transmet au générateur.
4. Sans sous-titres exploitables, le générateur peut récupérer lui-même des sous-titres puis basculer vers la transcription audio Whisper.
5. Le JSON produit est écrit dans le stockage local de highlights. Le lecteur, la page Highlights et Smart TV réutilisent la même donnée.

Le générateur met les transcriptions exploitables en cache. Les sous-titres partiels ne sont pas mémorisés par défaut afin qu'une transcription courte ou tronquée ne remplace pas durablement une transcription complète.

## Qualité et scores

Le premier passage d'analyse produit un résumé global et des thèses, avant le découpage en chapitres. Le nombre de chapitres s'adapte à la durée de la vidéo. Les scores estiment la valeur du passage pour le spectateur ; ils ne sont pas une note de popularité de la vidéo entière.

Le générateur réessaie les réponses de modèle malformées récupérables, redécoupe les sections trop larges et recale les bornes finales sur les débuts de phrases. Le lecteur expose ce résultat dans la heatmap, le panneau X-Ray et ses filtres de chapitres.

## Smart TV

Smart TV crée une session finie à partir de chapitres notés. Il ne crée pas une playlist géante et ne la reconstruit pas continuellement pendant l'écoute.

- Le **mix global** combine les sources éligibles.
- Les tuiles Smart TV contextuelles construisent une session à partir des vidéos de leur propre ligne.
- Une session mémorise les chapitres déjà joués ; la relancer reprend donc la séquence restante.
- Cliquer une tuile recalcule volontairement la session depuis le pool courant, puis lance la lecture.

Dans **Paramètres → Smart Analysis → Smart TV**, choisissez la durée cible, le maximum de vidéos et de chapitres, le maximum de chapitres par vidéo, le score minimal, la taille du pool, la pénalité de répétition, les miniatures et le comportement du résumé d'introduction.

## Highlights et rafraîchissement

Highlights réutilise les résumés Smart Analysis pour classer les vidéos non vues et éligibles de vos abonnements dans **Watch now**, puis afficher un contexte d'intérêt cohérent. Les lignes de groupes d'abonnements s'affichent d'abord depuis le cache local, puis se rafraîchissent indépendamment.

Le contrôle de rechargement propose deux actions distinctes :

- **Recharger le cache** : redessine immédiatement à partir des données locales disponibles.
- **Mettre à jour** : demande un rafraîchissement complet aux sources configurées.

## Branche Smart Block

`pr/smart-block-promotions` est actuellement une branche expérimentale dépendante, pas encore intégrée à `bluejay/all-features`. Elle enrichit le même fichier d'analyse local avec des segments promotionnels issus de données compatibles SponsorBlock et de l'analyse du modèle. Lorsqu'il est activé, Smart Block peut les marquer par une couche grise hachurée sur la heatmap puis les sauter. Il est indépendant de SponsorBlock : chacun peut être activé sans l'autre.

## Limites opérationnelles

Le générateur a besoin d'un fournisseur de modèle configuré. Le repli de transcription peut aussi nécessiter `yt-dlp`, `deno`, `ffmpeg` et un modèle Whisper selon la source. Exécutez `tools/generate_smart_chapters.py --check` pour diagnostiquer l'environnement local avant d'indexer un lot.
