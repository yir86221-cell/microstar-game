# 云端主体分割候选（2026-11-10 核对）

本次只调查接口，不开通服务、不上传用户照片、不调用付费图片接口。0.1.9 仍完全使用本机后台抠图。以下是按现有“保留原色、点选主体、可擦除补回”的要求作出的接入判断，尚未用实际照片对各服务进行效果或延迟测试。

| 方案 | 与项目的适配 | 费用及限制 |
| --- | --- | --- |
| Photoroom Remove Background API | 自动识别主体；`channels=alpha` 直接返回蒙版，适合单件物品拍照后自动抠图 | 官方文档标价 $0.02/次，套餐和额度需核对控制台。单独蒙版没有服务端 matting，边缘可能不如完整抠图结果；要对比实际杯柄、孔洞和半透明物体 |
| fal 托管 SAM 2 image | 支持前景/背景点和矩形提示；设置 `apply_mask=false` 取分割输出，适合保留“点哪件物品就选哪件” | 需要独立 FAL_KEY。公开页面显示的 $0/计算秒不足以确认实际账单，接入前以控制台或价格接口核实，不能据此认定永久免费 |
| 自建 SAM 2 / SAM 2.1 服务 | 可用原图及点击坐标计算蒙版，再在手机套回原图；可自行选择部署地域和存储策略 | 官方提供推理代码和模型，检查点/主要代码采用 Apache 2.0。需自行承担服务器、部署与运维成本，并实测 GPU/CPU 性能 |

## 建议

只要自动抠单个物品，可先小规模测试 Photoroom。要保留点选其他物品的能力，优先评估 SAM 2 托管接口；长期使用并有服务器条件，再考虑自建。这些服务不能复用 OpenAI API 密钥。

API 接入时先压缩照片、保持方向和尺寸一致，在自己的后端保存密钥；手机收取与原图对齐的蒙版，并使用原始 RGB 合成透明图片。关闭自动裁剪/重定位，避免蒙版与原图错位；返回临时链接时及时下载。失败应保留原图并允许手动编辑，不能用生成式重绘静默替换真实物体。

Photoroom 如需保留服务端的边缘处理，可额外测试完整 PNG 的 alpha 通道套回原图；要验证尺寸一致及边缘质量，不能假定所有输出路径完全相同。SAM 2 的分割掩码也不等于精细透明度抠图，半透明和毛发等边缘需单独评估。

## 未列为首选的服务

阿里云视觉智能开放平台的 SegmentCommonImage 原本支持中心主体和 mask，但官方已公告自 2026-10-11 停止新用户开通，2028-04-30 全面停止服务，因此不建议作为新的接入方案。

## 官方依据

- [Photoroom 蒙版输出与边缘限制](https://docs.photoroom.com/remove-background-api-basic-plan/download-the-segmentation-mask)
- [Photoroom 专用抠图接口](https://docs.photoroom.com/remove-background-api-basic-plan/quickstart-guide)
- [Photoroom 价格](https://docs.photoroom.com/remove-background-api-basic-plan/pricing)
- [fal SAM 2 点选/框选、输出参数](https://fal.ai/models/fal-ai/sam2/image/api)
- [fal SAM 2 当前展示页](https://fal.ai/models/fal-ai/sam2/image)
- [fal 计费规则](https://fal.ai/docs/documentation/model-apis/pricing)
- [Meta SAM 2 源码、部署与许可](https://github.com/facebookresearch/sam2)
- [阿里云退市公告](https://help.aliyun.com/zh/viapi/product-overview/announcement-regarding-the-discontinuation-of-online-services-on-the-visual-intelligence-open-platform)
