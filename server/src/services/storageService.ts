import fs from 'fs'
import path from 'path'
import { config } from '../config.js'
import type { PetPoseType } from '../../../src/shared/types/pet.js'

function uniqueSuffix(): string {
  // 12-char base36 timestamp+random, stable enough for cache-busting filenames.
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${time}${rand}`.slice(0, 12)
}

export function ensureUploadsDir(): void {
  fs.mkdirSync(config.uploadsDir, { recursive: true })
}

export function batchDir(userId: string, batchId: string): string {
  const dir = path.join(config.uploadsDir, userId, batchId)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function jobDir(userId: string, jobId: string): string {
  const dir = path.join(config.uploadsDir, userId, jobId)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function saveBatchInputImage(
  userId: string,
  batchId: string,
  buffer: Buffer,
  ext: string
): string {
  const dir = batchDir(userId, batchId)
  const filePath = path.join(dir, `input.${ext}`)
  fs.writeFileSync(filePath, buffer)
  return filePath
}

export function saveBatchPoseOutput(
  userId: string,
  batchId: string,
  pose: PetPoseType,
  buffer: Buffer
): string {
  const dir = batchDir(userId, batchId)
  const filePath = path.join(dir, `pose-${pose}-${uniqueSuffix()}.png`)
  fs.writeFileSync(filePath, buffer)
  return filePath
}

export function saveClientPosePreview(
  userId: string,
  batchId: string,
  pose: PetPoseType,
  buffer: Buffer
): string {
  const dir = batchDir(userId, batchId)
  const filePath = path.join(dir, `preview-${pose}.webp`)
  fs.writeFileSync(filePath, buffer)
  return filePath
}

export function saveInputImage(userId: string, jobId: string, buffer: Buffer, ext: string): string {
  const dir = jobDir(userId, jobId)
  const filePath = path.join(dir, `input.${ext}`)
  fs.writeFileSync(filePath, buffer)
  return filePath
}

export function saveOutputImage(userId: string, jobId: string, buffer: Buffer): string {
  const dir = jobDir(userId, jobId)
  const filePath = path.join(dir, 'output.png')
  fs.writeFileSync(filePath, buffer)
  return filePath
}

export function toPublicUrl(filePath: string): string {
  const normalized = filePath.replace(config.uploadsDir, '').replace(/\\/g, '/')
  return `${config.publicBaseUrl}/uploads${normalized}`
}
