const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const android = path.join(root, 'android');
const localProperties = path.join(android, 'local.properties');

// Only configure this checkout; never change the computer's global SDK/JDK setup.
if (!fs.existsSync(localProperties)) {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'AppData/Local/Android/Sdk'),
    path.join(os.homedir(), 'Library/Android/sdk'), path.join(os.homedir(), 'Android/Sdk')];
  const sdk = candidates.find(p => p && fs.existsSync(path.join(p, 'platforms')));
  if (!sdk) throw new Error('未找到 Android SDK。请设置 ANDROID_HOME，或安装 Android Studio 的 SDK。');
  fs.writeFileSync(localProperties, `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);
}

for (const relative of ['index.html', 'game.js', 'style.css', 'parent/index.html']) {
  const web = path.join(root, 'dist', relative);
  const bundled = path.join(android, 'app/src/main/assets/public', relative);
  if (!fs.existsSync(bundled) || !fs.readFileSync(web).equals(fs.readFileSync(bundled))) {
    throw new Error(`安装包资源缺失或过期：${relative}。请运行 npm run android:apk。`);
  }
}

// Invoke the checked-in Gradle wrapper through Java directly. cmd.exe can lose
// Chinese characters in %APP_HOME% when it launches gradlew.bat on Windows.
const java = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
  : 'java';
const result = spawnSync(java, ['-classpath', 'gradle/wrapper/gradle-wrapper.jar',
  'org.gradle.wrapper.GradleWrapperMain', '--console=plain', '--no-daemon', 'assembleDebug'],
  { cwd: android, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

const source = path.join(android, 'app/build/outputs/apk/debug/app-debug.apk');
const releases = path.join(root, 'releases');
fs.mkdirSync(releases, { recursive: true });
const destination = path.join(releases, 'microstar-android-debug.apk');
fs.copyFileSync(source, destination);
const sha = crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex');
fs.writeFileSync(`${destination}.sha256`, `${sha}  microstar-android-debug.apk\n`);
console.log(`\nAPK 已生成：${destination}\nSHA-256：${sha}\n这是供小组侧载试玩的调试签名包。`);
