import { h } from "../lib/dom.js";
import { rangePanel } from "../lib/range-panel.js";
import type { ScreenRenderer } from "../lib/nav.js";
export const render: ScreenRenderer = () => {
  const panel=rangePanel(false);
  return {el:h('div',{class:'screen'},h('div',{class:'page-head'},h('h1',null,'设备')),panel.el),destroy:panel.destroy};
};
