import { prisma } from '../src/lib/prisma.js'
import { generateImage } from '../src/services/seedreamService.js'
import { saveBatchPoseOutput } from '../src/services/storageService.js'
import { seedFromString } from '../../src/shared/generation/reference.js'
import type { PetPoseType } from '../../src/shared/types/pet.js'
import fs from 'node:fs'
import { createHash } from 'node:crypto'

function parseArg(flag: string): string | null {
  const index = process.argv.indexOf(flag)
  if (index < 0) return null
  return process.argv[index + 1] ?? null
}

const email = parseArg('--email')
const pose = (parseArg('--pose') ?? 'happy') as PetPoseType
const batchIdArg = parseArg('--batch')

if (!email) {
  console.error('Missing --email')
  process.exit(1)
}
if (!pose) {
  console.error('Missing --pose')
  process.exit(1)
}

const user = await prisma.user.findUnique({ where: { email } })
if (!user) {
  console.error('User not found')
  process.exit(1)
}

const batch = batchIdArg
  ? await prisma.generationBatch.findFirst({
      where: { id: batchIdArg, userId: user.id },
      include: { jobs: true }
    })
  : await prisma.generationBatch.findFirst({
      where: { userId: user.id, jobType: 'full_batch', status: 'succeeded' },
      orderBy: { createdAt: 'desc' },
      include: { jobs: true }
    })

if (!batch) {
  console.error('Batch not found')
  process.exit(1)
}

const idleJob = batch.jobs.find((j) => j.pose === 'idle' && j.status === 'succeeded')
if (!idleJob?.outputImagePath) {
  console.error('Idle output not found for batch; cannot anchor-regenerate.')
  process.exit(1)
}

const targetJob = batch.jobs.find((j) => j.pose === pose)
if (!targetJob) {
  console.error(`Target job not found for pose=${pose}`)
  process.exit(1)
}

const idleBuffer = fs.readFileSync(idleJob.outputImagePath)
const inputHash = createHash('sha256')
  .update(batch.inputImagePath ? fs.readFileSync(batch.inputImagePath) : idleBuffer)
  .digest('hex')
const seed = seedFromString(inputHash)

const started = Date.now()
const { buffer, prompt } = await generateImage(idleBuffer, 'petory', pose, {
  seed,
  referenceMode: 'anchor',
  mimeType: 'image/png'
})
const outputPath = saveBatchPoseOutput(user.id, batch.id, pose, buffer)
const durationMs = Date.now() - started

await prisma.generationJob.update({
  where: { id: targetJob.id },
  data: {
    status: 'succeeded',
    outputImagePath: outputPath,
    prompt,
    errorCode: null,
    errorMessage: null,
    durationMs
  }
})

console.info(`OK: regenerated ${pose} for batch=${batch.id} job=${targetJob.id} -> ${outputPath}`)

