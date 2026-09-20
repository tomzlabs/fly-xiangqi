# 蝇境 · Fly World

一只果蝇的连续世界：神经活动驱动行动，环境变化影响输入，行为记录形成视频分镜。

[进入蝇境](https://fly-xiangqi.vercel.app/) · [源代码](https://github.com/tomzlabs/fly-xiangqi) · [视频方案研究](docs/trumanworld-research.md)

## 当前可以做什么

- 在浏览器中运行完整果蝇连接组的连续 LIF 模拟，保留相邻窗口的神经状态。
- 观察微观场景、跟随果蝇，调整光照和浆果位置。
- 录制画面，导出行为分镜，载入视频片段顺序播放。
- 使用本地有界视频工作器生成短片，以上一段末帧衔接下一段；默认离线检查，不产生费用。

首页就是蝇境，旧 `/world/` 地址跳转到首页。项目已移除棋盘、棋规及相关页面。仓库与部署域名保留原地址，避免破坏现有链接和数据下载。

**当前边界：** 在线画面是 Three.js 模拟；尚未接入 AI 视频直播。模拟在网页打开时运行，关闭或刷新不保留神经状态。感觉输入和运动读出都是工程映射，没有经过生物行为验证，也不代表读取了果蝇的主观体验。

## 开发与验证

```sh
npm ci
npm run data:fetch
npm run dev -- --host 127.0.0.1 --port 5277 --strictPort
npm test
npm run test:world
npm run build:web
```

浏览器需支持 WebAssembly、Web Worker、Web Crypto、DecompressionStream 和 WebGL。首次加载约 50 MB 连接组资源。网络计算耗时可能超过模拟时长；页面区分模型时间与实际录制时间。

修改 Rust 核心后使用 `npm run build` 重新构建 WASM。数值模型、世界适配器见 [模型说明](docs/model.md)，视频生成与恢复步骤见 [运行说明](docs/fly-world.md)。

## 数据与计算

使用 [Shiu 等人的研究模型](https://github.com/philshiu/Drosophila_brain_model)，固定提交 `91bdd1e7dcf193f3e7ca5a8933497fcef63b7960`。

| 项目 | 数量 |
|---|---:|
| 神经元 | 138,639 |
| 有向神经元对连接 | 15,091,983 |
| 突触计数之和 | 54,492,922 |
| 感觉输入神经元 | 10,855 |
| 下行／运动输出神经元 | 1,409 |

保留该作者导出中的全部神经元及连接，不随机生成连接，不裁剪网络。感觉输入采用人工定义的 8 通道编码，输出使用固定、未训练投影。窗口间保留膜电位、突触电流、延迟队列与随机数状态，没有在线学习。

资源存储于 [connectome-v783 Release](https://github.com/tomzlabs/fly-xiangqi/releases/tag/connectome-v783)。构建和浏览器加载都检查 SHA-256。来源清单见 `data/source-lock.json` 与 `public/data/manifest.json`。

## 发布

Vercel 从 GitHub 的 main 分支自动发布。构建命令：`npm run data:fetch && npm run build:web`。GitHub Actions 验证数值核心、世界适配器、资源完整性，以及完整网络的可重复性与断连对照。

无限 AI 视频直播应增加独立的后台生成会话、统一世界状态、共享直播分发、恢复机制与费用限额。参考 [Truman World 公开实现分析](docs/trumanworld-research.md)。当前没有启动任何付费常驻任务。

## 来源与许可

神经计算与数据工具源自 [tolatolatop/fly-chess](https://github.com/tolatolatop/fly-chess)，保留来源和原始历史。tomzlabs 原创贡献使用 MIT；上游应用当时未声明项目许可证，不能将整个项目视作统一 MIT 项目。研究数据、字体和第三方库保留各自条款。详见 [LICENSE](LICENSE) 与 [来源说明](docs/ATTRIBUTION.md)。
