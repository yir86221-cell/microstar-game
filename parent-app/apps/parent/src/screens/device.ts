import { card, cardTitle, h } from "../lib/dom.js";
import { DeviceLamp } from "../lib/device-lamp.js";
import { store } from "../lib/store.js";
import type { LampSettings } from "../lib/manual-lamp.js";
import type { ScreenRenderer } from "../lib/nav.js";

export const render: ScreenRenderer = () => {
  const settings = (): LampSettings => ({ preset:store.state.plan.preset, brightness:store.state.plan.brightness,
    photosensitive:store.state.child.photosensitive, highLightSensitivity:store.state.child.highLightSensitivity,
    tactileSensitive:store.state.child.tactileSensitive });
  const connection = h("strong", null, "未连接");
  const message = h("p", {class:"hint",role:"status","aria-live":"polite"}, "连接真实 MicroStar 后操作。");
  const report = h("p", {class:"hint"}, "尚未读取设备状态。");
  const controls: HTMLButtonElement[] = [], blinkControls: HTMLButtonElement[] = [];
  const connect = h("button", {class:"btn primary grow",onClick:()=>void lamp.connect()}, "连接提示灯") as HTMLButtonElement;
  const lamp = new DeviceLamp(state => {
    connection.textContent = state.connected ? "已连接 MicroStar" : "未连接";
    message.textContent = state.message;
    connect.disabled = state.busy || state.connected;
    for (const button of controls) button.disabled = state.busy || !state.connected;
    for (const button of blinkControls) button.disabled ||= settings().photosensitive || settings().tactileSensitive;
    brightness.disabled = state.busy;
    const s = state.reported;
    report.textContent = s ? `设备报告：闪烁${s.blinking ? "开启" : "关闭"}；运动标记 ${s.moving ? 1 : 0}；IMU ${s.imuOk ? "正常" : "异常"}（${new Date(s.at).toLocaleTimeString()}）` : "尚无当前设备状态，请点读取状态。";
  });
  function button(label: string, action: () => Promise<void>, blinks = false) {
    const b = h("button", {class:"btn ghost",disabled:true,onClick:()=>void action()},label) as HTMLButtonElement;
    controls.push(b); if (blinks) blinkControls.push(b); return b;
  }
  const max = settings().highLightSensitivity ? 96 : 128;
  const level = h("span", null, String(Math.min(settings().brightness,max)));
  const brightness = h("input", {type:"range",min:0,max,step:1,value:Math.min(settings().brightness,max),"aria-label":"亮度",
    onInput:(event:Event)=>{level.textContent=(event.target as HTMLInputElement).value;},
    onChange:(event:Event)=>{
      const value=Number((event.target as HTMLInputElement).value);
      store.update(s=>{s.plan.brightness=value;});
      if(lamp.state.connected) void lamp.setColor(settings());
    },
  }) as HTMLInputElement;
  const presets = [["red","红色"],["yellow","黄色"],["warmWhite","暖白"],["deepBlue","蓝色"]] as const;
  const colors = h("div",{class:"segmented swatches"});
  for (const [name,label] of presets) {
    const b=button(label, async()=>{
      store.update(s=>{s.plan.preset=name;});
      for(const item of colors.querySelectorAll("button")) item.classList.toggle("active",item===b);
      await lamp.setColor(settings());
    });
    b.className=`seg swatch ${name} ${settings().preset===name ? "active" : ""}`;
    b.setAttribute("aria-label",label); colors.append(b);
  }
  const restriction = settings().photosensitive ? "档案已禁用闪烁。" : settings().tactileSensitive ? "当前档案要求关闭震动，但固件不支持该指令，因此不启动闪烁。" : "试灯和找灯使用短时闪烁；发送成功后请观察实灯。";
  const el=h("div",{class:"screen"},h("div",{class:"page-head"},h("h1",null,"设备")),
    card(cardTitle("提示灯"),connection,message,h("p",{class:"hint"},"离开设备页会停止并断开。"),
      h("div",{class:"row"},connect,button("停止并断开",()=>lamp.disconnect())),
      h("div",{class:"row"},button("试灯（2秒）",()=>lamp.blink(settings(),2000),true),button("找灯（3秒）",()=>lamp.blink(settings(),3000),true))),
    card(cardTitle("灯光"),h("div",{class:"row"},button("开始闪烁",()=>lamp.blink(settings()),true),button("停止闪烁",()=>lamp.stop())),
      colors,h("label",{class:"field"},h("span",null,"亮度 ",level,` / ${max}`),brightness),
      h("p",{class:"hint"},restriction)),
    card(cardTitle("设备状态"),button("读取状态",()=>lamp.readStatus()),report,
      h("p",{class:"hint"},"显示灯具实际返回的数据；运动标记不代表抓握成功。")),
    h("details",{class:"card"},h("summary",null,"连不上怎么办？"),
      h("p",{class:"hint"},"确认灯已开机、手机蓝牙已开启且允许附近设备权限。靠近灯，并关闭其他正在连接它的应用后重试。")));
  const hidden=()=>{if(document.hidden)void lamp.disconnect();};
  const leave=()=>lamp.dispose();
  document.addEventListener("visibilitychange",hidden); window.addEventListener("pagehide",leave);
  return {el,destroy(){document.removeEventListener("visibilitychange",hidden);window.removeEventListener("pagehide",leave);lamp.dispose();}};
};
