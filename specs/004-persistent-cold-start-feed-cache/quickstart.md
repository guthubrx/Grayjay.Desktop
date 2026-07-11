# Validation Manuelle

1. Lancer BlueJay avec un compte possedant des videos d'abonnements deja mises en cache.
2. Attendre qu'un rafraichissement normal se termine afin de laisser le snapshot etre ecrit.
3. Quitter BlueJay, couper temporairement le reseau ou ralentir les sources, puis relancer l'application.
4. Ouvrir Souscriptions : constater des vignettes locales avant la fin du rafraichissement et l'absence d'erreur visible.
5. Ouvrir Highlights : constater un hero ou une ligne de groupes issue des abonnements avant les resultats live.
6. Restaurer le reseau : verifier que les vignettes se mettent ensuite a jour.
7. Supprimer ou invalider le snapshot de test : verifier que les deux pages retombent sur leur chargement normal.
8. Verifier qu'une desinscription recente n'apparait pas dans le rendu bootstrap.
