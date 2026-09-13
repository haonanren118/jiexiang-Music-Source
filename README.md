# 🎵 杰翔音乐源 (jiexiang-Music Source)

<p align="center">
  <img src="https://img.shields.io/badge/version-2.3.0-brightgreen" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="license">
  <img src="https://img.shields.io/badge/platform-LX%20Music-orange" alt="platform">
  <img src="https://img.shields.io/github/stars/haonanren118/jiexiang-Music-Source?style=social" alt="stars">
</p>

**杰翔音乐源**是专为 **洛雪音乐（LX Music）** 打造的超聚合自定义音源，融合 **QQ、网易云、酷我、酷狗、咪咕** 五大平台 **90+ 个后端**，支持 flac，其中 QQ/网易云/酷我支持母带与全景声。

本项目基于 [墨澜音乐源](https://github.com/baiji6/molanyinyueyuan)（作者：白姬9527，MIT 许可）二改。`杰翔音乐源.js` 在**各后端请求/签名逻辑与原版完全一致**的基础上，仅对调度层做了一处**安全加速（优先级窗口并发）**——不改变「最终返回哪个 URL」的语义，因此通过洛雪（LX Music）对 `musicUrl` 的校验与原版行为一致。详见下方「⚡ 安全加速」。

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

- **优先级窗口并发（窗口大小 `CONCURRENCY = 4`）**：每窗口最多 4 个后端同时发请求；窗口内全部完成后，**只采纳「最小索引（最高优先级）成功者」**。
- **按需降级**：仅当本窗口全部失败时，才发起下一窗口，避免无效等待。
- **返回结果与原串行数学等价**：绝不会因为「快但失效的低优先级后端」抢先而返回死链——这正是早期「并发竞速」方案在洛雪校验下报「API 返回异常」的根因，本方案已规避。
- **不动各后端逻辑**：`fishSign` 仍每次 fresh 取 `/time` 签名、不拦截 HTTP 4xx、不硬拒 URL、保留原版 KW 索引选择。因此通过洛雪探测校验的行为与原版一致。

实测（8 后端、命中第 8 个、单后端 80ms）：串行约 **740ms**，窗口并发约 **186ms**，提速约 4 倍；命中靠前时收益更大。

> 注：可达性兜底仅做「是否像直链（http(s)）」的轻量判断，真正的网络可达性仍交给洛雪自身探测，避免误拒原版本可播放的 URL。

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

### v2.3.0-jiexiang-safe（2026-09-13）⚡ 安全加速

- 调度层改为**优先级窗口并发（`CONCURRENCY = 4`）+ 按需降级**，返回「最小索引成功者」，与原串行返回结果数学等价。
- 保留各后端请求/签名逻辑、KW 索引选择、`fishSign` 每次 fresh 签名；不拦截 HTTP 4xx、不硬拒 URL。
- 通过洛雪对 `musicUrl` 的校验语义与原版一致（不触发「API 返回异常」）。单测覆盖：返回优先级、窗口降级、HTML 误响应拒收、并发提速等场景。

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

杰翔音乐源 v2.3.0 —— 汇聚百川，只为每一首歌流畅抵达。
如果你喜欢这个项目，别忘了点 ⭐ **Star** 支持我们，并欢迎进群一起交流！🎵

*免责声明：本项目仅用于学习与技术研究，请遵守相关平台服务条款与当地法律法规，勿用于商业或侵权用途。*
