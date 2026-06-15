/**
 * Admin console display labels — map internal field values to readable Chinese.
 */
;(function () {
  const USER_STATUS = { active: '正常', disabled: '已禁用' }
  const JOB_STATUS = {
    pending: '排队中',
    processing: '生成中',
    succeeded: '成功',
    failed: '失败',
    cancelled: '已取消'
  }
  const JOB_TYPE = {
    full_batch: '完整生成',
    pose_completion: '补全姿势',
    single_pose: '单姿势',
    single_pose_regen: '单姿势重生成',
    client_local: '客户端本地生成'
  }
  const STYLE = {
    petory: 'Petory 默认',
    pixel: '像素风',
    sticker: '贴纸风',
    plush: '毛绒风',
    clay: '黏土风',
    cyber: '赛博风'
  }
  const POSE = {
    idle: '日常待机',
    happy: '开心',
    focus: '专注中',
    sleep: '睡觉',
    remind: '提醒你',
    angry: '小生气'
  }
  const ERROR_CODE = {
    GENERATION_FAILED: '生成失败',
    CHAT_FAILED: '对话失败',
    CHAT_QUOTA_EXCEEDED: '对话额度不足',
    QUOTA_EXCEEDED: '生成额度不足',
    STYLE_LOCKED: '该功能暂不可用',
    AUTH_EXPIRED: '登录过期',
    SERVICE_DISABLED: '服务维护中',
    NETWORK_ERROR: '网络错误',
    RATE_LIMIT: '请求过于频繁',
    UPLOAD_INVALID: '图片无效',
    REMBG_FAILED: '桌面抠图失败',
    IMAGE_NOT_CONFIGURED: '图像 API 未配置',
    UNKNOWN: '未知错误'
  }
  const AUDIT_ACTION = {
    admin_login: '管理员登录',
    update_system_config: '更新系统配置',
    disable_user: '禁用用户',
    enable_user: '恢复用户',
    grant_quota: '赠送生成额度',
    activate_pro: '旧版权益变更',
    deactivate_pro: '旧版权益变更',
    flag_device: '标记异常设备',
    unflag_device: '取消设备标记',
    create_redeem_code: '旧版权益凭证操作',
    disable_redeem_code: '旧版权益凭证操作',
    enable_redeem_code: '旧版权益凭证操作'
  }
  const TARGET_TYPE = { user: '用户', device: '设备', redeem_code: '旧版权益凭证', system: '系统' }
  const CONFIG_LABEL = {
    freeDailyGenerationLimit: '每日生成次数',
    freeDailyChatLimit: '每日对话次数',
    jobTimeoutSeconds: '单任务超时（秒）',
    registrationOpen: '允许新用户注册',
    generationServiceEnabled: '开启图片生成服务',
    chatServiceEnabled: '开启 AI 对话服务',
    maintenanceNotice: '维护公告（客户端可见）'
  }
  const CONFIG_HINT = {
    jobTimeoutSeconds: '超过此时长未完成的生成任务将标记失败。',
    maintenanceNotice: '留空表示无公告；填写后会在客户端展示。'
  }
  const OS = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function pick(map, key, fallback = '—') {
    if (key == null || key === '') return fallback
    const raw = String(key)
    return map[raw] ?? map[raw.toLowerCase()] ?? map[raw.toUpperCase()] ?? raw
  }

  function badge(text, variant = '') {
    const v = variant ? ` ${variant}` : ''
    return `<span class="badge${v}">${esc(text)}</span>`
  }

  function statusBadge(status) {
    const label = pick(JOB_STATUS, status, status)
    if (status === 'succeeded' || status === 'active' || status === 'paid') return badge(label, 'ok')
    if (status === 'failed' || status === 'disabled' || status === 'cancelled') return badge(label, 'danger')
    if (status === 'processing' || status === 'pending') return badge(label, 'warn')
    return badge(label, 'info')
  }

  function userStatusBadge(status) {
    const label = pick(USER_STATUS, status, status)
    if (status === 'active') return badge(label, 'ok')
    if (status === 'disabled') return badge(label, 'danger')
    return badge(label)
  }

  function formatTime(iso) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return iso
    }
  }

  function formatDate(iso) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString('zh-CN')
    } catch {
      return iso
    }
  }

  function formatDuration(ms) {
    if (ms == null || ms === '' || Number.isNaN(Number(ms))) return '—'
    const n = Number(ms)
    if (n < 1000) return `${n} 毫秒`
    if (n < 60000) return `${(n / 1000).toFixed(1)} 秒`
    return `${(n / 60000).toFixed(1)} 分钟`
  }

  function shortId(id, len = 8) {
    if (!id) return '—'
    const s = String(id)
    return s.length <= len + 1 ? s : `${s.slice(0, len)}…`
  }

  function errorLabel(code) {
    if (!code) return '—'
    const upper = String(code).toUpperCase()
    if (ERROR_CODE[upper]) return ERROR_CODE[upper]
    if (upper.startsWith('MINIMAX_')) return '图像服务异常'
    if (upper.startsWith('KIMI_')) return '对话服务异常'
    return pick(ERROR_CODE, code, code)
  }

  function friendlyError(code, message) {
    const label = errorLabel(code)
    if (!message || /MiniMax|rembg|HTTP|KIMI_|pip3|api\.|IMAGE_NOT_CONFIGURED/i.test(message)) return label
    return `${label}：${message}`
  }

  function formatAuditDetail(detail) {
    if (!detail) return '—'
    const raw = String(detail).trim()
    if (!raw.startsWith('{') && !raw.startsWith('[')) {
      if (raw.includes('=')) {
        return raw
          .split(',')
          .map((part) => {
            const [k, v] = part.split('=')
            return `${esc(k?.trim())}：${esc(v?.trim())}`
          })
          .join('；')
      }
      return esc(raw)
    }
    try {
      const obj = JSON.parse(raw)
      if (typeof obj !== 'object' || obj == null) return esc(raw)
      return Object.entries(obj)
        .map(([k, v]) => `${esc(pick(CONFIG_LABEL, k, k))}：${esc(String(v))}`)
        .join('；')
    } catch {
      return esc(raw)
    }
  }

  function deviceLabel(device) {
    if (device.deviceName) return esc(device.deviceName)
    return `<span class="muted" title="${esc(device.localDeviceId)}">设备 ${esc(shortId(device.localDeviceId))}</span>`
  }

  function osLabel(os, version, appVersion) {
    const name = pick(OS, os, os || '未知系统')
    const parts = [name]
    if (version) parts.push(version)
    if (appVersion) parts.push(`客户端 ${appVersion}`)
    return esc(parts.join(' · '))
  }

  window.AdminFmt = {
    esc,
    pick,
    badge,
    statusBadge,
    userStatusBadge,
    formatTime,
    formatDate,
    formatDuration,
    shortId,
    errorLabel,
    friendlyError,
    formatAuditDetail,
    deviceLabel,
    osLabel,
    maps: { USER_STATUS, JOB_STATUS, JOB_TYPE, STYLE, POSE, ERROR_CODE, AUDIT_ACTION, TARGET_TYPE, CONFIG_LABEL, CONFIG_HINT }
  }
})()
