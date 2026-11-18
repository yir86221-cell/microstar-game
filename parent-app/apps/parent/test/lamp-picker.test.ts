// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { openLampPicker } from '../../../../native/lamp-picker.js';
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.open = false; } });
});
afterEach(() => { document.body.innerHTML = ''; });
it('uses an explicit large device button and ignores backdrop clicks', () => {
  const choose=vi.fn(),cancel=vi.fn(); const picker=openLampPicker({choose,cancel});
  picker.devices([{deviceId:'AA:BB',name:'MicroStar'}]);
  picker.devices([{deviceId:'AA:BB',name:'MicroStar'},{deviceId:'CC:DD',name:'MicroStar'}]);
  const dialog=document.querySelector('dialog')!;
  dialog.click(); expect(cancel).not.toHaveBeenCalled();
  const buttons=dialog.querySelectorAll('.lamp-device-choice'); expect(buttons.length).toBe(2);
  expect(buttons[0].textContent).toContain('连接 MicroStar');
  (buttons[0] as HTMLButtonElement).click(); expect(choose).toHaveBeenCalledWith('AA:BB');
  picker.busy(); (buttons[1] as HTMLButtonElement).click();
  expect(choose).toHaveBeenCalledTimes(1);
  expect([...dialog.querySelectorAll('button')].every(button=>button.disabled)).toBe(true);
  picker.close(); expect(document.querySelector('dialog')).toBeNull();
});
it('treats an intentional cancel separately from selection', () => {
  const choose=vi.fn(),cancel=vi.fn(); const picker=openLampPicker({choose,cancel});
  const dialog=document.querySelector('dialog')!;
  const event=new Event('cancel',{cancelable:true}); dialog.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true); expect(cancel).toHaveBeenCalledOnce();
  expect(choose).not.toHaveBeenCalled(); picker.close();
});
