export function openLampPicker({ choose, cancel }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'microstar-update microstar-lamp-picker';
  dialog.setAttribute('aria-labelledby', 'microstar-lamp-picker-title');
  const title = document.createElement('h2');
  title.id = 'microstar-lamp-picker-title'; title.textContent = '选择 MicroStar 提示灯';
  const status = document.createElement('p');
  status.setAttribute('role', 'status'); status.textContent = '正在搜索附近的 MicroStar…';
  const list = document.createElement('div');
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button'; cancelButton.textContent = '取消';
  cancelButton.onclick = cancel;
  dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
  dialog.append(title, status, list, cancelButton);
  document.body.append(dialog);
  dialog.showModal();
  const shown = new Set();
  let busy = false;
  return {
    devices(devices) {
      if (busy) return;
      status.textContent = '找到提示灯，请点下面的“连接 MicroStar”。';
      for (const device of devices) {
        if (shown.has(device.deviceId)) continue;
        shown.add(device.deviceId);
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'lamp-device-choice';
        const label = document.createElement('strong'); label.textContent = '连接 MicroStar';
        const address = document.createElement('small'); address.textContent = device.deviceId;
        button.append(label, address);
        button.onclick = () => { if (!busy) choose(device.deviceId); };
        list.append(button);
      }
    },
    scanEnded() { if (!busy) status.textContent = '搜索已结束，请选择提示灯。需要重新搜索时，点取消后再试。'; },
    busy() {
      busy = true; status.textContent = '正在结束搜索…';
      for (const button of dialog.querySelectorAll('button')) button.disabled = true;
    },
    close() { dialog.close(); dialog.remove(); },
  };
}
