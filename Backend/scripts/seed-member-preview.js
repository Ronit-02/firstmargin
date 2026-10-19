const mongoose = require('mongoose');
const { connectToMongoDB } = require('../utils/mongoConnect');
const User = require('../schemas/user.schema');
const Publication = require('../schemas/publication.schema');
const PublicationRevision = require('../schemas/publication-revision.schema');
const Workshop = require('../schemas/workshop.schema');

// Only add the Member Hub examples. The comprehensive seed updates many other fixtures.
const databaseName = (() => {
  try { return new URL(process.env.MONGO_URI || '').pathname.slice(1); } catch { return process.env.DB_NAME || ''; }
})();
if (process.env.NODE_ENV === 'production' || !/dev|test|sandbox|local/i.test(databaseName) || /prod|live/i.test(databaseName)) {
  throw new Error('Member preview seed requires an explicitly named development database');
}

const DAY = 24 * 60 * 60 * 1000;
const ahead = days => new Date(Date.now() + days * DAY);
const posts = [
  { email: 'maya@inkrider.local', title: 'The Library at the End of the Street', format: 'story', tags: ['design', 'essays'], publicInDays: 9, coverImage: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1400&q=80', blocks: [['text', 'The neighborhood library opens before the shops and stays bright after the school day ends. For many residents, it is the only quiet room they can enter without buying anything.'], ['h2', 'A place to stay'], ['text', 'I spoke with readers, librarians, and people who simply needed a table. Their stories show how a small public space can make a city feel more generous.']] },
  { email: 'arjun@inkrider.local', title: 'One Question Before You Share a Chart', format: 'short', tags: ['technology', 'design'], publicInDays: 12, blocks: [['text', 'Before sharing a chart, ask what the scale hides. A dramatic line can describe a tiny change, while a flat line can conceal a meaningful difference across groups. Read the labels, then read the story again.']] },
];
const workshops = [
  { email: 'arjun@inkrider.local', title: 'Make Data Stories Easier to Read', description: 'Practice choosing a clear question, checking a chart’s scale, and explaining what the numbers do and do not show.', startsInDays: 10, minutes: 90, capacity: 30, meetingUrl: 'https://meet.example.test/data-stories' },
  { email: 'maya@inkrider.local', title: 'Build a Scene from Everyday Details', description: 'Bring a few observations from a familiar place and turn them into a scene with movement, voice, and a sense of place.', startsInDays: 14, minutes: 120, capacity: 20, meetingUrl: 'https://meet.example.test/everyday-scenes' },
];

async function run() {
  await connectToMongoDB();
  const users = new Map((await User.find({ email: { $in: [...new Set([...posts, ...workshops].map(item => item.email))] } }).select('email')).map(user => [user.email, user]));
  if (users.size !== 2) throw new Error('Demo authors are missing; run the comprehensive development seed first');

  for (const fixture of posts) {
    const author = users.get(fixture.email);
    const body = JSON.stringify(fixture.blocks.map(([type, content], index) => ({ id: `seed-member-preview-${index + 1}`, type, content })));
    const publicAt = ahead(fixture.publicInDays);
    const post = await Publication.findOneAndUpdate({ author: author._id, title: fixture.title }, { $setOnInsert: { body, format: fixture.format, tags: fixture.tags, coverImage: fixture.coverImage || null, publicationStatus: 'published', publicAt, currentRevision: 1 } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
    await PublicationRevision.updateOne({ publicationId: post._id, revision: 1 }, { $setOnInsert: { authorId: author._id, title: fixture.title, body, coverImage: fixture.coverImage || null, format: fixture.format, tags: fixture.tags, publicAt } }, { upsert: true });
  }

  for (const fixture of workshops) {
    const startsAt = ahead(fixture.startsInDays);
    await Workshop.updateOne({ hostId: users.get(fixture.email)._id, title: fixture.title }, { $setOnInsert: { description: fixture.description, startsAt, endsAt: new Date(startsAt.getTime() + fixture.minutes * 60 * 1000), capacity: fixture.capacity, meetingUrl: fixture.meetingUrl, status: 'published' } }, { upsert: true });
  }

  console.log('Member Hub preview items are ready: 2 early releases and 2 workshops');
}

run().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect());
