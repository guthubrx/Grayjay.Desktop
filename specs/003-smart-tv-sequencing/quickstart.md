# Validation manuelle - Sequencement editorial Smart TV

## Prerequis

- BlueJay construit depuis `pr/smart-tv-sequencing` avec les branches Smart Chapters et playback-prefetch deja integrees.
- Au moins six chapitres Smart analyses, repartis sur deux videos ou createurs, dont plusieurs scores superieurs au seuil Smart TV.
- Une tuile Smart TV disponible sur Highlights.

## Tests automatises

Depuis `/Volumes/8TB2/50-repos-archives/11.Repositories/grayjay-smart-tv-sequencing/Grayjay.Desktop.Web` :

```bash
node --test src/utils/smartTvSequencer.test.ts
npm run build
```

## Parcours P1 - Mix equilibre

1. Ouvrir Highlights puis lancer `Global mix`.
2. Verifier que la session est creee avec les plafonds affiches et qu'elle contient des chapitres non joues.
3. Laisser la session avancer vers au moins trois passages.
4. Verifier dans l'overlay de contexte que chaque transition affiche `Same topic`, `Discover`, `New angle` ou `Best available`.
5. Quitter et relancer BlueJay, puis recalculer la meme tuile. Verifier que les chapitres deja joues ne reviennent pas.

## Parcours P2 - Reglages et stabilite

1. Dans Settings > Smart Analysis > Smart TV, choisir `Stay on topic`, sauvegarder, puis recalculer une nouvelle session.
2. Verifier que les passages de sujet proche sont preferes lorsque plusieurs candidats pertinents existent.
3. Choisir `Explore`, recalculer et verifier qu'un createur different est prefere lorsqu'il existe une transition pertinente.
4. Pendant la lecture d'une session, declencher un rafraichissement Home ou attendre une indexation Smart Chapters. Verifier que la file en cours ne change pas.

## Degradations attendues

- Sans Smart Chapters exploitables, aucune tuile ne lance une session vide et les carrousels Home continuent de fonctionner.
- Une session historique sans transitions reste lisible ; l'overlay ne doit pas echouer.
- Une video devenue indisponible est ignoree lors du recalcul et les candidats restants peuvent etre lus normalement.
