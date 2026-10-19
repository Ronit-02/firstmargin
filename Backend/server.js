const app = require('./src/app.js')
const config = require('./config/config.js')
const { connectToMongoDB } = require('./utils/mongoConnect.js')
const { ensureCanonicalTopics } = require('./services/topic.service.js')

const start = async () => {
  await connectToMongoDB();
  await ensureCanonicalTopics();
  app.listen(config.PORT, () => {
    console.log(`Listening on port ${config.PORT}`);
  });
};

start().catch(() => {
  console.error('firstmargin API failed to start');
  process.exitCode = 1;
});
