import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let memoryServer = null;

/**
 * Connects to MongoDB.
 * - If MONGODB_URI is set, uses that deployment (recommended for production).
 * - Otherwise starts an in-process single-node replica set so multi-document
 *   transactions are available during development and end-to-end testing.
 */
export async function connectDB() {
  if (process.env.MONGODB_URI) {
    mongoose.set('strictQuery', true);
    await mongoose.connect(process.env.MONGODB_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    return mongoose.connection;
  }

  memoryServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const uri = memoryServer.getUri('school_inventory');
  await mongoose.connect(uri, { autoIndex: true });
  console.log(`MongoDB (in-memory) connected: ${mongoose.connection.name}`);
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
