# Modele de donnees

## SmartTvCandidate

Ajoute des listes optionnelles de labels semantiques issus du `mixProfile`. Elles sont en memoire uniquement et ne modifient pas les sessions deja persistees.

## Smart Discovery query

Representation transitoire composee au maximum de deux `topics`, un `relatedTopic` et, en repli, du `globalSummary`. Elle ne stocke aucune donnee nouvelle.

## Resultat de decouverte

Video existante retournee par Smart Search. Une entree est retenue seulement si elle possede une URL, n'est pas la source et n'a pas deja ete retenue sous une URL equivalente.
