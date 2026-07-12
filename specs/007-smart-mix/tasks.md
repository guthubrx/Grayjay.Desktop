# Taches : Smart Mix inspire par une video

**Feature** : `007-smart-mix`  
**Branche** : `007-smart-mix`  
**Regle** : cocher une tache seulement apres sa verification. Les tests et builds sont executes avant la validation de leur tache.

## Phase 1 - Profil derive du transcript (P1)

- [x] **T001** Ajouter `tests/unit/test_007_smart_mix_profile.py` couvrant la validation du profil : listes bornees, deduplication, suppression des valeurs invalides, compatibilite avec une analyse ancienne sans profil. **Resultat observable** : les tests echouent avant l'ajout du profil et decrivent le JSON attendu.
- [x] **T002** Etendre `tools/generate_smart_chapters.py` pour demander, valider, cacher et ecrire `mixProfile` avec l'analyse Smart Chapters existante. Ne pas conserver de transcript supplementaire ni declencher de reanalyse massive. **Verification** : `python3 -m unittest tests/unit/test_007_smart_mix_profile.py tests/unit/test_002_translated_subtitles.py tests/unit/test_006_selective_subtitle_translation.py` est vert.
- [x] **T003** Ajouter les contrats optionnels `VideoHighlightMixProfile` dans `Grayjay.ClientServer/Models/Highlights/VideoHighlightMixProfile.cs`, `VideoHighlightSet.cs`, `Grayjay.Desktop.Web/src/backend/models/highlights/IVideoHighlightMixProfile.ts` et `IVideoHighlightSet.ts`. **Verification** : les anciens fichiers JSON sans le champ sont deserialisables et `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj` passe.

## Phase 2 - Projection locale et composeur (P1)

- [x] **T004** Ajouter `VideoHighlightMixCandidate` et `StateHighlights.GetMixCandidates()` dans `Grayjay.ClientServer`, puis exposer `GET /highlights/MixCandidates` dans `HighlightsController.cs`. La projection doit contenir le minimum de donnees de classement, les segments explicatifs et aucune donnee de transcript/sous-titre. **Verification** : `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj` passe et le contrat [smart-mix-candidates.md](contracts/smart-mix-candidates.md) correspond aux modeles.
- [x] **T005** Ajouter les types frontend `IVideoHighlightMixCandidate.ts`, `IVideoHighlightMixProfile.ts` et la methode `HighlightsBackend.getMixCandidates()`. **Verification** : `npm --prefix Grayjay.Desktop.Web run build` passe avec ces contrats.
- [x] **T006** Ecrire `Grayjay.Desktop.Web/src/utils/smartMixComposer.test.ts` pour les cas : repartition `60/25/15`, arrondi deterministe, quotas incomplets, exclusion source/doublons, preference non-vu, variete createur, fallback sans profil et stabilite de l'ordre. **Resultat observable** : le test echoue avant le composeur.
- [x] **T007** Implementer `Grayjay.Desktop.Web/src/utils/smartMixComposer.ts` comme fonction pure O(n log n). Le composeur doit categoriser, classer, repartir et expliquer les videos completes sans I/O. **Verification** : `node --experimental-strip-types --test Grayjay.Desktop.Web/src/utils/smartMixComposer.test.ts` est vert et la complexite est commentee au point d'entree.
- [x] **T007a** Extraire la lecture des limites Smart TV de `Grayjay.Desktop.Web/src/pages/Home/index.tsx` vers `Grayjay.Desktop.Web/src/utils/smartTvSettings.ts`, puis reutiliser cet utilitaire depuis Home et le lecteur. **Verification** : les valeurs par defaut et les index existants restent identiques dans Home ; `npm --prefix Grayjay.Desktop.Web run build` passe.

## Phase 3 - Reglages editoriaux (P1)

- [x] **T008** Ajouter `Grayjay.Desktop.Web/src/state/StateSmartMix.ts` avec les valeurs `60/25/15`, une normalisation defensive et la persistence `smartMix.settings`. **Verification** : le module refuse une configuration dont le total differe de 100 et retombe sur le defaut pour une valeur persistee invalide.
- [ ] **T009** Ajouter `Grayjay.Desktop.Web/src/components/settings/SmartMixSettings/index.tsx` et `index.module.css`, puis integrer la section dans `Grayjay.Desktop.Web/src/pages/Settings/index.tsx`. Les trois steppers doivent etre lisibles, par pas de 5, avec total et sauvegarde invalide hors 100 %. **Verification** : `npm --prefix Grayjay.Desktop.Web run build` passe ; verification manuelle de la disposition desktop et de l'etat desactive.

## Phase 4 - Action de lecture et explication (P1)

- [ ] **T010** Integrer l'action `Create Smart Mix` dans `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx`. Sur une video analysee, elle charge les candidats en un appel local, lance une queue de videos completes avec `source: "smart-mix"` et reutilise l'overlay de contexte pour les trois raisons editoriales ; sans analyse exploitable, elle explique qu'il faut d'abord generer les Smart Chapters. **Verification** : test manuel du quickstart, dont absence de requete LLM/Routr pendant le clic.

## Phase 5 - Verification et revue (P2)

- [x] **T012** Mettre a jour `specs/007-smart-mix/implementation.md` avec les fichiers reels, commandes et resultats. Executer les tests Python, le test Node du composeur, le build frontend et le build serveur. **Resultat observable** : toutes les commandes sont vertes ou leurs avertissements preexistants sont consignes.
- [ ] **T013** Executer l'analyse SpecKit, corriger les findings non ambigus, puis relancer une analyse. Realiser une self-review `Minimalisme & Frugalite` et `Vertus LLM & Responsabilite Future`. **Verification** : aucun finding critique persistant et `tasks.md` est entierement coche avant de declarer la feature implementee.
- [ ] **T014** Integrer la branche dans `bluejay/all-features`, reconstruire avec `/Volumes/8TB2/50-repos-archives/11.Repositories/grayjay/build-bluejay-with-prs.sh` et preparer l'installation dans `/Applications/BlueJay.app` apres fermeture explicite de l'application par l'utilisateur. **Verification** : build complet reussi et installation uniquement apres le message `ferme` de l'utilisateur.
