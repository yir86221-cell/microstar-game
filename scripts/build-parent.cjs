/*
 * 构建家长端。
 *
 * 存在的理由：原来这里直接写 `pnpm ...`，组员没装 pnpm 就跑不动，
 * 而报错信息只有一行看不懂的 "pnpm 不是内部或外部命令"。
 * 现在统一走 npm，并且在依赖没装时给一句人话。
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const appDir = path.join(root, "parent-app");

if (!fs.existsSync(path.join(appDir, "package.json"))) {
  console.error("\n  找不到 parent-app 目录，仓库可能不完整。\n");
  process.exit(1);
}

if (!fs.existsSync(path.join(appDir, "node_modules"))) {
  console.error("");
  console.error("  parent-app 还没有安装依赖。先运行一次：");
  console.error("");
  console.error("      cd parent-app");
  console.error("      npm install");
  console.error("");
  console.error("  然后再回到仓库根目录执行 npm run build:parent。");
  console.error("");
  process.exit(1);
}

try {
  execSync("npm run build:parent", { cwd: appDir, stdio: "inherit" });
} catch (error) {
  console.error("\n  家长端构建失败。把上面的报错发给 AI。\n");
  process.exit(typeof error.status === "number" ? error.status : 1);
}
