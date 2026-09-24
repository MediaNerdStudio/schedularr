import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/schedularr';
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
      break;
    } catch (err) {
      retries++;
      if (retries === maxRetries) {
        console.error(`MongoDB connection failed after ${maxRetries} attempts: ${err.message}`);
        console.error('Make sure MongoDB is running. You can start it with:');
        console.error('  docker compose up -d mongo');
        console.error(`  or set MONGODB_URI in .env to your MongoDB instance`);
        process.exit(1);
      }
      console.warn(`MongoDB connection attempt ${retries}/${maxRetries} failed, retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });
}
