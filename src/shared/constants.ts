export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_IMAGE_EDGE = 1280
export const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const
export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp'
] as const

export const PERSONALITIES = [
  '温柔陪伴型',
  '元气鼓励型',
  '傲娇吐槽型',
  '安静治愈型',
  '严格监督型'
] as const

export const PETORY_WEBSITE_URL = 'https://petory.chat'
export const PETORY_DOWNLOAD_PAGE = `${PETORY_WEBSITE_URL}/download/`
export const PETORY_TERMS_URL = `${PETORY_WEBSITE_URL}/terms/`
export const PETORY_PRIVACY_URL = `${PETORY_WEBSITE_URL}/privacy/`
export const DEFAULT_UPDATE_FEED_URL = `${PETORY_WEBSITE_URL}/releases`

export const CONTENT_SAFETY = {
  upload:
    '请上传你拥有使用权的图片。不要上传他人照片、明星图片或未经授权的版权角色。',
  chat: '对话内容由 AI 生成，仅供陪伴娱乐。请勿输入违法、骚扰或敏感个人信息。'
} as const

export const ERROR_MESSAGES = {
  upload_invalid: '请上传 PNG、JPG、JPEG 或 WEBP 格式，且图片小于 10MB。',
  generation_failed: '没能从这张照片生成桌宠，可以换一张再试。',
  rembg_failed: '桌宠已生成，但准备桌面形象时出了问题，请重试。',
  quota_exceeded: '今日额度已用完，明天再来或升级 Pro。',
  style_locked: '该风格需要 Pro 会员，请在设置中兑换后重试。',
  auth_expired: '登录已过期，请重新登录后再试。',
  service_disabled: '生成服务维护中，请稍后再试。',
  network_error: '网络连接失败，请检查网络后重试。',
  rate_limit: '请求过于频繁，请稍后再试。'
} as const
