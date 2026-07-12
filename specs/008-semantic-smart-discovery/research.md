# Recherche

## Decision : reutiliser Smart Search comme moteur de decouverte

**Pourquoi** : Smart Search possede deja le traducteur local, les langues choisies, les filtres de sources et les contrats de resultat. Le reutiliser evite de doubler les appels reseau, les reglages et les politiques de cache.

**Alternative rejetee** : interroger directement YouTube depuis Smart Mix. Cela contournerait les sources actives, briserait les reglages multilingues et introduirait un second chemin de recherche a maintenir.

## Decision : profil canonique avant similarite textuelle

**Pourquoi** : deux videos traitant du meme sujet dans des langues differentes ont peu de tokens textuels communs. Les labels canoniques deja calcules resolvent ce cas sans nouvel appel IA.

**Repli** : les anciens highlights restent relies par les titres, resumes et chapitres existants.

## Decision : decouverte explicitement demandee

**Pourquoi** : une recherche externe a un cout et une latence variables. Elle doit rester une action volontaire, alors que les lignes Highlights doivent rester immediates et predecibles.
