import type { User } from '@prisma/client'
import { CUSTOM_PET_LIMIT_MESSAGE } from '../../../src/shared/entitlements.js'
import { prisma } from '../lib/prisma.js'

const CREATION_BATCH_TYPES = ['full_batch', 'client_local'] as const

/** Backfill from batches that actually produced at least one pose; clear stale marks. */
export async function syncCustomPetCreatedAt(userId: string): Promise<Date | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { customPetCreatedAt: true }
  })
  if (!user) return null

  const earliest = await prisma.generationBatch.findFirst({
    where: {
      userId,
      jobType: { in: [...CREATION_BATCH_TYPES] },
      status: { in: ['succeeded', 'partial'] },
      posesSucceeded: { gte: 1 }
    },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  })

  if (!earliest) {
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
    data: { customPetCreatedAt: earliest.createdAt }
  })
  return updated.customPetCreatedAt
}

export async function hasUsedCustomPetSlot(userId: string): Promise<boolean> {
  const createdAt = await syncCustomPetCreatedAt(userId)
  return createdAt !== null
}

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

/** Mark slot used only after a pet was successfully generated (does not disable the account). */
export async function markCustomPetCreated(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, customPetCreatedAt: null },
    data: { customPetCreatedAt: new Date() }
  })
}

export async function assertCanRegenerateCustomPet(
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

export async function getCustomPetStatus(userId: string) {
  const createdAt = await syncCustomPetCreatedAt(userId)
  return {
    customPetCreated: createdAt !== null,
    customPetCreatedAt: createdAt?.toISOString() ?? null
  }
}
