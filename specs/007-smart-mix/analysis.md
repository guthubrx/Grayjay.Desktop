# Analyse croisee des artefacts

**Tour** : 2026-07-12  
**Portee** : `spec.md`, `plan.md`, `data-model.md`, `contracts/`, `reuse-audit.md`, `tasks.md` et code existant lu.

## Findings et corrections appliquees

| Severite | Finding | Correction |
|---|---|---|
| Moyen | Le plan prevoyait une extension de `VideoQueueItemMeta` alors que `source` est deja libre et que les raisons editoriales existent deja. | Tache supprimee ; le mix reutilise le contrat de file sans modification. |
| Moyen | Les limites Smart TV etaient definies localement dans `Home`, ce qui aurait pousse le lecteur a recopier la meme table de conversion. | Ajout de `T007a` et de l'extraction `smartTvSettings.ts`, justifiee par deux usages reels. |
| Faible | Le terme `point de depart` pouvait faire croire que le mix tronquerait des videos. | Spec corrigee : la video est lue complete ; le chapitre ne sert qu'a expliquer la pertinence. |
| Faible | La specification parlait de reseau au sens large alors que le frontend appelle le serveur local. | Le contrat et le plan precisent desormais l'absence d'appel externe, LLM ou plateforme dans le chemin interactif. |

## Coherence confirmee

- Les trois proportions, leurs defauts et leur invariant `100 %` sont identiques dans la spec, le modele et les taches.
- Le profil `mixProfile` est optionnel dans chaque artefact et le repli ancien est specifie.
- La projection bulk est coherente avec l'interdiction de N+1 et le contrat documente.
- Le lecteur complet est coherent avec l'analogie Deezer et avec les metadonnees de chapitre explicatives.
- Aucun nouveau service externe, schema de donnees utilisateur ou dependance n'est introduit.

## Resultat

Aucun finding critique ou bloquant. Les corrections non ambigues ont ete appliquees avant implementation.

## Relecture post-implementation

**Tour** : 2026-07-12  
**Portee** : implementation de `007-smart-mix`, tests et builds.

| Severite | Finding | Correction | Verification |
|---|---|---|---|
| Moyen | La limite de duree pouvait etre depassee une fois par categorie editoriale. | Le composeur n'autorise un premier depassement que pour la toute premiere video de la session. | Test `does not exceed the target duration once another video is selected`. |
| Moyen | La variete de createur n'etait appliquee qu'entre les categories. | La selection favorise maintenant un createur non encore represente a chaque choix, y compris dans une meme categorie. | Test `keeps creator variety within one editorial category`. |
| Faible | Les URLs YouTube equivalentes pouvaient etre considerees comme non vues. | Le jeu d'URLs deja vues contient aussi la cle normalisee de chaque URL. | Test `recognizes watched YouTube videos with an equivalent URL`. |
| Faible | La validation des pourcentages etait dupliquee entre l'etat et le formulaire. | Extraction d'un utilitaire pur teste, reutilise par les deux couches. | Tests `smartMixSettings.test.ts`. |

## Self-review : minimalisme et responsabilite future

- Aucun package, service externe, table ou index vectoriel n'est ajoute. Le clic utilise une projection HTTP locale unique et l'historique local, puis un composeur pur sans I/O.
- Le seul profil supplementaire est optionnel et compact ; les anciens highlights se degradent vers resume, theses et chapitres deja presents.
- Les limites existantes Smart TV sont extraites une seule fois plutot que reproduites dans le lecteur.
- La file existante et l'overlay existant sont reutilises ; le comportement standard, Smart TV et SponsorBlock n'est pas modifie.
- Les validations visuelles et le parcours runtime restent a effectuer apres integration de la branche dans une application BlueJay construite.

## Resultat post-implementation

Aucun finding critique persistant. Les risques residuels sont limites a la validation manuelle de l'interface et de la lecture integree.
