import { card, cardTitle, h } from "../lib/dom.js";
import { extract, preparePhoto, readFileAsDataUrl } from "../lib/extract.js";
import { readCustomLevels, removeCustomLevel, saveCustomLevel } from "../lib/customLevels.js";
import { levelsOf, store } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

/**
 * 拍摄 → 提纯 → 存成第三阶段的自定义关卡。
 *
 * 照片全程在设备上：裁剪、压缩、抠图、单色化都在浏览器里做。
 * 只有在设置里配了抠图服务地址时，才会把**压过的、裁过的小图**传出去，
 * 而且服务端不落盘。
 */
export const render: ScreenRenderer = (ctx) => {
  const stage = store.state.plan.stage;
  const canUse = stage === 3;

  const body = h("div", { class: "screen" });
  let prepared = "";
  let result: Awaited<ReturnType<typeof extract>> | null = null;
  let busy = false;
  let name = "";
  let editingId: string | null = null;
  let draftName = "";

  function paint(): void {
    const parts: HTMLElement[] = [];
    if (!canUse) parts.push(noticeCard());
    parts.push(introCard());
    if (busy) parts.push(workingCard());
    if (result) parts.push(reviewCard(result));
    parts.push(libraryCard());
    body.replaceChildren(...parts);
  }

  /** 已拍的实物：改名、删除。没有这个列表，拍糊的就永远留在那了。 */
  function libraryCard(): HTMLElement {
    const items = readCustomLevels();
    if (items.length === 0) {
      return card(
        cardTitle("已拍的实物", "0 个"),
        h("p", { class: "hint" }, "还没有。拍一个就会出现在这里，也会出现在第三阶段的关卡列表里。"),
      );
    }

    return card(
      cardTitle("已拍的实物", `${items.length} 个`),
      ...items.map((item) => {
        if (editingId === item.id) {
          const input = h("input", {
            type: "text",
            value: item.name,
            onChange: (event: Event) => {
              draftName = (event.target as HTMLInputElement).value;
            },
          }) as HTMLInputElement;

          return h(
            "div",
            { class: "list-row" },
            h(
              "div",
              { class: "list-main", style: { flex: "1 1 auto" } },
              h("strong", null, "改名"),
              input,
            ),
            h(
              "button",
              {
                class: "btn ghost small",
                onClick: () => {
                  const label = (draftName || item.name).trim() || item.name;
                  saveCustomLevel({ ...item, name: label, target: label });
                  editingId = null;
                  draftName = "";
                  paint();
                },
              },
              "保存",
            ),
            h(
              "button",
              {
                class: "btn ghost small",
                onClick: () => {
                  editingId = null;
                  draftName = "";
                  paint();
                },
              },
              "取消",
            ),
          );
        }

        return h(
          "div",
          { class: "list-row" },
          h(
            "div",
            { class: "list-main" },
            h(
              "div",
              { class: "custom-line" },
              h("img", { class: "custom-thumb", src: item.thumb || item.image, alt: "" }),
              h("strong", null, item.name),
            ),
            h("span", { class: "muted" }, `建于 ${new Date(item.createdAt).toLocaleDateString("zh-CN")}`),
          ),
          h(
            "button",
            {
              class: "btn ghost small",
              onClick: () => {
                editingId = item.id;
                draftName = item.name;
                paint();
              },
            },
            "改名",
          ),
          h(
            "button",
            {
              class: "btn ghost small danger",
              onClick: () => {
                if (!window.confirm(`删掉「${item.name}」？训练记录不会删，但这个关卡不能再用了。`)) return;
                removeCustomLevel(item.id);
                // 删的正好是当前选中的关卡：退回第三阶段的第一个内置关，
                // 否则 plan.levelId 会指向一个不存在的关卡
                if (store.state.plan.levelId === item.id) {
                  const fallback = levelsOf(3)[0]!;
                  store.update((s) => {
                    s.plan.levelId = fallback.id;
                  });
                }
                paint();
              },
            },
            "删除",
          ),
        );
      }),
    );
  }

  function noticeCard(): HTMLElement {
    return card(
      h("div", { class: "card-head" }, h("h2", null, "还没到这一阶段")),
      h(
        "p",
        { class: "hint" },
        "拍摄提纯是第三阶段「生活探索」的素材来源。现在整在别的阶段，可以先切到第三阶段再回来。",
      ),
      h("button", { class: "btn ghost block", onClick: () => ctx.navigate("train") }, "回到训练"),
    );
  }

  function introCard(): HTMLElement {
    const input = h("input", {
      type: "file",
      accept: "image/*",
      capture: "environment",
      style: { display: "none" },
      onChange: async (event: Event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        busy = true;
        result = null;
        paint();
        try {
          const raw = await readFileAsDataUrl(file);
          prepared = await preparePhoto(raw, 512);
          result = await extract(prepared);
        } catch (error) {
          result = null;
          busy = false;
          paint();
          window.alert(String(error));
          return;
        }
        busy = false;
        paint();
      },
    }) as HTMLInputElement;

    return card(
      cardTitle("拍一件家里的东西", "只存在这台设备"),
      h(
        "div",
        { class: "shot-frame" },
        h("div", { class: "shot-guide" }, h("span", null, "把物品放在框里")),
      ),
      h(
        "p",
        { class: "hint" },
        "放在纯色背景上（深色布最好），正上方俯拍，让物品占满框的六成以上。避开手和影子。",
      ),
      input,
      h(
        "button",
        { class: "btn primary block lg", disabled: !canUse, onClick: () => input.click() },
        "拍照或选图",
      ),
    );
  }

  function workingCard(): HTMLElement {
    return card(h("p", { class: "hint" }, "正在处理…"));
  }

  function reviewCard(current: Awaited<ReturnType<typeof extract>>): HTMLElement {
    const failed = current.problems.length > 0;
    return card(
      cardTitle("提纯结果", current.via === "api" ? "云端抠图" : "本地抠图"),
      h(
        "div",
        { class: "compare" },
        h(
          "figure",
          null,
          h("img", { src: prepared, alt: "原图" }),
          h("figcaption", null, "原图"),
        ),
        h(
          "figure",
          null,
          h("img", { src: current.image, alt: "提纯后" }),
          h("figcaption", null, "训练时看到的"),
        ),
      ),
      failed
        ? h("div", { class: "notice" }, current.problems.join("；"))
        : h("p", { class: "hint" }, "轮廓看起来够清楚就可以保存。"),
      h(
        "label",
        { class: "field" },
        h("span", null, "名字"),
        h("input", {
          type: "text",
          value: name || "我的东西",
          onChange: (event: Event) => {
            name = (event.target as HTMLInputElement).value;
          },
        }),
      ),
      h(
        "div",
        { class: "row" },
        h(
          "button",
          {
            class: "btn ghost grow",
            onClick: () => {
              result = null;
              paint();
            },
          },
          "重拍",
        ),
        h(
          "button",
          {
            class: "btn primary grow",
            disabled: failed,
            onClick: () => {
              const label = (name || "我的东西").trim() || "我的东西";
              saveCustomLevel({
                id: `custom-${Date.now().toString(36)}`,
                name: label,
                target: label,
                color: current.color,
                image: current.image,
                thumb: current.thumb || current.image,
                createdAt: Date.now(),
              });
              ctx.navigate("train");
            },
          },
          "存成关卡",
        ),
      ),
      h(
        "p",
        { class: "hint" },
        "单色化是有意为之：CVI 孩子对复杂纹理过载，去掉明暗和背景更容易认出来。",
      ),
    );
  }

  paint();

  return {
    el: h(
      "div",
      { class: "screen" },
      h(
        "header",
        { class: "session-head" },
        h("button", { class: "icon-btn", onClick: () => ctx.navigate("train") }, "←"),
        h(
          "div",
          { class: "session-title" },
          h("strong", null, "拍实物"),
          h("span", null, "第三阶段的自定义关卡"),
        ),
        h("span", { class: "spacer" }),
      ),
      body,
    ),
  };
};
