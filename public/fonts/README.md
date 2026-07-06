# Polices de marque — Café Brume

Polices **sous licence commerciale**, fournies par le café, présentes ici en `.woff2` :

| Rôle              | Police    | Fichier              |
| ----------------- | --------- | -------------------- |
| Titres            | Anaktoria | `Anaktoria.woff2`    |
| Texte & chiffres  | Gotham Book   | `Gotham-Book.woff2`   |
| Gras / labels     | Gotham Medium | `Gotham-Medium.woff2` |

Branchées dans `src/app/globals.css` (`@font-face` + `--font-title` / `--font-body`).
Converties depuis les `.otf`/`.ttf` d'origine via `fonttools` (flavor woff2).

⚠️ **Licence** : Anaktoria et Gotham sont sous licence commerciale. Les héberger pour le site
du café est un usage normal, mais les fichiers sont committés dans ce dépôt (nécessaire au
déploiement) → **garder le dépôt privé**. Ne pas redistribuer les fichiers hors de ce projet.
