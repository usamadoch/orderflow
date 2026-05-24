import { MongoClient, type Db } from 'mongodb'

const DEFAULT_MONGODB_DB_NAME = 'orderflow'

type GlobalMongoState = {
  clientPromise?: Promise<MongoClient>
  uri?: string
}

declare global {
  // eslint-disable-next-line no-var
  var __orderflowMongo: GlobalMongoState | undefined
}

function getMongoUri() {
  const uri = process.env.MONGODB_URI

  if (!uri) {
    throw new Error('MONGODB_URI is required when MARKET_DB_DRIVER=mongodb')
  }

  return uri
}

export function getMongoDbName() {
  return process.env.MONGODB_DB_NAME || DEFAULT_MONGODB_DB_NAME
}

export async function getMongoClient() {
  const uri = getMongoUri()
  const globalState = globalThis.__orderflowMongo ?? {}

  if (!globalState.clientPromise || globalState.uri !== uri) {
    const client = new MongoClient(uri)
    globalState.clientPromise = client.connect()
    globalState.uri = uri
    globalThis.__orderflowMongo = globalState
  }

  return globalState.clientPromise
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient()
  return client.db(getMongoDbName())
}

export async function verifyMongoConnection() {
  const db = await getMongoDb()
  await db.command({ ping: 1 })

  return {
    ok: true,
    dbName: db.databaseName,
  }
}
