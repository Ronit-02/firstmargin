require('dotenv').config();
const mongoose = require('mongoose');
const ShortSeries = require('../schemas/short-series.schema');
const { connectToMongoDB } = require('../utils/mongoConnect');

const run = async () => {
  await connectToMongoDB();
  const indexes = await ShortSeries.collection.listIndexes().toArray();
  const legacy = indexes.find(index => index.unique && Object.keys(index.key).length === 1 && index.key['items.publication'] === 1);
  if (!legacy) {
    console.log('No unique series membership index to remove');
    return;
  }
  await ShortSeries.collection.dropIndex(legacy.name);
  console.log('Removed unique series membership index');
};

run()
  .catch(() => {
    console.error('Series membership migration failed');
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
