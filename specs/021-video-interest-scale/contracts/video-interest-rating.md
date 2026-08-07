# Contrat UI - notation d'interet video

## Entree

Le rendu recoit un signal d'interet video deja calcule :

```text
stars: 0.5 | 1.0 | 1.5 | ... | 5.0
label: libelle francais du palier
```

Lorsqu'un profil editorial valide est present, le score source est derive de ses dimensions stables. Sinon, la conversion historique fondee sur les resumes de chapitres reste disponible.

## Sortie observable

- Exactement cinq emplacements d'etoile, avec zero ou plusieurs etoiles pleines, au plus une demi-etoile et les etoiles vides restantes.
- La note textuelle utilise la virgule francaise : `3,5 / 5`.
- Le nom accessible combine la note et le libelle : `3,5 étoiles sur 5 - Très intéressante`.
- Le composant ne declenche aucun chargement, aucune requete et aucun recalcul de Smart Chapters.

## Compatibilite

- Toute ancienne valeur entiere reste rendable.
- Une valeur invalide est bornee dans l'intervalle visible plutot que de casser le layout.
- La date de publication et la fraicheur n'alterent jamais la note affichee.
