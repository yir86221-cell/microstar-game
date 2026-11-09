import { createCutoutEditor, type CutoutEditor } from "../lib/cutout-editor.js";
import { card, cardTitle, h } from "../lib/dom.js";
import { preparePhoto, readFileAsDataUrl } from "../lib/extract.js";
import { readCustomLevels, removeCustomLevel, saveCustomLevel } from "../lib/customLevels.js";
import { levelsOf, store } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

/** Keep real photo colours; processing and storage stay on device. */
export const render: ScreenRenderer = (ctx) => {
  const body = h("div", { class: "screen" });
  let image = "", name = "", error = "", draftName = "";
  let busy = false, alive = true, editorBusy = false;
  let editor: CutoutEditor | null = null;
  let generation = 0, photoLoad = 0;
  let editingId: string | null = null, replacementId: string | null = null;
  const input = (camera: boolean) => h("input", {
    type: "file", accept: "image/*", ...(camera ? { capture: "environment" } : {}),
    "aria-label": camera ? "拍摄实物照片" : "选择实物照片", hidden: true,
    onChange: async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file || busy || editorBusy) return;
      error = "";
      if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
        error = "请选择不超过 20 MB 的照片。"; paint(); return;
      }
      const load = ++photoLoad;
      busy = true; paint();
      try {
        const photo = await preparePhoto(await readFileAsDataUrl(file), 768);
        if (!alive || load !== photoLoad) return;
        await openEditor(photo, undefined, true);
      } catch { if (alive && load === photoLoad) error = "无法读取这张照片，请重新拍摄或选择 JPG、PNG 照片。"; }
      finally { if (alive && load === photoLoad) { busy = false; paint(); } }
    },
  }) as HTMLInputElement;
  const camera = input(true), gallery = input(false);
  async function openEditor(photo: string, savedMask?: string, auto = false): Promise<void> {
    const token = ++generation;
    editor?.destroy(); editor = null; editorBusy = false;
    const next = await createCutoutEditor(photo, savedMask, value => {
      if (alive && token === generation) { editorBusy = value; paint(); }
    });
    if (!alive || token !== generation) { next.destroy(); return; }
    editor = next; image = photo; busy = false; paint();
    if (auto) await next.auto();
  }
  async function save(): Promise<void> {
    if (!editor || busy || editorBusy) return;
    error = ""; const label = name.trim();
    if (!label) { error = "请先填写关卡名称。"; paint(); return; }
    const token = generation;
    busy = true; paint();
    try {
      const result = await editor.export(); if (!alive || token !== generation) return;
      const previous = readCustomLevels().find(p => p.id === replacementId);
      const id = previous?.id ?? `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      saveCustomLevel({ id, name: label, target: label, color: "#a8d5c8", ...result, createdAt: previous?.createdAt ?? Date.now() });
      store.update(s => { s.plan.stage = 3; s.plan.levelId = id; }); ctx.navigate("train");
    } catch (cause) { if (alive && token === generation) error = cause instanceof Error ? cause.message : "保存失败，请重试。"; }
    finally { if (alive && token === generation) { busy = false; paint(); } }
  }
  function attempt(action: () => void): void {
    error = "";
    try { action(); } catch (cause) { error = cause instanceof Error ? cause.message : "保存失败，请重试。"; }
    paint();
  }
  function paint(): void {
    if (!alive) return;
    body.replaceChildren(
      card(cardTitle("拍照制作关卡", "第三阶段 · 实物照片"),
        h("p", { class: "hint" }, "拍一件熟悉的物品，或从相册选择照片。尽量使用纯色背景，把物品拍完整。抠图保留物品原色，可点选主体并修整边缘。"), camera, gallery,
        h("div", { class: "row" },
          h("button", { class: "btn primary grow", disabled: busy || editorBusy, onClick: () => { camera.value = ""; camera.click(); } }, "拍照"),
          h("button", { class: "btn ghost grow", disabled: busy || editorBusy, onClick: () => { gallery.value = ""; gallery.click(); } }, "从相册选择")),
        h("p", { class: "hint" }, "照片只保存在这台设备，不上传。电脑上可选择图片文件。")),
      ...(busy ? [card(h("p", { role: "status" }, "正在处理照片…"))] : []),
      ...(error ? [h("p", { class: "notice", role: "alert" }, error)] : []),
      ...(image ? [card(cardTitle(replacementId ? "替换关卡照片" : "照片预览", "训练时使用这张图"),
        editor?.el,
        h("label", { class: "field" }, h("span", null, "关卡名称"), h("input", {
          type: "text", value: name, maxLength: 40, placeholder: "例如：我的水杯",
          onInput: (event: Event) => { name = (event.target as HTMLInputElement).value; },
        })),
        h("button", { class: "btn primary block lg", disabled: busy || editorBusy || !editor, onClick: () => void save() }, "保存并返回训练"),
        h("button", { class: "link-btn", onClick: () => { generation++; photoLoad++; editor?.destroy(); editor = null; editorBusy = false; busy = false; image = ""; replacementId = null; name = ""; error = ""; paint(); } }, "取消这张照片"))] : []), library());
  }
  function library(): HTMLElement {
    const items = readCustomLevels();
    return card(cardTitle("已拍的实物", `${items.length} 关`),
      ...(!items.length ? [h("p", { class: "hint" }, "还没有照片关卡。拍照并保存后，儿童端第三阶段会显示同一张照片。")] : []),
      ...items.map(item => {
        if (editingId === item.id) return h("div", { class: "list-row" },
          h("input", { type: "text", "aria-label": "新关卡名称", value: draftName, maxLength: 40,
            onInput: (e: Event) => { draftName = (e.target as HTMLInputElement).value; },
            onChange: (e: Event) => { draftName = (e.target as HTMLInputElement).value; } }),
          h("button", { class: "btn ghost small", onClick: () => attempt(() => {
            const label = draftName.trim(); if (!label) throw Error("名称不能为空。");
            saveCustomLevel({ ...item, name: label, target: label }); editingId = null;
          }) }, "保存"),
          h("button", { class: "btn ghost small", onClick: () => { editingId = null; paint(); } }, "取消"));
        return h("div", { class: "photo-library-item" },
          h("div", { class: "custom-line" }, h("img", { class: "custom-thumb", src: item.image, alt: item.name }), h("strong", null, item.name)),
          h("div", { class: "row" },
            h("button", { class: "btn ghost small", disabled: busy || editorBusy, onClick: () => { editingId = item.id; draftName = item.name; paint(); } }, "改名"),
            h("button", { class: "btn ghost small", disabled: busy || editorBusy, onClick: async () => { const load = ++photoLoad; replacementId = item.id; name = item.name; error = ""; busy = true; paint();
              try { await openEditor(item.sourceImage || item.image, item.maskImage); }
              catch { if (alive && load === photoLoad) error = "无法打开照片，请重新选图。"; }
              finally { if (alive && load === photoLoad) { busy = false; paint(); } }
            } }, "编辑 / 更换照片"),
            h("button", { class: "btn ghost small danger", disabled: busy || editorBusy, onClick: () => {
              if (!window.confirm(`删掉「${item.name}」？训练记录会保留。`)) return;
              attempt(() => {
                removeCustomLevel(item.id);
                if (store.state.plan.levelId === item.id) store.update(s => { s.plan.levelId = levelsOf(3)[0]?.id ?? ""; });
                if (replacementId === item.id) { generation++; editor?.destroy(); editor = null; replacementId = null; image = ""; name = ""; }
              });
            } }, "删除")));
      }));
  }
  paint();
  return { el: h("div", { class: "screen" }, h("header", { class: "session-head" },
    h("button", { class: "btn ghost", onClick: () => ctx.navigate("train") }, "返回训练")), body), destroy: () => { alive = false; generation++; photoLoad++; editor?.destroy(); } };
};
