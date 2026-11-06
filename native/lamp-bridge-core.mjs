// Runs in the top WebView. The parent UI is an iframe; Capacitor callbacks
// belong to this top window, so never initialize the native plugin in the frame.
export function createNativeLampBridge(client, { SERVICE_UUID, ALERT_UUID, LIGHT_UUID, DEVICE_NAME }) {
  let selecting = false;
  let session = null;
  const bytes = values => new DataView(Uint8Array.from(values).buffer);
  return {
    async connect(onDisconnect, owner) {
      if (selecting || session) throw Error('蓝牙控灯连接正在使用中，请先停止后重试。');
      selecting = true;
      let current = null;
      let abandoned = false;
      // The iframe can be removed while its chooser or writes are pending.
      // Keep cleanup in the host realm so its promises survive iframe removal.
      const leave = () => {
        abandoned = true;
        const owned = current;
        if (!owned || owned.dead) return;
        owned.dead = true;
        void client.write(owned.id, SERVICE_UUID, ALERT_UUID, bytes([0]))
          .catch(() => {})
          .then(() => client.disconnect(owned.id))
          .catch(() => {})
          .finally(() => { if (session === owned) session = null; });
      };
      owner?.addEventListener('pagehide', leave, { once: true });
      try {
        await client.initialize({ androidNeverForLocation: true });
        if (!await client.isEnabled()) await client.requestEnable();
        const selected = await client.requestDevice({ name: DEVICE_NAME, optionalServices: [SERVICE_UUID] });
        if (abandoned) throw Error('已离开控灯页面，连接已取消。');
        current = { id: selected.deviceId, lit: false, dead: false, onDisconnect };
        const owned = current;
        session = owned;
        await client.connect(owned.id, () => {
          owned.dead = true;
          owner?.removeEventListener('pagehide', leave);
          if (session === owned) session = null;
          onDisconnect();
        });
        function ready() {
          if (owned.dead || session !== owned) throw Error('MicroStar 已断开，请重新连接。');
        }
        ready();
        return {
          async writeLight(values) {
            ready();
            const data = Array.from(values);
            if (data.length !== 5 || data.some(x => !Number.isInteger(x) || x < 0 || x > 255) || data[4] > 128) {
              throw Error('灯光参数无效。');
            }
            await client.write(owned.id, SERVICE_UUID, LIGHT_UUID, bytes(data));
          },
          async writeAlert(value) {
            ready();
            if (value !== 0 && value !== 1) throw Error('固件只支持闪烁启停。');
            await client.write(owned.id, SERVICE_UUID, ALERT_UUID, bytes([value]));
            owned.lit = value === 1;
          },
          async disconnect() {
            owner?.removeEventListener('pagehide', leave);
            if (owned.dead) return;
            owned.dead = true;
            try { await client.disconnect(owned.id); }
            finally { if (session === owned) session = null; }
          },
        };
      } catch (error) {
        owner?.removeEventListener('pagehide', leave);
        if (current) {
          current.dead = true;
          await client.disconnect(current.id).catch(() => {});
          if (session === current) session = null;
        }
        throw error;
      } finally { selecting = false; }
    },
    // Called when Android backgrounds the app. Do not cancel the native device
    // chooser or permission sheet, which can also invoke Activity.onPause().
    async stopActive() {
      const current = session;
      if (!current?.lit || current.dead) return;
      current.lit = false;
      try { await client.write(current.id, SERVICE_UUID, ALERT_UUID, bytes([0])); }
      finally {
        current.dead = true;
        try { await client.disconnect(current.id); }
        finally {
          if (session === current) session = null;
          current.onDisconnect();
        }
      }
    },
  };
}
