# Analyse croisee : Smart Prefill Scheduler

**Passage 1** : 2026-07-13

## Verification spec -> plan -> taches

| Sujet | Resultat |
|---|---|
| Opt-in et degradation | Couvert par T005, T007 et les sorties sans commande. |
| Plafond global 1..32 | Couvert par T001, T002 et T005. |
| Priorites | Couvert par T001, T002, T009 et T010. |
| Smart Mix sans blocage | Couvert par T009 ; pas de modification de la file par le prefill. |
| Sous-titres / Whisper existants | Reutilisation explicite dans le plan et T001. |
| Erreur / retry | Couvert par T001, T002 et T011. |
| Tests | Couvert par T003, T004, T012 a T015. |

## Finding corrige

1. **Backfill inter-processus** : la premiere formulation de la spec pouvait laisser croire que le plafond BlueJay coordonnait aussi le backfill autonome. La limite memoire ne peut pas le garantir. La section *Assumptions* et le plan ont ete corriges pour borner la promesse au processus BlueJay et aux scripts qui passent par son API.

## Passage 2

Relu apres correction : aucun conflit non ambigu entre la spec, le plan et les taches. Les taches ne dupliquent pas les services existants identifies dans `reuse-audit.md`.
