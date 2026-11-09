// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { preparePhoto, readFileAsDataUrl } from '../src/lib/extract.js';
vi.mock('../src/lib/extract.js', () => ({
  readFileAsDataUrl: vi.fn(async () => 'data:image/png;base64,AAAA'),
  preparePhoto: vi.fn(async () => 'data:image/jpeg;base64,BBBB'),
}));
vi.mock('../src/lib/cutout-editor.js', () => ({createCutoutEditor:vi.fn(async(source:string)=>{
  const el=document.createElement('img');el.className='photo-level-preview';el.src=source;
  return {el,auto:vi.fn(async()=>{}),destroy:vi.fn(),export:async()=>({image:source,thumb:source,sourceImage:source,maskImage:'data:image/png;base64,CCCC'})};
})}));
const flush = async () => { for(let i=0;i<12;i++) await Promise.resolve(); };
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  const data = new Map<string,string>();
  const storage = { getItem: (k:string) => data.get(k) ?? null, setItem: vi.fn((k:string,v:string) => {data.set(k,v);}), removeItem: (k:string) => data.delete(k) };
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); });
async function maker() {
  const { render } = await import('../src/screens/extract.js');
  const navigate = vi.fn(); const screen = render({navigate,rerender:vi.fn()}); document.body.append(screen.el);
  return {screen,navigate};
}
async function choose(el:HTMLElement) {
  const picker = el.querySelector<HTMLInputElement>('input[aria-label="选择实物照片"]')!;
  Object.defineProperty(picker,'files',{configurable:true,value:[new File(['photo'],'cup.jpg',{type:'image/jpeg'})]});
  picker.dispatchEvent(new Event('change')); await flush();
}
function click(el:HTMLElement,name:string){ [...el.querySelectorAll('button')].find(b=>b.textContent===name)!.click(); }
it('creates a persistent full-colour photo level and selects the same ID for training', async () => {
  const {screen,navigate}=await maker();
  expect(screen.el.querySelector('input[capture="environment"]')).not.toBeNull();
  expect(screen.el.querySelector('input[aria-label="选择实物照片"]')?.hasAttribute('capture')).toBe(false);
  await choose(screen.el);
  expect(preparePhoto).toHaveBeenCalledWith('data:image/png;base64,AAAA',768);
  expect(screen.el.querySelector('.photo-level-preview')?.getAttribute('src')).toBe('data:image/jpeg;base64,BBBB');
  const name=screen.el.querySelector<HTMLInputElement>('input[type=text]')!; name.value='我的水杯';name.dispatchEvent(new Event('input'));
  click(screen.el,'保存并返回训练'); await flush();
  const saved=JSON.parse(localStorage.getItem('microstar.custom-levels.v1')!)[0];
  const {store,levelsOf}=await import('../src/lib/store.js');
  expect(store.state.plan.stage).toBe(3); expect(store.state.plan.levelId).toBe(saved.id);
  expect(saved.sourceImage).toBe('data:image/jpeg;base64,BBBB');expect(saved.maskImage).toBe('data:image/png;base64,CCCC');
  expect(levelsOf(3).map(l=>l.id)).toEqual([saved.id]);expect(navigate).toHaveBeenCalledWith('train');
  screen.destroy?.(); vi.resetModules();
  const reloaded=await import('../src/lib/customLevels.js');expect(reloaded.readCustomLevels()[0]?.image).toBe(saved.image);
  const {render}=await import('../src/screens/child.js'); const child=render({navigate:vi.fn(),rerender:vi.fn()});
  expect(child.el.querySelector('.photo-target img')?.getAttribute('src')).toBe(saved.image);child.destroy?.();
});
it('keeps the photo and shows an error when saving exceeds device storage',async()=>{
  const {screen,navigate}=await maker();await choose(screen.el);
  const name=screen.el.querySelector<HTMLInputElement>('input[type=text]')!;name.value='杯子';name.dispatchEvent(new Event('input'));
  vi.mocked(localStorage.setItem).mockImplementationOnce(()=>{throw Error('quota');});click(screen.el,'保存并返回训练'); await flush();
  expect(screen.el.querySelector('[role=alert]')?.textContent).toContain('保存失败');expect(navigate).not.toHaveBeenCalled();
  expect(screen.el.querySelector('.photo-level-preview')).not.toBeNull(); screen.destroy?.();
});
it('empty or obsolete third-stage plans show creation controls instead of cartoon training',async()=>{
  const {store}=await import('../src/lib/store.js');store.update(s=>{s.plan.stage=3;s.plan.levelId='p3-chick';});
  const {render}=await import('../src/screens/train.js');const screen=render({navigate:vi.fn(),rerender:vi.fn()});
  expect(screen.el.textContent).toContain('拍照制作关卡');expect(screen.el.textContent).not.toContain('开始训练');
  expect(screen.el.textContent).not.toContain('让小鸡跳舞');screen.destroy?.();
});
it('leaving while a photo is loading cannot resurrect a stale draft',async()=>{
  let resolve!: (v:string)=>void;
  vi.mocked(readFileAsDataUrl).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  const {screen,navigate}=await maker();await choose(screen.el);screen.destroy?.();resolve('data:image/png;base64,AAAA');await flush();
  expect(screen.el.querySelector('.photo-level-preview')).toBeNull();expect(navigate).not.toHaveBeenCalled();
});
it('cancelling while a replacement photo loads cannot recreate the cancelled draft',async()=>{
  const {screen,navigate}=await maker();await choose(screen.el);
  let resolve!: (v:string)=>void;
  vi.mocked(readFileAsDataUrl).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  await choose(screen.el);click(screen.el,'取消这张照片');
  resolve('data:image/png;base64,AAAA');await flush();
  expect(screen.el.querySelector('.photo-level-preview')).toBeNull();
  expect(navigate).not.toHaveBeenCalled();screen.destroy?.();
});
