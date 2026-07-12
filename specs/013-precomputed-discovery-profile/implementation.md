# Implementation 013

## Realisation

- Le premier passage Smart Chapters demande quatre axes de decouverte et les requetes par langue configuree.
- Le cache depend de la version du profil et de la liste de langues.
- Les ecritures normales et `--analysis-only` conservent les chapitres existants tout en persistant le profil quand il est valide.
- Les contrats C# et TypeScript ajoutent la propriete optionnelle `discoveryProfile`.

## Verification

- `python3 -m py_compile tools/generate_smart_chapters.py` : succes.
- `python3 -m unittest tools/test_generate_smart_chapters.py` : succes, 5 tests.
- `npx vite build` dans `Grayjay.Desktop.Web` : succes.
- `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj --no-restore` : succes, avec les avertissements preexistants du depot.

## Revue

- Le profil ne cree aucun appel reseau supplementaire : il partage le premier appel LLM deja realise pour les resumes.
- Les highlights historiques sans profil restent lisibles et aucun code non Smart ne depend du nouveau type.
- Un profil invalide est omis plutot que de bloquer la generation de chapitres; comme il n'est pas accepte par le cache, une analyse future peut le regenerer.
