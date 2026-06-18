import { randomUUID } from 'crypto'
import type { User } from '@prisma/client'
import { toBubbleText } from '../../../src/shared/prompts/petPersonality.js'
import type { ChatMessage } from '../../../src/shared/types/chat.js'
import type { PetPersonality } from '../../../src/shared/types/pet.js'
import { config } from '../config.js'
import { prisma } from '../lib/prisma.js'
import { chatWithKimi, type ChatPetContext } from './kimiService.js'
import { canConsumeChat, consumeChat, getChatQuotaView } from './chatQuotaService.js'
import { assertChatEnabled } from './systemConfigService.js'

export type { ChatPetContext } from './kimiService.js'

const PERSONALITIES = new Set<PetPersonality>([
  '温柔陪伴型',
  '元气鼓励型',
  '傲娇吐槽型',
  '安静治愈型',
  '严格监督型'
])

export interface SendChatInput {
  message: string
  history?: ChatMessage[]
  pet: ChatPetContext
}

async function logChatAttempt(input: {
  userId: string
  pet: ChatPetContext
  status: 'succeeded' | 'failed'
  inputChars: number
  outputChars: number
  durationMs: number
  errorCode?: string
  errorMessage?: string
}) {
  await prisma.chatLog.create({
    data: {
      userId: input.userId,
      petId: input.pet.petId,
      petName: input.pet.name,
      personality: input.pet.personality,
      status: input.status,
      model: config.kimiModel,
      inputChars: input.inputChars,
      outputChars: input.outputChars,
      durationMs: input.durationMs,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage?.slice(0, 500)
    }
  })
}

export async function sendChat(user: User, input: SendChatInput) {
  const serviceCheck = await assertChatEnabled()
  if (!serviceCheck.ok) {
    return { success: false as const, code: serviceCheck.code, message: serviceCheck.message }
  }

  if (user.status !== 'active') {
    return { success: false as const, code: 'USER_DISABLED', message: '账号已被禁用。' }
  }

  const trimmed = input.message.trim()
  if (!trimmed) {
    return { success: false as const, message: '请输入内容。' }
  }
  if (trimmed.length > config.chatMaxInputChars) {
    return { success: false as const, message: '消息过长，请缩短后重试。' }
  }
  if (!input.pet?.name?.trim()) {
    return { success: false as const, message: '缺少宠物信息。' }
  }
  if (!PERSONALITIES.has(input.pet.personality)) {
    return { success: false as const, message: '无效的性格类型。' }
  }

  const quotaCheck = await canConsumeChat(user)
  if (!quotaCheck.ok) {
    return { success: false as const, code: quotaCheck.code, message: quotaCheck.message }
  }

  const history = (input.history ?? []).filter(
    (m) => m.role === 'user' || m.role === 'assistant'
  )

  const started = Date.now()
  try {
    const reply = await chatWithKimi(input.pet, history, trimmed)
    const durationMs = Date.now() - started

    await consumeChat(user.id, `chat with ${input.pet.name}`)
    await logChatAttempt({
      userId: user.id,
      pet: input.pet,
      status: 'succeeded',
      inputChars: trimmed.length,
      outputChars: reply.length,
      durationMs
    })

    const assistantMessage: ChatMessage = {
      id: randomUUID(),
      petId: input.pet.petId ?? 'remote',
      role: 'assistant',
      content: reply,
      createdAt: new Date().toISOString()
    }

    const chatQuota = await getChatQuotaView(user)
    return {
      success: true as const,
      message: assistantMessage,
      bubbleText: toBubbleText(reply),
      chatQuota
    }
  } catch (error) {
    const durationMs = Date.now() - started
    const raw = error instanceof Error ? error.message : 'CHAT_FAILED'
    const errorCode = raw.startsWith('KIMI_') ? raw.split(':')[0]! : 'CHAT_FAILED'

    await logChatAttempt({
      userId: user.id,
      pet: input.pet,
      status: 'failed',
      inputChars: trimmed.length,
      outputChars: 0,
      durationMs,
      errorCode,
      errorMessage: raw
    })

    const message = raw.includes('KIMI_NOT_CONFIGURED')
      ? '服务端未配置 Kimi API Key。'
      : '对话失败了，稍后再试试吧。'

    return { success: false as const, code: errorCode, message }
  }
}

export async function getChatStatsForUser(userId: string, days = 1) {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - (days - 1))
  since.setUTCHours(0, 0, 0, 0)

  const logs = await prisma.chatLog.findMany({
    where: { userId, createdAt: { gte: since } }
  })

  const succeeded = logs.filter((l) => l.status === 'succeeded').length
  const failed = logs.filter((l) => l.status === 'failed').length
  const total = logs.length

  return {
    total,
    succeeded,
    failed,
    successRate: total > 0 ? Math.round((succeeded / total) * 100) : 0
  }
}
