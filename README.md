# Fly Chess Lab · 连接与落子

[在线体验](https://tolatolatop.github.io/fly-chess/) · [GitHub 源码](https://github.com/tolatolatop/fly-chess) · [构建与部署记录](https://github.com/tolatolatop/fly-chess/actions/workflows/pages.yml)

一个已经能运行的果蝇连接组下棋实验。完整 FlyWire v783 网络在浏览器的 Web Worker 中用 **Rust → WebAssembly** 计算，不需要计算后端。棋盘、神经元点云、活动记录、棋步评分和断开突触的对照实验都可在页面查看。

**“真实”的范围：** 真实来源的连接图和实际执行的神经元数值模拟。不是活体果蝇，不是完整生物仿真，也没有证明果蝇理解国际象棋。棋盘编码和读出映射是人为定义的接口。当前读出层是**固定、尚未训练的线性投影**，棋力很弱。

## 运行

Node.js 22.12+、Python 3.11+。仓库包含编译好的 WASM；首次克隆后，用固定来源重建连接数据：

```bash
npm ci
python -m pip install -r scripts/requirements-data.txt
npm run data
npm run dev -- --port 5188
```

打开 http://localhost:5188 。第一次下载连接图约 49.9 MB，之后走棋计算不发网络请求。浏览器需支持 WebAssembly、Web Worker、Web Crypto 和 DecompressionStream；请通过 localhost 或 HTTPS 打开。WebGL 只用于显示，失败时仍可计算。

构建静态站点（直接使用已有 WASM）：

```bash
npm run build:web
npm run preview -- --port 5189
```

`dist/` 可由普通静态服务器托管。已经验证带 `Content-Encoding: gzip` 和直接返回 gzip 文件两种数据响应方式。不需要服务器端 Python、GPU、数据库、API 密钥或 WebSocket。首次资源加载受网速影响。

GitHub Pages 通过 `.github/workflows/pages.yml` 自动部署。每次推送到 `main` 都会从固定提交下载并校验原始数据、重建完整连接资源、重新编译 Rust/WASM、运行数值和全网络对照测试，再发布静态文件。大型生成资源不进入 Git 历史，但会完整包含在 Pages 发布产物中。无需上传 `node_modules`、原始数据缓存或手动维护 `gh-pages` 分支。

在本地验证 GitHub Pages 的项目子路径：

```bash
FLY_BASE_PATH=/fly-chess/ npm run build:web
FLY_BASE_PATH=/fly-chess/ npm run preview -- --port 5190
FLY_TEST_URL=http://localhost:5190/fly-chess/ npm run test:browser
```

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

1. `chess.js` 处理规则、合法走法、王车易位、吃过路兵、四种升变和终局判定。
2. 将当前棋盘编码为 64 格 × 12 种相对己方／敌方棋子通道。按固定索引把通道分配给真实视觉感觉神经元；占用通道接受 180 Hz 的有种子泊松式刺激。**这不等同于真实视觉转导，也不是视网膜空间映射。**
3. 从静息态开始，以 0.1 ms 步长运行 60 / 120 / 240 ms 的全网络 LIF 模型。每一步计算所有神经元的膜电位，只有放电节点触发稀疏突触传播。
4. 读出 1,409 个下行／运动神经元的特征：`脉冲数 + 平均膜电位偏移 / 7 mV`。因此输出神经元不放电时，亚阈值传播也可能影响结果。
5. 每个合法动作使用固定、由动作编码与神经元索引生成的 ±1 权重，对该特征向量做线性投影；取最高分，相同分数按 UCI 字符串排序。**该投影未训练，没有棋艺知识。**
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
python -m pip install playwright
python -m playwright install chromium
npm run test:browser           # 需先启动 5188 端口页面
```

已验证的范围：

- 小回路中的解析衰减、兴奋／抑制、传播延迟、无输入静默、可重复性、断连行为。
- 独立 Brian2 对照：4 个神经元、200 ms、136 次脉冲的时间和神经元编号完全一致，最终膜电位最大误差约 `2.56e-13 mV`。**这不是全脑生理有效性的验证。**
- 全图真实 WASM 测试：`e4` 后种子 42、120 ms 模拟，10,068 个脉冲、590 个放电神经元、下行／运动脉冲 0；读出仍有亚阈值信号。断连后仅输入群放电，输出信号为 0，不产生走法。
- Linux Node 22 的本次基准：120 ms 神经模拟约 0.41 秒核心计算、约 180 MiB WASM 线性内存。浏览器、图形、解压、JS 对象会额外占用内存；这是本机测量，不是所有手机的性能承诺。

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
