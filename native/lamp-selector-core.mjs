// Native BLE scanning with our own explicit chooser. Never auto-select a lamp.
export function createLampSelector(client, openPicker, { scanTime = 20000 } = {}) {
  let activeCancel = null;
  return {
    cancel() { if (!activeCancel) return false; activeCancel(); return true; },
    async select(options, { signal } = {}) {
      if (activeCancel) throw Error('设备选择正在进行中。');
      if (signal?.aborted) throw Error('已离开控灯页面，选择已取消。');
      const devices = new Map();
      let decided = false, cancelled = false, ui, timer, stopPromise, resolveChoice;
      const choice = new Promise(resolve => { resolveChoice = resolve; });
      const finish = result => {
        if (decided) return;
        decided = true;
        ui?.busy();
        resolveChoice(result);
      };
      activeCancel = () => { cancelled = true; finish({ error: Error('已取消选择提示灯。') }); };
      const cancel = activeCancel;
      signal?.addEventListener('abort', cancel, { once: true });
      const stop = () => stopPromise ??= client.stopLEScan();
      try {
        ui = openPicker({
          choose(id) { if (devices.has(id)) finish({ device: devices.get(id) }); },
          cancel() { if (!decided) cancel(); },
        });
        try {
          await client.requestLEScan({ name: options.name, allowDuplicates: false }, result => {
            if (decided) return;
            const device = result.device;
            if (!device?.deviceId || (device.name !== options.name && result.localName !== options.name)) return;
            if (devices.has(device.deviceId)) return;
            devices.set(device.deviceId, { deviceId: device.deviceId, name: options.name });
            ui.devices([...devices.values()]);
          });
          // Cancellation may occur while the native start call is still pending.
          if (!decided) timer = setTimeout(() => {
            void stop().then(() => {
              if (decided) return;
              if (devices.size) ui.scanEnded();
              else finish({ error: Error('未找到 MicroStar。请确认灯已开机并靠近手机后重试。') });
            }).catch(error => finish({ error }));
          }, scanTime);
        } catch (error) { finish({ error }); }
        const result = await choice;
        clearTimeout(timer);
        // Wait until the native scan has fully stopped before allowing connect.
        try { await stop(); }
        catch (error) { if (!result.error) throw error; }
        if (result.error) throw result.error;
        if (cancelled || signal?.aborted) throw Error('已取消选择提示灯。');
        return result.device;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        activeCancel = null;
        ui?.close();
      }
    },
  };
}
