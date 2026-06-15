import { config } from './config.js'
import { randomBytes } from 'crypto'
import { todayKey } from './lib/entitlements.js'
import { prisma } from './lib/prisma.js'
import { hashPassword } from './lib/password.js'
import type { PlanTier } from '../../src/shared/types/auth.js'
import {
  getPlanChatLimit,
  getPlanGenerationLimit,
  seedSystemConfigDefaults
} from './services/systemConfigService.js'

const DEFAULT_REDEEM_CODES = [
  { code: 'PETORY-PRO-DEMO', maxUses: 9999, note: '演示兑换码' },
  { code: 'PETORY-PRO-TEST', maxUses: 100, note: '测试兑换码' }
]

async function ensureUserQuotas(): Promise<void> {
  const users = await prisma.user.findMany({
    include: { quota: true, chatQuota: true }
  })
  const today = todayKey()
  for (const user of users) {
    const plan = user.plan as PlanTier
    if (!user.quota) {
      await prisma.generationQuota.create({
        data: {
          userId: user.id,
          dailyLimit: await getPlanGenerationLimit(plan),
          usedToday: 0,
          resetDate: today
        }
      })
    }
    if (!user.chatQuota) {
      await prisma.chatQuota.create({
        data: {
          userId: user.id,
          dailyLimit: await getPlanChatLimit(plan),
          usedToday: 0,
          resetDate: today
        }
      })
    }
  }
}

export async function seedAdmin(): Promise<void> {
  await seedSystemConfigDefaults()

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: config.adminEmail }
  })
  if (!existingAdmin) {
    await prisma.adminUser.create({
      data: {
        email: config.adminEmail,
        passwordHash: await hashPassword(randomBytes(32).toString('hex')),
        role: 'admin'
      }
    })
    console.info(`[petory-server] seeded admin: ${config.adminEmail}`)
  } else if (existingAdmin.status !== 'active' || existingAdmin.role !== 'admin') {
    await prisma.adminUser.update({
      where: { id: existingAdmin.id },
      data: { status: 'active', role: 'admin' }
    })
  }

  await prisma.adminUser.updateMany({
    where: {
      role: 'admin',
      email: { not: config.adminEmail }
    },
    data: { status: 'disabled' }
  })

  const operator = await prisma.adminUser.findUnique({
    where: { email: config.operatorEmail }
  })
  if (!operator) {
    await prisma.adminUser.create({
      data: {
        email: config.operatorEmail,
        passwordHash: await hashPassword(randomBytes(32).toString('hex')),
        role: 'operator'
      }
    })
    console.info(`[petory-server] seeded operator (read-only): ${config.operatorEmail}`)
  }

  for (const item of DEFAULT_REDEEM_CODES) {
    const exists = await prisma.redeemCode.findUnique({ where: { code: item.code } })
    if (!exists) {
      await prisma.redeemCode.create({
        data: { code: item.code, plan: 'pro', maxUses: item.maxUses, note: item.note }
      })
      console.info(`[petory-server] seeded redeem code: ${item.code}`)
    }
  }

  await ensureUserQuotas()
}
