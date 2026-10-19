process.env.NOTIFICATION_WORKER_CONTINUOUS = 'true';
require('./scripts/process-notification-deliveries');
const { connectToMongoDB } = require('./utils/mongoConnect');
const { processDueCompetitions } = require('./services/competition-lifecycle.service');

const runCompetitions = async () => {
  await connectToMongoDB();
  await processDueCompetitions();
};
runCompetitions().catch(() => console.error('Competition deadline processing needs repair'));
const competitionInterval = setInterval(() => runCompetitions().catch(() => console.error('Competition deadline processing needs repair')), 15_000);
const stopCompetitions = () => clearInterval(competitionInterval);
process.once('SIGTERM', stopCompetitions);
process.once('SIGINT', stopCompetitions);
