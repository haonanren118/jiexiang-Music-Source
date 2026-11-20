/*!
 * @name 杰翔聚合音源
 * @description 全平台支持flac，wy，qq，kg支持母带；kw 仅保留官方后端，且最高 320k mp3（官方无损档文件坏帧）
 * @version 2.4.1
 * @author https://qm.qq.com/cgi-bin/qm/qr?k=dEBGYbmu1lIRp7bAgHFim0W1uDsYl9v5&jump_from=webapi&authKey=fmTG96MhfqDQ5KARA/OvnuWAigCAloClvYhtSiEQd0jQneXmGons54BwlAh1+bUi
 * @homepage https://github.com/baiji6/molanyinyueyuan
 * @license MIT
 * @update 2026-11-20
 * @changelog
    1.修复wy音源
    2.新增QQ越权
    3.修复kw音源：停用恒返回广告片段的「酷我官方」后端，修正流媒体档位映射，
      非母带档位不再剔除星海主后端（kw 可播率 32% → 100%）
    4.【2.4.0】kw 仅保留官方手机版/车机版后端：移除 14 个长期失效的第三方后端，
      修复飙升榜大面积「无法播放」；官方接口实测 0.1–0.3 秒出链
    5.【2.4.1】kw 官方无损档（2000kflac）实测返回文件含坏帧（ffmpeg 报 invalid sync
      code / decode_frame failed，8/8 全坏），播放到坏帧即中断，外网弱链路更易失败：
      kw 音质声明与档位映射统一锁定 128k/192k/320k mp3，不再请求无损档；
      QQ/网易/酷狗/咪咕的高音质不受影响
 */


const { EVENT_NAMES, request, on, send, utils, env, version, currentScriptInfo } = globalThis.lx

// ==================== 解析头部注解 ====================

const currentScript = currentScriptInfo
  ? currentScriptInfo.rawScript
  : (typeof document !== 'undefined' ? document.currentScript?.textContent || '' : '')

const parseHeader = (str) => {
  const comment = /^\/\*!(?:.|\n)+?\*\//.exec(str)?.[0]
  if (!comment) return {}
  const result = {}
  const pairs = [
    { key: 'tx_cookie', regex: /\*\s*@tx_cookie\s+(.+)/ },
    { key: 'wy_cookie', regex: /\*\s*@wy_cookie\s+(.+)/ },
  ]
  for (const { key, regex } of pairs) {
    const match = regex.exec(comment)
    const val = match?.[1]?.trim()
    result[key] = (!val || val === 'null') ? '' : val
  }
  return result
}

const config = parseHeader(currentScript)
const TX_COOKIE = config.tx_cookie
const WY_COOKIE = config.wy_cookie
const HAS_TX_COOKIE = !!TX_COOKIE
const HAS_WY_COOKIE = !!WY_COOKIE

// ==================== 音质列表（参照ikun音源格式） ====================

const MUSIC_QUALITY = JSON.parse(HAS_TX_COOKIE && HAS_WY_COOKIE
  ? '{"tx":["128k","320k","flac","flac24bit","hires","atmos","atmos_plus","master"],"wy":["128k","320k","flac","flac24bit","hires","atmos","master"],"kw":["128k","192k","320k"],"kg":["128k","320k","flac","hires","atmos","master"],"mg":["128k","320k","flac"]}'
  : HAS_TX_COOKIE
    ? '{"tx":["128k","320k","flac","flac24bit","hires","atmos","atmos_plus","master"],"wy":["128k","320k","flac"],"kw":["128k","192k","320k"],"kg":["128k","320k","flac","hires","atmos","master"],"mg":["128k","320k","flac"]}'
    : HAS_WY_COOKIE
      ? '{"tx":["128k","320k","flac"],"wy":["128k","320k","flac","flac24bit","hires","atmos","master"],"kw":["128k","192k","320k"],"kg":["128k","320k","flac","hires","atmos","master"],"mg":["128k","320k","flac"]}'
      : '{"tx":["128k","320k","flac"],"wy":["128k","320k","flac"],"kw":["128k","192k","320k"],"kg":["128k","320k","flac","hires","atmos","master"],"mg":["128k","320k","flac"]}'
)

const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY)

// ==================== 工具函数 ====================

const httpFetch = (url, options = { method: 'GET' }) => new Promise((resolve, reject) => {
  request(url, options, (err, resp) => {
    if (err) return reject(err)
    let body = resp.body
    if (typeof body === 'string') {
      const trimmed = body.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
        try { body = JSON.parse(trimmed) } catch (e) {}
      }
    }
    resolve({ body, statusCode: resp.statusCode, headers: resp.headers || {} })
  })
})

const md5 = (str) => utils.crypto.md5(str)

const randomGuid = () => {
  const hex = '0123456789abcdef'
  let guid = ''
  for (let i = 0; i < 32; i++) guid += hex[Math.floor(Math.random() * 16)]
  return guid
}

const aesEncrypt = (data, key, iv, mode) => {
  if (!version) mode = mode.split('-').pop()
  return utils.crypto.aesEncrypt(data, mode, key, iv)
}

const buf2hex = (buffer) => {
  return version
    ? utils.buffer.bufToString(buffer, 'hex')
    : [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('')
}

const wyEapi = (url, object) => {
  const eapiKey = 'e82ckenh8dichen8'
  const text = typeof object === 'object' ? JSON.stringify(object) : object
  const digest = md5('nobody' + url + 'use' + text + 'md5forencrypt')
  const data = url + '-36cd479b6b5-' + text + '-36cd479b6b5-' + digest
  return { params: buf2hex(aesEncrypt(data, eapiKey, '', 'aes-128-ecb')).toUpperCase() }
}

const objToForm = (obj) => Object.keys(obj).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k])).join('&')

const extractUrl = (obj, paths) => {
  for (const path of paths) {
    let val = obj
    for (const key of path) {
      if (val == null) { val = undefined; break }
      val = val[key]
    }
    if (Array.isArray(val)) val = val[0]
    if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) return val
    if (typeof val === 'string' && val.startsWith('//')) return 'https:' + val
  }
  return ''
}

const cleanUrl = (url) => {
  if (!url) return ''
  const s = String(url).replace(/\\?u0026/gi, '&').replace(/\\&/g, '&').replace(/\$/g, '&')
  const idx = s.indexOf('?')
  return idx > 0 ? s.substring(0, idx) : s
}

// ==================== 通用音质转Level工具 ====================

const qualityToLevel = (quality) => {
  const map = {
    '128k': 'standard',
    '192k': 'standard',
    '320k': 'exhigh',
    'flac': 'lossless',
    'flac24bit': 'lossless',
    'hires': 'lossless',
    'atmos': 'lossless',
    'atmos_plus': 'lossless',
    'master': 'lossless',
  }
  return map[quality] || 'standard'
}

// ==================== SHA256 工具（用于 Hello World API 签名） ====================

const sha256 = (function() {
  var HEX_CHARS = '0123456789abcdef'.split('');
  function Sha256() {
    this.blocks = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    this.h0 = 0x6a09e667;
    this.h1 = 0xbb67ae85;
    this.h2 = 0x3c6ef372;
    this.h3 = 0xa54ff53a;
    this.h4 = 0x510e527f;
    this.h5 = 0x9b05688c;
    this.h6 = 0x1f83d9ab;
    this.h7 = 0x5be0cd19;
    this.block = this.start = this.bytes = this.hBytes = 0;
    this.finalized = this.hashed = false;
    this.first = true;
  }
  Sha256.prototype.update = function(message) {
    if (this.finalized) return;
    var notString = typeof message !== 'string';
    var blocks = this.blocks;
    for (var i = 0; i < message.length; i++) {
      if (this.hashed) {
        this.hashed = false;
        blocks[0] = this.block;
        blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
      }
      var code = notString ? message[i] : message.charCodeAt(i);
      blocks[this.start >> 2] |= code << (24 - (this.start % 4) * 8);
      this.start++;
      if (this.start === 64) {
        this.block = blocks[16];
        this.start = 0;
        this.hash();
        this.hashed = true;
      }
    }
    this.bytes += message.length;
    if (this.bytes > 4294967295) {
      this.hBytes += this.bytes / 4294967296 << 0;
      this.bytes = this.bytes % 4294967296;
    }
    return this;
  };
  Sha256.prototype.finalize = function() {
    if (this.finalized) return;
    this.finalized = true;
    var blocks = this.blocks;
    var i = this.start;
    blocks[16] = this.block;
    blocks[i >> 2] |= 0x80 << (24 - (i % 4) * 8);
    this.block = blocks[16];
    if (i >= 56) {
      if (!this.hashed) this.hash();
      blocks[0] = this.block;
      blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
    }
    blocks[14] = this.hBytes << 3 | this.bytes >>> 29;
    blocks[15] = this.bytes << 3;
    this.hash();
  };
  Sha256.prototype.hash = function() {
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var a = this.h0, b = this.h1, c = this.h2, d = this.h3, e = this.h4, f = this.h5, g = this.h6, h = this.h7, blocks = this.blocks;
    for (var j = 0; j < 64; j++) {
      if (j >= 16) {
        var w0 = blocks[j - 15];
        var w1 = blocks[j - 2];
        var s0 = ((w0 >>> 7) | (w0 << 25)) ^ ((w0 >>> 18) | (w0 << 14)) ^ (w0 >>> 3);
        var s1 = ((w1 >>> 17) | (w1 << 15)) ^ ((w1 >>> 19) | (w1 << 13)) ^ (w1 >>> 10);
        blocks[j] = blocks[j - 16] + s0 + blocks[j - 7] + s1;
      }
      var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      var ch = (e & f) ^ ((~e) & g);
      var temp1 = h + S1 + ch + K[j] + (blocks[j] >>> 0);
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = S0 + maj;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    this.h0 = (this.h0 + a) >>> 0;
    this.h1 = (this.h1 + b) >>> 0;
    this.h2 = (this.h2 + c) >>> 0;
    this.h3 = (this.h3 + d) >>> 0;
    this.h4 = (this.h4 + e) >>> 0;
    this.h5 = (this.h5 + f) >>> 0;
    this.h6 = (this.h6 + g) >>> 0;
    this.h7 = (this.h7 + h) >>> 0;
  };
  Sha256.prototype.hex = function() {
    this.finalize();
    var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3, h4 = this.h4, h5 = this.h5, h6 = this.h6, h7 = this.h7;
    return HEX_CHARS[(h0 >> 28) & 0x0F] + HEX_CHARS[(h0 >> 24) & 0x0F] + HEX_CHARS[(h0 >> 20) & 0x0F] + HEX_CHARS[(h0 >> 16) & 0x0F] + HEX_CHARS[(h0 >> 12) & 0x0F] + HEX_CHARS[(h0 >> 8) & 0x0F] + HEX_CHARS[(h0 >> 4) & 0x0F] + HEX_CHARS[h0 & 0x0F] + HEX_CHARS[(h1 >> 28) & 0x0F] + HEX_CHARS[(h1 >> 24) & 0x0F] + HEX_CHARS[(h1 >> 20) & 0x0F] + HEX_CHARS[(h1 >> 16) & 0x0F] + HEX_CHARS[(h1 >> 12) & 0x0F] + HEX_CHARS[(h1 >> 8) & 0x0F] + HEX_CHARS[(h1 >> 4) & 0x0F] + HEX_CHARS[h1 & 0x0F] + HEX_CHARS[(h2 >> 28) & 0x0F] + HEX_CHARS[(h2 >> 24) & 0x0F] + HEX_CHARS[(h2 >> 20) & 0x0F] + HEX_CHARS[(h2 >> 16) & 0x0F] + HEX_CHARS[(h2 >> 12) & 0x0F] + HEX_CHARS[(h2 >> 8) & 0x0F] + HEX_CHARS[(h2 >> 4) & 0x0F] + HEX_CHARS[h2 & 0x0F] + HEX_CHARS[(h3 >> 28) & 0x0F] + HEX_CHARS[(h3 >> 24) & 0x0F] + HEX_CHARS[(h3 >> 20) & 0x0F] + HEX_CHARS[(h3 >> 16) & 0x0F] + HEX_CHARS[(h3 >> 12) & 0x0F] + HEX_CHARS[(h3 >> 8) & 0x0F] + HEX_CHARS[(h3 >> 4) & 0x0F] + HEX_CHARS[h3 & 0x0F] + HEX_CHARS[(h4 >> 28) & 0x0F] + HEX_CHARS[(h4 >> 24) & 0x0F] + HEX_CHARS[(h4 >> 20) & 0x0F] + HEX_CHARS[(h4 >> 16) & 0x0F] + HEX_CHARS[(h4 >> 12) & 0x0F] + HEX_CHARS[(h4 >> 8) & 0x0F] + HEX_CHARS[(h4 >> 4) & 0x0F] + HEX_CHARS[h4 & 0x0F] + HEX_CHARS[(h5 >> 28) & 0x0F] + HEX_CHARS[(h5 >> 24) & 0x0F] + HEX_CHARS[(h5 >> 20) & 0x0F] + HEX_CHARS[(h5 >> 16) & 0x0F] + HEX_CHARS[(h5 >> 12) & 0x0F] + HEX_CHARS[(h5 >> 8) & 0x0F] + HEX_CHARS[(h5 >> 4) & 0x0F] + HEX_CHARS[h5 & 0x0F] + HEX_CHARS[(h6 >> 28) & 0x0F] + HEX_CHARS[(h6 >> 24) & 0x0F] + HEX_CHARS[(h6 >> 20) & 0x0F] + HEX_CHARS[(h6 >> 16) & 0x0F] + HEX_CHARS[(h6 >> 12) & 0x0F] + HEX_CHARS[(h6 >> 8) & 0x0F] + HEX_CHARS[(h6 >> 4) & 0x0F] + HEX_CHARS[h6 & 0x0F] + HEX_CHARS[(h7 >> 28) & 0x0F] + HEX_CHARS[(h7 >> 24) & 0x0F] + HEX_CHARS[(h7 >> 20) & 0x0F] + HEX_CHARS[(h7 >> 16) & 0x0F] + HEX_CHARS[(h7 >> 12) & 0x0F] + HEX_CHARS[(h7 >> 8) & 0x0F] + HEX_CHARS[(h7 >> 4) & 0x0F] + HEX_CHARS[h7 & 0x0F];
  };
  return function(message) {
    return new Sha256().update(message).hex();
  };
})();

const HELLO_WORLD_API_KEY = 'lxmusic';
const HELLO_WORLD_SECRET_KEY = 'JaJ?a7Nwk_Fgj?2o:znAkst';
const HELLO_WORLD_SCRIPT_MD5 = '1888f9865338afe6d5534b35171c61a4';
const helloWorldSign = (requestPath) => sha256(requestPath + HELLO_WORLD_SCRIPT_MD5 + HELLO_WORLD_SECRET_KEY);

const HYW_API_BASE = 'http://103.79.184.97';
const HYW_CARD_KEY = 'MOLAN-BAIJI';

// ==================== QQ 音乐音质文件映射 ====================

const TX_FILE_CONFIG = {
  '128k': { s: 'M500', e: '.mp3', br: '128k' },
  '320k': { s: 'M800', e: '.mp3', br: '320k' },
  flac: { s: 'F000', e: '.flac', br: 'flac' },
  flac24bit: { s: 'AI00', e: '.flac', br: 'flac24bit' },
  hires: { s: 'AI00', e: '.flac', br: 'hires' },
  atmos: { s: 'AI00', e: '.flac', br: 'atmos' },
  atmos_plus: { s: 'AI00', e: '.flac', br: 'atmos' },
  master: { s: 'AI00', e: '.flac', br: 'master' },
}

// ==================== 网易云音质映射 ====================

const WY_LEVEL_MAP = {
  '128k': 'standard',
  '320k': 'exhigh',
  flac: 'lossless',
  flac24bit: 'hires',
  hires: 'hires',
  atmos: 'sky',
  master: 'jymaster',
}

const WY_BR_MAP = {
  '128k': 128000,
  '320k': 320000,
  flac: 999000,
  flac24bit: 999000,
  hires: 999001,
  atmos: 999002,
  master: 999003,
}

// ==================== 酷我音质Level映射（笒鬼鬼等专用） ====================

const KW_LEVEL_MAP = {
  '128k': '128k',
  '192k': '128k',
  '320k': '320k',
  flac: 'lossless',
  flac24bit: 'lossless',
}

// ==================== 酷狗音质Level映射（长青SVIP音源二改版专用） ====================

const KG_LEVEL_MAP = {
  '128k': 'standard',
  '192k': 'standard',
  '320k': 'exhigh',
  flac: 'lossless',
  flac24bit: 'hires',
  hires: 'hires',
  atmos: 'atmos',
  atmos_plus: 'atmos',
  master: 'clear',
}

// ==================== 酷我流媒体音质Level映射（175.27.166.236:8928 专用） ====================
//
// 2026-10-20 实测：该服务只接受 master / hires / atmos / atmos_plus 四档，
// 传 flac / 320k / 128k 一律返回 {"code":400,"msg":"不支持的音质参数"}。
// 原映射把 flac→flac、320k→320k、128k→128k，导致「酷我流媒体」后端**永远 400**，
// 而它是 kw 少数能按 rid 返回完整无损音频的后端（实测 level=master 对不同 rid
// 返回 md5 各异的真 FLAC，1.0~2.1 MB，Range 206）。
// 修正：非母带档位统一落到 hires（无损），母带档位保持原样。
// 高音质优先策略不变（atmos/atmos_plus/master 走 backends[0] 星海主后端）。

const KW_STREAM_LEVEL_MAP = {
  '128k': 'hires',
  '192k': 'hires',
  '320k': 'hires',
  flac: 'hires',
  flac24bit: 'hires',
  hires: 'hires',
  atmos: 'atmos',
  atmos_plus: 'atmos_plus',
  master: 'master',
}

// ==================== Fish API 签名工具 ====================

const FISH_DOMAIN = 'music.gdstudio.xyz'
const FISH_VERSION = '20260510'

const fishSign = async (secret) => {
  const timeRes = await httpFetch('https://' + FISH_DOMAIN + '/time', { method: 'GET', timeout: 6000 })
  const timeStr = String(Number(timeRes.body) || Date.now()).slice(0, 9)
  const signInput = FISH_DOMAIN + '|' + FISH_VERSION + '|' + timeStr + '|' + secret
  return md5(signInput).slice(-8).toUpperCase()
}

const fishPost = async (params, secret) => {
  const sign = await fishSign(secret)
  params.s = sign
  const body = objToForm(params)
  const res = await httpFetch('https://' + FISH_DOMAIN + '/api.php', {
    method: 'POST',
    timeout: 6000,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: 'https://' + FISH_DOMAIN,
      Referer: 'https://' + FISH_DOMAIN + '/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body,
  })
  return res.body
}

// ==================== 新增后端函数（取自星澜聚合音源 v3.1.1.1） ====================

// -------- QQ越权（3重策略） --------
const getQQExploit = async (songId, quality, musicInfo) => {
  const songmid = songId || musicInfo?.songmid || musicInfo?.id
  if (!songmid) throw new Error('QQ越权: 缺少 songmid')
  const mediaMid = musicInfo?.mediaMid || musicInfo?.strMediaMid || musicInfo?.media_mid || ''
  const prefixMap = { '128k':'M500','192k':'M800','320k':'M800','flac':'F000','flac24bit':'RS01','hires':'RS01','atmos':'atmosphere','atmos_plus':'atmosphere','master':'AIM00' }
  const prefix = prefixMap[quality] || 'M800'
  const extMap = { 'M500':'mp3','M800':'mp3','F000':'flac','RS01':'flac','AIM00':'mflac','atmosphere':'flac' }
  const ext = extMap[prefix] || 'mp3'
  const midForFile = mediaMid || songmid
  const qqKey = '1984LZXvCR'
  const qqUin = '1234567890'
  const pgv_pvid = Math.floor(Math.random() * 10000000000).toString()
  const qqCookie = `qm_keyst=${qqKey}; uin=o${qqUin}; pgv_pvid=${pgv_pvid}; qqmusic_key=${qqKey}; qqmusic_uin=o${qqUin}; psrf_qqaccess_token=${qqKey}; ts_uid=${pgv_pvid}; psi=${pgv_pvid}`

  // 策略A: ut.y.qq.com GetEVkey
  const filename = `${prefix}${midForFile}.${ext}`
  const bodyA = {
    comm: { ct: 19, cv: 0, guid: pgv_pvid, tmeAppID: 'qqmusic', qq: qqUin },
    hot: { method: 'CgiGetHotVkey', module: 'music.vkey.GetEVkey', param: { filename: [filename], songmid: [songmid] } },
    ekey: { method: 'GetEkey', module: 'music.vkey.GetEVkey', param: { finfo: [{ filename, mid: midForFile || '0' }] } }
  }
  try {
    const resp = await httpFetch('https://ut.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST', timeout: 5000,
      headers: { 'Content-Type': 'application/json', 'Referer': 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Cookie': qqCookie },
      body: JSON.stringify(bodyA)
    })
    const d = resp.body
    if (d?.hot?.data?.urls?.[0]?.purl) {
      return 'https://dl.stream.qqmusic.qq.com/' + d.hot.data.urls[0].purl
    }
  } catch (e) {}

  // 策略B: u.y.qq.com platform=23
  const variants = [
    { name: '双songmid', filename: `${prefix}${songmid}${songmid}.${ext}`, uin: qqUin, loginflag: 1 },
    { name: '单songmid', filename: `${prefix}${songmid}.${ext}`, uin: qqUin, loginflag: 1 },
    { name: '双空uin', filename: `${prefix}${songmid}${songmid}.${ext}`, uin: '', loginflag: 1 },
    { name: '单空uin', filename: `${prefix}${songmid}.${ext}`, uin: '', loginflag: 1 }
  ]
  for (const v of variants) {
    try {
      const param = { filename: [v.filename], songmid: [songmid], songtype: [0], uin: v.uin, loginflag: v.loginflag, platform: '23', firstlogin: 1, newver: 1, nohash: 0, cms: 0 }
      const apiData = JSON.stringify({
        comm: { uin: v.uin ? parseInt(v.uin) : 0, format: 'json', ct: 23, cv: 0, ...(v.uin ? { qq: v.uin } : {}) },
        req_0: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey', param }
      })
      const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=${encodeURIComponent(apiData)}`
      const resp = await httpFetch(url, {
        method: 'GET', timeout: 5000,
        headers: { 'Referer': 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Cookie': qqCookie }
      })
      const d = resp.body
      if (d?.code === 0 && d?.req_0?.data?.midurlinfo?.[0]?.purl) {
        const sip = d.req_0.data.sip?.[0] || 'https://dl.stream.qqmusic.qq.com/'
        return sip + d.req_0.data.midurlinfo[0].purl
      }
    } catch (e) {}
  }

  // 策略C: ut+key 增强
  try {
    const bodyC = {
      comm: { ct: 19, cv: 0, guid: pgv_pvid, tmeAppID: 'qqmusic', qq: qqUin },
      hot: { method: 'CgiGetHotVkey', module: 'music.vkey.GetEVkey', param: { filename: [filename], songmid: [songmid] } }
    }
    const resp = await httpFetch('https://ut.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST', timeout: 5000,
      headers: { 'Content-Type': 'application/json', 'Referer': 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0 QQMusic/2201', 'Cookie': qqCookie },
      body: JSON.stringify(bodyC)
    })
    const d = resp.body
    if (d?.hot?.data?.urls?.[0]?.purl) {
      return 'https://dl.stream.qqmusic.qq.com/' + d.hot.data.urls[0].purl
    }
  } catch (e) {}

  throw new Error('QQ越权全部失败')
}

// -------- ygking QQ（全音质） --------
// -------- 残像 WY（母带） --------
// -------- 星海聚合（通用） --------
// -------- yunmge 酷我 --------
const getYunmgeKw = async (songId, quality, musicInfo) => {
  const id = musicInfo?.rid || musicInfo?.songmid || songId
  if (!id) throw new Error('yunmge: 缺少 id')
  const brMap = { '128k':128, '192k':192, '320k':320, 'flac':2000, 'flac24bit':2000, 'hires':4000, 'master':4000 }
  const wantBr = brMap[quality] || 320
  const url = `https://api.yunmge.com/kuwo?key=yunmge_key&token=yunmge_token&id=${encodeURIComponent(id)}`
  const resp = await httpFetch(url, { method: 'GET', timeout: 5000 })
  const d = resp.body
  if (d?.code === 200 && d?.data?.all_bitrates) {
    const list = d.data.all_bitrates
    const brOrder = [4000, 2000, 320, 192, 128]
    for (const br of brOrder) {
      if (br < wantBr) continue
      const item = list.find(b => b.bitrate === br || String(b.bitrate) === String(br))
      if (item && item.play_url) return item.play_url
    }
    const fallback = list.find(b => b.play_url)
    if (fallback) return fallback.play_url
  }
  throw new Error('yunmge 失败')
}

// -------- 念心酷狗 --------
const getNianxinKg = async (songId, quality, musicInfo) => {
  const hash = musicInfo?.hash || musicInfo?.songmid || songId
  if (!hash) throw new Error('念心: 缺少 hash')
  const levelMap = { '128k':'128kmp3','192k':'320kmp3','320k':'320kmp3','flac':'2000kflac','flac24bit':'4000kflac','hires':'hires','master':'4000kflac','atmos':'4000kflac','atmos_plus':'4000kflac' }
  const level = levelMap[quality] || '320kmp3'
  const url = `https://mcp.nianxinxz.com/kgqq/kg.php?id=${encodeURIComponent(hash)}&level=${level}&type=mp3`
  const resp = await httpFetch(url, { method: 'GET', timeout: 5000 })
  const d = resp.body
  if (d?.code === 200 && d?.url) return d.url
  if (typeof d === 'string' && d.startsWith('http')) return d
  throw new Error('念心 失败')
}

// -------- animemusic 聚合（次惜科技 lx-animemusic v3.0.1，全新独立多平台源） --------
// 单一聚合端点，支持 qq/wy/kw/kg；按平台从 musicInfo 取正确的音乐 ID。
const ANIMEMUSIC_API_URL = 'https://animemusic.bzxhkj.com/v1/index.php'
const getAnimemusic = async (amSource, songId, quality, musicInfo) => {
  let id = songId
  if (amSource === 'qq') id = musicInfo?.songmid || musicInfo?.id || songId
  else if (amSource === 'wy') id = musicInfo?.id || musicInfo?.songid || musicInfo?.songmid || songId
  else if (amSource === 'kw') id = musicInfo?.rid || musicInfo?.songmid || musicInfo?.id || songId
  else if (amSource === 'kg') id = musicInfo?.hash || musicInfo?.songmid || musicInfo?.id || songId
  if (!id) throw new Error('animemusic: 缺少音乐ID')
  const res = await httpFetch(ANIMEMUSIC_API_URL + '/music/url?key=', {
    method: 'POST',
    timeout: 6000,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`,
      'X-Api-Key': '',
    },
    body: JSON.stringify({ source: amSource, musicId: String(id), quality: quality }),
    follow_max: 5,
  })
  const d = res.body
  if (!d || isNaN(Number(d.code))) throw new Error('animemusic: 未知响应')
  if (Number(d.code) === 200 && d.url) return d.url
  if (Number(d.code) === 403) throw new Error('animemusic: 鉴权失败')
  if (Number(d.code) === 429) throw new Error('animemusic: 请求过速')
  throw new Error('animemusic(' + amSource + '): ' + (d.message || ('code ' + d.code)))
}

// ==================== QQ音乐 后端接口列表（按优先级排列） ====================

const TX_BACKENDS = [
  // 优先级：① QQ官方(配 @tx_cookie 后走官方vkey，唯一能稳定出VIP整曲)；
  // ② 玉宁熙/收集聚合/Huibq/animemusic 第三方代理(自带服务端vip令牌，可出整曲)；
  // ③ tang(flac专用)；④ vkeys 放最后——它只回~1分钟试听片段，绝不允许抢跑遮挡上面的整曲源。
  {
    name: 'QQ官方',
    fetch: async (songmid, quality) => {
      const fileInfo = TX_FILE_CONFIG[quality]
      if (!fileInfo) throw new Error('不支持的音质')
      const guid = randomGuid()
      const file = fileInfo.s + songmid + fileInfo.e
      const reqData = {
        req_0: {
          module: 'vkey.GetVkeyServer',
          method: 'CgiGetVkey',
          param: { filename: [file], guid, songmid: [songmid], songtype: [0], uin: '0', loginflag: HAS_TX_COOKIE ? 1 : 0, platform: '20' },
        },
        loginUin: '0',
        comm: { uin: '0', format: 'json', ct: 24, cv: 0 },
      }
      const headers = { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', Referer: 'https://y.qq.com/' }
      if (HAS_TX_COOKIE) headers.Cookie = TX_COOKIE
      const res = await httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', { method: 'POST', headers, body: JSON.stringify(reqData) })
      const d = res.body
      if (d && d.req_0 && d.req_0.data && d.req_0.data.midurlinfo && d.req_0.data.midurlinfo[0] && d.req_0.data.midurlinfo[0].purl) {
        const sip = d.req_0.data.sip || ['https://isure.stream.qqmusic.qq.com/']
        return sip[Math.floor(Math.random() * sip.length)] + d.req_0.data.midurlinfo[0].purl
      }
      throw new Error('QQ官方: 无数据')
    },
  },
  {
    name: '玉宁熙',
    fetch: async (songmid, quality) => {
      const qualityMap = { '128k': '标准', '320k': 'HQ', flac: 'SQ', flac24bit: '母带', hires: '母带', atmos: '母带', master: '母带' }
      const q = qualityMap[quality] || '标准'
      const res = await httpFetch('https://api-v2.yuafeng.cn/API/qqmusic.php?type=' + encodeURIComponent(q) + '&mid=' + songmid + '&apikey=3ff23523e47465224a3f48579acf41f241540ce04b6cc0b94164f37a5b6299d5', {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      if (d && d.data && d.data.music) return d.data.music
      throw new Error('玉宁熙: 无数据')
    },
  },
  {
    name: '收集聚合',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://cyapi.top/API/qq_music.php?apikey=1ffdf5733f5d538760e63d7e46ba17438d9f7b9dfc18c51be1109386fd74c3a1&type=json&mid=' + songmid, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      if (d && d.url) return d.url
      throw new Error('收集聚合: 无数据')
    },
  },
  {
    name: 'Huibq',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://lxmusicapi.onrender.com/url/tx/' + songmid + '/' + quality, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', 'X-Request-Key': 'share-v3' },
      })
      const d = res.body
      if (d && d.code === 0) {
        if (d.url) return d.url
        if (d.data && d.data.url) return d.data.url
      }
      throw new Error('Huibq: 无数据')
    },
  },
  {
    name: 'animemusic',
    fetch: async (songmid, quality, musicInfo) => getAnimemusic('qq', songmid, quality, musicInfo),
  },
  {
    name: 'tang',
    fetch: async (songmid, quality) => {
      if (quality !== 'flac') throw new Error('tang仅支持flac')
      const res = await httpFetch('https://tang.api.s01s.cn/music_open_api.php?mid=' + songmid, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      const url = extractUrl(d, [['song_play_url_sq'], ['song_play_url_pq'], ['song_play_url_hq'], ['song_play_url'], ['song_play_url_standard']])
      if (url) return url
      throw new Error('tang: 无数据')
    },
  },
  {
    name: 'vkeys',
    fetch: async (songmid, quality) => {
      const qualityMap = { '128k': '8', '320k': '9', flac: '10', flac24bit: '16', hires: '14', atmos: '13', atmos_plus: '12', master: '11' }
      const q = qualityMap[quality]
      if (!q) throw new Error('vkeys 不支持的音质')
      const res = await httpFetch('https://api.vkeys.cn/v2/music/tencent/geturl?mid=' + songmid + '&quality=' + q, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      if (d && d.data && d.data.url) return d.data.url
      if (d && d.url) return d.url
      throw new Error('vkeys: 无数据')
    },
  },
]

// ==================== 网易云音乐 后端接口列表（按优先级排列） ====================

const WY_BACKENDS = [
  { name: 'ikun网易云', fetch: async (songmid, quality, musicInfo) => {
      const songId = musicInfo?.hash ?? songmid
      const res = await httpFetch('https://c.wwwweb.top/music/url', {
        method: 'POST', timeout: 6000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'lx-music-request/2.9.0',
          'X-Api-Key': '',
        },
        body: { source: 'wy', musicId: songId, quality: quality },
        follow_max: 5,
      })
      const d = res.body
      if (!d || isNaN(Number(d.code))) throw new Error('ikun网易云: 未知错误')
      if (d.code === 200 && d.url) return d.url
      if (d.code === 403) throw new Error('ikun网易云: 鉴权失败')
      if (d.code === 429) throw new Error('ikun网易云: 请求过速')
      throw new Error('ikun网易云: ' + (d.message || '获取URL失败'))
    },
  },

  {
    name: '网易云官方',
    fetch: async (songmid, quality) => {
      const level = WY_LEVEL_MAP[quality] || 'standard'
      const targetUrl = 'https://interface3.music.163.com/eapi/song/enhance/player/url/v1'
      const eapiUrl = '/api/song/enhance/player/url/v1'
      const payload = { ids: [Number(songmid)], level, encodeType: 'flac', immerseType: 'c51' }
      const encrypted = wyEapi(eapiUrl, payload)
      let cookieValue = 'os=pc; appver=; osver=; deviceId=pyncm!'
      if (HAS_WY_COOKIE) cookieValue = WY_COOKIE + '; ' + cookieValue
      const res = await httpFetch(targetUrl, {
        method: 'POST', timeout: 6000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/2.10.2.200154',
          Referer: 'https://music.163.com/',
          Cookie: cookieValue,
        },
        form: encrypted,
      })
      const d = res.body
      if (d && d.data && d.data[0] && d.data[0].url && !d.data[0].freeTrialInfo) return d.data[0].url
      if (d && d.data && d.data[0] && d.data[0].freeTrialInfo) throw new Error('VIP歌曲仅试听（配置Cookie后可用完整版）')
      throw new Error('网易云官方: 无数据')
    },
  },

  {
    name: 'ChKsZ-VIP',
    fetch: async (songmid, quality) => {
      const level = WY_LEVEL_MAP[quality] || 'standard'
      const res = await httpFetch('https://api.chksz.top/api/163_music?id=' + songmid + '&level=' + level, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', Referer: 'https://cp.chksz.top/' },
      })
      const d = res.body
      if (d && d.code === 200 && d.data && d.data.url) return d.data.url
      throw new Error('ChKsZ-VIP: ' + (d?.msg || '无数据'))
    },
  },

  {
    name: '笒鬼鬼',
    fetch: async (songmid, quality) => {
      const level = WY_LEVEL_MAP[quality] || 'standard'
      const res = await httpFetch('https://api.cenguigui.cn/api/netease/music_v1.php?id=' + songmid + '&type=json&level=' + level, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      if (d && d.data && d.data.url) return d.data.url
      if (d && d.url) return d.url
      throw new Error('笒鬼鬼: 无数据')
    },
  },

  {
    name: '溯音163',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://oiapi.net/api/Music_163?id=' + songmid + '&type=json', {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      if (d && d.url) return d.url
      if (d && d.data && d.data[0] && d.data[0].url) return d.data[0].url
      if (d && d.data && d.data.url) return d.data.url
      throw new Error('溯音163: 无数据')
    },
  },

  {
    name: 'toubiec',
    fetch: async (songmid, quality) => {
      const level = WY_LEVEL_MAP[quality] || 'standard'
      const res = await httpFetch('https://wyapi.toubiec.cn/api/music/url', {
        method: 'POST', timeout: 6000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
          Origin: 'https://wyapi.toubiec.cn',
          Referer: 'https://wyapi.toubiec.cn/',
        },
        body: JSON.stringify({ id: songmid, level }),
      })
      const d = res.body
      if (d && d.data && d.data[0] && d.data[0].url) return d.data[0].url
      if (d && d.url) return d.url
      throw new Error('toubiec: 无数据')
    },
  },

  {
    name: 'GDStudio',
    fetch: async (songmid, quality) => {
      const brMap = { '128k': '128', '320k': '320', flac: '740', flac24bit: '999', hires: '999' }
      const br = brMap[quality] || '128'
      const res = await httpFetch('https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light&types=url&source=netease&id=' + songmid + '&br=' + br, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      if (d && d.url) return d.url
      throw new Error('GDStudio: 无数据')
    },
  },

  {
    name: '星海主后端',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://yy.zddyr.top/lx/api/?source=netease&songmid=' + songmid + '&quality=' + quality, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const d = res.body
      if (d && d.code === 200 && d.url) return d.url
      throw new Error('星海主后端: ' + (d?.msg || '无数据'))
    },
  },

  {
    name: '星海备后端',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://zrcdy.dpdns.org/lx/api/api.php?source=netease&songmid=' + songmid + '&quality=' + quality, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const d = res.body
      if (d && d.code === 200 && d.url) return d.url
      throw new Error('星海备后端: ' + (d?.msg || '无数据'))
    },
  },

  {
    name: 'bugpk',
    fetch: async (songmid, quality) => {
      const level = WY_LEVEL_MAP[quality] || 'standard'
      const res = await httpFetch('https://api.bugpk.com/api/163_music?type=json&ids=' + songmid + '&level=' + level, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      const url = extractUrl(d, [['url'], ['data', 'url'], ['data', 0, 'url']])
      if (url) return url
      throw new Error('bugpk: 无数据')
    },
  },

  {
    name: '念心直链',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('http://music.nxinxz.com/wy.php?id=' + songmid + '&level=' + quality + '&type=mp3', {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const d = res.body
      if (typeof d === 'string' && (d.startsWith('http://') || d.startsWith('https://'))) return d
      if (d && d.url) return d.url
      throw new Error('念心直链: 无数据')
    },
  },

  {
    name: '妖狐',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://api.yaohud.cn/api/music/wyvip?id=' + songmid + '&level=' + quality, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      const url = extractUrl(d, [['url'], ['data', 'url']])
      if (url) return url
      throw new Error('妖狐: 无数据')
    },
  },

  {
    name: 'FishAPI',
    fetch: async (songmid, quality) => {
      const brMap = { '128k': 128, '320k': 320, flac: 740, flac24bit: 999 }
      const br = brMap[quality]
      if (!br) throw new Error('FishAPI 不支持的音质')
      const result = await fishPost({ types: 'url', id: songmid, source: 'netease', br: br }, encodeURIComponent(songmid))
      const url = result && result.url ? cleanUrl(String(result.url)) : ''
      if (url.startsWith('http')) return url
      throw new Error('FishAPI: 无数据')
    },
  },

  {
    name: 'Huibq',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://lxmusicapi.onrender.com/url/wy/' + songmid + '/' + quality, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', 'X-Request-Key': 'share-v3' },
      })
      const d = res.body
      if (d && d.code === 0) {
        if (d.url) return d.url
        if (d.data && d.data.url) return d.data.url
      }
      throw new Error('Huibq: 无数据')
    },
  },

  {
    name: '汽水VIP',
    fetch: async (songmid, quality) => {
      const levelMap = { '128k': 'standard', '320k': 'exhigh', flac: 'lossless', flac24bit: 'hires' }
      const level = levelMap[quality] || 'standard'
      const res = await httpFetch('https://api.vsaa.cn/api/music.qishui.vip?act=song&id=' + songmid + '&quality=' + level, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      const url = extractUrl(d, [['data', 'data', 0, 'url'], ['data', 'data', 'url'], ['data', 'url'], ['url']])
      if (url) return url
      throw new Error('汽水VIP: 无数据')
    },
  },

  {
    name: 'HYWmusic',
    fetch: async (songmid, quality) => {
      const res = await httpFetch(HYW_API_BASE + '/api/music/url?source=wy&songId=' + songmid + '&quality=' + quality + '&key=' + HYW_CARD_KEY, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', 'X-Card-Key': HYW_CARD_KEY },
      })
      const d = res.body
      if (d && d.code === 200) {
        if (d.url) return d.url
        if (d.data && d.data.url) return d.data.url
      }
      throw new Error('HYWmusic: 无数据')
    },
  },

  {
    name: 'animemusic',
    fetch: async (songmid, quality, musicInfo) => getAnimemusic('wy', songmid, quality, musicInfo),
  },

  {
    name: '长青直链',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('http://175.27.166.236/wy1/wy.php?type=mp3&id=' + songmid + '&level=' + quality, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const d = res.body
      if (typeof d === 'string' && (d.startsWith('http://') || d.startsWith('https://'))) return d
      if (d && d.url) return d.url
      throw new Error('长青直链: 无数据')
    },
  },

  {
    name: '聚合API',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://api.music.lerd.dpdns.org/wy', {
        method: 'POST', timeout: 6000,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ musicInfo: { songmid }, type: quality }),
      })
      const d = res.body
      if (d && d.code === 200 && d.data && d.data.url) return d.data.url
      throw new Error('聚合API: 无数据')
    },
  }
]

// ==================== 酷我音乐(kw) 后端接口列表（按优先级排列） ====================

const KW_BACKENDS = [
  {
    name: '酷我手机版',
    fetch: async (songmid, quality) => {
      // 2.4.1：官方 2000kflac/4000kflac 档返回的文件含坏帧（ffmpeg invalid sync code），
      // 一律降级到 320kmp3，避免把坏 FLAC 交给客户端
      const brMap = { '128k': '128kmp3', '192k': '128kmp3', '320k': '320kmp3', flac: '320kmp3', flac24bit: '320kmp3', hires: '320kmp3', atmos: '320kmp3', atmos_plus: '320kmp3', master: '320kmp3' }
      const br = brMap[quality]
      if (!br) throw new Error('酷我手机版 不支持的音质')
      const res = await httpFetch('https://nmobi.kuwo.cn/mobi.s?f=web&user=0&source=kwplayerhd_ar_4.3.0.8_tianbao_T1A_qirui.apk&type=convert_url_with_sign&rid=' + songmid + '&br=' + br, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
      })
      const d = res.body
      if (d && d.code === 200 && d.data && d.data.url) return d.data.url
      if (d && d.code === 200 && d.data && d.data.surl) return d.data.surl
      throw new Error('酷我手机版: 无数据')
    },
  },
  {
    name: '酷我车机版',
    fetch: async (songmid, quality) => {
      // 2.4.1：同手机版，无损档返回坏帧文件，统一降级到 320kmp3
      const brMap = { '128k': '128kmp3', '192k': '128kmp3', '320k': '320kmp3', flac: '320kmp3', flac24bit: '320kmp3', hires: '320kmp3', atmos: '320kmp3', atmos_plus: '320kmp3', master: '320kmp3' }
      const br = brMap[quality]
      if (!br) throw new Error('酷我车机版 不支持的音质')
      const res = await httpFetch('https://mobi.kuwo.cn/mobi.s?f=web&user=0&source=kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk&type=convert_url_with_sign&br=' + br + '&sig=0&rid=' + songmid, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
      })
      const d = res.body
      if (d && d.code === 200 && d.data && d.data.url) return d.data.url
      if (d && d.code === 200 && d.data && d.data.surl) return d.data.surl
      throw new Error('酷我车机版: 无数据')
    },
  }
]

// ==================== 酷狗音乐(kg) 后端接口列表（按优先级排列） ====================

const KG_BACKENDS = [
  {
    name: '长青海棠',
    fetch: async (songmid, quality, musicInfo) => {
      const level = KG_LEVEL_MAP[quality] || 'standard'
      const hash = musicInfo?.hash || musicInfo?.songmid || songmid
      const res = await httpFetch('https://musicserver.haitangw.cc/v1/music/resolve-url', {
        method: 'POST', timeout: 6000,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ source: 'kg', rid: hash, level: level }),
      })
      const d = res.body
      // 响应格式: {code: 0, data: {url: "..."}}
      if (d && d.code === 0 && d.data && d.data.url) return d.data.url
      throw new Error('长青海棠: ' + (d?.msg || '无数据'))
    },
  },

  {
    name: '长青SVIP直链',
    fetch: async (songmid, quality, musicInfo) => {
      const level = KG_LEVEL_MAP[quality] || 'standard'
      const hash = musicInfo?.hash || musicInfo?.songmid || songmid
      // 直接构造URL，该URL本身即为有效直链
      const url = 'https://music.haitangw.cc/kgqq1/kg.php?type=mp3&id=' + hash + '&level=' + level
      const res = await httpFetch(url, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const d = res.body
      if (typeof d === 'string' && (d.startsWith('http://') || d.startsWith('https://'))) return d
      if (d && d.url) return d.url
      throw new Error('长青SVIP直链: 无数据')
    },
  },

  {
    name: '星海主后端',
    fetch: async (songmid, quality, musicInfo) => {
      const hash = musicInfo?.hash || (musicInfo?._types?.[quality]?.hash) || songmid
      const albumId = musicInfo?.albumId || ''
      const mainHash = hash
      const res = await httpFetch('https://yy.zddyr.top/lx/api/?source=kg&quality=' + quality + '&songmid=' + (musicInfo?.songmid || songmid) + '&albumId=' + albumId + '&mainHash=' + mainHash + '&hash=' + hash, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const d = res.body
      if (d && d.code === 200 && d.url) return d.url
      throw new Error('星海主后端: ' + (d?.msg || '无数据'))
    },
  },

  {
    name: '星海备后端',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://zrcdy.dpdns.org/lx/api/api.php?source=kg&songmid=' + songmid + '&quality=' + quality, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const d = res.body
      if (d && d.code === 200 && d.url) return d.url
      throw new Error('星海备后端: ' + (d?.msg || '无数据'))
    },
  },

  {
    name: '妖狐',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://api.yaohud.cn/api/music/kgvip?id=' + songmid + '&level=' + quality, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      const url = extractUrl(d, [['url'], ['data', 'url']])
      if (url) return url
      throw new Error('妖狐: 无数据')
    },
  },

  {
    name: '念心KG',
    fetch: async (songmid, quality) => {
      const level = KG_LEVEL_MAP[quality] || 'standard'
      const res = await httpFetch('https://music.nxinxz.com/kgqq/kg.php?id=' + songmid + '&level=' + level + '&type=mp3', {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const d = res.body
      if (d && d.code === 200 && d.url) return d.url
      if (typeof d === 'string' && (d.startsWith('http://') || d.startsWith('https://'))) return d
      throw new Error('念心KG: 无数据')
    },
  },

  {
    name: 'ChKsZ',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://api.chksz.top/api', {
        method: 'POST', timeout: 5000,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ source: 'kg', songmid, quality }),
      })
      const d = res.body
      if (d && d.code === 200 && d.data && d.data.url) return d.data.url
      throw new Error('ChKsZ: ' + (d?.msg || '无数据'))
    },
  },

  {
    name: '海棠API',
    fetch: async (songmid, quality, musicInfo) => {
      const level = KG_LEVEL_MAP[quality] || 'standard'
      const hash = musicInfo?.hash || (musicInfo?._types?.[quality]?.hash) || songmid
      const res = await httpFetch('https://musicapi.haitangw.net/kgqq/kg.php?type=json&id=' + hash + '&level=' + level, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      const url = extractUrl(d, [['url'], ['data', 'url']])
      if (url) return url
      throw new Error('海棠API: 无数据')
    },
  },

  {
    name: '酷狗官方',
    fetch: async (songmid, quality, musicInfo) => {
      const hash = musicInfo?.hash || songmid
      const albumId = musicInfo?.albumId || ''
      const res = await httpFetch('https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=' + hash + '&platid=4&album_id=' + albumId + '&mid=00000000000000000000000000000000', {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.kugou.com/' },
      })
      const d = res.body
      if (d && d.status === 1 && d.data && d.data.play_backup_url) return d.data.play_backup_url
      if (d && d.status === 1 && d.data && d.data.play_url) return d.data.play_url
      throw new Error('酷狗官方: 无数据')
    },
  },

  {
    name: '聆澜',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://source.shiqianjiang.cn/api/music/url?source=kg&songId=' + songmid + '&quality=' + quality, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      if (d && d.code === 200 && d.url) return d.url
      if (d && d.data && d.data.url) return d.data.url
      throw new Error('聆澜: 无数据')
    },
  },

  {
    name: 'HYWmusic',
    fetch: async (songmid, quality) => {
      const res = await httpFetch(HYW_API_BASE + '/api/music/url?source=kg&songId=' + songmid + '&quality=' + quality + '&key=' + HYW_CARD_KEY, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', 'X-Card-Key': HYW_CARD_KEY },
      })
      const d = res.body
      if (d && d.code === 200) {
        if (d.url) return d.url
        if (d.data && d.data.url) return d.data.url
      }
      throw new Error('HYWmusic: 无数据')
    },
  },

  {
    name: 'GDStudio',
    fetch: async (songmid, quality) => {
      const brMap = { '128k': '128', '320k': '320', flac: '740', flac24bit: '999', hires: '999' }
      const br = brMap[quality] || '128'
      const res = await httpFetch('https://music-api.gdstudio.xyz/api.php?types=url&source=kg&id=' + songmid + '&br=' + br, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      if (d && d.url) return d.url
      throw new Error('GDStudio: 无数据')
    },
  },

  { name: '念心酷狗', fetch: getNianxinKg },

  {
    name: 'animemusic',
    fetch: async (songmid, quality, musicInfo) => getAnimemusic('kg', songmid, quality, musicInfo),
  },

  {
    name: '长青直链',
    fetch: async (songmid, quality, musicInfo) => {
      const level = KG_LEVEL_MAP[quality] || 'standard'
      const hash = musicInfo?.hash || songmid
      const res = await httpFetch('http://175.27.166.236/kgqq1/kg.php?type=mp3&id=' + hash + '&level=' + level, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const d = res.body
      if (typeof d === 'string' && (d.startsWith('http://') || d.startsWith('https://'))) return d
      if (d && d.url) return d.url
      throw new Error('长青直链: 无数据')
    },
  },

  {
    name: '聚合API',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://api.music.lerd.dpdns.org/kg', {
        method: 'POST', timeout: 6000,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ musicInfo: { songmid }, type: quality }),
      })
      const d = res.body
      if (d && d.code === 200 && d.data && d.data.url) return d.data.url
      throw new Error('聚合API: 无数据')
    },
  }
]

// ==================== 咪咕音乐(mg) 后端接口列表（按优先级排列） ====================

const MG_BACKENDS = [
  {
    name: '星海主后端',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://yy.zddyr.top/lx/api/?source=migu&songmid=' + songmid + '&quality=' + quality, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const d = res.body
      if (d && d.code === 200 && d.url) return d.url
      throw new Error('星海主后端: ' + (d?.msg || '无数据'))
    },
  },

  {
    name: '星海备后端',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://zrcdy.dpdns.org/lx/api/api.php?source=migu&songmid=' + songmid + '&quality=' + quality, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const d = res.body
      if (d && d.code === 200 && d.url) return d.url
      throw new Error('星海备后端: ' + (d?.msg || '无数据'))
    },
  },

  {
    name: 'GDStudio',
    fetch: async (songmid, quality) => {
      const brMap = { '128k': '128', '320k': '320', flac: '1000' }
      const br = brMap[quality] || '128'
      const res = await httpFetch('https://music-api.gdstudio.xyz/api.php?types=url&source=migu&id=' + songmid + '&br=' + br, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      if (d && d.url) return d.url
      throw new Error('GDStudio: 无数据')
    },
  },

  {
    name: 'Migu直接源',
    fetch: async (songmid, quality) => {
      const level = qualityToLevel(quality)
      const res = await httpFetch('https://music.migu.cn/v3/api/music/audioPlayer/getPlayInfo?copyrightId=' + encodeURIComponent(String(songmid)) + '&level=' + level, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Referer: 'https://music.migu.cn/' },
      })
      const d = res.body
      if (d && d.data && d.data.playUrl) return d.data.playUrl
      if (d && d.url) return d.url
      if (d && d.playUrl) return d.playUrl
      throw new Error('Migu直接源: 无数据')
    },
  },

  {
    name: 'Migu API',
    fetch: async (songmid, quality) => {
      const levelMap = { '128k': 'PQ', '320k': 'HQ', flac: 'SQ', flac24bit: 'ZQ' }
      const level = levelMap[quality] || 'HQ'
      const res = await httpFetch('https://app.c.nf.migu.cn/MIGUM2.0/strategy/listen-url/v2.2?copyrightId=' + encodeURIComponent(String(songmid)) + '&quality=' + level, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36', Referer: 'https://app.c.nf.migu.cn/' },
      })
      const d = res.body
      if (d && d.data && d.data.url) return d.data.url
      if (d && d.url) return d.url
      if (d && d.data && d.data.playUrl) return d.data.playUrl
      throw new Error('Migu API: 无数据')
    },
  },

  {
    name: '长青直链',
    fetch: async (songmid, quality) => {
      const level = qualityToLevel(quality)
      const res = await httpFetch('https://music.haitangw.cc/musicapi/mg.php?type=mp3&id=' + encodeURIComponent(String(songmid)) + '&level=' + level, {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const d = res.body
      if (typeof d === 'string' && (d.startsWith('http://') || d.startsWith('https://'))) return d
      if (d && d.url) return d.url
      throw new Error('长青直链: 无数据')
    },
  },

  {
    name: '念心直链',
    fetch: async (songmid, quality) => {
      const level = qualityToLevel(quality)
      const res = await httpFetch('http://music.nxinxz.com/mg.php?id=' + encodeURIComponent(String(songmid)) + '&level=' + level + '&type=mp3', {
        method: 'GET', timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const d = res.body
      if (typeof d === 'string' && (d.startsWith('http://') || d.startsWith('https://'))) return d
      if (d && d.url) return d.url
      throw new Error('念心直链: 无数据')
    },
  },

  {
    name: '聆澜',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://source.shiqianjiang.cn/api/music/url?source=mg&songId=' + songmid + '&quality=' + quality, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      const d = res.body
      if (d && d.code === 200 && d.url) return d.url
      if (d && d.data && d.data.url) return d.data.url
      throw new Error('聆澜: 无数据')
    },
  },

  {
    name: 'HYWmusic',
    fetch: async (songmid, quality) => {
      const res = await httpFetch(HYW_API_BASE + '/api/music/url?source=mg&songId=' + songmid + '&quality=' + quality + '&key=' + HYW_CARD_KEY, {
        method: 'GET', timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', 'X-Card-Key': HYW_CARD_KEY },
      })
      const d = res.body
      if (d && d.code === 200) {
        if (d.url) return d.url
        if (d.data && d.data.url) return d.data.url
      }
      throw new Error('HYWmusic: 无数据')
    },
  },

  {
    name: '聚合API',
    fetch: async (songmid, quality) => {
      const res = await httpFetch('https://api.music.lerd.dpdns.org/mg', {
        method: 'POST', timeout: 6000,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ musicInfo: { songmid }, type: quality }),
      })
      const d = res.body
      if (d && d.code === 200 && d.data && d.data.url) return d.data.url
      throw new Error('聚合API: 无数据')
    },
  }
]

// ==================== 获取音乐URL（优先级窗口并发，语义与原串行一致） ====================

// 杰翔安全加速：把后端按「优先级窗口」并发请求，但只采纳「最小索引(最高优先级)成功者」。
// 这样最终返回的 URL 与「串行按优先级逐个尝试」在数学上完全一致（不会让快但失效的低优先级后端抢先），
// 仅把「逐个等」变成「每窗口并行等」，大幅缩短等待；不改变洛雪对 musicUrl 的校验语义。
// 纪律：单个后端的 fetch/签名逻辑原样调用 —— 不并发竞速(firstSuccess)、不拦 4xx、不硬拒 URL、不动 KW 索引选择。
const CONCURRENCY = 4 // 单窗口同时发起的后端数；本窗口全军覆没才降级到下一窗口，避免无效等待
const isPlayableUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim()) // 仅做「像不像直链」的兜底，不替代洛雪自身的可达性探测

const handleGetMusicUrl = async (source, musicInfo, quality) => {
  const songId = musicInfo.hash ?? musicInfo.songmid ?? musicInfo.id
  if (!songId) throw new Error('无法获取歌曲ID')

  let backends = {
    tx: TX_BACKENDS,
    wy: WY_BACKENDS,
    kw: KW_BACKENDS,
    kg: KG_BACKENDS,
    mg: MG_BACKENDS,
  }[source]

  if (!backends) throw new Error('未知音源: ' + source)

  // 酷我音乐：高音质（atmos/atmos_plus/master）走流媒体直链，普通音质走星海等其他后端
  if (source === 'kw') {
    const highQuality = ['atmos', 'atmos_plus', 'master']
    if (highQuality.includes(quality)) {
      backends = [backends[0]]
    } else {
      // ★ 2026-10-20：原逻辑剔除索引 0（星海主后端）。但星海主后端恰恰是 kw
      //   唯一能按 rid 返回**完整无损**直链的后端（实测 source=kw 返回 fLaC 直链，
      //   Range 206、1.0~1.8MB、按 rid 区分），剔除它等于砍掉 kw 的主力路径。
      //   同时「酷我官方」已被停用（恒返回固定广告片段），原先靠它"成功"来短路
      //   降级的副作用消失。改为**不再剔除任何后端**，让星海主后端与流媒体
      //   一起参与优先级竞价。
    }
  }

  const errors = []
  const B = backends.length

  // 优先级竞价窗口：每窗口最多 CONCURRENCY 个后端并发请求，但一旦「最高优先级(最小索引)成功者」可确定就立即返回，
  // 不再等同窗口内排在它后面的慢后端——这正是此前比原版慢的根因（Promise.allSettled 会傻等窗口里最慢的那个）。
  // 返回结果与「串行按优先级逐个尝试」完全一致：只有 backends[0..i-1] 全失败且 backends[i] 成功才采用 i，不改变洛雪对 musicUrl 的校验语义。
  const raceWindow = (indices) => new Promise((resolve) => {
    const outcomes = {} // i -> url(成功) | null(失败/非直链)
    const decide = () => {
      for (const i of indices) {
        if (!(i in outcomes)) return        // 更低优先级的后端还没结果，不能下结论，继续等
        if (outcomes[i]) {                   // 当前最低优先级已成功 -> 采用它（更高优先级无需再等）
          console.log('[' + source + '] ' + backends[i].name + ' 成功')
          resolve(outcomes[i])
          return
        }
        // 当前最低优先级失败 -> 看下一个更高优先级
      }
      resolve(null) // 本窗口全部失败
    }
    indices.forEach((i) => {
      backends[i].fetch(songId, quality, musicInfo).then(
        (url) => {
          const u = isPlayableUrl(url) ? url : null
          if (!u) { errors.push(backends[i].name + ': 返回非直链'); console.log('[' + source + '] ' + backends[i].name + ' 返回非直链') }
          outcomes[i] = u
          decide()
        },
        (e) => {
          const msg = e && e.message ? e.message : String(e)
          errors.push(backends[i].name + ': ' + msg)
          console.log('[' + source + '] ' + backends[i].name + ' 失败: ' + msg)
          outcomes[i] = null
          decide()
        }
      )
    })
  })

  for (let start = 0; start < B; start += CONCURRENCY) {
    const end = Math.min(start + CONCURRENCY, B)
    const indices = []
    for (let i = start; i < end; i++) indices.push(i)
    const win = await raceWindow(indices) // 本窗口内有成功则立即返回；全失败才降级下一窗口
    if (win) return win
  }

  throw new Error('所有后端均失败（共' + B + '个）\n' + errors.join('\n'))
}

// ==================== 注册请求事件 ====================

on(EVENT_NAMES.request, ({ action, source, info }) => {
  switch (action) {
    case 'musicUrl':
      return handleGetMusicUrl(source, info.musicInfo, info.type)
        .then((data) => Promise.resolve(data))
        .catch((err) => Promise.reject(err))
    default:
      return Promise.reject('action not support: ' + action)
  }
})

// ==================== 初始化音源 ====================

const musicSources = {}
MUSIC_SOURCE.forEach((item) => {
  const nameMap = {
    tx: 'QQ音乐',
    wy: '网易云音乐',
    kw: '酷我音乐',
    kg: '酷狗音乐',
    mg: '咪咕音乐',
  }
  musicSources[item] = {
    name: nameMap[item] || item,
    type: 'music',
    actions: ['musicUrl'],
    qualitys: MUSIC_QUALITY[item],
  }
})

send(EVENT_NAMES.inited, {
  status: true,
  openDevTools: false,
  sources: musicSources,
})

console.log('[QQ音乐+网易云音乐+酷我+酷狗+咪咕聚合音源 v4.4.1] 已加载完成')
console.log('[QQ音乐] 后端数: ' + TX_BACKENDS.length + ' Cookie: ' + (HAS_TX_COOKIE ? '已配置' : '未配置'))
console.log('[网易云音乐] 后端数: ' + WY_BACKENDS.length + ' Cookie: ' + (HAS_WY_COOKIE ? '已配置' : '未配置'))
console.log('[酷我音乐] 后端数: ' + KW_BACKENDS.length)
console.log('[酷狗音乐] 后端数: ' + KG_BACKENDS.length + ' 主API: 长青海棠')
console.log('[咪咕音乐] 后端数: ' + MG_BACKENDS.length)