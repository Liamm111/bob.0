# Polices de marque — Café Brume

L'app utilise deux polices **sous licence** (à fournir par le café, qui doit en
détenir la licence). Déposez les fichiers `.woff2` ici, avec ces noms exacts :

| Rôle              | Police    | Fichier attendu         |
| ----------------- | --------- | ----------------------- |
| Titres            | Anaktoria | `Anaktoria.woff2`       |
| Texte & chiffres  | Gotham    | `Gotham-Book.woff2`     |
| Texte gras        | Gotham    | `Gotham-Medium.woff2`   |

Le chargement est déjà branché dans `src/app/globals.css` (`@font-face` +
variables `--font-title` / `--font-body`). **Tant que les fichiers ne sont pas
là, l'app retombe automatiquement** sur des polices serif/sans proches — aucune
erreur, aucun blocage de build.

Formats acceptés : `.woff2` (recommandé). Si vous n'avez que du `.otf`/`.ttf`,
convertissez-les en `.woff2` (ex. `fonttools`, ou un convertisseur en ligne) ou
adaptez l'`src:` du `@font-face` dans `globals.css`.
