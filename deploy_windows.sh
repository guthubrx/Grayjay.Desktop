#!/bin/bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

targetDir="/var/www/html/Apps"

if [[ "$3" != "" ]]; then
   appName="$3"
else
   echo -n "AppName:"
   read appName
fi

SSH_KEY_PRIV_FILE="$(mktemp "${TMPDIR:-/tmp}/deploy_key.XXXXXXXX")"
cleanup() { rm -f "$SSH_KEY_PRIV_FILE"; }
trap cleanup EXIT INT TERM
printf '%s' "$SSH_KEY_PRIV" | base64 -d > "$SSH_KEY_PRIV_FILE"
chmod 600 "$SSH_KEY_PRIV_FILE"

SSH_CMD="ssh -i $SSH_KEY_PRIV_FILE -o StrictHostKeyChecking=no"
SCP_CMD="scp -i $SSH_KEY_PRIV_FILE -o StrictHostKeyChecking=no"

if [[ "$1" != "" ]]; then
   version="$1"
else
   echo -n "Version:"
   read version
fi

if [[ "$2" != "" ]]; then
  server="$2"
else
  echo -n "Server:"
  read server
fi

printf "Version to deploy: $version\n"
printf "To server: $server\n"


# Build front-end
cd Grayjay.Desktop.Web
npm install
rm -rf dist
npm run build
cd ..

runtimes=("win-x64")

# Loop over each runtime
rm -rf Grayjay.Desktop.CEF/bin/Release
for runtime in "${runtimes[@]}"
do
    echo "Building for $runtime"

    # Publish CEF
    cd Grayjay.Desktop.CEF
    dotnet publish -r $runtime -c Release -p:PublishSingleFile=true -p:AssemblyVersion=1.$version.0.0 --self-contained
    cd ..

    # Copy wwwroot
    mkdir -p Grayjay.Desktop.CEF/bin/Release/net8.0/$runtime/publish/wwwroot
    cp -r Grayjay.Desktop.Web/dist Grayjay.Desktop.CEF/bin/Release/net8.0/$runtime/publish/wwwroot/web
    
    cd Grayjay.Desktop.CEF/bin/Release/net8.0/$runtime/publish	
	
	if [ "$runtime" = "win-x64" ]; then
	   ../../../../../../rcedit-x64.exe "cef/justcefnative.exe" --set-icon "../../../../../logo.ico"
	   ../../../../../../rcedit-x64.exe "cef/justcefnative.exe" --set-version-string "ProductName" "Grayjay"
	   ../../../../../../rcedit-x64.exe "cef/justcefnative.exe" --set-version-string "FileDescription" "Grayjay"
	   #../../../../../../rcedit-x64.exe "Grayjay.Desktop.CEF.exe" --set-icon "../../../../../logo.ico"
	   #../../../../../../rcedit-x64.exe "Grayjay.Desktop.CEF.exe" --set-version-string "ProductName" "Grayjay.Desktop"

    	echo "Signing..."
		../../../../../../sign_windows.sh "cef/chrome_elf.dll"
		../../../../../../sign_windows.sh "cef/d3dcompiler_47.dll"
		../../../../../../sign_windows.sh "cef/justcefnative.dll"
		../../../../../../sign_windows.sh "cef/justcefnative.exe"
		../../../../../../sign_windows.sh "cef/dxcompiler.dll"
		../../../../../../sign_windows.sh "cef/dxil.dll"
		../../../../../../sign_windows.sh "cef/libcef.dll"
		../../../../../../sign_windows.sh "cef/libEGL.dll"
		../../../../../../sign_windows.sh "cef/libGLESv2.dll"
		../../../../../../sign_windows.sh "cef/steam_api64.dll"
		../../../../../../sign_windows.sh "cef/vk_swiftshader.dll"
		../../../../../../sign_windows.sh "cef/vulkan-1.dll"
		../../../../../../sign_windows.sh "x64/libzstd.dll"
		../../../../../../sign_windows.sh "x86/libzstd.dll"
		../../../../../../sign_windows.sh "aspnetcorev2_inprocess.dll"
		../../../../../../sign_windows.sh "ClearScriptV8.win-x64.dll"
		../../../../../../sign_windows.sh "e_sqlite3.dll"
		../../../../../../sign_windows.sh "fcast_sender_sdk.dll"
		../../../../../../sign_windows.sh "ffmpeg.exe"
		../../../../../../sign_windows.sh "FUTO.Updater.Client.exe"
		../../../../../../sign_windows.sh "Grayjay.exe"
		../../../../../../sign_windows.sh "libsodium.dll"

	fi
    
    bash "$ROOT_DIR/generate_changelogs.sh" "$PWD"

    cd ../../../../../..
done
	
#Loop over each runtime for deploy
for runtime in "${runtimes[@]}"
do
	echo "Deleting existing on remote for $runtime\n"
	$SSH_CMD $server "rm -rf $targetDir/$appName/$version/$runtime"
	$SSH_CMD $server "rm -f $targetDir/$appName/$version/Grayjay.Desktop-$runtime-v$version.zip"
	$SSH_CMD $server "rm -f $targetDir/$appName/Grayjay.Desktop-$runtime.zip"

	echo "Deploying for $runtime\n"

	cd Grayjay.Desktop.CEF/bin/Release/net8.0/$runtime/publish
	printf "Deploying from $PWD\n"
	
	printf "Generating ZIP\n"
	rm -f "../Grayjay.Desktop-$runtime-v$version.zip"
	rm -rf "../Grayjay.Desktop-$runtime-v$version"
	cp -R "../publish" "../Grayjay.Desktop-$runtime-v$version"
	cd ../
	rm -f Grayjay.Desktop-$runtime-v$version.zip
	zip -r "Grayjay.Desktop-$runtime-v$version.zip" "Grayjay.Desktop-$runtime-v$version"
	cp "Grayjay.Desktop-$runtime-v$version.zip" "Grayjay.Desktop-$runtime.zip"
	cd publish
	
	outDir=$targetDir/$appName/$version/$runtime
	printf "Deploying to $outDir:\n"
	
	printf " - Creating folder...\n"
	$SSH_CMD $server "mkdir -p $outDir"
	
	printf " - Copying zip\n"
	$SCP_CMD "../Grayjay.Desktop-$runtime-v$version.zip" $server:$targetDir/$appName/$version
	printf " - Copying zip global\n"
	$SCP_CMD "../Grayjay.Desktop-$runtime.zip" $server:$targetDir/$appName
	
	printf " - Copy [${PWD}] => [$outDir]\n"
	$SCP_CMD -r "../publish" $server:$outDir
	
	printf " - Moving files..\n"
	$SSH_CMD $server "mv -f $outDir/publish/* $outDir"
	$SSH_CMD $server "rm -rf $outDir/publish"

	cd ../../../../../..
	
	printf " - Done\n\n"
done
