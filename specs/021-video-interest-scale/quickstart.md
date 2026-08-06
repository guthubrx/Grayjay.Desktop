# Verification rapide

1. Installer les dependances frontend dans `Grayjay.Desktop.Web` si elles ne sont pas deja presentes.
2. Executer les tests de `highlightInterest.test.ts` avec le runner TypeScript disponible dans le projet.
3. Lancer `npm run build` depuis `Grayjay.Desktop.Web`.
4. Ouvrir une video qui possede des Smart Chapters et verifier dans Smart Analysis une note telle que `3,5 / 5`, son libelle francais et cinq emplacements d'etoiles dont une demi-etoile.
5. Ouvrir Highlights et verifier la meme presentation dans le hero et son overlay d'information.
6. Verifier qu'un changement de page, de Smart TV ou de filtre de chapitre ne modifie pas les scores des chapitres ou l'ordre de recommandation.
