#!/bin/bash
# GitHub Actions (ubuntu রানার) এ APK বিল্ড — রানারে JDK ও Android SDK আগেই থাকে
set -e
cd "$(dirname "$0")/.."
# সার্ভারের ঠিকানা (GitHub repo variable SERVER_URL) অ্যাপে বসানো
mkdir -p android/assets
sed "s|var SERVER_URL = \"\";|var SERVER_URL = \"${SERVER_URL:-}\";|" public/index.html > android/assets/index.html
BT=$(ls -d $ANDROID_HOME/build-tools/* | sort -V | tail -1)
AJAR=$(ls $ANDROID_HOME/platforms/android-34/android.jar 2>/dev/null || ls $ANDROID_HOME/platforms/*/android.jar | sort -V | tail -1)
echo "build-tools: $BT | android.jar: $AJAR"
W=build-work; rm -rf $W; mkdir -p $W/gen $W/classes $W/dex dist
$BT/aapt2 compile --dir android/res -o $W/compiled.zip
$BT/aapt2 link -o $W/app-unsigned.apk -I $AJAR --manifest android/AndroidManifest.xml $W/compiled.zip -A android/assets --java $W/gen --min-sdk-version 24 --target-sdk-version 34
find android/src $W/gen -name "*.java" > $W/sources.txt
javac -cp $AJAR -d $W/classes @$W/sources.txt
$BT/d8 --lib $AJAR --output $W/dex $(find $W/classes -name "*.class")
(cd $W && zip -q app-unsigned.apk -j dex/classes.dex)
$BT/zipalign -f -p 4 $W/app-unsigned.apk $W/app-aligned.apk
# সাইনিং: রিলিজ keystore থাকলে তা, না থাকলে debug keystore (পরীক্ষামূলক)
if [ -n "$KEYSTORE_B64" ]; then
  echo "$KEYSTORE_B64" | base64 -d > $W/ks.jks
  $BT/apksigner sign --ks $W/ks.jks --ks-pass "pass:$KEYSTORE_PASS" --key-pass "pass:$KEYSTORE_PASS" --out dist/ChotoKaj.apk $W/app-aligned.apk
else
  keytool -genkeypair -keystore $W/dbg.jks -alias dbg -keyalg RSA -keysize 2048 -validity 3650 -storepass android -keypass android -dname "CN=ChotoKaj Test" 2>/dev/null
  $BT/apksigner sign --ks $W/dbg.jks --ks-pass pass:android --key-pass pass:android --out dist/ChotoKaj.apk $W/app-aligned.apk
fi
$BT/apksigner verify dist/ChotoKaj.apk && echo "APK ready: dist/ChotoKaj.apk"
