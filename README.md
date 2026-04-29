
> ## A personal fork — with the deepest respect for [Grayjay](https://grayjay.app/) and [FUTO](https://futo.org/)
>
> This repository is a personal fork of [`futo-org/Grayjay.Desktop`](https://github.com/futo-org/Grayjay.Desktop). I'm not affiliated with FUTO in any way — just a heavy daily user who happens to keep a couple of small local tweaks.
>
> Grayjay is, very plainly, the application I use the most after my terminal. The team has built something genuinely useful — and they did it the hard way: open code, plugin architecture, no telemetry, no dark patterns, real respect for users. That deserves to be said out loud, and to be supported.
>
> ### Why a fork, then?
>
> Honestly, just to scratch a few of my own itches without imposing them on anyone. The changes here are small quality-of-life tweaks (carousels under the player in theater mode, queue-consume on play, per-channel playback speed, hold-to-fast-forward, a `?` shortcuts overlay…). Nothing groundbreaking, nothing replacing what FUTO does — just personal stuff for my own usage.
>
> ### Why no flood of PRs to upstream?
>
> Out of **respect**. I don't want to look like someone trying to muscle their ideas into a project they didn't build, especially when several of my changes are still settling and might evolve. I'd rather let things mature here, then propose them upstream calmly, one focused PR at a time, only when they feel ready and clearly useful to others — never as a take-it-or-leave-it batch.
>
> If FUTO maintainers ever want to look at any of these branches, **of course** I'd be happy to share, refactor as they wish, or simply close PRs that don't fit the project's direction. The decision is theirs.
>
> ### Why is this repo public, then?
>
> Mostly so my own builds across machines stay reproducible, and so anyone curious can see the diff. **It is not** an attempt to redistribute Grayjay, fork the community, or compete in any way. If at any point this fork ever risked confusing users about what "Grayjay" is, or pulling attention away from the official project, I'd rather make this repository private — that's a real line for me.
>
> ### What you should actually use
>
> The official Grayjay Desktop, from the official site:
> - **Website**: [grayjay.app/desktop](https://grayjay.app/desktop/)
> - **Upstream repo**: [github.com/futo-org/Grayjay.Desktop](https://github.com/futo-org/Grayjay.Desktop) (mirror of the primary GitLab)
> - **FUTO**: [futo.org](https://futo.org/)
>
> If you're a FUTO maintainer reading this and any of the above feels off, please [open an issue](https://github.com/guthubrx/Grayjay.Desktop/issues) or DM me — I'll adjust gladly.
>
> Thank you for Grayjay. Sincerely.
>
> — *guthubrx*

---

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

