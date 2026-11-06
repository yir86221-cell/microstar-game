import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { createNativeLampBridge } from './lamp-bridge-core.mjs';
import * as protocol from '../parent-app/packages/core-protocol/src/uuids.ts';

if (Capacitor.isNativePlatform()) {
  window.microstarLampBridge = createNativeLampBridge(BleClient, protocol);
}
