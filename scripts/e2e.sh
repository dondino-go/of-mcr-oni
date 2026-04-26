#!/bin/bash
# Self-contained E2E runner: ensures emulator is up, latest APK installed,
# location services configured, then runs Maestro flows.
# Idempotent — running twice in a row is safe.
set -euo pipefail

ADB="$HOME/Library/Android/sdk/platform-tools/adb"
EMULATOR="$HOME/Library/Android/sdk/emulator/emulator"

# 1. Ensure an emulator is running (boot first available AVD if not)
if ! "$ADB" devices | grep -q "^emulator-"; then
  AVD=$("$EMULATOR" -list-avds | head -1)
  if [ -z "$AVD" ]; then
    echo "No AVDs found. Create one in Android Studio (Device Manager) first." >&2
    exit 1
  fi
  echo "Booting emulator: $AVD"
  nohup "$EMULATOR" -avd "$AVD" -no-snapshot -no-audio > /tmp/emulator.log 2>&1 &
  disown
fi

# 2. Wait for the emulator to finish booting (handles both fresh boot and offline state)
echo "Waiting for boot completion..."
"$ADB" wait-for-device shell 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done'

# 3. Configure location services + seed Manchester GPS
"$ADB" shell settings put secure location_mode 3 > /dev/null
"$ADB" shell cmd location set-location-enabled true > /dev/null
"$ADB" emu geo fix -2.2232 53.4784 > /dev/null

# 4. Install latest APK (always reinstall — fast and ensures we test the freshest build)
LATEST_APK=$(ls -t build-*.apk 2>/dev/null | head -1 || true)
if [ -z "$LATEST_APK" ]; then
  echo "No APK found in project root. Run 'eas build --platform android --profile preview --local' first." >&2
  exit 1
fi
echo "Installing $LATEST_APK..."
"$ADB" install -r "$LATEST_APK" > /dev/null

# 5. Run Maestro flows
PATH="$HOME/Library/Android/sdk/platform-tools:$PATH" maestro test .maestro/
