import 'dotenv/config';
import { connectDB, disconnectDB } from './config/db.js';
import app from './app.js';
import { seedDatabase } from './seed.js';

const PORT = Number(process.env.PORT) || 4000;

async function start() {
  try {
    await connectDB();
    await seedDatabase();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`School Inventory API listening on http://0.0.0.0:${PORT}`);
      console.log(`Demo accounts → admin/Admin@123 · staff/Staff@123 · viewer/Viewer@123`);
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
