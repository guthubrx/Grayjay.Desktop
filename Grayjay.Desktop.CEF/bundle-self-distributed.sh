#!/bin/bash

if [ -z "$1" ]; then
    echo "Error: Version number is required."
    echo "Usage: $0 <version>"
    exit 1
fi

VERSION=$1
APP_NAME_BASE="Grayjay"
BUNDLE_ID="com.futo.grayjay.desktop"
APPLE_ID="koen@futo.org"
TEAM_ID="2W7AC6T8T5"
APP_CERT="Developer ID Application: FUTO Holdings, Inc. (2W7AC6T8T5)"
KEYCHAIN_PROFILE="GRAYJAY_PROFILE"

bundle_libidn2_for_curlshim() {
    local ARCH="$1"
    local APP_NAME="$2"

    local APP_MACOS_DIR="$APP_NAME/Contents/MacOS"
    local CURLSHIM="$APP_MACOS_DIR/curlshim.dylib"
    local LIBCURLIMPERSONATE="$APP_MACOS_DIR/libcurl-impersonate.dylib"

    if [[ ! -f "$CURLSHIM" ]]; then
        echo "bundle_libidn2_for_curlshim: missing $CURLSHIM"
        exit 1
    fi

    if [[ ! -f "$LIBCURLIMPERSONATE" ]]; then
        echo "bundle_libidn2_for_curlshim: missing $LIBCURLIMPERSONATE"
        exit 1
    fi

    local BASE_TAG
    BASE_TAG="$(
      ruby -rjson -ropen-uri -e '
        data = JSON.parse(URI.open("https://formulae.brew.sh/api/formula/libidn2.json").read)
        keys = data.dig("bottle","stable","files").keys
        arm = keys.select { |k| k.start_with?("arm64_") }.map { |k| k.sub(/^arm64_/, "") }
        intel = keys.reject { |k| k.start_with?("arm64_") || k.include?("linux") }
        common = (arm & intel)

        order = %w[sequoia sonoma ventura monterey big_sur catalina mojave high_sierra sierra]
        chosen = (order & common).first || common.first
        puts chosen.to_s
      '
    )"

    if [[ -z "$BASE_TAG" ]]; then
        echo "ERROR: Could not find a common bottle tag for libidn2 (intel+arm64)."
        exit 1
    fi

    local BOTTLE_TAG=""
    case "$ARCH" in
        osx-arm64) BOTTLE_TAG="arm64_${BASE_TAG}" ;;
        osx-x64)   BOTTLE_TAG="${BASE_TAG}" ;;
        *)
            echo "bundle_libidn2_for_curlshim: unknown arch '$ARCH'"
            exit 1
            ;;
    esac

    echo "Bundling libidn2 for $ARCH using bottle-tag: $BOTTLE_TAG"

    local FORMULAE=("libidn2" "libunistring" "gettext" "zstd")

    local TMP
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' RETURN

    local COPIED=()

    for f in "${FORMULAE[@]}"; do
        echo "  fetching $f ($BOTTLE_TAG)"
        brew fetch --force --bottle-tag "$BOTTLE_TAG" "$f"

        local BOTTLE
        BOTTLE="$(brew --cache --bottle-tag "$BOTTLE_TAG" "$f")" 

        if [[ ! -f "$BOTTLE" ]]; then
            echo "ERROR: Expected bottle file not found: $BOTTLE"
            exit 1
        fi

        tar -xzf "$BOTTLE" -C "$TMP"

        while IFS= read -r -d '' lib; do
            local base
            base="$(basename "$lib")"
            if [[ -L "$lib" ]]; then
                cp -Pf "$lib" "$APP_MACOS_DIR/"
            else
                cp -f "$lib" "$APP_MACOS_DIR/"
            fi
            COPIED+=("$APP_MACOS_DIR/$base")
        done < <(find "$TMP" \( -type f -o -type l \) -path '*/lib/*.dylib*' -print0)
    done

    local uniq=()
    local seen=""
    for p in "${COPIED[@]}"; do
        if [[ "$seen" != *"|$p|"* ]]; then
            uniq+=("$p")
            seen="${seen}|$p|"
        fi
    done
    COPIED=("${uniq[@]}")

    fix_deps_to_loader_path() {
        local file="$1"
        local deps dep base
        deps="$(otool -L "$file" | tail -n +2 | awk '{print $1}')"
        while IFS= read -r dep; do
            [[ -z "$dep" ]] && continue

            # Never redirect Apple system libraries (prevents ABI / basename collisions)
            if [[ "$dep" == /usr/lib/* || "$dep" == /System/Library/* ]]; then
                continue
            fi

            base="$(basename "$dep")"
            if [[ -e "$APP_MACOS_DIR/$base" ]]; then
                install_name_tool -change "$dep" "@loader_path/$base" "$file"
            fi
        done <<< "$deps"
    }

    for dylib in "${COPIED[@]}"; do
        if [[ -f "$dylib" ]] && file "$dylib" | grep -q "Mach-O"; then
            install_name_tool -id "@loader_path/$(basename "$dylib")" "$dylib" || true
            fix_deps_to_loader_path "$dylib"
        fi
    done

    fix_deps_to_loader_path "$CURLSHIM"

    echo "curlshim deps now:"
    otool -L "$CURLSHIM" | sed 's/^/  /'

    fix_deps_to_loader_path "$LIBCURLIMPERSONATE"

    echo "libcurlshim deps now:"
    otool -L "$LIBCURLIMPERSONATE" | sed 's/^/  /'
}

build_sign_notarize() {
    ARCH=$1
    APP_NAME="${APP_NAME_BASE}_${ARCH}.app"
    APP_NAME_SIGNED="${APP_NAME_BASE}_${ARCH}-signed.app"
    PKG_NAME="${APP_NAME_BASE}_${ARCH}.pkg"
    ZIP_NAME="${APP_NAME_BASE}_${ARCH}.zip"

    echo "Building for architecture: $ARCH"

    # Build backend
    rm -rf bin/ obj/
    dotnet publish -r $ARCH -c Release -p:AssemblyVersion=1.$VERSION.0.0
    PUBLISH_PATH="bin/Release/net8.0/$ARCH/publish"
    mkdir -p "$PUBLISH_PATH/wwwroot"
    cp -r ../Grayjay.Desktop.Web/dist "$PUBLISH_PATH/wwwroot/web"

    echo "Creating the app bundle..."
    rm -rf "$APP_NAME"
    rm -rf "$APP_NAME_SIGNED"
    mkdir -p "$APP_NAME/Contents/MacOS"
    mkdir -p "$APP_NAME/Contents/Resources"
    cp -a Info/Info.plist "$APP_NAME/Contents/Info.plist"
    cp -a Resources/MacOS/PkgInfo "$APP_NAME/Contents"

    cp -a "$PUBLISH_PATH/Grayjay" "$APP_NAME/Contents/MacOS"
    cp -a "$PUBLISH_PATH/libe_sqlite3.dylib" "$APP_NAME/Contents/MacOS"
    cp -a "$PUBLISH_PATH/libsodium.dylib" "$APP_NAME/Contents/MacOS"
    cp -a "$PUBLISH_PATH/ClearScriptV8.$ARCH.dylib" "$APP_NAME/Contents/MacOS"
    cp -a "$PUBLISH_PATH/dotcefnative.app/Contents/MacOS/dotcefnative" "$APP_NAME/Contents/MacOS"
    cp -a "$PUBLISH_PATH/cef/steam_appid.txt" "$APP_NAME/Contents/Resources"
    cp -a "../Grayjay.ClientServer/deps/${ARCH}/ffmpeg" "$APP_NAME/Contents/MacOS"
    chmod +x "$APP_NAME/Contents/MacOS/ffmpeg"
    cp -a "../Grayjay.ClientServer/deps/${ARCH}/libcurl-impersonate.dylib" "$APP_NAME/Contents/MacOS"
    cp -a "../Grayjay.ClientServer/deps/${ARCH}/curlshim.dylib" "$APP_NAME/Contents/MacOS"
    bundle_libidn2_for_curlshim "$ARCH" "$APP_NAME"
    cp -a "../Grayjay.ClientServer/deps/${ARCH}/libsteam_api.dylib" "$APP_NAME/Contents/MacOS"
    cp -a "$PUBLISH_PATH/libfcast_sender_sdk.dylib" "$APP_NAME/Contents/MacOS"
    cp -a "$PUBLISH_PATH/wwwroot" "$APP_NAME/Contents/Resources/wwwroot"

    cp -a "$PUBLISH_PATH/dotcefnative.app/Contents/Frameworks" "$APP_NAME/Contents/Frameworks"
    cp -a Resources/MacOS/Keychain.framework "$APP_NAME/Contents/Frameworks/Keychain.framework"
    cp -a "$PUBLISH_PATH/dotcefnative.app/Contents/Resources/." "$APP_NAME/Contents/Resources"
    cp -a Resources/MacOS/MainMenu.xib "$APP_NAME/Contents/Resources/MainMenu.xib"
    rm -rf "$APP_NAME/Contents/Resources/English.lproj"
    cp -a Resources/MacOS/English.lproj "$APP_NAME/Contents/Resources/English.lproj"
    cp -a Resources/MacOS/grayjay.icns "$APP_NAME/Contents/Resources/shared.icns"

    cp -a Info/Info-Helper.plist "$APP_NAME/Contents/Frameworks/dotcefnative Helper.app/Contents/Info.plist"
    cp -a Info/Info-Helper-Alerts.plist "$APP_NAME/Contents/Frameworks/dotcefnative Helper (Alerts).app/Contents/Info.plist"
    cp -a Info/Info-Helper-GPU.plist "$APP_NAME/Contents/Frameworks/dotcefnative Helper (GPU).app/Contents/Info.plist"
    cp -a Info/Info-Helper-Plugin.plist "$APP_NAME/Contents/Frameworks/dotcefnative Helper (Plugin).app/Contents/Info.plist"
    cp -a Info/Info-Helper-Renderer.plist "$APP_NAME/Contents/Frameworks/dotcefnative Helper (Renderer).app/Contents/Info.plist"

    bash ./sign-macos.sh "$APP_NAME"

    rm -f "Grayjay.Desktop-$ARCH.zip"
    rm -rf "Grayjay.app"
    mv "Grayjay_$ARCH-signed.app" "Grayjay.app"
    /usr/bin/ditto -c -k --sequesterRsrc --keepParent "Grayjay.app" "Grayjay.Desktop-$ARCH.zip"
    if [ $? -ne 0 ]; then
        echo "Failed to create zip Grayjay.Desktop-$ARCH.zip"
        exit 1
    fi
}

# Build front-end
cd ../Grayjay.Desktop.Web
npm install
rm -rf dist
npm run build
cd ../Grayjay.Desktop.CEF

build_sign_notarize "osx-x64"
build_sign_notarize "osx-arm64"

echo "All builds complete."
