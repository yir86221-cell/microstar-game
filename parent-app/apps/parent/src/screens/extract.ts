import { card, cardTitle, h } from "../lib/dom.js";
import { preparePhoto, readFileAsDataUrl } from "../lib/extract.js";
import { readCustomLevels, removeCustomLevel, saveCustomLevel } from "../lib/customLevels.js";
import { levelsOf, store } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

/** Keep real photo colours; processing and storage stay on device. */
export const render: ScreenRenderer = (ctx) => {
  const body = h("div", { class: "screen" });
  let image = "", thumb = "", name = "", error = "", draftName = "";
  let busy = false, alive = true;
  let editingId: string | null = null, replacementId: string | null = null;
  const input = (camera: boolean) => h("input", {
    type: "file", accept: "image/*", ...(camera ? { capture: "environment" } : {}),
    "aria-label": camera ? "拍摄实物照片" : "选择实物照片", hidden: true,
    onChange: async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file || busy) return;
      error = "";
      if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
        error = "请选择不超过 20 MB 的照片。"; paint(); return;
      }
      busy = true; paint();
      try {
        const photo = await preparePhoto(await readFileAsDataUrl(file), 768);
        const small = await preparePhoto(photo, 160);
        if (!alive) return;
        image = photo; thumb = small;
      } catch { if (alive) error = "无法读取这张照片，请重新拍摄或选择 JPG、PNG 照片。"; }
      finally { if (alive) { busy = false; paint(); } }
    },
  }) as HTMLInputElement;
  const camera = input(true), gallery = input(false);
  function attempt(action: () => void): void {
    error = "";
    try { action(); } catch (cause) { error = cause instanceof Error ? cause.message : "保存失败，请重试。"; }
    paint();
  }
  function paint(): void {
    if (!alive) return;
    body.replaceChildren(
      card(cardTitle("拍照制作关卡", "第三阶段 · 实物照片"),
        h("p", { class: "hint" }, "拍一件熟悉的物品，或从相册选择照片。尽量使用纯色背景，把物品拍完整。保留照片真实颜色与细节。"), camera, gallery,
        h("div", { class: "row" },
          h("button", { class: "btn primary grow", disabled: busy, onClick: () => { camera.value = ""; camera.click(); } }, "拍照"),
          h("button", { class: "btn ghost grow", disabled: busy, onClick: () => { gallery.value = ""; gallery.click(); } }, "从相册选择")),
        h("p", { class: "hint" }, "照片只保存在这台设备，不上传。电脑上可选择图片文件。")),
      ...(busy ? [card(h("p", { role: "status" }, "正在处理照片…"))] : []),
      ...(error ? [h("p", { class: "notice", role: "alert" }, error)] : []),
      ...(image ? [card(cardTitle(replacementId ? "替换关卡照片" : "照片预览", "训练时使用这张图"),
        h("img", { class: "photo-level-preview", src: image, alt: "训练照片预览" }),
        h("label", { class: "field" }, h("span", null, "关卡名称"), h("input", {
          type: "text", value: name, maxLength: 40, placeholder: "例如：我的水杯",
          onInput: (event: Event) => { name = (event.target as HTMLInputElement).value; },
        })),
        h("button", { class: "btn primary block lg", disabled: busy, onClick: () => attempt(() => {
          const label = name.trim(); if (!label) throw Error("请先填写关卡名称。");
          const previous = readCustomLevels().find(p => p.id === replacementId);
          const id = previous?.id ?? `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
          saveCustomLevel({ id, name: label, target: label, color: "#a8d5c8", image, thumb, createdAt: previous?.createdAt ?? Date.now() });
          store.update(s => { s.plan.stage = 3; s.plan.levelId = id; }); ctx.navigate("train");
        }) }, "保存并返回训练"),
        h("button", { class: "link-btn", disabled: busy, onClick: () => { image = ""; replacementId = null; name = ""; error = ""; paint(); } }, "取消这张照片"))] : []), library());
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
            h("button", { class: "btn ghost small", disabled: busy, onClick: () => { editingId = item.id; draftName = item.name; paint(); } }, "改名"),
            h("button", { class: "btn ghost small", disabled: busy, onClick: () => { replacementId = item.id; name = item.name; image = item.image; thumb = item.thumb; paint(); } }, "更换照片"),
            h("button", { class: "btn ghost small danger", disabled: busy, onClick: () => {
              if (!window.confirm(`删掉「${item.name}」？训练记录会保留。`)) return;
              attempt(() => {
                removeCustomLevel(item.id);
                if (store.state.plan.levelId === item.id) store.update(s => { s.plan.levelId = levelsOf(3)[0]?.id ?? ""; });
                if (replacementId === item.id) { replacementId = null; image = ""; name = ""; }
              });
            } }, "删除")));
      }));
  }
  paint();
  return { el: h("div", { class: "screen" }, h("header", { class: "session-head" },
    h("button", { class: "btn ghost", onClick: () => ctx.navigate("train") }, "返回训练")), body), destroy: () => { alive = false; } };
};
