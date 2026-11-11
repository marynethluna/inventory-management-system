import 'dotenv/config';
import { connectDB, disconnectDB } from './config/db.js';
import app from './app.js';
import { JWT_SECRET } from './middleware/auth.js';
import { seedDatabase } from './seed.js';

const PORT = Number(process.env.PORT) || 4000;

async function start() {
  try {
    if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
      throw new Error('Set JWT_SECRET to a private random value of at least 32 characters before starting in production.');
    }
    await connectDB();
    await seedDatabase();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`School Inventory API listening on http://0.0.0.0:${PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 8000).unref();
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
}

start();
