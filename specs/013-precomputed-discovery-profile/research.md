# Recherche

Le generateur utilise deja le mode JSON OpenAI-compatible, car Routr peut choisir des fournisseurs differents. Le contrat conserve donc une validation defensive locale plutot que de dependre de `json_schema`, qui n'est pas garanti par tous les backends du pool. La documentation OpenAI confirme que le JSON mode requiert une consigne explicite et que les sorties structurees sont preferables lorsqu'elles sont supportees; le prompt existant et les validateurs locaux couvrent ce besoin de portabilite. [OpenAI API reference](https://platform.openai.com/docs/api-reference/evals/run-output-item-object?lang=node)

La traduction des requetes est placee dans le premier passage, qui a deja le transcript complet et produit le resume. Cela evite un second round-trip de planification au clic. La variable d'environnement est volontairement un repli de precompute : elle ne cree pas un second panneau de reglages et les langues manquantes peuvent etre enrichies plus tard.
