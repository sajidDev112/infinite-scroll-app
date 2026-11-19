import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

/** Opens the MongoDB connection (once) and makes sure the model indexes exist. */
export async function connectDb(uri = env.mongoUri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const { Admin, Story, PublishedStory, Image } = await import('../models/index.js');
  await Promise.all([Admin, Story, PublishedStory, Image].map((m) => m.syncIndexes()));
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

export const dbReady = () => mongoose.connection.readyState === 1;
