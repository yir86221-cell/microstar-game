import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { createNativeLampBridge } from './lamp-bridge-core.mjs';
import { installAppUpdates } from './app-updates.js';
import { createLampSelector } from './lamp-selector-core.mjs';
import { openLampPicker } from './lamp-picker.js';
import * as protocol from '../parent-app/packages/core-protocol/src/uuids.ts';

if (Capacitor.isNativePlatform()) {
  const selector = createLampSelector(BleClient, openLampPicker);
  window.microstarLampSelector = selector;
  window.microstarLampBridge = createNativeLampBridge(BleClient, protocol, selector.select);
  window.microstarAppUpdates = installAppUpdates(__APP_VERSION__);
}
