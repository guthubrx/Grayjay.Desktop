
# Grayjay Desktop
Grayjay is a multi-platform media application that allows you to watch content from multiple platforms in a single application. Using an extendable plugin system developers can make new integrations with additional platforms. Plugins are cross-compatible between Android and Desktop.

FUTO is an organization dedicated to developing, both through in-house engineering and investment, technologies that frustrate centralization and industry consolidation.

For more elaborate showcase of features and downloads, check out the website.
Website: https://grayjay.app/desktop/

**NOTE for MacOS Users:** Our Apple signing/notarization is not entirely done yet, thus you have to run the following command once to run the application.
```
xattr -c ./Grayjay_osx-arm64.app

```
or
```
xattr -c ./Grayjay_osx-x64.app
```


### Home
Here you find the recommendations found on respective applications.

![Home](https://gitlab.futo.org/videostreaming/Grayjay.Desktop/-/raw/master/imgs/home.PNG)


### Sources
Here you install new source plugins, change which sources are used, or configure your source behavior.

![Sources](https://gitlab.futo.org/videostreaming/Grayjay.Desktop/-/raw/master/imgs/sources.PNG)

### Details
Here is an example of what the video player looks like, we support various views so that you can view the video how you like. By default we show a theater view that becomes smaller when reading comments, while not entirely hiding it.

|  |  |
|--|--|
| ![Details 1](https://gitlab.futo.org/videostreaming/Grayjay.Desktop/-/raw/master/imgs/detail1.PNG) | ![Details 2](https://gitlab.futo.org/videostreaming/Grayjay.Desktop/-/raw/master/imgs/detail2.PNG) |

### Downloads
Grayjay also supports downloads, allowing offline viewing of videos, as well as exporting them to files usable outside of Grayjay.

![Downloads](https://gitlab.futo.org/videostreaming/Grayjay.Desktop/-/raw/master/imgs/download.PNG)

### Channel
![Channels](https://gitlab.futo.org/videostreaming/Grayjay.Desktop/-/raw/master/imgs/channel.PNG)


### More..
Grayjay Desktop has way more features than this, but for that, check out the website or download it yourself!


---

## BlueJay fork — additional features

> This fork tracks Grayjay Desktop upstream and adds the features listed below. Everything else behaves like upstream Grayjay. Each feature is also kept as a standalone branch for potential upstream contribution.

### Home

- **Highlights home page** — a hero banner mixing your subscription videos with platform recommendations, plus content carousels. Switch between *Highlights* and the classic layout in *Settings → Home*.
- **Smarter Continue Watching** — finished videos (watched ≥ 90 %) and dismissed items are excluded from the carousel.

### Player

- **Binge watch mode** — start a binge for a channel from its context menu (`...`); the queue refills dynamically as you watch, with a Next-Up overlay (also visible in fullscreen and window-maximized modes).
- **Queue consumed on play** — queued items are removed as they start playing.
- **Recommendations as a horizontal carousel** in theater mode (toggle).
- **Per-channel playback speed** — a speed override remembered per channel.
- **Hold to fast-forward** at a configurable speed (long press), with a speed chip overlay.

### Video & navigation

- **In-app description links** — links in a video description (YouTube and other plugin-supported platforms) open the matching content *inside* the app, at the right timestamp when the URL carries one, instead of opening an external browser. Unsupported links still open in the browser.
- **Cmd/Ctrl+click opens a new window** — for videos, channels and playlists, including description links.
- **Subscription menu on the video page** — subscribe/unsubscribe from the video detail view.
- **Open channel minimizes the player** — opening a channel from a content menu minimizes the current video instead of closing it.
- **Add a channel to a subscription group** from the channel context menu.

### Search

- **Multi-sort with priority order** — client-side sorting of results by several criteria.

### Subscriptions

- **Multi-select subscription groups** with batch copy/move actions.
- **Local recommendations** derived from your own subscriptions.

### Keyboard

- **Shortcuts overlay** — press `?` to display all shortcuts.
- **Theater toggle** (`t`), **playback speed** (`<` / `>`), reload Home/Subscriptions, `Esc` to exit window-maximized mode.
- **Customizable shortcuts**.

---

## Fork BlueJay — fonctionnalités additionnelles

> Ce fork suit Grayjay Desktop en amont et ajoute les fonctionnalités ci-dessous. Tout le reste se comporte comme Grayjay original. Chaque fonctionnalité est aussi conservée sur une branche dédiée en vue d'une éventuelle contribution upstream.

### Accueil

- **Page d'accueil Highlights** — une bannière héro mêlant les vidéos de vos abonnements et les recommandations des plateformes, plus des carrousels de contenu. Bascule entre *Highlights* et la disposition classique dans *Paramètres → Accueil*.
- **Continue Watching amélioré** — les vidéos terminées (vues ≥ 90 %) et les éléments masqués sont exclus du carrousel.

### Lecteur

- **Mode binge watch** — démarrez un binge pour une chaîne depuis son menu contextuel (`...`) ; la file se réalimente dynamiquement à mesure que vous regardez, avec une superposition Next-Up (visible aussi en plein écran et en fenêtre maximisée).
- **File consommée à la lecture** — les éléments en file sont retirés dès qu'ils commencent.
- **Recommandations en carrousel horizontal** en mode théâtre (activable).
- **Vitesse de lecture par chaîne** — une vitesse mémorisée pour chaque chaîne.
- **Avance rapide maintenue** à une vitesse configurable (appui long), avec une pastille de vitesse.

### Vidéo & navigation

- **Liens de description ouverts dans l'app** — les liens d'une description vidéo (YouTube et autres plateformes gérées par les plugins) ouvrent le contenu correspondant *dans* l'application, au bon timestamp si l'URL en contient un, au lieu d'ouvrir un navigateur externe. Les liens non gérés ouvrent toujours le navigateur.
- **Cmd/Ctrl+clic ouvre une nouvelle fenêtre** — pour les vidéos, chaînes et playlists, y compris les liens de description.
- **Menu d'abonnement sur la page vidéo** — s'abonner/se désabonner depuis la vue détaillée.
- **Ouvrir une chaîne minimise le lecteur** — ouvrir une chaîne depuis un menu de contenu minimise la vidéo en cours au lieu de la fermer.
- **Ajouter une chaîne à un groupe d'abonnements** depuis le menu contextuel de la chaîne.

### Recherche

- **Tri multiple avec ordre de priorité** — tri côté client des résultats selon plusieurs critères.

### Abonnements

- **Sélection multiple de groupes d'abonnements** avec actions de copie/déplacement en lot.
- **Recommandations locales** dérivées de vos propres abonnements.

### Clavier

- **Aperçu des raccourcis** — appuyez sur `?` pour afficher tous les raccourcis.
- **Bascule théâtre** (`t`), **vitesse de lecture** (`<` / `>`), rechargement Accueil/Abonnements, `Échap` pour quitter le mode fenêtre maximisée.
- **Raccourcis personnalisables**.

---

## NixOS config

Below a NixOS configuration in case you like to use Grayjay on NixOS.
```
(pkgs.buildFHSEnv {
  name = "fhs";
  targetPkgs = _: with pkgs; [
    libz
    icu
    libgbm
    openssl # For updater

    xorg.libX11
    xorg.libXcomposite
    xorg.libXdamage
    xorg.libXext
    xorg.libXfixes
    xorg.libXrandr
    xorg.libxcb

    gtk3
    glib
    nss
    nspr
    dbus
    atk
    cups
    libdrm
    expat
    libxkbcommon
    pango
    cairo
    udev
    alsa-lib
    mesa
    libGL
    libsecret
  ];
}).env
```

