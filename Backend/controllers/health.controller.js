const { checkMongoConnection, checkMongoAvailability } = require('../utils/mongoConnect.js');
const { getNotificationDeliveryHealth } = require('../services/notification-monitor.service.js');

const health = (req, res) => res.status(200).json({ status: 'ok' });

const readiness = async (req, res) => {
  const databaseReady = checkMongoConnection();
  const delivery = databaseReady ? await getNotificationDeliveryHealth().catch(() => ({ status: 'unknown' })) : { status: 'unknown' };
  const payload = {
    status: databaseReady && delivery.status !== 'attention' ? 'ok' : 'error',
    checks: { database: databaseReady ? 'ok' : 'error' },
  };
  if (databaseReady) {
    payload.checks.notificationDelivery = delivery.status;
    payload.notificationDelivery = delivery;
  }

  if (!databaseReady) payload.message = 'MongoDB connection failed';
  return res.status(payload.status === 'ok' ? 200 : 503).json(payload);
};

const databaseStatus = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  const databaseReady = await checkMongoAvailability();
  if (databaseReady) return res.status(200).send({ status: 'ok' });
  return res.status(503).send({ status: 'error', message: 'MongoDB connection failed' });
};

module.exports = { health, readiness, databaseStatus };
