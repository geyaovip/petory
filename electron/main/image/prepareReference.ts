import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import type { ReferenceMode } from '../../../src/shared/generation/reference'

export interface PreparedReference {
  buffer: Buffer
  mimeType: 'image/jpeg' | 'image/png'
  sourceBytes: number
  preparedBytes: number
  isolated: boolean
}

function mimeFromPath(filePath: string): 'image/jpeg' | 'image/png' {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  return 'image/png'
}

function debugSavePathForUpload(filePath: string): string | null {
  const sourceSegment = `${path.sep}source${path.sep}`
  if (!filePath.includes(sourceSegment)) return null
  return path.join(path.dirname(filePath), 'reference-for-minimax.jpg')
}

/**
 * Keep the user's photo intact and only fix EXIF orientation before image-to-image generation.
 */
export async function prepareReferenceFromPath(
  filePath: string,
  referenceMode: ReferenceMode
): Promise<PreparedReference> {
  const sourceBytes = fs.statSync(filePath).size

  if (referenceMode === 'anchor') {
    const buffer = fs.readFileSync(filePath)
    return {
      buffer,
      mimeType: mimeFromPath(filePath),
      sourceBytes,
      preparedBytes: buffer.length,
      isolated: false
    }
  }

  const ext = path.extname(filePath).toLowerCase()
  let buffer: Buffer
  let mimeType: 'image/jpeg' | 'image/png'

  if (ext === '.png' || ext === '.webp') {
    buffer = await sharp(fs.readFileSync(filePath)).rotate().png().toBuffer()
    mimeType = 'image/png'
  } else {
    buffer = await sharp(fs.readFileSync(filePath)).rotate().jpeg({ quality: 98 }).toBuffer()
    mimeType = 'image/jpeg'
  }

  const debugPath = debugSavePathForUpload(filePath)
  if (debugPath) {
    fs.writeFileSync(debugPath, buffer)
  }

  return {
    buffer,
    mimeType,
    sourceBytes,
    preparedBytes: buffer.length,
    isolated: false
  }
}
