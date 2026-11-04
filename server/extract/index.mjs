/**
 * 提纯服务：家长端 → 这里 → 阿里云视觉智能 → 回传透明 PNG。
 *
 * 为什么要有这一层：
 *   1. 密钥不能进前端。前端只认自己的 /extract 地址，厂商换了前端不用动。
 *   2. 阿里云的抠图接口吃的是**公网 URL**，不是 base64，
 *      所以这里要先把图临时丢进 OSS，签一个 2 分钟有效的地址给它。
 *   3. 服务端不落盘：处理完立刻删掉 OSS 上的临时对象。
 *
 * 需要的环境变量见 .env.example。
 * ⚠️ 这份代码没有对真实账号跑过（开发时没有可用的 AccessKey），
 *    第一次联调时可能需要按官方文档微调 endpoint / 参数名。
 */

import http from "node:http";
import { randomUUID } from "node:crypto";
import OSS from "ali-oss";
import Imageseg from "@alicloud/imageseg20191230";
import * as $OpenApi from "@alicloud/openapi-client";

const {
  ALIYUN_ACCESS_KEY_ID,
  ALIYUN_ACCESS_KEY_SECRET,
  ALIYUN_OSS_BUCKET,
  ALIYUN_OSS_REGION = "oss-cn-shanghai",
  ALIYUN_ENDPOINT = "imageseg.cn-shanghai.aliyuncs.com",
  /** SegmentCommonImage（通用分割）| SegmentCommodity（商品分割） */
  ALIYUN_ACTION = "SegmentCommonImage",
  PORT = "8787",
  /** 可选：简单口令，设了就要求请求头 x-extract-token 一致 */
  SHARED_TOKEN = "",
} = process.env;

const MAX_BYTES = 4 * 1024 * 1024;

let oss = null;
let client = null;

function ensureClients() {
  if (oss && client) return;
  if (!ALIYUN_ACCESS_KEY_ID || !ALIYUN_ACCESS_KEY_SECRET || !ALIYUN_OSS_BUCKET) {
    throw new Error("缺少 ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / ALIYUN_OSS_BUCKET");
  }
  oss = new OSS({
    region: ALIYUN_OSS_REGION,
    accessKeyId: ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: ALIYUN_ACCESS_KEY_SECRET,
    bucket: ALIYUN_OSS_BUCKET,
  });

  client = new Imageseg.default(
    new $OpenApi.Config({
      accessKeyId: ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: ALIYUN_ACCESS_KEY_SECRET,
      endpoint: ALIYUN_ENDPOINT,
    }),
  );
}

/** dataURL 或裸 base64 → Buffer */
function decodeImage(input) {
  const comma = input.indexOf(",");
  const base64 = comma >= 0 ? input.slice(comma + 1) : input;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) throw new Error("图片是空的");
  if (buffer.length > MAX_BYTES) throw new Error("图片太大");
  return buffer;
}

/**
 * 抠图。
 * 注意：阿里云的接口要一个**公网可访问**的 URL，
 * 所以先把图放进私有 OSS，签一个短效地址，处理完立刻删。
 */
async function segment(buffer) {
  ensureClients();

  const key = `microstar-tmp/${randomUUID()}.jpg`;
  await oss.put(key, buffer, { headers: { "Content-Type": "image/jpeg" } });

  try {
    // 私有桶 + 临时签名：地址 2 分钟后失效，不公开暴露
    const signedUrl = oss.signatureUrl(key, { expires: 120 });

    const request = new Imageseg.SegmentCommonImageRequest({ imageURL: signedUrl });
    const response = await client.segmentCommonImage(request);

    const outUrl = response?.body?.data?.imageURL;
    if (!outUrl) throw new Error("云端没有返回结果");

    // 结果地址也是临时的，立刻下载，别存下来
    const png = Buffer.from(await (await fetch(outUrl)).arrayBuffer());
    return png.toString("base64");
  } finally {
    // 无论成败都删，服务端不保存任何照片
    try {
      await oss.delete(key);
    } catch {
      /* 删不掉不影响本次结果 */
    }
  }
}

const server = http.createServer(async (req, res) => {
  const cors = {
    "Access-Control-Allow-Origin": req.headers.origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-extract-token",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  if (req.method === "GET") {
    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, action: ALIYUN_ACTION }));
    return;
  }

  if (req.method !== "POST" || !req.url?.startsWith("/extract")) {
    res.writeHead(404, cors);
    res.end("Not found");
    return;
  }

  if (SHARED_TOKEN && req.headers["x-extract-token"] !== SHARED_TOKEN) {
    res.writeHead(401, cors);
    res.end("Unauthorized");
    return;
  }

  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BYTES + 1024) throw new Error("请求体太大");
      chunks.push(chunk);
    }

    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (typeof body.image !== "string") throw new Error("缺少 image 字段（dataURL 或 base64）");

    const png = await segment(decodeImage(body.image));

    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ png }));
  } catch (error) {
    res.writeHead(500, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
});

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`extract server: http://127.0.0.1:${PORT}  action=${ALIYUN_ACTION}`);
});
