# 🎵 杰翔音乐源 (jiexiang-Music Source)

<p align="center">
  <img src="https://img.shields.io/badge/version-2.4.4-brightgreen" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="license">
  <img src="https://img.shields.io/badge/platform-LX%20Music-orange" alt="platform">
  <img src="https://img.shields.io/github/stars/haonanren118/jiexiang-Music-Source?style=social" alt="stars">
</p>

**杰翔音乐源**是专为 **洛雪音乐（LX Music）** 打造的超聚合自定义音源，融合 **QQ、网易云、酷我、酷狗、咪咕** 五大平台共 **61 个后端**（QQ 11 / 网易 20 / 酷我 2 / 酷狗 17 / 咪咕 11），支持 flac，其中 QQ/网易云支持母带与全景声。

本项目基于 [墨澜音乐源](https://github.com/baiji6/molanyinyueyuan)（作者：白姬9527，MIT 许可）二改。`杰翔音乐源.js` 在**各后端请求/签名逻辑与原版完全一致**的基础上，仅对调度层做了一处**安全加速（优先级窗口并发）**——不改变「最终返回哪个 URL」的语义，因此通过洛雪（LX Music）对 `musicUrl` 的校验与原版行为一致。详见下方「⚡ 安全加速」。

> 📦 仓库主页（双平台同步）：[GitHub](https://github.com/haonanren118/jiexiang-Music-Source) · [Gitee](https://gitee.com/yygitee118/jiexiang-Music-Source)

---

## 📣 欢迎进群沟通

> 使用中有问题、想加后端、想一起折腾音源，欢迎进群交流 👋
>
> 💬 **杰翔交流群**：[点击加入 QQ 群](https://qm.qq.com/cgi-bin/qm/qr?k=dEBGYbmu1lIRp7bAgHFim0W1uDsYl9v5&jump_from=webapi&authKey=fmTG96MhfqDQ5KARA/OvnuWAigCAloClvYhtSiEQd0jQneXmGons54BwlAh1+bUi)
>
> 也欢迎在仓库提交 [Issue](https://github.com/haonanren118/jiexiang-Music-Source/issues) 或 [Pull Request](https://github.com/haonanren118/jiexiang-Music-Source/pulls)，一起把音源做得更稳更快 🚀

---

## ⚡ 安全加速（不影响洛雪校验）

原版按后端**优先级串行**逐个尝试，最坏情况要等 N 个后端的累计延迟。本仓库在**不改变返回语义**的前提下做了唯一一处调度优化：

- **优先级窗口并发（窗口大小 `CONCURRENCY = 4`）**：每窗口最多 4 个后端同时发请求；窗口内采用「优先级竞价」——**一旦能确定最小索引（最高优先级）成功者就立即返回，不等同窗口内排在它后面的慢后端**。
- **按需降级**：仅当本窗口全部失败时，才发起下一窗口，避免无效等待。
- **返回结果与原串行数学等价**：绝不会因为「快但失效的低优先级后端」抢先而返回死链——这正是早期「并发竞速」方案在洛雪校验下报「API 返回异常」的根因，本方案已规避。
- **修复「比原版还慢」的回归**：初版窗口并发误用 `Promise.allSettled`，会傻等窗口里最慢的那个后端（哪怕最高优先级后端早已返回直链），导致点歌要多等一个慢后端的整段超时。现改为优先级竞价，最高优先级一成功即返回，开始播放的等待与原版一致甚至更快。
- **不动各后端逻辑**：`fishSign` 仍每次 fresh 取 `/time` 签名、不拦截 HTTP 4xx、不硬拒 URL、保留原版 KW 索引选择。因此通过洛雪探测校验的行为与原版一致。

实测（8 后端、命中第 8 个、单后端 80ms）：串行约 **740ms**，窗口并发约 **186ms**，提速约 4 倍；命中靠前时收益更大。音频本身下载速度（MB/s）取决于所选后端的 CDN，与原版返回的同一后端完全一致。

> 注：可达性兜底仅做「是否像直链（http(s)）」的轻量判断，真正的网络可达性仍交给洛雪自身探测，避免误拒原版本可播放的 URL。

---

## 📦 支持的平台与音质

| 平台 | 已配置 Cookie 音质 | 未配置 Cookie 音质 |
|------|--------------------|--------------------|
| QQ音乐 (tx) | 128k, 320k, flac, flac24bit, hires, atmos, atmos_plus, master | 128k, 320k, flac |
| 网易云音乐 (wy) | 128k, 320k, flac, flac24bit, hires, atmos, master | 128k, 320k, flac |
| 酷我音乐 (kw) | 128k, 192k, 320k | 128k, 192k, 320k |
| 酷狗音乐 (kg) | 128k, 320k | 128k, 320k |
| 咪咕音乐 (mg) | 128k, 320k, flac | 128k, 320k, flac |

💡 高音质（母带、全景声）需对应平台会员 Cookie，详见下方「🔑 Cookie 配置」。

---

## 📌 接入地址（v2.4.4 正式发行）

**在线导入**（洛雪「自定义源管理 → 在线导入」直接粘贴）：

```
https://gitee.com/yygitee118/jiexiang-Music-Source/raw/main/%E6%9D%B0%E7%BF%94%E9%9F%B3%E4%B9%90%E6%BA%90.js
```

- 历史版本：`历史版本/杰翔音乐源-2.4.3.js`、`历史版本/杰翔音乐源-2.4.2.js`、`历史版本/杰翔音乐源-2.4.1.js`、`历史版本/杰翔音乐源-2.3.0.js`
- 说明：kw 仅保留酷我官方手机版/车机版后端，最高输出 320k mp3；kg 最高输出 320k mp3（`animemusic` 置于首位）
- 2.4.4 新增：kw/wy 直链自动升级 https（`.kuwo.cn` / `.music.126.net` 域实测 https 与 http 字节数一致）、后端连续失败熔断、同曲 60 秒解析缓存、kg 2.5 秒软超时兜底
- 兼容：上一轮并存入口 `杰翔音乐源-2.4.3.js` 内容为 2.4.3，保留该文件仅为不影响已导入用户，后续版本不再更新它
- 回滚：把导入地址末尾的 `杰翔音乐源.js` 换成 `历史版本/杰翔音乐源-2.4.3.js`（URL 编码）即可退回 2.4.3
- 提示：请使用上面这条 **URL 编码后** 的地址。未编码的中文路径在浏览器、curl、Node 下可用，但 Python 及部分脚本会直接报错

---

## 🔧 安装与使用

### 📥 快速开始

1. 打开洛雪音乐 → 进入 **设置 → 音源管理 → 自定义音源**。
2. 点击右上角「+」（或「新建」），在编辑框中粘贴本仓库 `杰翔音乐源.js` 的完整内容。
3. 将脚本名称改为「**杰翔音乐源 (jiexiang-Music Source)**」（或任意你喜欢名字）。
4. 点击「保存」，然后启用该音源。
5. 在播放列表/歌单右上角切换音源为「杰翔音乐源」，即可开始使用。

### 📄 获取完整脚本

本项目同时托管于 **GitHub** 与 **Gitee**，二选一下载即可。国内用户推荐 Gitee 源（`raw.githubusercontent.com` 常被墙）：

```bash
# 方式一：GitHub 源（国际）
curl -O https://raw.githubusercontent.com/haonanren118/jiexiang-Music-Source/main/杰翔音乐源.js

# 方式二：Gitee 源（国内加速，推荐）
curl -O https://gitee.com/yygitee118/jiexiang-Music-Source/raw/main/%E6%9D%B0%E7%BF%94%E9%9F%B3%E4%B9%90%E6%BA%90.js
```

> 注意：确保复制完整，首尾包含 `/*!` 和 `*/` 的注释区域，避免语法错误。

🔒 **安全提示**：本音源仅涉及音乐播放，不收集任何个人隐私数据。若使用 Cookie 配置，请确保来源安全，切勿分享给他人。

---

## 🔑 Cookie 配置（解锁高音质）

若你拥有 QQ 音乐或网易云音乐的 VIP/付费会员，可在脚本顶部注释区（`/*! ... */` 内）按以下格式填写，自动解锁母带、全景声等高级音质：

```javascript
/*!
 * @name 杰翔聚合音源
 * @tx_cookie  uin=你的QQ号; skey=你的skey; ...
 * @wy_cookie  MUSIC_U=你的网易云音乐ID; ...
 */
```

- **QQ音乐**：登录 y.qq.com → F12 → Application → Cookies → 复制 `uin`、`skey`、`p_uin`、`p_skey` 等字段拼接。
- **网易云音乐**：登录 music.163.com → 开发者工具中查找 `MUSIC_U` 字段复制其值。

⚠️ Cookie 相当于登录凭证，请勿泄露给他人，建议使用小号或临时测试账号。

---

## 📋 后端数量一览

| 平台 | v2.4.4 后端数 | 本次实测（2026-11-25）出链 | 说明 |
|------|--------:|:--:|------|
| QQ音乐 (tx) | 11 | 7 | 出链：玉宁熙、收集聚合、tang、晴亮、回响、vkeys备用、长青直连；`QQ官方` 需配 `@tx_cookie`；`vkeys` 主端点当前 503、`Huibq` 已停服、`animemusic` 需 API Key |
| 网易云音乐 (wy) | 20 | — | 含 ikun、网易云官方(eapi)、ChKsZ、笒鬼鬼、toubiec、星海、残像(母带) 等（本次未逐条实测） |
| 酷我音乐 (kw) | 2 | — | 仅保留酷我官方手机版/车机版；官方无损档文件含坏帧，故最高输出 320k mp3；2.4.4 起直链统一 https |
| 酷狗音乐 (kg) | 17 | — | 含长青海棠(主API)、长青SVIP、星海、HelloWorld、妖狐、念心、海棠API、酷狗官方 等；2.4.4 起带 2.5 秒软超时 |
| 咪咕音乐 (mg) | 11 | 1 | 仅 `溯音咪咕`（128k）出链；星海主/备、xinghai-backend、长青、念心、聆澜、GDStudio、Migu 官方 web/App、聚合API、HYW 当前均失败 |

> 上表为 **v2.4.4** 数值（后端数量与 2.4.3 完全相同，本次只改调度层），与代码常量 `TX_BACKENDS / WY_BACKENDS / KW_BACKENDS / KG_BACKENDS / MG_BACKENDS` 一一对应。

---

## 📈 更新日志

### v2.4.4（2026-11-25）📌 正式发行

- 发行形式：`杰翔音乐源.js` 更新为 2.4.4，2.4.3 完整归档至 `历史版本/杰翔音乐源-2.4.3.js`（未改写，可回滚）。本次**只改脚本调度层**，未改飞牛音乐扩展（`app.py` / `proxy/app.py` 保持原版）。
- 针对「移动网络/外网下很多歌无法播放」：
  - 先排了排查，结论是通信层正常 —— 飞牛 App 主接口 2 天 2042 次请求全部 200（`track/audio`、`track/hls`、`metadata` 均正常），只有 QQ 曲目出现 404（tx 无 cookie 的已知限制）。
  - 真正放大的环节是扩展的**歌单可播预筛**：打开榜单时后台并发 10、最多 200 首逐首解析，任一首失败就记 30 分钟黑名单并把整份歌单剔除。实测单曲解析正常（120 首 kw 并发 10 全部成功、4.9 秒），但单个后端在高峰期整体故障时，旧逻辑要让每首都把它等满超时才降档，整片歌单会一起被判「不可播」。
  - 本次脚本侧四条改动：
    - **后端健康熔断**：同一后端连续失败 3 次 → 冷却 90 秒并排到最后（不剔除，全灭时仍能兜底），避免「一个后端挂了拖垮整片歌单」。
    - **http 直链升级 https**：kw 的 `car-bj / car-er / car-lv / car-lw.kuwo.cn`、wy 的 `m701 / m801.music.126.net` 实测换 https 后 HEAD 200 且 `Content-Length` 完全一致，消除明文链路在弱网下的探测失败。
    - **同曲同档 60 秒解析缓存**：预筛之后紧接着的点播请求直接命中，不再重复解析（实测第二次 0.00s）。
    - **kw/kg 的 lossless 首档显式降级到 320k**：扩展首档固定请求 lossless，旧表里没有这一档会先失败再降档，等于每首多一次往返。
  - **kg 软超时兜底**：kg 各后端输出同质 320k mp3，2.5 秒内若已有其它后端出链就直接采用，不再每首都等首位 `animemusic`（2.5～5 秒）。实测 40 首并发 10 的总耗时 34.6 秒 → 28.7 秒（其它 kg 后端本身也不快，故提升有限，但不会更慢）。
- 实测数据（2026-11-25，NAS 本地 4 核）：kw 120 首并发 10 全部成功、5.1 秒、全部 https；kg 40 首并发 10 全部成功；单曲解析 kw 0.3～0.6 秒、kg 2.5～5 秒。

### v2.4.3（2026-11-22）📌 正式发行

- 发行形式：`杰翔音乐源.js` 已更新为 2.4.3，2.4.2 原文件完整归档至 `历史版本/杰翔音乐源-2.4.2.js`（未丢失、未改写，可随时回滚）。上一轮并存文件 `杰翔音乐源-2.4.3.js` 与主线内容一致，保留仅为兼容已导入用户。
- 按 2026-11-22 实测补充可用后端，**只新增后端、未改调度层**（窗口并发、优先级竞价、返回语义全部不动）。
- QQ 新增 4 条，统一插在 `vkeys` 之前，避免只回试听片段的 `vkeys` 抢跑：
  - `晴亮(QQ)`：`music.lzmhhh.com`，320k mp3，实测 132ms
  - `回响(QQ)`：`api.xunhuisi.store`，整曲 m4a，实测 1.29s
  - `vkeys备用`：`api.vkeys.cn/music/tencent/song/link`，flac，实测 351ms
  - `长青直连(QQ)`：`175.27.166.236/kgqq1`，流式 `audio/mpeg`，支持 Range；脚本内先做 1KB Range 探测再交给洛雪，避免无效 ID 挂到超时
- 咪咕新增 `溯音咪咕`（`oiapi.net/api/MiGu_Music`）并置于**首位**：原第一梯队（星海主/备、GDStudio、Migu 直接源）当前全部失效，放在后面会白等 2～3 个窗口。该后端按歌名取链，脚本内用返回的 `copyrightId` 与 `songmid` 比对，不一致直接换源，防止串歌；免费额度最高 128k。
- 实测（模拟洛雪 `globalThis.lx` 跑 musicUrl）：QQ 7/11 出链、咪咕 1/11 出链；咪咕由「整链全灭」恢复为 1.1 秒内出链，QQ 首窗（`玉宁熙`）与新增后备均返回 206 `audio/mpeg`。
- 顺带修正 README 后端数量表：主线 2.4.2 实际为 TX 7 / MG 10，此前写的 26/12 是 2.3.0 的旧数据。
- 2.4.2 已归档、内容零改写；回滚只需把导入地址换成 `历史版本/杰翔音乐源-2.4.2.js`。

### v2.4.2（2026-11-20）📌 正式发行

- 修复酷狗（kg）无损档无法播放：`flac` 档实测返回 31,633,244 字节的 `audio/x-flac`，但整文件含坏帧，`ffmpeg` 全轨解码报错、无法播放（与 kw 旧问题同源）。同一 hash 走 `320k` 返回 10,792,943 字节 `audio/mpeg`，解码零错误。
- kg 音质声明收敛为 **128k / 320k**；`flac`、`flac24bit`、`hires`、`atmos`、`atmos_plus`、`master` 在解析前统一降级到 **320k mp3**。
- kg 后端顺序调整：`animemusic` 提到首位（当前唯一稳定出链的后端），解析耗时从实测 6.93 / 7.64 / 11.64 秒降至 5.02 / 3.79 / 5.03 / 2.67 秒，避免逼近 12 秒超时上限。
- 回归验证：kw 未受影响（320k mp3、10,797,030 字节、269.87 秒、解码零错误）。
- 上一版本归档至 `历史版本/杰翔音乐源-2.4.1.js`，可随时回滚。

### v2.4.1（2026-11-20）📌 正式发行

- 修复酷我（kw）大量歌曲无法播放：官方无损档（`2000kflac`）返回的文件内含坏帧，ffmpeg 全轨解码报 `invalid sync code` / `decode_frame failed`（实测 8/8 首全坏，NAS 后台校验 32/32 全失败），播放到坏帧处即中断。
- kw 音质声明与档位映射统一锁定 **128k / 192k / 320k mp3**，不再请求官方无损档；实测 320k 档 8/8 首解码零错误。
- QQ、网易、酷狗、咪咕的高音质与母带链路不受影响。
- 上一版本归档至 `历史版本/杰翔音乐源-2.4.0.js`，可随时回滚。

### v2.4.0（2026-11-19）📌 正式发行

- 版本号升级至 2.4.0，README 新增「接入地址」说明与发行标记。
- 酷我（kw）后端调整为仅保留官方手机版/车机版，其余长期失效的第三方后端已移除。
- 上一版本归档至 `历史版本/杰翔音乐源-2.3.0.js`，可随时回滚。

### v2.3.0-jiexiang-safe（2026-09-13）⚡ 安全加速

- 调度层改为**优先级窗口并发（`CONCURRENCY = 4`）+ 优先级竞价 + 按需降级**，返回「最小索引成功者」，与原串行返回结果数学等价。
- 保留各后端请求/签名逻辑、KW 索引选择、`fishSign` 每次 fresh 签名；不拦截 HTTP 4xx、不硬拒 URL。
- 通过洛雪对 `musicUrl` 的校验语义与原版一致（不触发「API 返回异常」）。
- 修订：窗口内由 `Promise.allSettled` 改为优先级竞价（最高优先级成功即返回，不再等慢后端），修复「开始播放比原版还慢」的回归。单测覆盖：快赢不被慢输拖住、慢赢优先、窗口降级、HTML 误响应拒收等场景。

### v2.3.0（墨澜音乐源 / 杰翔二改版，本仓库）

- 修复网易云音乐（wy）相关问题。
- 新增星澜聚合后端：QQ越权（3 重策略）、ygking QQ、残像 WY（母带）、星海聚合、yunmge 酷我、念心酷狗。
- 酷我新增流媒体直链（atmos/atmos_plus/master 高音质专线）。
- 引入 Hello World API 与 HYWmusic 公益 API。

> 本仓库文件基于上游原版，仅含上述「安全加速」调度优化，未改动任何后端逻辑。如需讨论其他优化，请见 [Issue](https://github.com/haonanren118/jiexiang-Music-Source/issues)。

---

## 📜 关于 LICENSE

本项目以 **MIT 许可证** 发布，基于墨澜音乐源二改，已保留原作者版权声明（见 `LICENSE`）。你可以自由使用、修改、分发，但须保留原作者版权与许可声明。

---

## 🤝 贡献指南

欢迎任何形式的贡献（代码、文档、建议、后端）：

- 🐞 **报告 Bug**：在 [Issues](https://github.com/haonanren118/jiexiang-Music-Source/issues) 附上洛雪版本、平台、复现步骤、错误日志。
- 💡 **提新后端**：说明后端 URL、API 文档、支持平台与音质。
- 💬 **进群聊**：见顶部「欢迎进群沟通」。

---

## 🔗 相关链接

- 洛雪音乐官网：https://lxmusic.toside.cn/
- 自定义音源文档：https://lxmusic.toside.cn/mobile/custom-source
- **本仓库**：https://github.com/haonanren118/jiexiang-Music-Source
- **上游原版（墨澜音乐源）**：https://github.com/baiji6/molanyinyueyuan
- HYWmusic 公益项目：https://github.com/Macrohard0001/HYWmusic_source

---

## 🙏 致谢

本项目的每一行代码都离不开社区支持，特别感谢：

- **白姬9527（[baiji6](https://github.com/baiji6/molanyinyueyuan)）** —— 墨澜音乐源原作者，本二改版的基础。感谢开源与授权二改。
- **星澜聚合音源**（[lick563](https://github.com/lick563/Xinglan-aggregate-sound-sources)）—— 提供了 QQ越权、ygking、残像、星海聚合、yunmge、念心酷狗等优质后端。
- **ikun 音源** —— 网易云音乐 API 与音质格式参考。
- **酷我流媒体音源** —— 酷我高音质流媒体直链方案。
- **长青SVIP 音源二改版** —— 酷狗长青海棠主 API 与音质映射。
- **Hei Music** —— Migu 系列、长青、念心等后端。
- **HYWmusic** —— 公益项目作者，无私维护免费 API。
- **LX Music 开发团队** —— 打造优秀的开源播放器并开放自定义音源接口。
- 所有参与测试、反馈、提交 PR 的用户。

> 本项目以 MIT 许可证发布，基于墨澜音乐源二改，已保留原作者版权声明（见 LICENSE）。

---

杰翔音乐源 v2.4.4 —— 汇聚百川，只为每一首歌流畅抵达。
如果你喜欢这个项目，别忘了点 ⭐ **Star** 支持我们，并欢迎进群一起交流！🎵

*免责声明：本项目仅用于学习与技术研究，请遵守相关平台服务条款与当地法律法规，勿用于商业或侵权用途。*
