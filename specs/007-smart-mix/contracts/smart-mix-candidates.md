# Contrat local : `GET /highlights/MixCandidates`

## Intention

Retourner en un appel local la projection compacte de tous les highlights qui peuvent participer a un Smart Mix. Ce contrat evite une lecture HTTP par video dans le navigateur.

## Reponse

```json
[
  {
    "videoUrl": "https://www.youtube.com/watch?v=example",
    "updatedAt": "2026-07-12T10:00:00Z",
    "video": { "name": "...", "url": "..." },
    "mixProfile": {
      "topics": ["artificial intelligence agents"],
      "relatedTopics": ["developer productivity"],
      "angleLabels": ["risk assessment"]
    },
    "globalSummary": "...",
    "theses": [{ "id": 1, "statement": "..." }],
    "averageScore": 0.82,
    "topScore": 0.94,
    "interestingDuration": 912,
    "segments": [
      {
        "start": 312,
        "end": 508,
        "title": "...",
        "summary": "...",
        "score": 0.94,
        "thesisId": 1
      }
    ]
  }
]
```

## Garanties

- Les tableaux peuvent etre vides et les champs de profil optionnels pour conserver la compatibilite.
- La reponse ne contient pas le transcript brut ni les sous-titres.
- Les entrees sans URL video ne sont pas retournees.
- Le tri est stable : date de mise a jour decroissante, puis URL.
