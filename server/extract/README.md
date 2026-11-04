# 提纯代理服务

家长端拍照 → 本服务 → 阿里云视觉智能 → 回传透明 PNG。

## 为什么需要这一层

三个理由，缺一不可：

1. **密钥不能进前端。** 前端只认我们自己的 `/extract` 地址，换厂商前端不用改。
2. **阿里云的抠图接口吃的是公网 URL，不是 base64。** 所以本服务要先把图临时放进 OSS，
   签一个 2 分钟有效的地址交给它。
3. **服务端不落盘。** 处理完立刻删掉 OSS 上的临时对象，日志里不记图片内容。

## 阿里云准备

1. 开通**视觉智能开放平台**，确认要用的能力已经开通（默认「通用分割」）。
2. 建一个 **RAM 子账号**，只授权：
   - `AliyunOSSFullAccess`（限定到那一个桶更好）
   - 视觉智能对应的权限（`AliyunVIAPIFullAccess` 或按能力细分）
   **不要用主账号 AccessKey。**
3. 建一个 **私有** OSS 桶（不要开公共读），记下 region，比如 `oss-cn-shanghai`。

## 配置与启动

```sh
cd server/extract
cp .env.example .env      # 填 AccessKey、桶名、region
npm install
node --env-file=.env index.mjs
```

Windows 上的 PowerShell 里，`--env-file` 需要 Node 20+；也可以手动 `set` 环境变量。

启动后：

```
extract server: http://127.0.0.1:8787  action=SegmentCommonImage
```

健康检查：`GET /` 返回 `{"ok":true,"action":"..."}`。

## 接口约定

```
POST /extract
  头：Content-Type: application/json
      x-extract-token: <SHARED_TOKEN>   （服务端设了才需要）
  体：{ "image": "data:image/jpeg;base64,..." 或裸 base64 }
  ←  200 { "png": "<透明 PNG 的 base64>" }
  ←  500 { "error": "人话错误信息" }
```

**这个契约是稳定的**，换厂商只改 `index.mjs` 里的 `segment()`，前端不用动。

## 前端怎么接

家长端不提供填地址的界面（家长不该管这个）。开发/演示时手动指定一次：

```js
localStorage.setItem(
  "microstar.extract-config.v1",
  JSON.stringify({ endpoint: "http://127.0.0.1:8787/extract", key: "" }),
);
```

没配（或调用失败）时，家长端会自动退回**本地算法**——纯前端、不联网。
所以演示可以不接这个服务。

## 费用与合规

- 量级：每张几分钱到一毛钱。按每户每月 10 张、1000 户估，约 300 元/月。
- 照片只在**内存和临时对象**里待几十秒，处理完即删。
- 上传前家长端已经把图裁到 512 边长、剥掉 EXIF，不含 GPS 和拍摄地点。
- 上线前把这段写进隐私说明：照片会上传用于自动提纯，处理完成即删除。

## 已知未验证

这份代码**没有对真实账号跑过**（开发时没有可用的 AccessKey）。第一次联调时可能需要调整：

- `@alicloud/imageseg20191230` 的包名与版本，官方 SDK 迭代较快
- `SegmentCommonImage` 的对象方法名（可能是 `segmentCommonImage` 或 `segmentCommonImageWithOptions`）
- 视觉智能的 endpoint 区域（有的账号在 `cn-shanghai`，有的在 `cn-hangzhou`）

联调建议顺序：先 `GET /` 确认服务起来 → 用一张纯色背景的照片跑一次 → 看返回的 PNG 是否带透明通道。
