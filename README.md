# 蝇弈

与果蝇神经网络，弈一局中国象棋。

基于 [tolatolatop/fly-chess](https://github.com/tolatolatop/fly-chess) 改造的中国象棋版本，保留真实果蝇连接组、Rust/WASM 计算与对照实验。[在线对弈](https://fly-xiangqi.vercel.app) · [公开源码](https://github.com/tomzlabs/fly-xiangqi)。

一个已经能运行的果蝇连接组下棋实验。完整 FlyWire v783 网络在浏览器的 Web Worker 中用 **Rust → WebAssembly** 计算，不需要计算后端。棋盘、神经元点云、活动记录、棋步评分和断开突触的对照实验都可在页面查看。

**“真实”的范围：** 真实来源的连接图和实际执行的神经元数值模拟。不是活体果蝇，不是完整生物仿真，也没有证明果蝇理解中国象棋。棋盘编码和读出映射是人为定义的接口。当前读出层是**固定、尚未训练的线性投影**，棋力很弱。

## 中国象棋玩法

- 红先黑后；点击己方棋子，再点击提示落点。支持执红／执黑、翻转棋盘、撤回一轮、新对局、中文棋谱和 FEN 残局。
- 棋盘是九路十行，棋子在交叉点上。参考 [世界象棋联合会规则](https://www.wxf-xiangqi.org/images/wxf-rules/2018_World_XiangQi_Rules_English2018.pdf) 的基本走法；无合法走法的一方判负，包括困毙。
- **实验版和棋约定：** 同一局面（含行棋方）三次重复，或连续 120 半回合未吃子即判和。未实现竞赛长将、长捉裁定；这不是完整竞赛裁判程序。不会套用国际象棋的子力不足判和。
- FEN 使用十行、每行九路：`r n b a k c p` 表示车马象士将炮卒，大写为红方，`w` 为红方行棋，`b` 为黑方。坐标 `a0` 是红方左下角，`i9` 是黑方左下角；完整初始局面见 `src/xiangqi.mjs` 的 `START_FEN`。
- 每步仍由真实连接组输出选择，固定读出层尚未训练，棋力有限。

## 运行

Node.js 22.12+、Python 3.11+。仓库包含编译好的 WASM；首次克隆后，从固定 Release 下载并校验连接数据：

```bash
npm ci
npm run data:fetch
npm run dev -- --port 5188
```

打开 http://localhost:5188 。第一次下载连接图约 49.9 MB，之后走棋计算不发网络请求。浏览器需支持 WebAssembly、Web Worker、Web Crypto 和 DecompressionStream；请通过 localhost 或 HTTPS 打开。WebGL 只用于显示，失败时仍可计算。

构建静态站点（直接使用已有 WASM）：

```bash
npm run build:web
npm run preview -- --port 5189
```

`dist/` 可由普通静态服务器托管。已经验证带 `Content-Encoding: gzip` 和直接返回 gzip 文件两种数据响应方式。不需要服务器端 Python、GPU、数据库、API 密钥或 WebSocket。首次资源加载受网速影响。

## GitHub 与 Vercel 发布

源码以独立公开仓库形式发布到 [tomzlabs/fly-xiangqi](https://github.com/tomzlabs/fly-xiangqi)，已解除 GitHub Fork 关系，保留原始提交历史与来源说明。

Vercel 使用 `vercel.json`：`npm ci` → `npm run data:fetch` → `npm run build:web`，输出目录 `dist`，Node.js 22。浏览器中的计算完全本地运行，无需 API 密钥。

约 50 MB 的连接组资源存储在本仓库的 [connectome-v783 Release](https://github.com/tomzlabs/fly-xiangqi/releases/tag/connectome-v783)，不进入 Git 历史。构建脚本逐文件核对大小及 SHA-256，下载失败或校验失败会停止构建。GitHub Actions 运行规则、Rust 数值测试、静态构建以及全网络重复性／断连验证。

### 许可范围

本次原创新增代码与修改采用 MIT，见 [LICENSE](LICENSE)。上游应用没有声明项目许可证，其原有代码不在本次 MIT 授权范围内；研究数据、字体与第三方库保留各自条款。因此不能将整个项目标为统一 MIT 项目。来源见 [ATTRIBUTION](docs/ATTRIBUTION.md)。

修改 Rust 计算核心后重新编译：

```bash
rustup target add wasm32-unknown-unknown
npm run build
```

## 实际数据

使用 [Shiu 等人的官方研究代码](https://github.com/philshiu/Drosophila_brain_model)，固定提交 `91bdd1e7dcf193f3e7ca5a8933497fcef63b7960` 中的 `Completeness_783.csv` 和 `Connectivity_783.parquet`。以原始文件为准，不混用其他 v783 发行包的数量。

| 项目 | 本次文件中的数量 |
|---|---:|
| 神经元 | 138,639 |
| 有向神经元对连接 | 15,091,983 |
| 突触计数之和 | 54,492,922 |
| 可注释为视觉感觉的输入神经元 | 10,855 |
| 下行／运动输出神经元 | 1,409 |
| 有有效实测锚点的神经元 | 138,625 |

**保留作者全部神经元及连接，不做连接数阈值过滤，不随机生成网络，不裁剪子网络。** 只按突触前神经元排序、压成 CSR；同一神经元对的突触计数沿用原数据。正负符号来自作者基于神经递质信息的模型，不是我们新推定的生理测量。

类型与锚点来自 [flyconnectome/flywire_annotations](https://github.com/flyconnectome/flywire_annotations)，固定提交 `8587524c1748ce5ef2080822a2fc890fc03bf597`。采用 `pos_x/y/z` 锚点并按 4×4×40 nm 缩放，**不是完整神经元形态或连线的 3D 重建**；14 个缺少有效坐标的节点不显示，仍参与计算。

来源文件和生成文件的 SHA-256 在 `data/source-lock.json`、`public/data/manifest.json` 中。浏览器载入时校验哈希，不匹配即停止，不回退到假数据。

从固定来源重新制作资源（Python + numpy/pandas/pyarrow，原始文件约 136 MB，转换需额外内存）：

```bash
python -m pip install -r scripts/requirements-data.txt
npm run data
```

## 一步棋如何产生

1. `src/xiangqi.mjs` 处理中国象棋合法走法：车、马、相象、仕士、将帅、炮、兵卒；检查蹩马腿、塞象眼、过河、九宫、将帅照面、自陷将军、将死和困毙。规则层不提供局面评分。
2. 将当前棋盘编码为 90 个交叉点 × 14 种相对己方／敌方棋子通道。按固定索引把通道分配给真实视觉感觉神经元；占用通道接受 180 Hz 的有种子泊松式刺激。**这不等同于真实视觉转导，也不是视网膜空间映射。**
3. 从静息态开始，以 0.1 ms 步长运行 60 / 120 / 240 ms 的全网络 LIF 模型。每一步计算所有神经元的膜电位，只有放电节点触发稀疏突触传播。
4. 读出 1,409 个下行／运动神经元的特征：`脉冲数 + 平均膜电位偏移 / 7 mV`。因此输出神经元不放电时，亚阈值传播也可能影响结果。
5. 每个合法动作使用固定、由动作编码与神经元索引生成的 ±1 权重，对该特征向量做线性投影；取最高分，相同分数按 UCCI 坐标字符串排序。**该投影未训练，没有棋艺知识。**
6. 输出信号范数为零时，拒绝凭空选择走法。页面允许调整时长或种子后重试。

棋盘信息不能绕过神经元模拟直接进入局面评分。没有 Stockfish、Minimax、MCTS、子力分数、开局库或将杀辅助。整个棋艺策略仍然是人为设计的读出器；真实连接组计算不意味着天然会下好棋。

## 数值模型与验证

参数参考 [Shiu et al., Nature 2024](https://doi.org/10.1038/s41586-024-07763-9)：静息／复位 −52 mV，阈值 −45 mV，膜时间常数 20 ms，突触时间常数 5 ms，不应期 2.2 ms，传递延迟 1.8 ms，每突触权重 ±0.275 mV。

在事件之间对线性微分方程做解析更新；阈值检查、延迟突触事件、外部刺激、复位顺序详见 [模型说明](docs/model.md)。刺激采用共享确定性 xorshift32 流，与原作者 Brian2 的随机数流不同。每一步棋独立复位，不保留跨步“记忆”，没有突触可塑性。

```bash
npm test                      # Rust 数值测试 + JS 规则/读出/文件校验
npm run benchmark             # 全图实际 WASM、重复性和断连对照
python -m pip install brian2
npm run test:brian2            # 独立 Brian2 数值对照
npx playwright install chromium
npm run test:browser           # 需先启动 5188 端口页面
```

已验证的范围：

- 小回路中的解析衰减、兴奋／抑制、传播延迟、无输入静默、可重复性、断连行为。
- 上游保留的独立 Brian2 对照记录（本次未重跑）：4 个神经元、200 ms、136 次脉冲的时间和神经元编号完全一致，最终膜电位最大误差约 `2.56e-13 mV`。**这不是全脑生理有效性的验证。**
- 全图真实 WASM 测试：`e3e4`（兵五进一）后种子 42、120 ms 模拟，6,108 个脉冲、367 个放电神经元、下行／运动脉冲 2；网络选择 `b7a7`（砲2平1）。断连后仅输入群放电，输出信号为 0，不产生走法。
- macOS Node 22 的本次基准：120 ms 神经模拟约 0.74 秒核心计算、约 180 MiB WASM 线性内存。浏览器、图形、解压、JS 对象会额外占用内存；这是本机测量，不是所有手机的性能承诺。

详细结果见 `docs/benchmark.json`、`docs/brian2-validation.json`，浏览器验收结果在 `test-results/browser-check.json`。

## 相关 GitHub 项目与后续方向

| 项目 | 适合复用的部分 | 本项目的使用情况 |
|---|---|---|
| [philshiu/Drosophila_brain_model](https://github.com/philshiu/Drosophila_brain_model) | 论文作者的 Brian2 LIF 模型、连接数据 | 本项目的数据与参数基础，MIT 许可文本保留在 docs |
| [eonsystemspbc/fly-brain](https://github.com/eonsystemspbc/fly-brain) | Brian2 / CUDA / PyTorch / NEST GPU 等后端 | 可作为未来服务器计算的研究参照，未复制代码；GPL-2.0 |
| [vaibhavkedarisetti/fruit-fly-lab](https://github.com/vaibhavkedarisetti/fruit-fly-lab) | 全脑互动演示、感觉刺激与对照实验、浏览器实现 | 调研参考，未复制代码或下载其二进制；未见明确仓库许可证 |
| [flyconnectome/flywire_annotations](https://github.com/flyconnectome/flywire_annotations) | 真实神经元类型与位置注释 | 按固定提交与 root ID 联结 |

WASM 在本机已经可行，因此当前没有额外实现后端。若目标设备无法承受下载／内存，下一步可将**同一 Rust 核心**编译为本机库，由真实后端运行并返回同样的脉冲和读出记录。客户端必须清楚显示运行位置，不静默改用棋类引擎。

若要提高棋艺，需要另做带验证集的读出训练：保留连接图，训练活动→棋步映射，并比较完整图、断连图、打乱图及直接棋盘基线。仅仅有完整图比断连图更强，还不足以证明果蝇特有连接结构有棋艺优势。当前版本没有训练结果或 Elo 声称。

研究数据的归属及模型来源见 `docs/ATTRIBUTION.md`。
