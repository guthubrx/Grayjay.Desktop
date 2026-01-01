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

    if [[ ! -f "$CURLSHIM" ]]; then
        echo "bundle_libidn2_for_curlshim: missing $CURLSHIM"
        exit 1
    fi

    local BREW_ARCH=""
    case "$ARCH" in
        osx-arm64) BREW_ARCH="arm64" ;;
        osx-x64)   BREW_ARCH="x86_64" ;;
        *)
            echo "bundle_libidn2_for_curlshim: unknown arch '$ARCH'"
            exit 1
            ;;
    esac

    echo "Bundling libidn2 (+ deps) for $ARCH using Homebrew bottles..."

    local FETCH_OUT
    FETCH_OUT="$(brew fetch --deps --force --force-bottle --arch "$BREW_ARCH" libidn2 2>&1 || true)"

    mapfile -t BOTTLES < <(echo "$FETCH_OUT" | awk '/Downloaded to: / {print $3}' | grep -E '\.bottle(\.[0-9]+)?\.tar\.gz$' || true)

    if [[ "${#BOTTLES[@]}" -eq 0 ]]; then
        echo "brew fetch output:"
        echo "$FETCH_OUT"
        echo "ERROR: Did not find any bottle .tar.gz files to extract."
        exit 1
    fi

    local TMP
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' RETURN

    for b in "${BOTTLES[@]}"; do
        tar -xzf "$b" -C "$TMP"
    done

    while IFS= read -r -d '' f; do
        cp -a "$f" "$APP_MACOS_DIR/"
    done < <(find "$TMP" \( -type f -o -type l \) -path '*/lib/*.dylib*' -print0)

    fix_deps_to_loader_path() {
        local file="$1"
        local deps
        deps="$(otool -L "$file" | tail -n +2 | awk '{print $1}')"
        while read -r dep; do
            [[ -z "$dep" ]] && continue
            local base
            base="$(basename "$dep")"
            if [[ -e "$APP_MACOS_DIR/$base" ]]; then
                install_name_tool -change "$dep" "@loader_path/$base" "$file"
            fi
        done <<< "$deps"
    }

    for dylib in "$APP_MACOS_DIR"/*.dylib*; do
        [[ -e "$dylib" ]] || continue
        if file "$dylib" | grep -q "Mach-O"; then
            install_name_tool -id "@loader_path/$(basename "$dylib")" "$dylib" || true
            fix_deps_to_loader_path "$dylib"
        fi
    done

    fix_deps_to_loader_path "$CURLSHIM"

    echo "Bundled dylibs now in: $APP_MACOS_DIR"
    echo "Sanity check:"
    otool -L "$CURLSHIM" | sed 's/^/  /'
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
