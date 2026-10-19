const mongoose = require('mongoose');
const { connectToMongoDB } = require('../utils/mongoConnect');

const collectionRenames = [
  ['posts', 'publications'],
  ['likes', 'appreciations'],
  ['postrevisions', 'publicationrevisions'],
  ['postsummaries', 'publicationsummaries'],
  ['commentlikes', 'commentappreciations'],
];

const fieldRenames = {
  publications: [['likesCount', 'appreciationsCount']],
  appreciations: [['postId', 'publicationId']],
  publicationrevisions: [['postId', 'publicationId']],
  publicationsummaries: [['postId', 'publicationId']],
  comments: [['postId', 'publicationId']],
  saves: [['postId', 'publicationId']],
  readingstates: [['postId', 'publicationId']],
  drafts: [['postId', 'publicationId']],
  interactionevents: [['postId', 'publicationId']],
  collections: [['posts', 'publications']],
  questions: [['relatedArticles', 'relatedPublications']],
};

const valueRenames = [
  ['publications', 'format', 'article', 'story'],
  ['publicationrevisions', 'format', 'article', 'story'],
  ['drafts', 'format', 'article', 'story'],
  ['shortseries', 'type', 'article', 'story'],
  ['interactionevents', 'surface', 'article', 'story'],
  ['reports', 'subjectType', 'post', 'publication'],
  ['notifications', 'entityType', 'post', 'publication'],
  ['notifications', 'type', 'post_liked', 'publication_appreciated'],
  ['notifications', 'type', 'post_commented', 'publication_commented'],
  ['entitlements', 'capability', 'article_summary', 'story_summary'],
];

const nestedRenames = {
  collections: { items: [['post', 'publication']] },
  shortseries: { items: [['post', 'publication']] },
  competitions: { entries: [['post', 'publication'], ['postRevision', 'publicationRevision'], ['likes', 'votes'], ['likesCount', 'votesCount']] },
};

const existingNames = async db => new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));

const inspect = async db => {
  const names = await existingNames(db);
  const conflicts = [];
  const steps = [];
  const sourceByTarget = new Map();
  for (const [oldName, newName] of collectionRenames) {
    const oldCount = names.has(oldName) ? await db.collection(oldName).estimatedDocumentCount() : 0;
    const newCount = names.has(newName) ? await db.collection(newName).estimatedDocumentCount() : 0;
    if (oldCount && newCount) conflicts.push(`${oldName} and ${newName} both contain records`);
    sourceByTarget.set(newName, oldCount ? oldName : newName);
    steps.push({ operation: 'collection', oldName, newName, count: oldCount, emptyTargetExists: names.has(newName) && !newCount });
  }
  for (const [name, pairs] of Object.entries(fieldRenames)) {
    const actualName = sourceByTarget.get(name) || name;
    if (!actualName || !names.has(actualName)) continue;
    for (const [oldName, newName] of pairs) {
      const count = await db.collection(actualName).countDocuments({ [oldName]: { $exists: true } });
      const collisions = await db.collection(actualName).countDocuments({ [oldName]: { $exists: true }, [newName]: { $exists: true } });
      if (collisions) conflicts.push(`${name}: ${collisions} records contain both ${oldName} and ${newName}`);
      steps.push({ operation: 'field', collection: name, oldName, newName, count });
    }
  }
  for (const [name, field, oldValue, newValue] of valueRenames) {
    const actualName = sourceByTarget.get(name) || name;
    if (actualName && names.has(actualName)) steps.push({ operation: 'value', collection: name, field, oldValue, newValue, count: await db.collection(actualName).countDocuments({ [field]: oldValue }) });
  }
  for (const [name, arrays] of Object.entries(nestedRenames)) {
    if (!names.has(name)) continue;
    for (const [array, pairs] of Object.entries(arrays)) {
      for (const [oldName, newName] of pairs) {
        const count = await db.collection(name).countDocuments({ [`${array}.${oldName}`]: { $exists: true } });
        const collisions = await db.collection(name).countDocuments({ [`${array}.${oldName}`]: { $exists: true }, [`${array}.${newName}`]: { $exists: true } });
        if (collisions) conflicts.push(`${name}: ${collisions} records contain both ${array}.${oldName} and ${array}.${newName}`);
        steps.push({ operation: 'nested', collection: name, array, oldName, newName, count });
      }
    }
  }
  return { conflicts, steps };
};

const oldPaths = new Set(['postId', 'likesCount', 'items.post', 'entries.post', 'entries.likes', 'entries.likesCount', 'posts', 'relatedArticles']);

const dropLegacyIndexes = async db => {
  const names = await existingNames(db);
  for (const name of names) {
    if (!Object.hasOwn(fieldRenames, name) && !Object.hasOwn(nestedRenames, name)) continue;
    for (const index of await db.collection(name).indexes()) {
      if (index.name !== '_id_' && Object.keys(index.key).some(key => oldPaths.has(key))) {
        await db.collection(name).dropIndex(index.name);
        console.log(`Dropped obsolete index: ${name}.${index.name}`);
      }
    }
  }
};

const apply = async (db, steps) => {
  const names = await existingNames(db);
  let indexesDropped = false;
  for (const step of steps) {
    if (step.operation !== 'collection' && !indexesDropped) {
      await dropLegacyIndexes(db);
      indexesDropped = true;
    }
    if (step.operation === 'collection') {
      if (!names.has(step.oldName)) continue;
      if (!step.count && names.has(step.newName)) {
        if (await db.collection(step.oldName).estimatedDocumentCount()) throw new Error(`Legacy collection gained records: ${step.oldName}`);
        await db.collection(step.oldName).drop();
        names.delete(step.oldName);
        console.log(`Removed empty legacy collection: ${step.oldName}`);
        continue;
      }
      if (names.has(step.newName)) {
        if (!step.emptyTargetExists || await db.collection(step.newName).estimatedDocumentCount()) throw new Error(`Target collection already contains records: ${step.newName}`);
        await db.collection(step.newName).drop();
      }
      await db.collection(step.oldName).rename(step.newName);
      names.delete(step.oldName);
      names.add(step.newName);
    } else if (!step.count) {
      continue;
    } else if (step.operation === 'field') {
      await db.collection(step.collection).updateMany({ [step.oldName]: { $exists: true } }, { $rename: { [step.oldName]: step.newName } });
    } else if (step.operation === 'value') {
      await db.collection(step.collection).updateMany({ [step.field]: step.oldValue }, { $set: { [step.field]: step.newValue } });
    } else if (step.operation === 'nested') {
      const collection = db.collection(step.collection);
      const cursor = collection.find({ [`${step.array}.${step.oldName}`]: { $exists: true } }, { projection: { [step.array]: 1 } });
      for await (const document of cursor) {
        const array = document[step.array].map(item => {
          if (!(step.oldName in item)) return item;
          const { [step.oldName]: value, ...rest } = item;
          return { ...rest, [step.newName]: value };
        });
        await collection.updateOne({ _id: document._id }, { $set: { [step.array]: array } });
      }
    }
    console.log(`Applied ${step.operation}: ${step.collection || step.oldName} (${step.count})`);
  }
};

const refreshRenamedIndexes = async () => {
  const modelFiles = [
    'publication', 'appreciation', 'publication-revision', 'publication-summary',
    'comment-appreciation', 'comment', 'save', 'reading-state', 'draft',
    'interaction-event', 'collection', 'question', 'short-series', 'competition',
  ];
  for (const name of modelFiles) await require(`../schemas/${name}.schema`).createIndexes();
};

const main = async () => {
  const shouldApply = process.argv.includes('--apply');
  const expectedDatabase = process.argv.find(argument => argument.startsWith('--expect-db='))?.slice('--expect-db='.length);
  await connectToMongoDB();
  try {
    const db = mongoose.connection.db;
    if (shouldApply && (!expectedDatabase || db.databaseName !== expectedDatabase)) {
      throw new Error(`Apply requires --expect-db=${db.databaseName} for the connected database`);
    }
    const plan = await inspect(db);
    for (const step of plan.steps) console.log(JSON.stringify(step));
    if (plan.conflicts.length) throw new Error(`Migration conflicts: ${plan.conflicts.join('; ')}`);
    if (shouldApply) {
      await apply(db, plan.steps);
      await refreshRenamedIndexes();
      console.log('Publication terminology migration complete');
    } else {
      console.log('Dry run complete. Pass --apply to perform the migration.');
    }
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

module.exports = { collectionRenames, fieldRenames, valueRenames, nestedRenames, inspect, apply, refreshRenamedIndexes };
