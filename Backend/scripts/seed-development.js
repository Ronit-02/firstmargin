const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { connectToMongoDB } = require('../utils/mongoConnect');
const User = require('../schemas/user.schema');
const Profile = require('../schemas/profile.schema');
const Topic = require('../schemas/topic.schema');
const UserInterest = require('../schemas/user-interest.schema');
const Publication = require('../schemas/publication.schema');
const PublicationRevision = require('../schemas/publication-revision.schema');
const Draft = require('../schemas/draft.schema');
const Appreciation = require('../schemas/appreciation.schema');
const Save = require('../schemas/save.schema');
const Follow = require('../schemas/follow.schema');
const Comment = require('../schemas/comment.schema');
const Question = require('../schemas/question.schema');
const Collection = require('../schemas/collection.schema');
const ShortSeries = require('../schemas/short-series.schema');
const Competition = require('../schemas/competition.schema');
const CompetitionAudit = require('../schemas/competition-audit.schema');
const InteractionEvent = require('../schemas/interaction-event.schema');
const Membership = require('../schemas/membership.schema');
const Entitlement = require('../schemas/entitlement.schema');
const ProviderEvent = require('../schemas/provider-event.schema');
const PublicationSummary = require('../schemas/publication-summary.schema');
const Workshop = require('../schemas/workshop.schema');
const WorkshopAttendance = require('../schemas/workshop-attendance.schema');
const CreatorUpdate = require('../schemas/creator-update.schema');
const CreatorRequest = require('../schemas/creator-request.schema');
const Notification = require('../schemas/notification.schema');
const Report = require('../schemas/report.schema');
const ModerationAction = require('../schemas/moderation-action.schema');
const AiUsage = require('../schemas/ai-usage.schema');
const { ensureCanonicalTopics } = require('../services/topic.service');
const { normalizeQuestionText } = require('../utils/question');
const { MaleAvatars, FemaleAvatars } = require('../assets/data');
const { discoveryStoryBodies, shortFixtures, additionalStoryFixtures } = require('../data/development-writing');
const { edgeCaseFixtures, edgeQuestionFixtures, edgeDraftFixtures, edgeCollectionFixtures, edgeSeriesFixtures } = require('../data/development-edge-cases');

if (process.env.NODE_ENV === 'production') throw new Error('Development seed is disabled in production');

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const ago = days => new Date(now.getTime() - days * DAY);
const ahead = days => new Date(now.getTime() + days * DAY);
const monthKey = now.toISOString().slice(0, 7);
const seedPassword = process.env.SEED_PASSWORD || 'InkRiderDemo123!';

const userFixtures = [
  { key: 'maya', email: 'maya@inkrider.local', username: 'Maya Sen', handle: 'maya-sen', bio: 'Essays on cities, memory, and public life.', writerStatus: 'writer', directRequestsEnabled: true, avatarUrl: FemaleAvatars[0] },
  { key: 'arjun', email: 'arjun@inkrider.local', username: 'Arjun Rao', handle: 'arjun-rao', bio: 'Explaining technology through humane stories.', writerStatus: 'writer', directRequestsEnabled: true, avatarUrl: MaleAvatars[0] },
  { key: 'leila', email: 'leila@inkrider.local', username: 'Leila Noor', handle: 'leila-noor', bio: 'Marine science, field notes, and climate solutions.', writerStatus: 'writer', directRequestsEnabled: true, avatarUrl: FemaleAvatars[1] },
  { key: 'noah', email: 'noah@inkrider.local', username: 'Noah Williams', handle: 'noah-williams', bio: 'A curious reader exploring fiction and design.', writerStatus: 'reader', avatarUrl: MaleAvatars[1] },
  { key: 'priya', email: 'member@inkrider.local', username: 'Priya Mehta', handle: 'priya-mehta', bio: 'Member, collector, and workshop regular.', writerStatus: 'reader', avatarUrl: FemaleAvatars[2] },
  { key: 'moderator', email: 'moderator@inkrider.local', username: 'Demo Moderator', handle: 'demo-moderator', bio: 'Reviews community reports.', writerStatus: 'reader', role: 'moderator', avatarUrl: MaleAvatars[2] },
  { key: 'admin', email: 'admin@inkrider.local', username: 'Demo Admin', handle: 'demo-admin', bio: 'Operates competitions and platform settings.', writerStatus: 'reader', role: 'admin', avatarUrl: MaleAvatars[3] },
];

const engagementReaders = [
  ['aisha', 'Aisha Karim', FemaleAvatars[3]], ['dev', 'Dev Malhotra', MaleAvatars[4]],
  ['elena', 'Elena Park', FemaleAvatars[4]], ['farah', 'Farah Ali', FemaleAvatars[5]],
  ['gabriel', 'Gabriel Torres', MaleAvatars[5]], ['hana', 'Hana Kim', FemaleAvatars[6]],
  ['ishan', 'Ishan Patel', MaleAvatars[6]], ['jules', 'Jules Martin', MaleAvatars[7]],
  ['kavya', 'Kavya Nair', FemaleAvatars[7]], ['leo', 'Leo Bennett', MaleAvatars[8]],
  ['mina', 'Mina Chen', FemaleAvatars[3]], ['omar', 'Omar Haddad', MaleAvatars[9]],
];
userFixtures.push(...engagementReaders.map(([key, username, avatarUrl]) => ({
  key, email: `${key}@inkrider.local`, username, handle: `reader-${key}`,
  bio: 'A curious firstmargin reader.', writerStatus: 'reader', avatarUrl,
})));

const engagementReaderKeys = ['noah', 'priya', ...engagementReaders.map(([key]) => key)];
const stableNumber = (key, salt) => crypto.createHash('sha256').update(`${key}:${salt}`).digest().readUInt32BE(0);
const normalizeTags = tags => [...new Set(tags.map(tag => String(tag).trim().toLowerCase()).filter(Boolean))].slice(0, 20);
const relatedTags = {
  design: ['public space', 'urban life', 'accessibility', 'everyday design', 'community', 'observation'],
  essays: ['writing craft', 'reflection', 'field notes', 'local memory', 'slow reading', 'curiosity'],
  technology: ['data literacy', 'digital life', 'product thinking', 'human decisions', 'interfaces', 'reader choice'],
  science: ['field notes', 'ecology', 'coastal change', 'climate', 'research', 'nature'],
  fiction: ['short fiction', 'place', 'memory', 'dialogue', 'storytelling', 'atmosphere'],
  travel: ['place', 'walking', 'field notes', 'local life', 'observation', 'routes'],
  wellness: ['attention', 'slower living', 'nature', 'everyday habits', 'reflection', 'observation'],
};
const tagsForFixture = fixture => {
  const base = normalizeTags(fixture.tags);
  if (fixture.edgeCase || !base.length) return base;
  const extras = relatedTags[base[0]] || [];
  const offset = stableNumber(fixture.key, 'tag-offset') % (extras.length || 1);
  const count = stableNumber(fixture.key, 'tag-count') % 5;
  return normalizeTags([...base, ...[...extras.slice(offset), ...extras.slice(0, offset)].slice(0, count)]);
};
const commentCopy = {
  design: [
    'The everyday example makes the design choice much easier to picture.',
    'I would be interested to see how this changes for people with different routines.',
    'The maintenance detail is easy to miss and important to keep in the discussion.',
    'This gave me a new question to ask the next time I use a shared space.',
    'I like that the piece starts with what people actually do.',
    'A before-and-after visit would make a useful follow-up to this idea.',
  ],
  technology: [
    'The practical check is something I can try before trusting the next recommendation.',
    'I appreciate the distinction between a useful signal and a complete answer.',
    'This makes the tradeoff clearer without pretending there is one perfect metric.',
    'I would like to see how this behaves for a brand-new reader.',
    'The explanation helped me notice which choice the interface makes for me.',
    'A concrete example of the failure case would be a great follow-up.',
  ],
  science: [
    'The difference between observation and conclusion is especially helpful here.',
    'I appreciate that the limits of the evidence stay visible.',
    'This makes me want to compare the same place across more than one visit.',
    'The local perspective adds something a single measurement could miss.',
    'A follow-up after another season would make this even more useful.',
    'The field-note detail gives readers a practical way to look more closely.',
  ],
  fiction: [
    'That small detail near the end changed how I read the opening.',
    'The setting feels lived in without a long explanation.',
    'I kept thinking about the choice the character did not make.',
    'The quiet ending leaves room for a second reading.',
    'I could picture the scene because the movement stayed so specific.',
    'I would happily read another story set in this place.',
  ],
  essays: [
    'The opening observation stayed with me after I finished reading.',
    'This helped me name something I had noticed but not understood.',
    'I like how the small example opens into a larger question.',
    'The conclusion leaves me with something specific to try.',
    'I would enjoy another perspective on the same question.',
    'This is one I want to return to on a slower day.',
  ],
};

const postFixtures = [
  {
    key: 'walkable-city', author: 'maya', title: 'The Quiet Architecture of a Walkable City', tags: ['design', 'essays'], topicSlugs: ['design', 'essays'], age: 12,
    coverImage: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1400&q=80',
    blocks: [
      ['h1', 'Streets are invitations'],
      ['text', 'A walkable city is built from thousands of small invitations: a shaded bench, a safe crossing, and a shopfront that meets the street.'],
      ['quote', 'The best public spaces make ordinary movement feel worth noticing.'],
      ['text', 'Design matters, but maintenance and public trust determine whether those invitations remain open.'],
      ['image', 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80', 'People walking through a tree-lined city street.'],
    ],
  },
  {
    key: 'recommendation-systems', author: 'arjun', title: 'What Recommendation Systems Should Optimize For', tags: ['technology', 'design'], topicSlugs: ['technology', 'design'], age: 3, appreciationsCount: 18,
    coverImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80',
    blocks: [
      ['text', 'A useful recommendation system should expand a reader’s world without losing sight of why they arrived.'],
      ['h2', 'Popularity is a signal, not a verdict'],
      ['text', 'Recency, topic affinity, completion, and deliberate diversity all deserve a role in ranking.'],
      ['code', 'score = affinity + freshness + quality + exploration'],
      ['text', 'The product should explain its choices so readers can correct the system instead of being trapped by it.'],
    ],
  },
  {
    key: 'restoring-reefs', author: 'leila', title: 'Can Restored Reefs Protect Coastal Cities?', tags: ['science', 'wellness'], topicSlugs: ['science'], age: 0.2, appreciationsCount: 11,
    coverImage: 'https://images.unsplash.com/photo-1546026423-cc4642628d2b?auto=format&fit=crop&w=1400&q=80',
    blocks: [
      ['text', 'Coral and oyster reefs can reduce wave energy before it reaches vulnerable shorelines.'],
      ['h2', 'Protection and habitat can reinforce each other'],
      ['text', 'Restoration succeeds when ecology, local livelihoods, and long-term monitoring are planned together.'],
    ],
  },
  {
    key: 'fiction-station', author: 'maya', title: 'The Last Train from Platform Seven', tags: ['fiction', 'travel'], topicSlugs: ['fiction', 'travel'], age: 1, appreciationsCount: 7,
    coverImage: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1400&q=80',
    blocks: [
      ['text', 'At midnight, the station clock lost a minute and everyone pretended not to notice.'],
      ['text', 'Mira held a ticket printed with a destination she had never heard of, while the final train arrived without a sound.'],
      ['quote', 'Some journeys begin only after the map stops helping.'],
    ],
  },
  {
    key: 'attention-one', author: 'maya', title: 'Attention Begins with One Precise Detail', format: 'short', tags: ['essays', 'wellness'], topicSlugs: ['essays', 'wellness'], age: 0.1,
    blocks: [['text', 'Before interpreting a moment, write down one exact detail: the color of the light, the sound behind a conversation, or the object everyone ignored. Precision gives reflection somewhere honest to begin.']],
  },
  {
    key: 'attention-two', author: 'maya', title: 'Return Tomorrow and Notice What Changed', format: 'short', tags: ['essays', 'wellness'], topicSlugs: ['essays', 'wellness'], age: 0.08,
    blocks: [['text', 'Revisit the same place or idea a day later. The difference between your two observations often reveals more than either observation alone.']],
  },
  {
    key: 'ranking-short', author: 'arjun', title: 'A Two-Minute Test for Better Recommendations', format: 'short', tags: ['technology'], topicSlugs: ['technology'], age: 0.04,
    blocks: [['text', 'Ask whether the next recommendation adds a new author, a new angle, or a useful level of depth. If it adds none of these, popularity is probably doing too much work.']],
  },
  {
    key: 'early-access', author: 'leila', title: 'Field Notes from a Living Breakwater', tags: ['science', 'travel'], topicSlugs: ['science', 'travel'], age: 0, publicAt: ahead(5),
    coverImage: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80',
    blocks: [['text', 'These early field notes follow a living-breakwater team through one week of monitoring waves, sediment, and returning wildlife.'], ['text', 'Members can read the draft release now; the same story becomes public automatically in five days.']],
  },
  {
    key: 'early-city', author: 'maya', title: 'The Library at the End of the Street', tags: ['design', 'essays'], topicSlugs: ['design', 'essays'], age: 0, publicAt: ahead(9),
    coverImage: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1400&q=80',
    blocks: [['text', 'The neighborhood library opens before the shops and stays bright after the school day ends. For many residents, it is the only quiet room they can enter without buying anything.'], ['h2', 'A place to stay'], ['text', 'I spoke with readers, librarians, and people who simply needed a table. Their stories show how a small public space can make a city feel more generous.']],
  },
  {
    key: 'early-short', author: 'arjun', title: 'One Question Before You Share a Chart', format: 'short', tags: ['technology', 'design'], topicSlugs: ['technology', 'design'], age: 0, publicAt: ahead(12),
    blocks: [['text', 'Before sharing a chart, ask what the scale hides. A dramatic line can describe a tiny change, while a flat line can conceal a meaningful difference across groups. Read the labels, then read the story again.']],
  },
  {
    key: 'unpublished', author: 'arjun', title: 'Unpublished Demo: Notes on Humane Metrics', tags: ['technology'], topicSlugs: ['technology'], age: 2, publicationStatus: 'unpublished',
    blocks: [['text', 'This unpublished fixture appears only in Arjun’s post-management view and direct owner access.']],
  },
];

const openingStoryAdditions = {
  'walkable-city': [
    ['h2', 'The route between destinations'],
    ['text', 'On one block, a café owner places a chair near the entrance each morning. By afternoon, the chair is used by delivery workers, neighbors waiting for a friend, and anyone who needs a brief pause. It is a tiny amenity, but it changes the pace of the pavement around it.'],
    ['text', 'The next block has a wide sidewalk and nowhere to rest. In summer it offers no shade. A route can meet a width standard and still tell some people that they should move through quickly. Walkability becomes real when the whole journey works for a person carrying groceries, pushing a stroller, or moving slowly.'],
    ['h2', 'Care is part of the design'],
    ['text', 'Safe crossings need visible paint and functioning signals; trees need water; benches need repair. Maintenance is not a footnote to the original design. It is the continuing work that keeps public invitations open. Ask residents which parts of their route they avoid, then return after improvements to see whether their habits have changed.'],
  ],
  'recommendation-systems': [
    ['h2', 'Make the goal visible'],
    ['text', 'A recommendation can earn a click because a title provokes anxiety, yet leave the reader less informed. Another piece may be opened by fewer people but lead them to save it, finish it, or ask a better question. These outcomes describe different kinds of value. A ranking system should be explicit about which ones it rewards.'],
    ['text', 'Diversity is not a random story inserted as decoration. It is an opportunity to present a credible unfamiliar writer, a different level of depth, or a nearby subject that broadens the original question. The system still needs evidence that the suggestion helped.'],
    ['h2', 'Give readers a say'],
    ['text', 'An explanation such as “because you follow this topic” gives a reader something to correct. Controls to reduce a topic, follow a writer, or dismiss a recommendation turn the feed into a conversation. They also reveal where the system has mistaken a momentary click for a lasting interest.'],
  ],
  'restoring-reefs': [
    ['h2', 'What success would look like'],
    ['text', 'A reef project should begin with a local question: which stretch of coast needs help, and under what conditions? Wave height, sediment movement, and habitat use can be monitored before and after construction. Those measures are more informative than a single photograph of the finished structure.'],
    ['text', 'The people living and working nearby add another kind of evidence. Fishers may notice changes in access; residents may report where water reaches during storms. Their observations cannot replace instruments, but they can show which outcomes matter and where a model deserves a second look.'],
    ['h2', 'Plan for the long term'],
    ['text', 'Restoration is not a one-season promise. Materials can shift, young organisms may fail to establish, and future storms may test a design beyond its initial conditions. A credible plan budgets for monitoring, repair, and the possibility that the intervention needs to change.'],
  ],
  'fiction-station': [
    ['text', 'The conductor wore a blue coat with no badge. He checked Mira’s ticket and returned it with the date folded under his thumb. When she looked again, the platform behind him had emptied, although she had heard no footsteps.'],
    ['h2', 'The carriage with the open window'],
    ['text', 'Inside, every seat faced the same direction except one. An old woman sat there holding a paper map covered in penciled circles. “You can still get off,” she said, before Mira had asked whether she could.'],
    ['text', 'Mira chose the seat opposite her. Through the window she saw the station sign turn slowly away, then the street where she had grown up. She had not visited it in years. The train moved on before she could decide whether the glimpse was a memory or a place.'],
    ['text', 'At the next stop, the clock above the door returned the missing minute. Mira folded her ticket along its original crease and stepped into the light, carrying a destination she could finally name.'],
  ],
  'early-access': [
    ['h2', 'A week on the water'],
    ['text', 'Each morning the team marked the tide and inspected the sheltered side of the structure. Small changes in sediment were easier to see in repeated notes than in photographs taken from different angles. The group also recorded where birds rested and where the new growth had not yet taken hold.'],
    ['text', 'One windy afternoon interrupted the neat pattern. Waves crossed a section thought to be protected, and the team returned the following day to check for displaced material. The result was not a failure or a victory; it was information about the conditions the design still needed to withstand.'],
    ['text', 'The field notes end with a list of questions for the next season. That is the rhythm of living infrastructure: observe, repair, compare, and remain willing to change the plan.'],
  ],
  'early-city': [
    ['text', 'A student comes for a quiet table, while an older resident comes for the morning paper and a conversation with a familiar librarian. Neither use is captured by a simple count of books borrowed.'],
    ['h2', 'Keeping the door open'],
    ['text', 'The building works because someone maintains it, answers questions, and notices when the same person has stopped coming. Longer hours help only when staff and visitors can depend on them. A welcoming public place is an ongoing practice, not a sign on the door.'],
    ['text', 'The library is small enough that every moved chair is visible. Its value is large enough that the neighborhood has learned to defend the time and care it needs.'],
  ],
};
for (const fixture of postFixtures) if (openingStoryAdditions[fixture.key]) fixture.blocks.push(...openingStoryAdditions[fixture.key]);
const openingShortAdditions = {
  'attention-one': 'Write the detail before deciding what it means. When you return to the note later, you may find that the most ordinary observation is the one that changes your first interpretation.',
  'attention-two': 'Compare the two visits without trying to make them agree. What changed in the place, and what changed in your own attention? Keep both possibilities open until you have another observation.',
  'ranking-short': 'Try the test on three consecutive suggestions. If all three repeat the same voice or claim, ask what the feed thinks you need and whether you have given it a way to learn otherwise.',
  'early-short': 'If the chart compares groups, check whether they share a baseline. A clear caption should tell readers what is counted, when it was counted, and which question the picture can answer.',
};
for (const fixture of postFixtures) if (openingShortAdditions[fixture.key]) fixture.blocks.push(['text', openingShortAdditions[fixture.key]]);
postFixtures.push(...shortFixtures.map(({ text, ...fixture }) => ({ ...fixture, format: 'short', blocks: [['text', text]] })));

// Keep enough published, non-short stories in the demo feed to exercise the
// homepage's section insertion points (after stories 4, 8, 12, and 16).
const discoverySeedStories = [
  'The Small Rituals That Make a Room Feel Like Home',
  'Why Good Interfaces Leave Space for Hesitation',
  'A Field Guide to the Sounds of a Changing Coast',
  'The Long Way Around the Neighborhood',
  'What We Lose When Every Day Is Optimized',
  'Designing Better Questions for Better Decisions',
  'A Map of the Places We Return To',
  'The Case for Slower Digital Mornings',
  'How Public Libraries Become Living Rooms',
  'The Weather Inside a Story',
  'Three Ways to Make Research More Human',
  'Notes from the Edge of a Restored Wetland',
  'The Texture of an Unfinished Idea',
  'What a Good Collection Helps Us Notice',
  'A Practical Guide to Productive Curiosity',
  'When Technology Learns to Wait',
  'The People Behind a Reliable City',
  'Reading the Landscape Before Building on It',
  'The Quiet Work of Making Things Clear',
  'How Small Teams Keep Their Creative Range',
  'The Memory Held by an Ordinary Street',
  'Can a Dashboard Teach Better Judgment?',
  'The Science of Paying Attention Together',
  'A Beginner’s Guide to Better Field Notes',
  'Why Constraints Often Improve the Work',
  'The Future of Community-Led Discovery',
  'A Short History of Useful Friction',
  'What the Shoreline Can Teach a Product Team',
  'The Difference Between Busy and Alive',
  'How Writers Build Trust One Detail at a Time',
  'The Everyday Technology of Belonging',
  'A More Generous Way to Measure Progress',
];
const discoveryCoverImages = [
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1400&q=80',
];
const discoveryTaxonomies = [
  { author: 'maya', tags: ['design', 'essays'], topicSlugs: ['design', 'essays'] },
  { author: 'arjun', tags: ['technology', 'design'], topicSlugs: ['technology', 'design'] },
  { author: 'leila', tags: ['science', 'travel'], topicSlugs: ['science', 'travel'] },
  { author: 'maya', tags: ['fiction', 'travel'], topicSlugs: ['fiction', 'travel'] },
  { author: 'leila', tags: ['science', 'wellness'], topicSlugs: ['science', 'wellness'] },
];
postFixtures.push(...discoverySeedStories.map((title, index) => {
  const taxonomy = discoveryTaxonomies[index % discoveryTaxonomies.length];
  const paragraphs = discoveryStoryBodies[index];
  if (!paragraphs || paragraphs.length < 3) throw new Error(`Missing editorial content for discovery story ${index + 1}`);
  return {
    key: `discovery-story-${String(index + 1).padStart(2, '0')}`,
    ...taxonomy,
    title,
    age: 0.5 + index * 0.35,
    appreciationsCount: 6 + ((index * 7) % 25),
    coverImage: discoveryCoverImages[index % discoveryCoverImages.length],
    blocks: [['text', paragraphs[0]], ['h2', 'A closer look'], ['text', paragraphs[1]], ['h2', 'What to carry forward'], ['text', paragraphs[2]]],
  };
}));
postFixtures.push(...additionalStoryFixtures.map((fixture, index) => ({
  ...fixture,
  coverImage: discoveryCoverImages[(index + 2) % discoveryCoverImages.length],
  blocks: [['text', fixture.paragraphs[0]], ['h2', 'A closer look'], ['text', fixture.paragraphs[1]], ['h2', 'What changed'], ['text', fixture.paragraphs[2]]],
})));
postFixtures.push(...edgeCaseFixtures.map(fixture => ({ ...fixture, edgeCase: true })));

const makeBlocks = fixture => JSON.stringify(fixture.blocks.map(([type, content, alt], index) => ({ id: `seed-${fixture.key}-${index + 1}`, type, content, ...(alt ? { alt } : {}) })));
const upsert = (Model, filter, update) => Model.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });

async function seedUsers() {
  const password = await bcrypt.hash(seedPassword, 12);
  const users = new Map();
  for (const fixture of userFixtures) {
    const user = await upsert(User, { email: fixture.email }, {
      $set: { username: fixture.username, bio: fixture.bio, picture: fixture.avatarUrl, password, verified: true, role: fixture.role || 'regular', accountStatus: 'active' },
      $setOnInsert: { followers: 0, followersCount: 0, followingCount: 0, following: [] },
    });
    await upsert(Profile, { userId: user._id }, { $set: { handle: fixture.handle, displayName: fixture.username, bio: fixture.bio, avatarUrl: fixture.avatarUrl, writerStatus: fixture.writerStatus, directRequestsEnabled: Boolean(fixture.directRequestsEnabled), membershipEnabled: fixture.writerStatus === 'writer' } });
    users.set(fixture.key, user);
  }
  return users;
}

async function seedPosts(users, topics) {
  const posts = new Map();
  // Repair the old demo-only title before the title-based upsert, so reruns do
  // not leave a duplicate publication behind after the editorial correction.
  await Publication.updateOne(
    { author: users.get('maya')._id, title: 'The Small Rituals That Make a Room Feel Appreciation Home' },
    { $set: { title: discoverySeedStories[0] } },
  );
  for (const fixture of postFixtures) {
    const tags = tagsForFixture(fixture);
    const wordCount = fixture.blocks.reduce((total, [, content]) => total + String(content).trim().split(/\s+/).filter(Boolean).length, 0);
    if (!fixture.title.trim() || fixture.title.length > (fixture.format === 'short' ? 120 : 180)
      || tags.some(tag => tag.length > 60 || tag.includes(','))
      || fixture.blocks.length === 0 || fixture.blocks.length > 500
      || fixture.blocks.some(([type, content, alt]) => !['text', 'h1', 'h2', 'h3', 'quote', 'code', 'image', 'divider'].includes(type)
        || String(content).length > (type === 'code' ? 50_000 : 10_000) || (alt && alt.length > 300))
      || (fixture.format === 'short' && wordCount > 500)) throw new Error(`Invalid development publication: ${fixture.key}`);
    const body = makeBlocks(fixture);
    const publicAt = fixture.publicAt || ago(fixture.age);
    const post = await upsert(Publication, { author: users.get(fixture.author)._id, title: fixture.title }, {
      $set: {
        body, format: fixture.format || 'story', tags, topics: fixture.topicSlugs.map(slug => topics.get(slug)?._id).filter(Boolean),
        coverImage: fixture.coverImage || null, publicationStatus: fixture.publicationStatus || 'published', publicAt,
        currentRevision: 1,
        metadata: { views: fixture.appreciationsCount ? fixture.appreciationsCount * 14 : 5, shares: fixture.appreciationsCount ? Math.ceil(fixture.appreciationsCount / 3) : 0 },
      },
      $setOnInsert: { createdAt: ago(fixture.age) },
    });
    await upsert(PublicationRevision, { publicationId: post._id, revision: 1 }, { $set: { authorId: post.author, title: post.title, body: post.body, coverImage: post.coverImage, format: post.format, tags: post.tags, publicAt: post.publicAt } });
    posts.set(fixture.key, post);
  }
  return posts;
}

async function seedRelationships(users, posts, topics) {
  const follows = [['noah', 'maya'], ['noah', 'arjun'], ['priya', 'maya'], ['priya', 'arjun'], ['priya', 'leila'], ['maya', 'leila']];
  for (const [follower, following] of follows) await upsert(Follow, { followerId: users.get(follower)._id, followingId: users.get(following)._id }, { $setOnInsert: { followerId: users.get(follower)._id, followingId: users.get(following)._id } });
  for (const fixture of userFixtures) {
    const followingIds = follows.filter(([key]) => key === fixture.key).map(([, key]) => users.get(key)._id);
    const followersCount = follows.filter(([, key]) => key === fixture.key).length;
    await User.updateOne({ _id: users.get(fixture.key)._id }, { $set: { following: followingIds, followingCount: followingIds.length, followersCount, followers: followersCount } });
  }

  const likes = [['noah', 'recommendation-systems'], ['noah', 'walkable-city'], ['priya', 'recommendation-systems'], ['priya', 'restoring-reefs'], ['maya', 'restoring-reefs'], ['arjun', 'fiction-station'], ['noah', 'square-seating'], ['priya', 'three-tides'], ['maya', 'slower-feed'], ['leila', 'bench-care'], ['arjun', 'marsh-memory'], ['noah', 'city-crossing'], ['priya', 'model-confidence']];
  const saves = [['noah', 'walkable-city'], ['noah', 'fiction-station'], ['priya', 'restoring-reefs'], ['priya', 'recommendation-systems'], ['noah', 'square-seating'], ['priya', 'three-tides'], ['maya', 'slower-feed'], ['arjun', 'marsh-memory'], ['leila', 'field-note-date']];
  for (const [user, post] of likes) await upsert(Appreciation, { userId: users.get(user)._id, publicationId: posts.get(post)._id }, { $setOnInsert: { userId: users.get(user)._id, publicationId: posts.get(post)._id } });
  for (const [user, post] of saves) await upsert(Save, { userId: users.get(user)._id, publicationId: posts.get(post)._id }, { $setOnInsert: { userId: users.get(user)._id, publicationId: posts.get(post)._id } });

  const comments = [
    ['noah', 'walkable-city', 'The connection between maintenance and trust is easy to overlook.'],
    ['priya', 'walkable-city', 'I would love a follow-up comparing two neighborhoods over time.'],
    ['maya', 'recommendation-systems', 'Explanations feel essential if readers are expected to shape the system.'],
    ['arjun', 'restoring-reefs', 'This makes the infrastructure and habitat tradeoff unusually clear.'],
    ['priya', 'square-seating', 'The folding stools are such a clear sign that the square needs places to rest.'],
    ['noah', 'square-seating', 'I appreciated the reminder to leave space next to a bench for wheelchair users.'],
    ['maya', 'slower-feed', 'A stopping point could make a reading session feel complete.'],
    ['leila', 'three-tides', 'The repeated sketch from one marker is a practice anyone can try.'],
    ['arjun', 'model-confidence', 'Putting the next action beside the score is the most useful part of this explanation.'],
    ['priya', 'city-crossing', 'Watching who waits longest would change how I describe a safe route.'],
    ['noah', 'discovery-story-09', 'It is easy to forget that using a library without borrowing is still using the library.'],
    ['maya', 'marsh-memory', 'The distinction between an observation and the story we build from it is valuable.'],
  ];
  for (const [user, post, content] of comments) await upsert(Comment, { userId: users.get(user)._id, publicationId: posts.get(post)._id, content }, { $setOnInsert: { userId: users.get(user)._id, publicationId: posts.get(post)._id, content, parentCommentId: null } });
  const generatedAppreciations = [];
  const generatedComments = [];
  for (const fixture of postFixtures) {
    if (fixture.publicationStatus === 'unpublished' || (fixture.publicAt && fixture.publicAt > now)) continue;
    const post = posts.get(fixture.key);
    const eligibleReaders = engagementReaderKeys.filter(key => key !== fixture.author)
      .sort((a, b) => stableNumber(fixture.key, `reader:${a}`) - stableNumber(fixture.key, `reader:${b}`));
    const appreciationTargets = [0, 1, 2, 3, 5, 7, 10, 14];
    const appreciationCount = Math.min(eligibleReaders.length, appreciationTargets[stableNumber(fixture.key, 'appreciations') % appreciationTargets.length]);
    for (const key of eligibleReaders.slice(0, appreciationCount)) {
      const userId = users.get(key)._id;
      generatedAppreciations.push({ updateOne: { filter: { userId, publicationId: post._id }, update: { $setOnInsert: { userId, publicationId: post._id } }, upsert: true } });
    }
    const commentsCount = stableNumber(fixture.key, 'comments') % 7;
    const copy = commentCopy[fixture.tags[0]] || commentCopy.essays;
    for (let index = 0; index < commentsCount; index += 1) {
      const userId = users.get(eligibleReaders[(index + 3) % eligibleReaders.length])._id;
      const content = copy[(stableNumber(fixture.key, 'comment-copy') + index) % copy.length];
      generatedComments.push({ updateOne: { filter: { userId, publicationId: post._id, content }, update: { $setOnInsert: { userId, publicationId: post._id, content, parentCommentId: null } }, upsert: true } });
    }
  }
  if (generatedAppreciations.length) await Appreciation.bulkWrite(generatedAppreciations, { ordered: false });
  if (generatedComments.length) await Comment.bulkWrite(generatedComments, { ordered: false });

  const spread = {
    story: { appreciations: new Set(), comments: new Set() },
    short: { appreciations: new Set(), comments: new Set() },
  };
  for (const post of posts.values()) {
    const [appreciationsCount, commentsCount] = await Promise.all([Appreciation.countDocuments({ publicationId: post._id }), Comment.countDocuments({ publicationId: post._id, deletedAt: null })]);
    await Publication.updateOne({ _id: post._id }, { $set: { appreciationsCount, commentsCount } });
    if (post.publicationStatus === 'published' && (!post.publicAt || post.publicAt <= now)) {
      spread[post.format].appreciations.add(appreciationsCount);
      spread[post.format].comments.add(commentsCount);
    }
  }
  for (const [format, levels] of Object.entries(spread)) {
    if (levels.appreciations.size < 3 || levels.comments.size < 3) {
      throw new Error(`Seed verification failed: ${format} engagement counts need more variation`);
    }
  }

  const interestMap = { noah: [['fiction', 1], ['design', 0.8], ['technology', 0.5]], priya: [['science', 1], ['technology', 0.8], ['essays', 0.7]], maya: [['design', 1], ['essays', 0.9]], arjun: [['technology', 1], ['design', 0.7]] };
  for (const [userKey, interests] of Object.entries(interestMap)) for (const [slug, weight] of interests) await upsert(UserInterest, { userId: users.get(userKey)._id, topicId: topics.get(slug)._id }, { $set: { explicitWeight: weight, inferredWeight: weight / 4 } });
  for (const key of ['noah', 'priya']) await User.updateOne({ _id: users.get(key)._id }, { $set: { onboardingCompletedAt: ago(20) } });
}

async function seedQuestions(users, posts) {
  const fixtures = [
    { key: 'recommendations', author: 'noah', text: 'How can technology help us discover ideas outside our usual interests?', context: 'Looking for practical product and editorial approaches.', tags: ['technology', 'design'], voters: ['noah', 'priya', 'maya'], related: ['recommendation-systems'], status: 'answered' },
    { key: 'cities', author: 'priya', text: 'What makes a neighborhood genuinely pleasant to explore on foot?', context: 'Beyond sidewalks, which social and maintenance choices matter?', tags: ['design', 'essays'], voters: ['priya', 'noah'], related: ['walkable-city'], status: 'answered' },
    { key: 'ocean', author: 'noah', text: 'Can nature-based coastal defenses work at the scale of a large city?', context: 'Interested in evidence, limitations, and real projects.', tags: ['science'], voters: ['noah', 'priya', 'arjun'], related: ['restoring-reefs'], status: 'answered' },
    { key: 'fiction', author: 'priya', text: 'How do fiction writers make an unfamiliar place feel immediately believable?', context: 'Examples involving sensory detail would be useful.', tags: ['fiction', 'travel'], voters: ['priya'], related: [], status: 'open' },
    { key: 'libraries', author: 'noah', text: 'How can a public library show the value of visits that do not involve borrowing a book?', context: 'I am interested in practical measures that still respect privacy and the role of staff.', tags: ['design', 'essays'], voters: ['noah', 'priya'], related: ['discovery-story-09'], status: 'answered' },
    { key: 'field-notes', author: 'priya', text: 'What should a beginner record during a first field visit?', context: 'A short checklist for a shoreline or neighborhood walk would help.', tags: ['science', 'travel'], voters: ['priya', 'leila'], related: ['discovery-story-24'], status: 'answered' },
    { key: 'dashboards', author: 'maya', text: 'How can a dashboard explain uncertainty without overwhelming readers?', context: 'Looking for examples of labels and context that support better decisions.', tags: ['technology', 'design'], voters: ['maya', 'arjun', 'priya'], related: ['discovery-story-22'], status: 'answered' },
    { key: 'short-reading', author: 'noah', text: 'Which short reading exercise helps someone notice a familiar place differently?', context: 'I would like a small practice I can try on a commute.', tags: ['essays', 'travel'], voters: ['noah', 'maya'], related: ['attention-one', 'memory-map'], status: 'answered' },
    { key: 'coastal-monitoring', author: 'arjun', text: 'What evidence shows whether a restored coastal habitat is working after the launch?', context: 'Interested in repeat measurements and what local residents can contribute.', tags: ['science'], voters: ['arjun', 'priya', 'leila'], related: ['restoring-reefs', 'discovery-story-12'], status: 'answered' },
    { key: 'creative-teams', author: 'leila', text: 'How do small creative teams make time to try unfamiliar approaches?', context: 'Ideas that fit alongside deadlines would be more useful than a major process change.', tags: ['design', 'essays'], voters: ['leila', 'maya'], related: ['discovery-story-20'], status: 'answered' },
    { key: 'community-discovery', author: 'priya', text: 'How should reader questions shape a story feed without rewarding only popular requests?', context: 'I want to understand how new writers can still be discovered.', tags: ['technology', 'essays'], voters: ['priya', 'noah', 'arjun'], related: ['discovery-story-26'], status: 'answered' },
    { key: 'unanswered-city', author: 'noah', text: 'What would make an evening walking route feel safer to someone who moves slowly?', context: 'I would like observations from residents and maintenance teams, not just a map.', tags: ['design'], voters: ['noah', 'priya'], related: [], status: 'open' },
  ];
  fixtures.push(...edgeQuestionFixtures);
  const questions = new Map();
  for (const fixture of fixtures) {
    if (fixture.text.length < 10 || fixture.text.length > 180 || fixture.context.length > 1000
      || normalizeTags(fixture.tags).length > 5 || normalizeTags(fixture.tags).some(tag => tag.length > 30)) {
      throw new Error(`Invalid development question: ${fixture.key}`);
    }
    const voters = fixture.voters.map(key => users.get(key)._id);
    const data = { text: fixture.text, normalizedText: normalizeQuestionText(fixture.text), context: fixture.context, tags: normalizeTags(fixture.tags).slice(0, 5), author: users.get(fixture.author)._id, upvotes: voters, upvotesCount: voters.length, relatedPublications: fixture.related.map(key => posts.get(key)._id), status: fixture.status };
    const update = { $set: data };
    if (fixture.answers) update.$setOnInsert = { answers: fixture.answers.map(([author, text, answerVoters]) => ({ text, author: users.get(author)._id, upvotes: answerVoters.map(key => users.get(key)._id) })) };
    const question = await upsert(Question, { normalizedText: normalizeQuestionText(fixture.text) }, update);
    questions.set(fixture.key, question);
  }
  await Publication.updateOne({ _id: posts.get('recommendation-systems')._id }, { $set: { sourceQuestion: questions.get('recommendations')._id } });
  await Publication.updateOne({ _id: posts.get('walkable-city')._id }, { $set: { sourceQuestion: questions.get('cities')._id } });
  return questions;
}

async function seedAuthoring(users, posts, questions) {
  const drafts = [
    { author: 'maya', title: 'Draft: The Social Life of a Public Bench', format: 'story', tags: ['design', 'essays'], sourceQuestion: 'cities', blocks: [['h1', 'Who gets to pause?'], ['text', 'A bench is a tiny piece of social infrastructure, shaped by placement, shade, and who feels welcome to use it.'], ['text', 'I want to compare a shaded seat near the market with one beside the fast road. The first is almost always occupied; the second is rarely used, though it is newer.'], ['h2', 'Questions for the next visit'], ['text', 'Ask people when they use each seat, photograph the shade at different hours, and check how quickly repairs are reported.']] },
    { author: 'arjun', title: 'Draft: Measuring Curiosity Without Clickbait', format: 'story', tags: ['technology'], blocks: [['text', 'A metric for curiosity should reward exploration without confusing surprise with value.'], ['h2', 'Signals to test'], ['text', 'A reader who follows a new writer after finishing a piece may have found something valuable. A startled click followed by an immediate exit tells a different story.'], ['text', 'This draft still needs examples from readers who changed topics deliberately and those who wanted a deeper explanation within a familiar topic.']] },
    { author: 'leila', title: 'Draft Short: Reading a Tide Pool', format: 'short', tags: ['science'], blocks: [['text', 'Start at the waterline, move slowly, and look for changes in texture before looking for animals.'], ['text', 'The next revision should add a reminder to check the tide and leave stones and animals where they are. A short field note can be practical without pretending every pool is the same.']] },
    { author: 'maya', title: 'Draft: A Street Told by Its Neighbors', format: 'story', tags: ['essays', 'travel'], sourceQuestion: 'unanswered-city', blocks: [['text', 'One street has several maps: the delivery route, the walk to school, and the path an older resident takes to avoid a steep step.'], ['h2', 'Reporting plan'], ['text', 'Interview people who use it at different hours. Ask each person where they pause and what changed during the last year.'], ['text', 'The piece should let conflicting memories sit beside one another before trying to explain what the street has become.']] },
    { author: 'arjun', title: 'Draft Short: A Better Error Message', format: 'short', tags: ['technology', 'design'], blocks: [['text', 'An error message should name what failed, what was saved, and what a person can do next.'], ['text', 'I am collecting examples where a vague “try again” made people repeat work. The final short will show how a specific recovery step can protect trust.']] },
    { author: 'leila', title: 'Draft: Listening After a Storm', format: 'story', tags: ['science', 'travel'], blocks: [['text', 'The storm left visible debris, but the first sound I noticed was water moving through a channel that had been dry the previous week.'], ['h2', 'What to verify'], ['text', 'Compare observations from the same location before and after the storm, and ask local residents where the water crossed their routes.'], ['text', 'This is an opening scene, not yet an argument about recovery. I need a second visit before drawing a conclusion.']] },
  ];
  drafts.push(...edgeDraftFixtures);
  for (const fixture of drafts) {
    if (fixture.title.length > (fixture.format === 'short' ? 120 : 180) || normalizeTags(fixture.tags).some(tag => tag.length > 60)) {
      throw new Error(`Invalid development draft: ${fixture.title}`);
    }
    const body = JSON.stringify(fixture.blocks.map(([type, content], index) => ({ id: `seed-draft-${fixture.author}-${index}`, type, content })));
    await upsert(Draft, { authorId: users.get(fixture.author)._id, title: fixture.title }, { $set: { format: fixture.format, body, tags: normalizeTags(fixture.tags), version: 3, sourceQuestion: fixture.sourceQuestion ? questions.get(fixture.sourceQuestion)._id : null } });
  }
  await Publication.updateOne({ _id: posts.get('attention-one')._id }, { $set: { depthParent: posts.get('walkable-city')._id } });
}

async function seedCollectionsAndSeries(users, posts) {
  const collectionFixtures = [
    { title: 'Designing Humane Systems', description: 'Start with streets and reading habits, then explore how digital recommendations can leave room for human judgment.', author: 'priya', visibility: 'public', postKeys: ['recommendation-systems', 'walkable-city', 'discovery-story-02', 'discovery-story-16'], saved: ['noah'], followed: ['noah', 'maya'] },
    { title: 'Stories for a Slow Weekend', description: 'A fictional journey and three gentle essays for an afternoon with no fixed destination.', author: 'noah', visibility: 'unlisted', postKeys: ['fiction-station', 'walkable-city', 'discovery-story-07', 'discovery-story-29'], saved: ['priya'], followed: ['priya'] },
    { title: 'Private Research Queue', description: 'A personal reading queue about coastal fieldwork and the questions to revisit before the next trip.', author: 'priya', visibility: 'private', postKeys: ['early-access', 'restoring-reefs', 'field-note-date'], saved: [], followed: [] },
    { title: 'A Field Guide to Paying Attention', description: 'Begin with a precise observation, return to it, and follow the details into a larger story.', author: 'maya', visibility: 'public', postKeys: ['attention-one', 'attention-two', 'fiction-station', 'discovery-story-23'], saved: ['noah', 'priya'], followed: ['noah', 'leila'] },
    { title: 'Climate Stories with Practical Edges', description: 'Reporting on reefs and wetlands that keeps evidence, local experience, and long-term care together.', author: 'leila', visibility: 'public', postKeys: ['restoring-reefs', 'discovery-story-12', 'reef-question', 'early-access'], saved: ['maya'], followed: ['maya', 'arjun', 'priya'] },
    { title: 'Better Questions for Better Technology', description: 'A reading path from recommendation design to clearer charts and more patient interfaces.', author: 'arjun', visibility: 'public', postKeys: ['recommendation-systems', 'ranking-short', 'discovery-story-22', 'gentle-notification'], saved: ['maya', 'noah'], followed: ['maya'] },
    { title: 'A Small Library of Place and Memory', description: 'Fiction and essays about the streets, rooms, and journeys that hold personal memory.', author: 'noah', visibility: 'public', postKeys: ['fiction-station', 'walkable-city', 'discovery-story-07', 'memory-map'], saved: ['priya'], followed: ['maya', 'priya'] },
    { title: 'Short Reads for a Curious Morning', description: 'Brief practices for looking closely, asking a sharper question, and checking a claim.', author: 'priya', visibility: 'public', postKeys: ['attention-one', 'ranking-short', 'tide-pool', 'one-good-question'], saved: ['noah', 'leila'], followed: ['noah', 'maya', 'arjun'] },
    { title: 'The City at Walking Pace', description: 'Follow routes, crossings, libraries, and maintenance work through the eyes of people who use them.', author: 'maya', visibility: 'public', postKeys: ['walkable-city', 'city-crossing', 'square-seating', 'discovery-story-04', 'discovery-story-17', 'discovery-story-21'], saved: ['priya'], followed: ['priya', 'noah'] },
    { title: 'Coastal Field Notebook', description: 'A practical sequence for observing a shore, recording conditions, and testing restoration claims.', author: 'leila', visibility: 'public', postKeys: ['tide-pool', 'field-note-date', 'three-tides', 'discovery-story-03', 'restoring-reefs', 'discovery-story-12'], saved: ['noah'], followed: ['noah', 'arjun'] },
    { title: 'Reading Numbers with Care', description: 'Short checks and fuller essays that turn charts and metrics into better questions.', author: 'arjun', visibility: 'public', postKeys: ['data-denominator', 'better-metric', 'model-confidence', 'discovery-story-22', 'recommendation-systems'], saved: ['priya'], followed: ['priya', 'maya'] },
    { title: 'Public Rooms and Shared Space', description: 'How ordinary places welcome people through access, staffing, maintenance, and room to pause.', author: 'priya', visibility: 'public', postKeys: ['library-note', 'discovery-story-09', 'early-city', 'discovery-story-31'], saved: ['maya'], followed: ['maya', 'noah'] },
    { title: 'The Craft of a Clear Essay', description: 'From first observation to revision, a compact guide to essays that earn a reader’s trust.', author: 'maya', visibility: 'public', postKeys: ['attention-one', 'discovery-story-13', 'discovery-story-19', 'discovery-story-30'], saved: ['leila'], followed: ['leila', 'arjun'] },
    { title: 'Technology with Room to Breathe', description: 'Explore useful pauses, thoughtful notifications, and discovery that gives readers control.', author: 'arjun', visibility: 'public', postKeys: ['discovery-story-02', 'gentle-notification', 'discovery-story-16', 'discovery-story-27'], saved: ['noah'], followed: ['noah', 'priya'] },
    { title: 'Curiosity Across Disciplines', description: 'A reader’s route through research, field notes, product design, and the next good question.', author: 'noah', visibility: 'public', postKeys: ['one-good-question', 'discovery-story-15', 'discovery-story-24', 'discovery-story-26'], saved: ['maya'], followed: ['maya', 'leila'] },
    { title: 'A Fiction Writer’s Toolkit', description: 'Use weather, movement, and precise details to make an unfamiliar scene feel lived in.', author: 'maya', visibility: 'unlisted', postKeys: ['fiction-station', 'discovery-story-10', 'attention-one', 'memory-map'], saved: ['priya'], followed: ['priya'] },
  ];
  collectionFixtures.push(...edgeCollectionFixtures);
  for (const fixture of collectionFixtures) {
    if (fixture.title.trim().length < 2 || fixture.title.length > 100 || fixture.description.length > 500 || fixture.postKeys.length > 100) {
      throw new Error(`Invalid development collection: ${fixture.title}`);
    }
    const publicationIds = fixture.postKeys.map(key => posts.get(key)._id);
    await upsert(Collection, { author: users.get(fixture.author)._id, title: fixture.title }, { $set: { description: fixture.description, publications: publicationIds, items: publicationIds.map((post, position) => ({ publication: post, position, addedAt: ago(position) })), visibility: fixture.visibility, isPublic: fixture.visibility === 'public', savedBy: fixture.saved.map(key => users.get(key)._id), savedCount: fixture.saved.length, followers: fixture.followed.map(key => users.get(key)._id), followersCount: fixture.followed.length } });
  }
  const seriesFixtures = [
    { title: 'A Practice of Attention', author: 'maya', type: 'short', description: 'Four small exercises that move from noticing one detail to reading a familiar place anew.', postKeys: ['attention-one', 'attention-two', 'city-crossing', 'memory-map'], saved: ['noah', 'priya'] },
    { title: 'Small Questions, Better Technology', author: 'arjun', type: 'short', description: 'Quick checks for recommendation feeds, charts, metrics, and notifications.', postKeys: ['ranking-short', 'data-denominator', 'better-metric', 'gentle-notification'], saved: ['maya'] },
    { title: 'Coastal Observations', author: 'leila', type: 'short', description: 'A field-friendly sequence from tide-pool observation to a cautious reef-restoration question.', postKeys: ['tide-pool', 'field-note-date', 'reef-question'], saved: ['priya', 'arjun'] },
    { title: 'Places We Share', author: 'maya', type: 'story', description: 'Longer essays on walking, libraries, memory, and the quiet work that keeps public space open.', postKeys: ['walkable-city', 'square-seating', 'discovery-story-09', 'discovery-story-21', 'early-city'], saved: ['noah'] },
    { title: 'Designing for Better Judgment', author: 'arjun', type: 'story', description: 'Read from recommendation systems toward dashboards, useful friction, and more generous measures of progress.', postKeys: ['recommendation-systems', 'model-confidence', 'discovery-story-22', 'discovery-story-27', 'discovery-story-32'], saved: ['priya'] },
    { title: 'Field Notes and Living Coasts', author: 'leila', type: 'story', description: 'A connected account of shore sounds, careful observation, reef protection, and patient monitoring.', postKeys: ['three-tides', 'discovery-story-03', 'discovery-story-18', 'restoring-reefs', 'early-access'], saved: ['maya'] },
  ];
  seriesFixtures.push(...edgeSeriesFixtures);
  for (const fixture of seriesFixtures) {
    if (fixture.title.trim().length < 2 || fixture.title.length > 100 || fixture.description.length > 500 || fixture.postKeys.length < 2) {
      throw new Error(`Invalid development series: ${fixture.title}`);
    }
    for (const key of fixture.postKeys) {
      const publication = posts.get(key);
      if (!publication || String(publication.author) !== String(users.get(fixture.author)._id) || publication.format !== fixture.type) {
        throw new Error(`Invalid ${fixture.type} series item: ${fixture.title} / ${key}`);
      }
    }
    await upsert(ShortSeries, { author: users.get(fixture.author)._id, title: fixture.title }, { $set: { description: fixture.description, type: fixture.type, visibility: 'public', savedBy: fixture.saved.map(key => users.get(key)._id), savedCount: fixture.saved.length, items: fixture.postKeys.map((key, position) => ({ publication: posts.get(key)._id, position })) } });
  }
}

async function seedCompetitions(users, posts) {
  const fixtures = [
    { key: 'open', title: 'Small Details, Big Worlds', description: 'Show how one overlooked detail changes the way we understand a familiar place or system.', status: 'open', openDate: ago(2), closeDate: ahead(5), resultsDate: ahead(8), votingMode: 'readers', competitionType: 'theme', entries: [['maya', 'walkable-city', ['noah', 'priya']], ['arjun', 'recommendation-systems', ['priya']]] },
    { key: 'judging', title: 'Explain Tomorrow', description: 'Make an emerging idea clear without hiding its uncertainty, limits, or effect on real people.', status: 'judging', openDate: ago(12), closeDate: ago(1), resultsDate: ahead(2), votingMode: 'hybrid', competitionType: 'timed', entries: [['leila', 'restoring-reefs', ['noah', 'priya']], ['arjun', 'recommendation-systems', ['maya']]] },
    { key: 'closed', title: 'Journey in 1,000 Words', description: 'Tell a complete journey through a change of place, perspective, or understanding.', status: 'closed', openDate: ago(40), closeDate: ago(30), resultsDate: ago(25), votingMode: 'judges', competitionType: 'reader_choice', entries: [['maya', 'fiction-station', ['noah', 'priya']], ['arjun', 'recommendation-systems', ['leila']]], winnerIndex: 0 },
  ];
  const competitions = new Map();
  for (const fixture of fixtures) {
    let competition = await Competition.findOne({ title: fixture.title });
    if (!competition) competition = new Competition({ title: fixture.title, closeDate: fixture.closeDate });
    competition.set({ description: fixture.description, status: fixture.status, openDate: fixture.openDate, closeDate: fixture.closeDate, resultsDate: fixture.resultsDate, votingMode: fixture.votingMode, competitionType: fixture.competitionType, rules: ['Submit an owned published post.', 'Respect the announced theme.', 'Reader votes must be independent.'], prizes: [{ rank: 'Winner', amount: 'Featured writer placement' }], maxEntries: 50, createdBy: users.get('admin')._id });
    competition.entries = fixture.entries.map(([author, post, voters], index) => ({ author: users.get(author)._id, publication: posts.get(post)._id, publicationRevision: 1, note: index ? 'A contrasting perspective.' : 'Primary demo entry.', votes: voters.map(key => users.get(key)._id), votesCount: voters.length, judgeScores: fixture.votingMode === 'readers' ? [] : [{ judgeId: users.get('moderator')._id, craft: 8 - index, originality: 9 - index, relevance: 8, note: 'Seeded judging note for staff-console testing.' }] }));
    competition.winnerEntryIds = fixture.winnerIndex == null ? [] : [competition.entries[fixture.winnerIndex]._id];
    await competition.save();
    await upsert(CompetitionAudit, { competitionId: competition._id, action: 'created' }, { $setOnInsert: { competitionId: competition._id, actorId: users.get('admin')._id, action: 'created', details: { seeded: true } } });
    if (fixture.status === 'closed') await upsert(CompetitionAudit, { competitionId: competition._id, action: 'results_published' }, { $set: { actorId: users.get('admin')._id, details: { winnerEntryIds: competition.winnerEntryIds, seeded: true } } });
    competitions.set(fixture.key, competition);
  }
  return competitions;
}

async function seedPremium(users, posts) {
  for (const key of ['priya', 'leila']) await upsert(Membership, { userId: users.get(key)._id }, { $set: { plan: 'member', status: 'active', provider: null, providerCustomerId: null, providerSubscriptionId: null, currentPeriodStart: ago(10), currentPeriodEnd: ahead(20), cancelAtPeriodEnd: key === 'leila' } });
  await upsert(Entitlement, { userId: users.get('noah')._id, capability: 'story_summary', source: 'promotion' }, { $set: { startsAt: ago(1), endsAt: ahead(14), revokedAt: null } });

  const workshopOne = await upsert(Workshop, { hostId: users.get('maya')._id, title: 'Observation into Essay' }, { $set: { description: 'Turn field notes into a shaped personal essay through practical exercises.', startsAt: ahead(3), endsAt: new Date(ahead(3).getTime() + 90 * 60 * 1000), capacity: 24, meetingUrl: 'https://meet.example.test/observation-essay', status: 'published' } });
  const workshopTwo = await upsert(Workshop, { hostId: users.get('leila')._id, title: 'Explain Science Without Flattening It' }, { $set: { description: 'A workshop on clarity, uncertainty, evidence, and narrative structure.', startsAt: ahead(7), endsAt: new Date(ahead(7).getTime() + 2 * 60 * 60 * 1000), capacity: 40, meetingUrl: 'https://meet.example.test/science-writing', status: 'published' } });
  await upsert(Workshop, { hostId: users.get('arjun')._id, title: 'Make Data Stories Easier to Read' }, { $set: { description: 'Practice choosing a clear question, checking a chart’s scale, and explaining what the numbers do and do not show.', startsAt: ahead(10), endsAt: new Date(ahead(10).getTime() + 90 * 60 * 1000), capacity: 30, meetingUrl: 'https://meet.example.test/data-stories', status: 'published' } });
  await upsert(Workshop, { hostId: users.get('maya')._id, title: 'Build a Scene from Everyday Details' }, { $set: { description: 'Bring a few observations from a familiar place and turn them into a scene with movement, voice, and a sense of place.', startsAt: ahead(14), endsAt: new Date(ahead(14).getTime() + 2 * 60 * 60 * 1000), capacity: 20, meetingUrl: 'https://meet.example.test/everyday-scenes', status: 'published' } });
  await upsert(WorkshopAttendance, { workshopId: workshopOne._id, userId: users.get('priya')._id }, { $set: { status: 'registered' } });
  await upsert(WorkshopAttendance, { workshopId: workshopTwo._id, userId: users.get('priya')._id }, { $set: { status: 'registered' } });

  const updates = [
    ['maya', 'Why the bench scene changed three times', 'I first wrote the scene as description. The final version works because each revision changes who feels welcome in the space.', 'members'],
    ['maya', 'Notebook scan: observing without interpreting', 'Supporters get the rough field-note prompts behind the next essay.', 'supporters'],
    ['leila', 'Behind the reef-restoration reporting', 'A short account of the evidence I removed, the uncertainty I kept, and the experts who challenged the first draft.', 'members'],
  ];
  for (const [creator, title, body, audience] of updates) await upsert(CreatorUpdate, { creatorId: users.get(creator)._id, title }, { $set: { body, audience, status: 'published', publishedAt: ago(0.5) } });

  const requests = [
    ['priya', 'maya', 'How do you structure an essay from field notes?', 'Please show how fragments become a coherent argument.', 'pending', null],
    ['noah', 'maya', 'Could you write about hostile architecture?', 'I am interested in design choices that quietly exclude people.', 'accepted', 'Yes—I am collecting examples now.'],
    ['priya', 'arjun', 'Explain recommendation diversity', 'A practical piece with examples would be ideal.', 'answered', 'The new story on recommendation systems addresses this.'],
  ];
  for (const [requester, creator, subject, details, status, response] of requests) await upsert(CreatorRequest, { requesterId: users.get(requester)._id, creatorId: users.get(creator)._id, subject }, { $set: { details, status, response, periodKey: monthKey } });

  for (const key of ['walkable-city', 'recommendation-systems', 'restoring-reefs']) {
    const post = posts.get(key);
    const points = JSON.parse(post.body).filter(block => ['text', 'h1', 'h2', 'h3', 'quote'].includes(block.type)).map(block => block.content).slice(0, 3);
    await upsert(PublicationSummary, { publicationId: post._id }, { $set: { sourceHash: crypto.createHash('sha256').update(post.body).digest('hex'), points, provider: 'extractive-v1', disclosure: 'Automatically generated extractive overview; verify details against the full story.', generatedAt: ago(0.1) } });
  }
  await upsert(ProviderEvent, { provider: 'stripe', eventId: 'evt_ink_rider_seed_processed' }, { $set: { eventType: 'customer.subscription.updated', payloadHash: crypto.createHash('sha256').update('ink-rider-seed-event').digest('hex'), status: 'processed', processedAt: ago(1), failureCode: null } });
  await upsert(AiUsage, { userId: users.get('leila')._id, day: now.toISOString().slice(0, 10) }, { $set: { requests: 7 } });
}

async function seedEvents(users, posts) {
  const fixtures = [
    ['noah', 'walkable-city', 'open', 'home', 0, null, 2], ['noah', 'walkable-city', 'reading_depth', 'story', null, 50, 1.9],
    ['noah', 'fiction-station', 'complete', 'story', null, 100, 1], ['priya', 'restoring-reefs', 'open', 'home', 1, null, 0.4],
    ['priya', 'restoring-reefs', 'complete', 'story', null, 100, 0.3], ['priya', 'recommendation-systems', 'open', 'search', 2, null, 3],
    ['priya', 'recommendation-systems', 'reading_depth', 'story', null, 75, 2.8], ['maya', 'walkable-city', 'open', 'writer', 0, null, 4],
  ];
  for (let index = 0; index < fixtures.length; index += 1) {
    const [actor, post, eventType, surface, position, readingDepth, age] = fixtures[index];
    await upsert(InteractionEvent, { eventId: `ink-rider-seed-event-${index + 1}` }, { $set: { actorId: users.get(actor)._id, anonymousSessionId: null, eventType, publicationId: posts.get(post)._id, writerId: posts.get(post).author, surface, position, recommendationRequestId: `seed-recommendation-${actor}`, eventAt: ago(age), metadata: { readingDepth } } });
  }
}

async function seedModerationAndNotifications(users, posts, questions, competitions) {
  const comment = await Comment.findOne({ publicationId: posts.get('walkable-city')._id });
  const reports = [
    { key: 'pending', reporter: 'noah', subjectType: 'publication', subjectId: posts.get('recommendation-systems')._id, reason: 'misinformation', details: 'Seeded pending report for queue testing.', status: 'pending' },
    { key: 'reviewing', reporter: 'priya', subjectType: 'comment', subjectId: comment._id, reason: 'toxicity', details: 'Seeded report currently under review.', status: 'reviewing' },
    { key: 'dismissed', reporter: 'maya', subjectType: 'question', subjectId: questions.get('fiction')._id, reason: 'other', details: 'Seeded dismissed report.', status: 'dismissed' },
  ];
  const reportMap = new Map();
  for (const fixture of reports) reportMap.set(fixture.key, await upsert(Report, { reporterId: users.get(fixture.reporter)._id, subjectType: fixture.subjectType, subjectId: fixture.subjectId }, { $set: { reason: fixture.reason, details: fixture.details, status: fixture.status } }));
  await upsert(ModerationAction, { reportId: reportMap.get('reviewing')._id, action: 'begin_review' }, { $set: { moderatorId: users.get('moderator')._id, note: 'Review started from the seeded staff queue.' } });
  await upsert(ModerationAction, { reportId: reportMap.get('dismissed')._id, action: 'dismiss' }, { $set: { moderatorId: users.get('moderator')._id, note: 'No policy violation found in the seeded example.' } });

  const request = await CreatorRequest.findOne({ requesterId: users.get('priya')._id, creatorId: users.get('maya')._id, status: 'pending' });
  const notificationFixtures = [
    ['noah', 'maya', 'question_answered', 'Your question has a new story', 'Arjun answered a reader-demand question.', `/post/${posts.get('recommendation-systems')._id}`, 'publication', posts.get('recommendation-systems')._id, null],
    ['maya', 'priya', 'direct_request_received', 'New direct member request', 'A member asked for an story.', '/studio?writingTab=requests', 'creator_request', request._id, null],
    ['maya', 'admin', 'competition_result', 'You placed in Journey in 1,000 Words', 'The results are now public.', `/explore/competitions/${competitions.get('closed')._id}`, 'competition', competitions.get('closed')._id, ago(2)],
    ['noah', 'moderator', 'moderation', 'Report received', 'Your report is waiting for review.', '/notifications', 'report', reportMap.get('pending')._id, ago(1)],
  ];
  for (const [recipient, actor, type, title, body, href, entityType, entityId, readAt] of notificationFixtures) await upsert(Notification, { recipientId: users.get(recipient)._id, type, entityType, entityId }, { $set: { actorId: users.get(actor)._id, title, body, href, readAt } });
}

async function verifySeed() {
  const counts = Object.fromEntries(await Promise.all([
    ['users', User], ['profiles', Profile], ['posts', Publication], ['drafts', Draft], ['questions', Question], ['collections', Collection], ['series', ShortSeries],
    ['competitions', Competition], ['memberships', Membership], ['workshops', Workshop], ['creatorUpdates', CreatorUpdate], ['creatorRequests', CreatorRequest],
    ['notifications', Notification], ['reports', Report], ['events', InteractionEvent],
  ].map(async ([key, Model]) => [key, await Model.countDocuments(key === 'users' ? { email: /@inkrider\.local$/ } : {})])));
  const minimums = { users: 19, profiles: 19, posts: 74, drafts: 8, questions: 14, collections: 19, series: 7, competitions: 3, memberships: 2, workshops: 4, creatorUpdates: 3, creatorRequests: 3, notifications: 4, reports: 3, events: 8 };
  for (const [key, minimum] of Object.entries(minimums)) if (counts[key] < minimum) throw new Error(`Seed verification failed: expected at least ${minimum} ${key}, found ${counts[key]}`);
  return counts;
}

async function run() {
  await connectToMongoDB();
  await ensureCanonicalTopics();
  const topics = new Map((await Topic.find({ status: 'active' })).map(topic => [topic.slug, topic]));
  const users = await seedUsers();
  const posts = await seedPosts(users, topics);
  await seedRelationships(users, posts, topics);
  const questions = await seedQuestions(users, posts);
  await seedAuthoring(users, posts, questions);
  await seedCollectionsAndSeries(users, posts);
  const competitions = await seedCompetitions(users, posts);
  await seedPremium(users, posts);
  await seedEvents(users, posts);
  await seedModerationAndNotifications(users, posts, questions, competitions);
  const counts = await verifySeed();
  console.log('Comprehensive development fixtures are ready:', counts);
  console.log('Demo account credentials are configured through SEED_PASSWORD and are not printed.');
}

run().catch(() => { console.error('Development seed failed. Check the database and configuration.'); process.exitCode = 1 }).finally(() => mongoose.disconnect());
