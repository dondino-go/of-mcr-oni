#!/bin/bash
# Tear down the running Android emulator. No-op if none is running.
ADB="$HOME/Library/Android/sdk/platform-tools/adb"

if "$ADB" devices | grep -q "^emulator-"; then
  "$ADB" emu kill > /dev/null 2>&1 || true
  echo "Emulator stopped."
else
  echo "No emulator running."
fi
