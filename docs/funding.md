# 公共直播时间池（接入准备版）

收款链：Solana mainnet-beta。资产：Circle 原生 USDC（6 位小数）。
收款地址：`2vHrtE8gs2MFwCbJcVjr6MoTzpGHxgQcgev66TeRxczC`。

## 当前状态

页面、Solana Pay 订单/二维码、服务端链上核验和 Postgres 时间账本已实现。
**生产收款默认关闭。没有部署数据库、没有接入共享视频发布器，没有发起付费视频调用。**
这不是完整的付费直播系统；现在的 Three.js 模拟仍免费，余额不会因为用户打开页面而扣减。

拟定套餐：5 / 15 / 25 USDC 对应 60 / 180 / 300 秒。该价格参考 Truman World，
并非已经确认的成本报价或盈利保证。需要根据实际视频、传输、数据库等成本重新确认。

## 本机验证

- `node --test tests/funding.test.mjs`：本机 PGlite 执行真实 Postgres SQL，验证重复到账、交易重放、重复扣减、余额不足；验证交易金额、币种、收款人、订单时间和 API 关闭状态。
- `npm run build:web`
- `node scripts/check-funding-browser.mjs`：本地 Vite 服务运行于 5277 时测试页面与模拟支付流程。测试请求只使用本地 fixtures，不进行真实付款。

## 环境配置

只在 Vercel 或本机 `.env`（Git 已忽略）配置：

| 变量 | 用途 |
| --- | --- |
| DATABASE_URL | Neon Postgres 连接串，服务端使用 |
| SOLANA_RPC_URL | 支持 mainnet finalized 交易查询的 RPC |
| OPERATOR_SECRET | 高熵后台授权密钥，不给浏览器 |
| FUNDING_ENABLED | 默认未设置。只有 `true` 才可能创建订单 |
| LIVE_PUBLISHER_READY | 默认未设置。接入并验证真实发布器后才允许设为 `true` |

迁移：`node --env-file=.env scripts/migrate-funding.mjs`。它不应在每次 Vercel 函数请求中运行。
当前无需钱包私钥；接收地址是公开地址，付款由观众的钱包自行签名。

## 接口与账本

- `GET /api/funding/status`：服务器余额、套餐、收款开放状态；不模拟倒计时。
- `POST /api/funding/order`，JSON `{ "minutes": 1 }`：开放后创建 15 分钟有效的订单，返回 Solana Pay URI、reference、订单 capability。
- `GET /api/funding/order?id=…`，请求头 `x-order-capability`：核验最终确认交易。订单只保存 capability 哈希。关闭新收款后仍可核验已有订单。
- `POST /api/operator/usage`，`Authorization: Bearer …`，JSON `{ "segmentId": "UUID", "seconds": 5 }`：发布器提交稳定唯一的片段 ID，原子扣减 1–30 秒。重复请求不会重复扣费，余额不足返回 409。

核验接收地址净增的原生 USDC、reference、交易成功状态、时间范围及主网 genesis；全局唯一交易签名防止重复使用凭证。订单期间付款、稍晚 finalized 的交易仍可核验。
超过订单时间付款、直接向地址转账或缺少 reference 不会自动入账，需要人工处理。
一个 reference 只查询最近 20 笔交易。未来需增加分页索引和后台补单；目前用户关闭页面后不会自动核验，重新打开当前标签会恢复 sessionStorage 订单。

## 正式开放前的必要剩余工作

1. 确认视频提供商、API 密钥和明确的试运行费用上限；密钥不通过聊天发送。
2. 部署数据库和 RPC，增加订单/API 限流、后台补单及账单告警，完成 devnet 集成测试。
3. 接入唯一共享发布器及观众视频分发。发布器必须在余额不足、扣费失败、连接异常时停止生成；闲置或暂停不扣时。
4. 当前扣减接口只是账本原语，不预留余额、不管理发布器租约。正式发布器必须实现单实例/租约、重启恢复、片段投递核对、费用上限与未播出退款；不能只加环境开关就认为系统完整。
5. 在限定预算下验证真实视频、付款、入账、播放、断线、余额耗尽和退款流程，再开放生产收款。

参考规范：[Solana Pay](https://docs.solanapay.com/spec)、[Circle USDC 地址](https://developers.circle.com/stablecoins/usdc-contract-addresses)。
