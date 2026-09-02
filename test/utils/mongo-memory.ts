import { MongoMemoryServer } from 'mongodb-memory-server';

// Instance MongoDB en mémoire pour les tests e2e — évite de dépendre d'une
// instance MongoDB externe en CI (voir ADR 0010, stratégie de tests).
let mongod: MongoMemoryServer | undefined;

export async function startInMemoryMongo(): Promise<string> {
  mongod = await MongoMemoryServer.create();
  return mongod.getUri();
}

export async function stopInMemoryMongo(): Promise<void> {
  await mongod?.stop();
  mongod = undefined;
}
