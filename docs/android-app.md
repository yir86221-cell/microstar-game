# 安卓测试版

## 当前结果

- 分支：`feature/android-app`，基于 `main` 的 `b290f8b`。
- 独立目录：`D:\homework\2\微动星瞳-安卓`。原目录 `D:\homework\2\微动星瞳` 保留在 `main`。
- 应用名称：微动星瞳；包名：`cn.microstar.game.demo`；版本：0.1.0 / versionCode 1。
- 最低 Android 7.0（API 24），建议使用较新的 Android System WebView。
- APK：`releases/microstar-android-debug.apk`，旁边的 `.sha256` 文件记录校验值。
- 这是调试签名的侧载试玩包，尚未上架应用商店。将来正式发布需要独立维护发布签名。

## 如何安装

2026-11-05 已将版本 0.1.0 上传到 Gofile，供小组直接下载；发布源码为 `feature/android-app` 的 `d983c130f4ef9ecdbdbadd8f562a6bfaf5424cee`，没有合并 `main` 或更新 Sites。

- [手机下载 APK（约 4 MB）](https://gofile.io/d/JlZUglyv)，文件名 `microstar-android-v0.1.0.apk`。
- SHA-256：`ef2fcca7af6d9bc8653d8eb702bd10435dbdeacbac7de67d49b902656a1dbd6b`。
- 本机 `releases/` 中保存同一安装包、发布记录与 `microstar-android-v0.1.0-qr.png` 下载二维码。

1. 在安卓手机浏览器打开上面的下载页，点击文件旁的 Download 下载 APK；也可以通过 USB 或文件传输复制本机 APK。
2. 在手机文件管理器中打开 APK；若系统提示，允许该文件来源安装应用，再完成安装。
3. 从桌面的黄色小鸡图标打开“微动星瞳”。
4. 右下角家长入口需要按住约 1 秒再松开；黄杯关卡只有小人图标。

内置游戏和家长端资源随 APK 安装，日常试玩无需电脑运行 `npm run dev`，也无需访问网站。
手机中的记录和照片保存在这个 App 的本地存储中，与浏览器试玩数据分开；卸载或清除 App 数据会清空它们。
关闭了系统自动备份。仅配置了 HTTPS 抠图服务时才会按原有功能访问该服务，默认仍在本机处理。

## 本次适配

- 根目录 Capacitor 配置从 `dist/` 打包完整软件，包含 `dist/parent/`；不是只打包家长端。
- 原生返回键：家长端返回游戏；游戏中先暂停，再返回阶段选择；阶段选择返回首页；首页返回桌面。
- 后台暂停儿童游戏并取消未完成的按住动作。
- Android 15/16 的边到边显示使用原生安全区域，为状态栏、导航栏、刘海和键盘留出空间，横竖屏均可用。
- 复用原有小鸡图形作为应用和启动图标。
- 家长端在原生壳中不注册浏览器 Service Worker，避免 APK 更新后继续显示旧缓存。
- 相机调用复用系统拍照和文件选择界面；没有申请持续相机、麦克风或蓝牙权限。

## 本地重新构建

工具：Node.js 22+、JDK 21、Android SDK Platform 36 / Build Tools 36.0.0。
项目锁定 Capacitor 8.6.0；Gradle Wrapper 随工程保存，首次构建需要联网下载构建依赖。

```sh
npm ci
npm --prefix parent-app ci
npm run check
npm test
npm --prefix parent-app test
npm --prefix parent-app run typecheck
npm run android:apk
```

构建命令依次重建家长端、同步 Web 资源到 Android、编译调试 APK、复制到 `releases/` 并计算 SHA-256。
脚本优先读取 `ANDROID_HOME` / `ANDROID_SDK_ROOT`，也会查找系统常见 SDK 目录；SDK 路径仅写入此目录下被 Git 忽略的 `android/local.properties`。
JDK 使用 `JAVA_HOME`，未设置时使用 PATH 上的 Java。中文路径下直接调用 Java 启动 Gradle Wrapper，避开 cmd.exe 对中文路径的编码问题。

后续只同步资源可运行 `npm run android:sync`；已安装 Android Studio 时可运行 `npm run android:open`。
代码、SDK 路径、构建缓存、APK 和签名的边界在 `.gitignore` 中定义；不要提交签名文件或本机配置。

## 验证与待测

已通过儿童端自动检查（含安卓返回/后台暂停回归）、家长端 102 项测试和 TypeScript 检查。
浏览器按 412×915、915×412 验证家长入口、启动儿童训练、接触停留进入下一关、记录回流家长端。
Android APK 已成功编译、通过 apksigner 验证，包内全部儿童端及家长端 Web 文件与本次构建一致。

没有连接真实安卓设备，也没有配置模拟器，因此尚未验证原生安装启动、安卓系统返回键、刘海/键盘、旋转、系统拍照和长时间运行。浏览器预览不能替代这些实机检查。

沿用上游的功能限制：

- 真实蓝牙灯具未接入原生 App；WebView 的设备页会明确显示模拟设备。
- 云端抠图代理未部署、未配置真实凭据，默认使用本地处理。
- 当前家长端的 P2/P3 内置关卡目录仍各列四关，与儿童端最新的 P2 十关/P3 黄杯目录尚未完全对齐；本次打包保留上游内容，没有改动这些关卡定义。新增关卡可从儿童端菜单进入，自定义关卡跨端对应仍需上游修正。

此分支没有合并进 `main`，也没有发布 Sites 网站。后续同步原项目更新时应在此分支单独整合、重建 APK 并再次验证。
