import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor 配置。
 *
 * 为什么是 Capacitor 而不是 Flutter（架构文档 D1）：
 * 团队是前端背景，现有 BLE 原型就是 HTML/JS，`core-protocol` 用 TypeScript 写好后
 * iPhone 与 iPad 两个 App 共用同一份。iOS / iPadOS 的 Safari 不支持 Web Bluetooth，
 * 所以"网页也能连灯"这条路在产品形态上是走不通的——必须套一层原生壳。
 *
 * 说明：iOS 工程需要在 macOS 上执行 `npx cap add ios` 才会生成。
 * 在 Windows 上只能开发和调试 Web 层（Chrome 的 Web Bluetooth 可以连真灯）。
 */
const config: CapacitorConfig = {
  appId: "com.microstar.parent",
  appName: "星瞳家长",
  webDir: "dist",
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
