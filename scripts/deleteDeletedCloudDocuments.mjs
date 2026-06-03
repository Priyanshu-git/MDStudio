import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const confirmDelete = process.argv.includes('--confirm')
const envPath = resolve(process.cwd(), '.env.local')
const env = existsSync(envPath) ? readEnvFile(envPath) : {}

const app = initializeApp({
  credential: resolveAdminCredential(env),
  projectId: env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID,
})
const firestore = getFirestore(app)

try {
  const userRefs = await firestore.collection('users').listDocuments()
  const snapshots = await Promise.all(
    userRefs.map((userRef) => userRef.collection('documents').where('deletedAt', '>', 0).get()),
  )
  const candidates = snapshots.flatMap((snapshot) => snapshot.docs)

  console.log(confirmDelete ? 'Deleting deleted private cloud documents...' : 'Dry run: deleted private cloud documents')
  console.log(`Matched ${candidates.length} private deleted document(s).`)

  for (const item of candidates) {
    const data = item.data()
    const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : '(untitled)'
    const ownerUid = typeof data.ownerUid === 'string' && data.ownerUid.trim() ? data.ownerUid.trim() : '(missing ownerUid)'
    console.log(`- ${item.ref.path} | title: ${title} | ownerUid: ${ownerUid}`)
  }

  if (!confirmDelete) {
    console.log('No documents were deleted. Re-run with -- --confirm to delete these records.')
    process.exit(0)
  }

  for (const item of candidates) {
    await item.ref.delete()
  }

  console.log(`Deleted ${candidates.length} private cloud document(s).`)
} catch (error) {
  console.error('Unable to query or delete deleted private cloud documents.')
  console.error(
    'Provide Admin credentials via GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_PATH, or FIREBASE_SERVICE_ACCOUNT_JSON.',
  )
  throw error
}

function resolveAdminCredential(env) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (serviceAccountJson) {
    return cert(JSON.parse(serviceAccountJson))
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (serviceAccountPath) {
    return cert(JSON.parse(readFileSync(resolve(process.cwd(), serviceAccountPath), 'utf8')))
  }

  return applicationDefault()
}

function readEnvFile(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=')
        if (separatorIndex === -1) {
          return [line, '']
        }
        return [
          line.slice(0, separatorIndex).trim(),
          stripQuotes(line.slice(separatorIndex + 1).trim()),
        ]
      }),
  )
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}
