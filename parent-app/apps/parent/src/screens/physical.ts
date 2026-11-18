import { h } from '../lib/dom.js';
import { rangePanel } from '../lib/range-panel.js';
import type { ScreenRenderer } from '../lib/nav.js';
export const render:ScreenRenderer=ctx=>{
  const panel=rangePanel(true);
  return {el:h('div',{class:'screen'},h('button',{class:'btn ghost',onClick:()=>ctx.navigate('train')},'返回训练'),
    h('div',{class:'page-head'},h('h1',null,'实物寻找')),panel.el),destroy:panel.destroy};
};
