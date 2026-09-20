# Recherche : Smart Prefill Scheduler

## Question

Comment preparer des videos avant lecture sans lancer une seconde architecture IA, sans saturer Routr et sans ralentir le parcours interactif ?

## Baselines consultees

- `~/.speckit/research/01-ai-agents-agentic-ai.md` : privilegier les workflows explicites, bornes et observables plutot qu'un agent autonome opaque.
- `~/.speckit/research/04-architectures-patterns.md` : une file unique, idempotente et priorisee limite les courses et rend les reprises predictibles.
- `~/.speckit/research/03-cognitive-load-productivity.md` : n'exposer que les reglages qui changent une decision utile pour l'utilisateur.

## Validation live

- [Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents?via=bart41) recommande de commencer par des workflows simples et composables, et de ne paralleliser que des taches independantes.
- [OpenAI, A practical guide to building agents](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/) recommande une orchestration gouvernee par des gardes-fous et des sorties observables.

Ces principes confirment le choix d'une file unique existante, de priorites fixes et d'un plafond de travailleurs, plutot qu'un prefill qui lancerait directement des commandes depuis chaque ecran.

## Decisions et alternatives

| Decision | Raison | Alternative ecartee |
|---|---|---|
| Reutiliser `StateHighlightsIndexer` | Il possede deja l'execution, le WebSocket et la deduplication active. | Un nouveau scheduler aurait duplique l'etat et rendu les jobs moins observables. |
| Limite globale appliquee par BlueJay | Toutes les sources dans le meme processus partagent exactement le meme plafond. | Un plafond par page permettrait de depasser la capacite Routr. |
| Prefill desactive par defaut | LLM et Whisper restent des options. | Une activation implicite consommerait une ressource externe sans consentement. |
| Cooldown automatique apres erreur | Evite les boucles de rendu et les echos de WebSocket. | Retenter a chaque apparition du carrousel surcharge Routr et masque les incidents. |
| Perimetre app pour le plafond | Un semaphore en memoire ne peut pas coordonner de facon fiable un processus de backfill independant. | Promettre une limite inter-processus sans service partage serait trompeur. |

## Risques et garde-fous

- **Routr indisponible** : le job devient `error`, conserve un message limite et est refroidi avant un nouvel essai automatique.
- **Sous-titres absents** : le generateur existant decide de Whisper ou non ; aucune nouvelle voie ne contourne ce choix.
- **Videos repetes** : URL normalisee/deduplication dans le scheduler et envoi sessionnel deduplique cote interface.
- **Charge catalogue** : chaque surface a un maximum de candidats ; le travail futur ne bloque pas la lecture presente.
- **Mix change pendant le prefill** : cette feature ne reecrit pas la file ; PR 014 conserve son mecanisme de remplacement protege lorsqu'une mise a jour de recherche est demandee.
