# Recherche technique

## Décisions

### Traduire les cues existants, jamais la vidéo pendant la lecture

Le générateur conserve déjà des cues horodatés (`start`, `end`, `text`) dans le cache transcript. La traduction réutilise ces bornes et stocke des cues locaux par vidéo et langue cible dans les highlights. Elle sera demandée au précompute ou explicitement par l'utilisateur, jamais au changement de position du lecteur.

**Pourquoi**: préserve la synchronisation, évite Whisper supplémentaire et rend la lecture indépendante du réseau.

### Réutiliser le fournisseur configuré pour Smart Chapters

Le générateur emploie déjà un endpoint OpenAI-compatible via Routr. Une traduction par blocs de cues, validée et mise en cache, utilisera ce même chemin et le profil déjà choisi par l'utilisateur.

**Pourquoi**: pas de nouvelle clé, service ou dépendance; le transcript envoyé est limité au contenu nécessaire à la traduction. Le cache local évite les envois répétés, conformément au principe de minimisation rappelé par la [CNIL](https://www.cnil.fr/fr/minimiser-les-donnees-collectees).

### Une seule langue de sortie explicite pour les données Smart

Le réglage existant `Smart Analysis > Generation language` est la source de vérité pour les nouveaux résumés, thèses et chapitres. La piste traduite utilise par défaut cette même langue, tout en restant sélectionnable indépendamment des sous-titres source.

**Pourquoi**: l'utilisateur ne doit pas régler plusieurs langues contradictoires pour un même objectif de compréhension.

### Réparer l’empilement au niveau du gestionnaire global

Les modales sont aujourd'hui rendues dans `OverlayModals` avec une couche plus basse que certains éléments du lecteur. La correction doit définir une couche globale au-dessus des menus du lecteur et, en plein écran navigateur, rendre le conteneur dans le même contexte que l'élément plein écran.

**Pourquoi**: corriger une seule fois le contrat de couche pour Partager, Télécharger et tous les autres dialogues, sans augmenter arbitrairement le `z-index` de chaque dialogue. Le gestionnaire conservera son focus trap, conformément au [pattern de modale W3C](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## Alternatives écartées

- Traduction des sous-titres à chaque ouverture: coûteuse, lente et fragile.
- Nouvelle transcription Whisper dans la langue cible: ne produit pas réellement une traduction et est inutile quand le transcript existe.
- Traduire uniquement le résumé Smart: ne résout pas la compréhension pendant la vidéo.
- Relever seulement le `z-index` de la boîte Partager: laisserait les autres modales et le plein écran cassés.

## Impact mainteneur

Les fichiers de cache restent lisibles, supprimables et reproductibles. La langue et l’empreinte du transcript rendent l’invalidation explicite. La couche UI est centralisée dans un unique gestionnaire de modales.
