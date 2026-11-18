/**
 * 微动星瞳 BLE 协议常量。
 *
 * 四条 UUID 必须与固件里的字符串**逐字符一致**，任何改动都要两端同步。
 * 协议字节表见 docs 附录 B（微动星瞳-家长端软件架构 v1.1）。
 */

/** 总入口服务 */
export const SERVICE_UUID = "8a1f0001-3c4d-4e5f-9a6b-7c8d9e0f1a2b";
/** 灯的运行模式，写 1 字节 */
export const ALERT_UUID = "8a1f0002-3c4d-4e5f-9a6b-7c8d9e0f1a2b";
/** 颜色与亮度，写 5 字节 */
export const LIGHT_UUID = "8a1f0003-3c4d-4e5f-9a6b-7c8d9e0f1a2b";
/** 拿起/放下状态，notify 7 字节 */
export const MOTION_UUID = "8a1f0004-3c4d-4e5f-9a6b-7c8d9e0f1a2b";
/** 主动读取：闪烁、运动标记、IMU 状态，各 1 字节。 */
export const STATUS_UUID = "8a1f0005-3c4d-4e5f-9a6b-7c8d9e0f1a2b";

/** 扫描过滤器用的设备名 */
export const DEVICE_NAME = "MicroStar";

/**
 * 协议版本。
 * 固件若在未来扩展 ALERT 的取值，这里要跟着升，App 才能判断要不要降级。
 */
export const PROTOCOL_VERSION = 1;
