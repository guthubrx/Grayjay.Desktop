# Contrat: piste de sous-titres traduite

## Génération

Entrée: transcript horodaté local et langue cible.
Sortie: cues locaux horodatés et métadonnées de cache dans les highlights.

## Restitution dans le lecteur

- Nom visible: `<langue> traduit`.
- Cette piste ne remplace jamais les pistes fournies par la source.
- Le lecteur doit pouvoir la sélectionner, la désélectionner et revenir à `Aucun` avec le même comportement que les pistes source.

## Erreurs

- Transcript absent ou incomplet: aucune piste traduite, aucune régression de lecture.
- Génération en erreur: état identifiable, réessayable, sans cacher les autres choix.
- Cache non compatible: régénération contrôlée à la prochaine demande.
