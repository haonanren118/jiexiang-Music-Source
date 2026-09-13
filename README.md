# 🎵 杰翔音乐源 (jiexiang-Music Source)

<p align="center">
  <img src="https://img.shields.io/badge/version-2.3.0--jiexiang-brightgreen" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="license">
  <img src="https://img.shields.io/badge/platform-LX%20Music-orange" alt="platform">
  <img src="https://img.shields.io/badge/JavaScript-ES5+-yellow" alt="js">
  <img src="https://img.shields.io/badge/optimized-并发竞速-9cf" alt="optimized">
  <img src="https://img.shields.io/github/stars/haonanren118/jiexiang-Music-Source?style=social" alt="stars">
</p>

杰翔音乐源是专为 **洛雪音乐（LX Music）** 打造的超聚合自定义音源，融合 **QQ、网易云、酷我、酷狗、咪咕** 五大平台 **90+ 个后端**。

本项目基于 [墨澜音乐源](https://github.com/baiji6/molanyinyueyuan)（作者：白姬9527）二改，在保留全部后端的基础上，对调度引擎做了性能与健壮性优化（见下文「⚡ 优化亮点」）。

---

## 📣 欢迎进群沟通

> 使用中有问题、想加后端、想一起折腾音源，欢迎进群交流 👋
>
> 💬 **杰翔交流群**：[点击加入 QQ 群](https://qm.qq.com/cgi-bin/qm/qr?k=dEBGYbmu1lIRp7bAgHFim0W1uDsYl9v5&jump_from=webapi&authKey=fmTG96MhfqDQ5KARA/OvnuWAigCAloClvYhtSiEQd0jQneXmGons54BwlAh1+bUi)
>
> 也欢迎在仓库提交 [Issue](https://github.com/haonanren118/jiexiang-Music-Source/issues) 或 [Pull Request](https://github.com/haonanren118/jiexiang-Music-Source/pulls)，一起把音源做得更稳更快 🚀

---

## ⚡ 优化亮点（相对原版墨澜音乐源）

| # | 优化项 | 收益 | 说明 |
|---|--------|------|------|
| 1 | **后端并发竞速** | ⭐⭐⭐ 秒级→毫秒级 | 原版「串行轮询」逐个尝试，最坏可达数分钟；改为所有后端**同时请求、第一个成功即返回**（`firstSuccess` 竞速，不依赖 `Promise.any`，最大兼容 LX 沙箱）。 |
| 2 | **成功后端记忆** | ⭐⭐⭐ 二次播放更快 | 记录每个 `平台\|音质` 上次命中的后端，下次优先排到队首，跳过已证实不可用的源。 |
| 3 | **fishSign 缓存** | ⭐⭐ 少一次网络往返 | Fish API 签名原本每次播放都请求 `/time`；现缓存 8 秒（签名本就是秒级时间戳），减少延迟。 |
| 4 | **入口补齐 `rid`/`musicId`** | ⭐⭐ 修复潜在失败 | 原版入口 `songId` 仅取 `hash/songmid/id`，酷我等仅靠 `rid` 标识的歌曲会在入口直接抛错；现已补齐。 |
| 5 | **KW 高音质标记化** | ⭐⭐ 消除索引耦合隐患 | 原版靠「数组索引 0」判断酷我流媒体直链，插入后端即错位；现用 `streamOnly` 标记识别，顺序无关。 |
| 6 | **DEBUG 日志开关** | ⭐ 不刷屏/不泄露 | 后端竞速日志默认关闭（`DEBUG = false`），需要时置 `true` 才会打印，避免在控制台暴露听歌记录。 |
| 7 | **去除冗余 Promise 包装** | ⭐ 代码更干净 | 注册事件里的 `.then(Promise.resolve).catch(Promise.reject)` 冗余包装已移除。 |

> 后端数量、平台、音质支持与原版完全一致（90+ 后端，五大平台，含母带/全景声）。
> 说明：原版中 `MUSIC_QUALITY` 用 `JSON.parse` 内联字符串、`cleanUrl` 会截断 query 等可读性/健壮性项，本次为**最小化破坏风险**未改动；如需进一步重构可参看 Issue 讨论。

---

## 📦 支持的平台与音质

| 平台 | 已配置 Cookie 音质 | 未配置 Cookie 音质 |
|------|--------------------|--------------------|
| QQ音乐 (tx) | 128k, 320k, flac, flac24bit, hires, atmos, atmos_plus, master | 128k, 320k, flac |
| 网易云音乐 (wy) | 128k, 320k, flac, flac24bit, hires, atmos, master | 128k, 320k, flac |
| 酷我音乐 (kw) | 128k, 192k, 320k, flac, flac24bit | 128k, 192k, 320k, flac, flac24bit |
| 酷狗音乐 (kg) | 128k, 320k, flac, hires, atmos, master | 128k, 320k, flac, hires, atmos, master |
| 咪咕音乐 (mg) | 128k, 320k, flac | 128k, 320k, flac |

💡 高音质（母带、全景声）需对应平台会员 Cookie，详见下方「🔑 Cookie 配置」。

---

## 🔧 安装与使用

### 📥 快速开始

1. 打开洛雪音乐 → 进入 **设置 → 音源管理 → 自定义音源**。
2. 点击右上角「+」（或「新建」），在编辑框中粘贴本仓库 `杰翔音乐源.js` 的完整内容。
3. 将脚本名称改为「**杰翔音乐源 (jiexiang-Music Source)**」（或任意你喜欢名字）。
4. 点击「保存」，然后启用该音源。
5. 在播放列表/歌单右上角切换音源为「杰翔音乐源」，即可开始使用。

### 📄 获取完整脚本

```bash
curl -O https://raw.githubusercontent.com/haonanren118/jiexiang-Music-Source/main/杰翔音乐源.js
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

| 平台 | 后端数 | 说明 |
|------|--------|------|
| QQ音乐 (tx) | 26 | 含 QQ官方、星海、溯音、xcvts、vkeys、柳云、317ak、lxmusic88、HYWmusic 公益、QQ越权、ygking 等 |
| 网易云音乐 (wy) | 20 | 含 ikun、网易云官方(eapi)、ChKsZ、笒鬼鬼、toubiec、星海、残像(母带) 等 |
| 酷我音乐 (kw) | 17 | 含酷我流媒体高音质专线、星海、笒鬼鬼、聚合API、酷我官方/手机版/车机版、HelloWorld、yunmge 等 |
| 酷狗音乐 (kg) | 18 | 含长青海棠(主API)、长青SVIP、星海、HelloWorld、妖狐、念心、海棠API、酷狗官方 等 |
| 咪咕音乐 (mg) | 12 | 含星海、聚合API、Migu 直接源/API、长青、念心、聆澜、HYWmusic 等 |

> 实际数量随版本迭代可能增加，请以代码 `TX_BACKENDS / WY_BACKENDS / KW_BACKENDS / KG_BACKENDS / MG_BACKENDS` 为准。

---

## 📈 更新日志

### v2.3.0-jiexiang（2026-09-13）⚡ 优化版

基于墨澜音乐源 v2.3.0 二改，应用上述 7 项优化：

- 后端调度由串行轮询改为**并发竞速**（首个成功即返回）。
- 新增成功后端记忆，二次播放优先命中。
- `fishSign` 缓存 8 秒，减少网络往返。
- 歌曲 ID 入口补齐 `rid`/`musicId`。
- 酷我高音质改用 `streamOnly` 标记，解除数组索引耦合。
- 新增 `DEBUG` 日志开关（默认关闭）。
- 清理冗余 Promise 包装。

### 原版 v2.3.0（墨澜音乐源）

- 修复网易云音乐（wy）相关问题。
- 新增星澜聚合后端：QQ越权（3 重策略）、ygking QQ、残像 WY（母带）、星海聚合、yunmge 酷我、念心酷狗。
- 酷我新增流媒体直链（atmos/atmos_plus/master 高音质专线）。
- 引入 Hello World API 与 HYWmusic 公益 API。

---

## 🤝 贡献指南

欢迎任何形式的贡献（代码、文档、建议、后端）：

- 🐞 **报告 Bug**：在 [Issues](https://github.com/haonanren118/jiexiang-Music-Source/issues) 附上洛雪版本、平台、复现步骤、错误日志。
- 💡 **提新后端**：说明后端 URL、API 文档、支持平台与音质。
- 🔧 **提交 PR**：Fork → 分支 `feature/xxx` → 保持 ES5 语法兼容 LX 沙箱 → 在对应 `BACKENDS` 数组按优先级插入 → 提 PR。
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

杰翔音乐源 v2.3.0-jiexiang —— 汇聚百川，只为每一首歌流畅抵达。
如果你喜欢这个项目，别忘了点 ⭐ **Star** 支持我们，并欢迎进群一起交流！🎵

*免责声明：本项目仅用于学习与技术研究，请遵守相关平台服务条款与当地法律法规，勿用于商业或侵权用途。*
