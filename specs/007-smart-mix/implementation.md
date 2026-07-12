# Journal d'implementation : Smart Mix inspire par une video

**Feature** : `007-smart-mix`  
**Branche** : `007-smart-mix`  
**Statut** : In Progress - validation integree et integration Git restantes.

## Implementation realisee

- Le generateur Smart Chapters ecrit desormais un `mixProfile` optionnel : sujets, sujets connexes et angles, sous forme de labels canoniques anglais et bornes.
- Le serveur expose une projection locale compacte via `GET /highlights/MixCandidates`. Elle contient seulement les metadonnees video, le profil, les scores, les theses et les chapitres explicatifs.
- `smartMixComposer.ts` construit une file fixe de videos completes avec les proportions configurees, la preference non-vu, la variete de createur, la deduplication et une raison editoriale par video.
- La section Settings > Smart Mix persiste trois pourcentages par pas de 5, valides uniquement lorsque leur total vaut 100.
- Le menu video propose `Create Smart Mix`. Sans analyse, il explique qu'il faut d'abord generer les Smart Chapters. Avec une analyse, il appelle uniquement les endpoints locaux, lance une queue `smart-mix` et reutilise l'overlay de contexte existant.
- L'overlay affiche la raison editoriale et le titre du chapitre de la video candidate qui a motive la selection, sans tronquer la lecture de la video complete.

## Verifications executees

```text
python3 -m unittest tests/unit/test_007_smart_mix_profile.py tests/unit/test_002_translated_subtitles.py tests/unit/test_006_selective_subtitle_translation.py
15 tests passed

python3 -m py_compile tools/generate_smart_chapters.py
passed

node --experimental-strip-types --test Grayjay.Desktop.Web/src/utils/smartMixSettings.test.ts Grayjay.Desktop.Web/src/utils/smartMixComposer.test.ts
12 tests passed

dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj --no-restore -v:q
0 warnings, 0 errors

npm --prefix Grayjay.Desktop.Web run build
passed
```

Le build frontend signale des avertissements preexistants hors perimetre dans `OverlayDownloadDialog` et des declarations CSS prefixees par `#`. Il signale aussi la taille historique du bundle principal. Aucun avertissement n'est introduit par Smart Mix.

## Validations restantes

1. Ouvrir Settings > Smart Mix dans l'application construite et verifier la disposition desktop, les pas de 5 et le bouton Save desactive hors 100 %.
2. Depuis une video analysee, lancer `Create Smart Mix`, verifier la file fixe, les raisons `Same topic` / `Broaden the topic` / `New angle`, et l'absence de trafic Routr ou plateforme pendant le clic.
3. Apres validation, creer le commit de la branche de PR, l'integrer dans `bluejay/all-features`, puis lancer `/Volumes/8TB2/50-repos-archives/11.Repositories/grayjay/build-bluejay-with-prs.sh`. L'installation dans `/Applications/BlueJay.app` attend la fermeture explicite de l'application.
