# Journal d'implementation : Smart Prefill Scheduler

**Statut** : Pret a installer  
**Branche** : `pr/015-smart-prefill-scheduler`  
**Date** : 2026-07-13

## Livraison

- Le scheduler Highlights existant porte desormais les priorites, une source, un cooldown de quinze minutes et une limite de travailleurs configurable entre 1 et 32.
- Les demandes `GeneratePrefill` et `ConfigurePrefill` reutilisent le contrat de generation existant, les sous-titres materialises et les notifications WebSocket.
- Les preferences Smart Prefill sont opt-in, persistantes et separees de Smart Search : activation, limite LLM, nombre de candidats, Smart Mix, prochaine video, Smart TV, Watch now et groupes.
- Les candidats Smart Mix enrichis remontent dans la portion non lue grace au score d'interet deja utilise par les recommandations.
- Le prefill BlueJay est strictement limite aux videos disposant d'un VTT exploitable via le plugin : sans VTT, le job est marque `skipped` avant toute commande externe, donc sans yt-dlp ni Whisper.
- Les nouveaux reglages bornent la profondeur de lecture anticipee et la file globale. La video courante prime, suivie de la prochaine, puis des sources de decouverte moins urgentes.
- Le passage regulier de precompute ne lance plus Whisper. Un LaunchAgent nocturne distinct ne peut utiliser Whisper que pour les groupes ou chaines explicitement declares dans `/Users/moi/Nextcloud/10.Scripts/grayjay/precompute.env`.
- Le build complet produit `dist/BlueJay.app` sans modifier l'application ouverte.

## Verification

- [x] `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj --no-restore`
- [x] `npm run build` dans `Grayjay.Desktop.Web`
- [x] Tests Node bundles : `smartPrefill.test.ts` et `smartDiscovery.test.ts`
- [x] Test Node direct : `recommendationRanking.test.ts`
- [x] `./build-bluejay-clean.sh` puis `./build-bluejay-clean.sh --skip-frontend`
- [x] `plutil -lint dist/BlueJay.app/Contents/Info.plist`
- [x] `git diff --check`
- [x] `zsh -n` des scripts de precompute et `python3 -m py_compile refresh-highlights.py`
- [x] `launchctl print` du LaunchAgent nocturne : programme cible, planification a 02:15, etat inactif jusqu'au prochain passage.

## Limites connues

- `npx tsc --noEmit` reste en echec sur de nombreux diagnostics preexistants du projet et de ses dependances ; le build Vite de production est vert.
- L'application `/Applications/BlueJay.app` est encore ouverte. Le paquet final n'est donc pas installe ni teste interactivement dans cette session.
