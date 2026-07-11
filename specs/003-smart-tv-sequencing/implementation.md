# Journal d'implementation - Sequencement editorial Smart TV

## Contexte

- Branche : `pr/smart-tv-sequencing`
- Perimetre : sessions fixes uniquement ; aucun mode continu ni regeneration Smart Chapters.
- Point de depart : `capSmartTvEntries` dans Home selectionne les chapitres principalement par score. Les sessions, l'historique de chapitres et les reglages Smart TV existent deja.

## T001 - Verification de perimetre

- `.gitignore` couvre deja les sorties de build et ne requiert pas de changement pour cette feature.
- `Grayjay.Desktop.Web/package.json` ne contient aucun runner de test dedie ; Node 26 fournit le runner et l'effacement de types necessaires au test pur sans dependance nouvelle.

## T002 - Journal initialise

- Ce fichier recevra les resultats des tests rouges, les validations de build, le protocole manuel et la self-review finale.

## T003 - Tests rouges

- Commande : `node --test src/utils/smartTvSequencer.test.ts` depuis `Grayjay.Desktop.Web`.
- Resultat attendu : echec `ERR_MODULE_NOT_FOUND` sur `smartTvSequencer.ts`, car le module n'existait pas encore.
- Le warning Node sur le type de module du package est sans effet sur le test et ne justifie pas une modification globale de `package.json`.

## T004 - Sequenceur pur

- `src/utils/smartTvSequencer.ts` applique les contraintes dures avant les preferences de mix, puis conserve un seul ordre deterministe.
- Test vert : `node --test src/utils/smartTvSequencer.test.ts`, 8 sur 8.
- Tentative de suppression du warning avec `--experimental-default-type=module` abandonnee : Node 26.5.0 ne reconnait pas cette option. Le comportement de test reste correct sans cette option.

### Self-review Article XIX/XX

- **Pourquoi cette solution est necessaire** : le tri actuel par score ne porte ni une intention de transition ni des penalites de createur/sujet testables.
- **Pourquoi elle est plus simple** : une fonction pure locale reutilise les candidats existants. Elle evite un endpoint, un store global et tout appel IA au recalcul.
- **Hypotheses prises** : la proximite lexicale est une approximation explicable, pas une comprehension semantique complete ; les labels retombent sur `Best available` en cas de preuve faible.
- **Verifications realisees** : tests rouges puis 8 tests verts, relecture complete du module et `git diff --check` sur les fichiers de fondation.
- **Non verifie** : qualite editoriale sur le corpus reel BlueJay, reservee au protocole manuel final.
- **Code supprime ou evite** : aucun package de test, aucun client LLM, aucun service de recommandation.
- **Complexite ajoutee et justification** : un module de 250 lignes environ, justifie par les contraintes croisées et la necessite de les tester hors du composant Home.

## T005 a T011 - Integration Smart TV, reglages et overlay

- Home transforme les chapitres analyses en candidats editoriaux a partir des donnees existantes : score, titre, resume, these, createur, date et groupe source quand il existe.
- Le calcul remplace le capping par score seul, mais conserve l'historique de chapitres, les plafonds de duree/videos/chapitres et le snapshot de session fixe.
- Les dropdowns `Editorial mix` et `Creator variety` sont ajoutes au groupe Smart TV existant. Les valeurs absentes retombent vers `Balanced` et `Light`.
- La file transporte une raison de transition optionnelle et l'overlay existant affiche par exemple `Global mix - Same topic`. Les sessions historiques utilisent `Best available` apres leur premiere entree, sans changer les files non Smart TV.
- Les candidates de groupe portent leur provenance seulement lorsque cette information est disponible ; aucune taxonomie globale n'est inventee.

### Verifications techniques

- `node --test src/utils/smartTvSequencer.test.ts` : 9 sur 9.
- `npm run build` dans `Grayjay.Desktop.Web` : succes. Les warnings Vite sur `OverlayDownloadDialog`, CSS et chunk size sont preexistants.
- `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj --no-restore` : succes, 0 erreur, 0 avertissement apres initialisation des sous-modules dans ce worktree.
- `npx tsc --noEmit` : echoue sur des erreurs preexistantes reparties dans le frontend. Le seul signal initial sur `smartTvSequencer.test.ts` a ete corrige ; le filtrage final ne remonte plus aucun fichier Smart TV ajoute par cette feature.

### Self-review Article XIX/XX

- **Pourquoi cette solution est necessaire** : elle rend les sessions fixes lisibles et controlees, alors que le capping precedent ne savait qu'ordonner par score et repetition de video.
- **Pourquoi elle est plus simple** : elle prolonge les proprietaires existants de session, reglages, file et overlay. Aucun endpoint, stockage, worker ou composant d'ecran nouveau.
- **Hypotheses prises** : une similarite lexicale et des indices de changement d'angle sont suffisants pour une premiere selection prudente. Les labels sont des explications, pas des assertions semantiques.
- **Verifications realisees** : test-first, 9 tests du sequenceur, build Vite, build ClientServer, `git diff --check`, relecture du diff de tous les fichiers produits.
- **Non verifie** : qualite editoriale et lisibilite de l'overlay sur le corpus reel, a faire sur une build BlueJay installee.
- **Code supprime ou evite** : l'ancien capping local par score est remplace ; aucun moteur de recommandation parallele, appel IA, schema Smart Chapters ou package de test n'est ajoute.
- **Complexite ajoutee et justification** : deux dropdowns et un contrat de transition optionnel sont necessaires pour rendre les arbitrages inspectables et reversibles.
