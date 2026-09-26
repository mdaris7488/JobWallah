import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import app from './app.js';
import { purgeOldFiles } from './utils/tmpFiles.js';
import { killAllFfmpeg, startJobSweeper } from './services/videoService.js';

await connectDB();
startJobSweeper();
purgeOldFiles(60 * 60 * 1000); // leftovers from a previous crash
setInterval(() => purgeOldFiles(60 * 60 * 1000), 15 * 60 * 1000).unref();

const server = app.listen(env.PORT, () => console.log(`🚀 API running on http://localhost:${env.PORT} (${env.NODE_ENV})`));

async function shutdown(signal) {
  console.log(`\n${signal} received - shutting down gracefully...`);
  killAllFfmpeg();
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // force exit if connections hang
}
['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));
process.on('unhandledRejection', (reason) => { console.error('Unhandled rejection:', reason); shutdown('unhandledRejection'); });
