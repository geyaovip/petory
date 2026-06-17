import type { User } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { CUSTOM_PET_LIMIT_MESSAGE } from '../../../src/shared/entitlements.js'

const CREATION_BATCH_TYPES = ['full_batch', 'client_local'] as const

async function findSucceededCustomPetCreation(userId: string) {
  const batches = await prisma.generationBatch.findMany({
    where: {
      userId,
      jobType: { in: [...CREATION_BATCH_TYPES] },
      status: { in: ['succeeded', 'partial'] },
      posesSucceeded: { gte: 1 }
    },
    include: {
      jobs: {
        where: { pose: 'idle', status: 'succeeded' },
        take: 1
      }
    },
    orderBy: { createdAt: 'asc' },
    take: 5
  })
  return batches.find((batch) => batch.jobs.length > 0) ?? null
}

export async function syncCustomPetCreatedAt(userId: string): Promise<Date | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { customPetCreatedAt: true }
  })
  if (!user) return null

  const succeeded = await findSucceededCustomPetCreation(userId)
  if (!succeeded) {
    if (user.customPetCreatedAt) {
      await prisma.user.update({
        where: { id: userId },
        data: { customPetCreatedAt: null }
      })
    }
    return null
  }

  if (user.customPetCreatedAt) return user.customPetCreatedAt

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { customPetCreatedAt: succeeded.createdAt }
  })
  return updated.customPetCreatedAt
}

export async function hasUsedCustomPetSlot(userId: string): Promise<boolean> {
  const createdAt = await syncCustomPetCreatedAt(userId)
  return createdAt !== null
}

/** Block only starting a second custom pet (new full_batch). */
export async function assertCanCreateCustomPet(
  user: User
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  if (await hasUsedCustomPetSlot(user.id)) {
    return {
      ok: false,
      code: 'CUSTOM_PET_LIMIT',
      message: CUSTOM_PET_LIMIT_MESSAGE
    }
  }
  return { ok: true }
}

export async function markCustomPetCreated(userId: string, createdAt = new Date()): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, customPetCreatedAt: null },
    data: { customPetCreatedAt: createdAt }
  })
}

export async function getCustomPetStatus(userId: string) {
  const createdAt = await syncCustomPetCreatedAt(userId)
  return {
    customPetCreated: createdAt !== null,
    customPetCreatedAt: createdAt?.toISOString() ?? null
  }
}
