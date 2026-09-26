import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDB() {
  await mongoose.connect(env.MONGO_URI, {
    autoIndex: true, // creates the unique/TTL indexes on boot. For very large production DBs, disable and use migrations.
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 20,
  });
  console.log(`✅ MongoDB connected: ${mongoose.connection.name}`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
