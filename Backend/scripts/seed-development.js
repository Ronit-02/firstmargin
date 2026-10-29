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
const ReadingState = require('../schemas/reading-state.schema');
const { createCoverAllocator, photoIdentity } = require('../data/development-cover-selection');
const { covers, stableNumber, selectReaders, readerBios, communityWriters, communityReaders, communityStories, storyComments, communityShorts, communityQuestions, communityCollections, communitySeries, discoverySubjects, legacyShorts } = require('../data/development-community');
const { ensureCanonicalTopics } = require('../services/topic.service');
const { normalizeQuestionText } = require('../utils/question');
const { MaleAvatars, FemaleAvatars } = require('../assets/data');
const { discoveryStoryBodies, shortFixtures, additionalStoryFixtures, enrichPublicationBody } = require('../data/development-writing');
const { edgeCaseFixtures, edgeQuestionFixtures, edgeDraftFixtures, edgeCollectionFixtures, edgeSeriesFixtures } = require('../data/development-edge-cases');
const { parsePostBody } = require('../controllers/publication.controller');

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
  { key: 'moderator', email: 'moderator@inkrider.local', username: 'Rohan Desai', handle: 'demo-moderator', bio: 'Community moderator, careful reader, and occasional collector of short fiction.', writerStatus: 'reader', role: 'moderator', avatarUrl: MaleAvatars[2] },
  { key: 'admin', email: 'admin@inkrider.local', username: 'Amelia Hart', handle: 'demo-admin', bio: 'Keeping firstmargin welcoming. Interested in thoughtful questions and emerging writers.', writerStatus: 'reader', role: 'admin', avatarUrl: MaleAvatars[3] },
];

const engagementReaders = [
  ['aisha', 'Aisha Karim', FemaleAvatars[3]], ['dev', 'Dev Malhotra', MaleAvatars[4]],
  ['elena', 'Elena Park', FemaleAvatars[4]], ['farah', 'Farah Ali', FemaleAvatars[5]],
  ['gabriel', 'Gabriel Torres', MaleAvatars[5]], ['hana', 'Hana Kim', FemaleAvatars[6]],
  ['ishan', 'Ishan Patel', MaleAvatars[6]], ['jules', 'Jules Martin', MaleAvatars[7]],
  ['kavya', 'Kavya Nair', FemaleAvatars[7]], ['leo', 'Leo Bennett', MaleAvatars[8]],
  ['mina', 'Mina Chen', FemaleAvatars[3]], ['omar', 'Omar Haddad', MaleAvatars[9]],
];
userFixtures.push(...engagementReaders.map(([key, username, avatarUrl], index) => ({
  key, email: `${key}@inkrider.local`, username, handle: `reader-${key}`,
  bio: readerBios[index % readerBios.length], writerStatus: 'reader', avatarUrl,
})));
userFixtures.push(...communityWriters, ...communityReaders);

const engagementReaderKeys = ['noah', 'priya', ...engagementReaders.map(([key]) => key), ...communityReaders.map(({ key }) => key)];
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
    coverImage: covers.coast,
    blocks: [['text', 'These early field notes follow a living-breakwater team through one week of monitoring waves, sediment, and returning wildlife.'], ['text', 'The first visit began with a tide marker and a question about the sheltered water behind the structure. By the end of the week, the team had a more complicated account of where the design was helping and where another visit was needed.']],
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
    key: 'unpublished', author: 'arjun', previousTitle: 'Unpublished Demo: Notes on Humane Metrics', title: 'Notes on Humane Metrics', tags: ['technology'], topicSlugs: ['technology'], age: 2, publicationStatus: 'unpublished',
    blocks: [['text', 'A useful metric needs a clear relationship to the experience it claims to describe. Before revising this piece, I want to follow one measure from the dashboard back to an actual reader’s decision.']],
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
const discoveryTaxonomies = [
  { author: 'maya', tags: ['design', 'essays'], topicSlugs: ['design', 'essays'] },
  { author: 'arjun', tags: ['technology', 'design'], topicSlugs: ['technology', 'design'] },
  { author: 'leila', tags: ['science', 'travel'], topicSlugs: ['science', 'travel'] },
  { author: 'maya', tags: ['fiction', 'travel'], topicSlugs: ['fiction', 'travel'] },
  { author: 'leila', tags: ['science', 'wellness'], topicSlugs: ['science', 'wellness'] },
];
postFixtures.push(...discoverySeedStories.map((title, index) => {
  const taxonomy = discoveryTaxonomies[index % discoveryTaxonomies.length];
  const [subject, image] = discoverySubjects[index];
  const paragraphs = discoveryStoryBodies[index];
  if (!paragraphs || paragraphs.length < 3) throw new Error(`Missing editorial content for discovery story ${index + 1}`);
  return {
    key: `discovery-story-${String(index + 1).padStart(2, '0')}`,
    ...taxonomy,
    tags: [subject], topicSlugs: [subject],
    title,
    age: 0.5 + index * 0.35,
    appreciationsCount: 6 + ((index * 7) % 25),
    coverImage: covers[image],
    blocks: [['text', paragraphs[0]], ['h2', 'A closer look'], ['text', paragraphs[1]], ['h2', 'What to carry forward'], ['text', paragraphs[2]]],
  };
}));
postFixtures.push(...additionalStoryFixtures.map(fixture => ({
  ...fixture,
  coverImage: covers[({ science: 'coast', technology: 'data', design: 'architecture' })[fixture.tags[0]] || 'notebook'],
  blocks: [['text', fixture.paragraphs[0]], ['h2', 'A closer look'], ['text', fixture.paragraphs[1]], ['h2', 'What changed'], ['text', fixture.paragraphs[2]]],
})));
postFixtures.push(...edgeCaseFixtures.map(fixture => ({ ...fixture, edgeCase: true })));
postFixtures.push(...communityStories, ...communityShorts);
for (const fixture of postFixtures) fixture.blocks = enrichPublicationBody(fixture);
// Shorts also use meaningful covers; no random image endpoint is needed at render time.
const catalogCover = createCoverAllocator();
for (const fixture of postFixtures) fixture.coverImage = catalogCover(`publication:${fixture.key}`, fixture);

const makeBlocks = fixture => JSON.stringify(fixture.blocks.map(([type, content, alt], index) => ({ id: `seed-${fixture.key}-${index + 1}`, type, content, ...(alt ? { alt } : {}) })));
const upsert = (Model, filter, update) => Model.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });

const tenStorySeries = {
  title: 'A Curious Life: Ten Ways of Seeing', author: 'maya', type: 'story',
  description: 'Ten essays about noticing more: begin with familiar rooms and neighborhood walks, then explore better questions, shared places, research, and the quiet craft of making an idea clear.',
  postKeys: ['discovery-story-01', 'discovery-story-04', 'discovery-story-06', 'discovery-story-09', 'discovery-story-11', 'discovery-story-14', 'discovery-story-16', 'discovery-story-19', 'discovery-story-21', 'discovery-story-24'],
  saved: [],
};

async function seedUsers() {
  const password = await bcrypt.hash(seedPassword, 12);
  const users = new Map();
  for (const fixture of userFixtures) {
    const user = await upsert(User, { email: fixture.email }, {
      $set: { username: fixture.username, bio: fixture.bio, picture: fixture.avatarUrl, password, verified: true, role: fixture.role || 'regular', accountStatus: 'active' },
      $setOnInsert: { followers: 0, followersCount: 0, followingCount: 0, following: [], createdAt: ago(30 + stableNumber(fixture.key, 'joined') % 600) },
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
    if (fixture.previousTitle) await Publication.updateOne({ author: users.get(fixture.author)._id, title: fixture.previousTitle }, { $set: { title: fixture.title } });
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
        metadata: { views: 0, shares: 0 },
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
  const writers = userFixtures.filter(user => user.writerStatus === 'writer').map(({ key }) => key);
  for (const follower of engagementReaderKeys) {
    for (const following of selectReaders(writers, follower, 'follows', 1 + stableNumber(follower, 'follow-count') % 7, [follower])) {
      if (!follows.some(pair => pair[0] === follower && pair[1] === following)) follows.push([follower, following]);
    }
  }
  await Follow.bulkWrite(follows.map(([follower, following]) => {
    const filter = { followerId: users.get(follower)._id, followingId: users.get(following)._id };
    return { updateOne: { filter, update: { $setOnInsert: { ...filter, createdAt: ago(7 + stableNumber(`${follower}:${following}`, 'follow-age') % 180) } }, upsert: true } };
  }));
  const seededUserIds = [...users.values()].map(user => user._id);
  const actualFollows = await Follow.find({ $or: [{ followerId: { $in: seededUserIds } }, { followingId: { $in: seededUserIds } }] }).select('followerId followingId').lean();
  await User.bulkWrite(userFixtures.map(fixture => {
    const id = users.get(fixture.key)._id;
    const followingIds = actualFollows.filter(row => String(row.followerId) === String(id)).map(row => row.followingId);
    const followersCount = actualFollows.filter(row => String(row.followingId) === String(id)).length;
    return { updateOne: { filter: { _id: id }, update: { $set: { following: followingIds, followingCount: followingIds.length, followersCount, followers: followersCount } } } };
  }));

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
  const generatedSaves = [];
  for (const fixture of postFixtures) {
    if (fixture.publicationStatus === 'unpublished' || (fixture.publicAt && fixture.publicAt > now)) continue;
    const post = posts.get(fixture.key);
    const eligibleReaders = engagementReaderKeys.filter(key => key !== fixture.author)
      .sort((a, b) => stableNumber(fixture.key, `reader:${a}`) - stableNumber(fixture.key, `reader:${b}`));
    const appreciationTargets = [0, 1, 3, 7, 12, 19, 28, 43, 57, 74];
    const appreciationCount = Math.min(eligibleReaders.length, appreciationTargets[stableNumber(fixture.key, 'appreciations') % appreciationTargets.length]);
    for (const key of eligibleReaders.slice(0, appreciationCount)) {
      const userId = users.get(key)._id;
      generatedAppreciations.push({ updateOne: { filter: { userId, publicationId: post._id }, update: { $setOnInsert: { userId, publicationId: post._id, createdAt: ago(fixture.age * ((stableNumber(`${fixture.key}:${key}`, 'liked-age') % 90) + 1) / 100) } }, upsert: true } });
    }
    for (const key of selectReaders(eligibleReaders, fixture.key, 'saves', stableNumber(fixture.key, 'save-count') % 24)) {
      const filter = { userId: users.get(key)._id, publicationId: post._id };
      generatedSaves.push({ updateOne: { filter, update: { $setOnInsert: { ...filter, createdAt: ago((stableNumber(`${fixture.key}:${key}`, 'saved-age') % Math.max(1, Math.floor(fixture.age * 100))) / 100) } }, upsert: true } });
    }
    const commentsCount = stableNumber(fixture.key, 'comments') % 7;
    const copy = commentCopy[fixture.tags[0]] || commentCopy.essays;
    for (let index = 0; index < commentsCount; index += 1) {
      const userId = users.get(eligibleReaders[(index + 3) % eligibleReaders.length])._id;
      const content = copy[(stableNumber(fixture.key, 'comment-copy') + index) % copy.length];
      generatedComments.push({ updateOne: { filter: { userId, publicationId: post._id, content }, update: { $setOnInsert: { userId, publicationId: post._id, content, parentCommentId: null, createdAt: ago(fixture.age * (0.1 + (index + 1) / 10)) } }, upsert: true } });
    }
  }
  if (generatedAppreciations.length) await Appreciation.bulkWrite(generatedAppreciations, { ordered: false });
  if (generatedComments.length) await Comment.bulkWrite(generatedComments, { ordered: false });
  if (generatedSaves.length) await Save.bulkWrite(generatedSaves, { ordered: false });
  for (const [index, fixture] of communityStories.entries()) {
    const post = posts.get(fixture.key);
    const content = storyComments[index];
    const userId = users.get(engagementReaderKeys[(index * 7) % engagementReaderKeys.length])._id;
    const parent = await upsert(Comment, { userId, publicationId: post._id, content }, { $setOnInsert: { userId, publicationId: post._id, content, parentCommentId: null, createdAt: ago(fixture.age * 0.7) } });
    const reply = ({ sofia: 'Thank you. The small detours have become the first thing I write down after a trip. I am glad this one stayed with you.', theo: 'That is a useful example. Looking at the whole experience often changes where I think the design problem begins.', nisha: 'I am glad the detail felt familiar. Those ordinary conversations keep turning out to be the part I want to preserve.', lucas: 'I would be interested to hear how it works for your team. The important part for us was making the next decision explicit.', anika: 'Keep the exceptions in the notebook too. They often suggest a much better question for the next observation.', mateo: 'Thank you for noticing that detail. I cut a longer final paragraph because the scene seemed to have already said enough.', zoe: 'I am glad it felt usable. I keep trying to leave room for the days when the routine needs to change.', daniel: 'That is exactly the kind of detail I want the picture to leave room for. Thank you for adding another perspective.' })[fixture.author];
    await upsert(Comment, { userId: post.author, publicationId: post._id, parentCommentId: parent._id }, { $setOnInsert: { userId: post.author, publicationId: post._id, parentCommentId: parent._id, content: reply, createdAt: ago(fixture.age * 0.5) } });
  }

  const spread = {
    story: { appreciations: new Set(), comments: new Set() },
    short: { appreciations: new Set(), comments: new Set() },
  };
  const publicationIds = [...posts.values()].map(post => post._id);
  const [appreciationTotals, commentTotals] = await Promise.all([
    Appreciation.aggregate([{ $match: { publicationId: { $in: publicationIds } } }, { $group: { _id: '$publicationId', count: { $sum: 1 } } }]),
    Comment.aggregate([{ $match: { publicationId: { $in: publicationIds }, deletedAt: null } }, { $group: { _id: '$publicationId', count: { $sum: 1 } } }]),
  ]);
  const appreciationsByPost = new Map(appreciationTotals.map(row => [String(row._id), row.count]));
  const commentsByPost = new Map(commentTotals.map(row => [String(row._id), row.count]));
  const counterUpdates = [];
  for (const post of posts.values()) {
    const appreciationsCount = appreciationsByPost.get(String(post._id)) || 0;
    const commentsCount = commentsByPost.get(String(post._id)) || 0;
    counterUpdates.push({ updateOne: { filter: { _id: post._id }, update: { $set: { appreciationsCount, commentsCount } } } });
    if (post.publicationStatus === 'published' && (!post.publicAt || post.publicAt <= now)) {
      spread[post.format].appreciations.add(appreciationsCount);
      spread[post.format].comments.add(commentsCount);
    }
  }
  await Publication.bulkWrite(counterUpdates);
  for (const [format, levels] of Object.entries(spread)) {
    if (levels.appreciations.size < 3 || levels.comments.size < 3) {
      throw new Error(`Seed verification failed: ${format} engagement counts need more variation`);
    }
  }

  const interestMap = { noah: [['fiction', 1], ['design', 0.8], ['technology', 0.5]], priya: [['science', 1], ['technology', 0.8], ['essays', 0.7]], maya: [['design', 1], ['essays', 0.9]], arjun: [['technology', 1], ['design', 0.7]] };
  for (const writer of communityWriters) interestMap[writer.key] = [[writer.topic, 1], [writer.topic === 'essays' ? 'travel' : 'essays', 0.5]];
  for (const [userKey, interests] of Object.entries(interestMap)) for (const [slug, weight] of interests) await upsert(UserInterest, { userId: users.get(userKey)._id, topicId: topics.get(slug)._id }, { $set: { explicitWeight: weight, inferredWeight: weight / 4 } });
  await User.updateMany({ _id: { $in: ['noah', 'priya', ...communityWriters.map(writer => writer.key)].map(key => users.get(key)._id) } }, { $set: { onboardingCompletedAt: ago(20) } });
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
  fixtures.push(...communityQuestions);
  fixtures.push(...edgeQuestionFixtures);
  const questions = new Map();
  for (const fixture of fixtures) {
    if (fixture.text.length < 10 || fixture.text.length > 180 || fixture.context.length > 1000
      || normalizeTags(fixture.tags).length > 5 || normalizeTags(fixture.tags).some(tag => tag.length > 30)) {
      throw new Error(`Invalid development question: ${fixture.key}`);
    }
    const voterKeys = [...new Set([...fixture.voters, ...selectReaders(engagementReaderKeys, fixture.key, 'question-votes', stableNumber(fixture.key, 'question-count') % 59, [fixture.author])])];
    if (fixture.previousText) await Question.updateOne({ author: users.get(fixture.author)._id, normalizedText: normalizeQuestionText(fixture.previousText) }, { $set: { text: fixture.text, normalizedText: normalizeQuestionText(fixture.text) } });
    const voters = voterKeys.map(key => users.get(key)._id);
    const followers = selectReaders(engagementReaderKeys, fixture.key, 'question-followers', 1 + stableNumber(fixture.key, 'question-follows') % 27).map(key => users.get(key)._id);
    const data = { text: fixture.text, normalizedText: normalizeQuestionText(fixture.text), context: fixture.context, tags: normalizeTags(fixture.tags).slice(0, 5), author: users.get(fixture.author)._id, upvotes: voters, upvotesCount: voters.length, followers, relatedPublications: fixture.related.map(key => posts.get(key)._id), status: fixture.status };
    const update = { $set: data };
    update.$setOnInsert = { createdAt: ago(3 + stableNumber(fixture.key, 'question-age') % 36), ...(fixture.answers ? { answers: fixture.answers.map(([author, text, answerVoters]) => ({ text, author: users.get(author)._id, upvotes: answerVoters.map(key => users.get(key)._id), createdAt: ago(1 + stableNumber(fixture.key, 'answer-age') % 2) })) } : {}) };
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
  drafts.push(...communityWriters.map(writer => ({ author: writer.key, title: `Notes for the next ${writer.topic === 'fiction' ? 'story' : 'essay'}`, format: 'story', tags: [writer.topic], blocks: [['text', `I keep returning to the question behind “${communityStories.find(post => post.author === writer.key).title}”. The next piece needs a different opening and a more specific example.`], ['h2', 'Before the next draft'], ['text', 'Return to the notes, check the sequence of events, and choose one scene that carries the question. Ask a reader what remains unclear before writing the conclusion.']] })));
  for (const fixture of drafts) {
    if (fixture.title.length > (fixture.format === 'short' ? 120 : 180) || normalizeTags(fixture.tags).some(tag => tag.length > 60)) {
      throw new Error(`Invalid development draft: ${fixture.title}`);
    }
    const body = JSON.stringify(fixture.blocks.map(([type, content], index) => ({ id: `seed-draft-${fixture.author}-${index}`, type, content })));
    if (fixture.previousTitle) await Draft.updateOne({ authorId: users.get(fixture.author)._id, title: fixture.previousTitle }, { $set: { title: fixture.title } });
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
  collectionFixtures.push(...communityCollections);
  for (const fixture of collectionFixtures) {
    if (fixture.previousTitle) await Collection.updateOne({ author: users.get(fixture.author)._id, title: fixture.previousTitle }, { $set: { title: fixture.title } });
    fixture.saved = [...new Set([...fixture.saved, ...selectReaders(engagementReaderKeys, fixture.title, 'collection-saves', fixture.visibility === 'private' ? 0 : stableNumber(fixture.title, 'save-count') % 35, [fixture.author])])];
    fixture.followed = [...new Set([...fixture.followed, ...selectReaders(engagementReaderKeys, fixture.title, 'collection-follows', fixture.visibility === 'private' ? 0 : stableNumber(fixture.title, 'follow-count') % 23, [fixture.author])])];
    if (fixture.title.trim().length < 2 || fixture.title.length > 100 || fixture.description.length > 500 || fixture.postKeys.length > 100) {
      throw new Error(`Invalid development collection: ${fixture.title}`);
    }
    const publicationIds = fixture.postKeys.map(key => posts.get(key)._id);
    await upsert(Collection, { author: users.get(fixture.author)._id, title: fixture.title }, { $set: { description: fixture.description, coverImage: fixture.coverImage || posts.get(fixture.postKeys[0])?.coverImage || covers.books, publications: publicationIds, items: publicationIds.map((post, position) => ({ publication: post, position, addedAt: ago(position) })), visibility: fixture.visibility, isPublic: fixture.visibility === 'public', savedBy: fixture.saved.map(key => users.get(key)._id), savedCount: fixture.saved.length, followers: fixture.followed.map(key => users.get(key)._id), followersCount: fixture.followed.length } });
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
  seriesFixtures.push(...communitySeries);
  seriesFixtures.push(tenStorySeries);
  for (const fixture of seriesFixtures) {
    if (fixture.previousTitle) await ShortSeries.updateOne({ author: users.get(fixture.author)._id, title: fixture.previousTitle }, { $set: { title: fixture.title } });
    if (fixture.title.trim().length < 2 || fixture.title.length > 100 || fixture.description.length > 500 || fixture.postKeys.length < 2) {
      throw new Error(`Invalid development series: ${fixture.title}`);
    }
    for (const key of fixture.postKeys) {
      const publication = posts.get(key);
      if (!publication || String(publication.author) !== String(users.get(fixture.author)._id) || publication.format !== fixture.type) {
        throw new Error(`Invalid ${fixture.type} series item: ${fixture.title} / ${key}`);
      }
    }
    const saved = [...new Set([...fixture.saved, ...selectReaders(engagementReaderKeys, fixture.title, 'series-saves', stableNumber(fixture.title, 'saved') % 31, [fixture.author])])];
    await upsert(ShortSeries, { author: users.get(fixture.author)._id, title: fixture.title }, { $set: { description: fixture.description, coverImage: fixture.coverImage || posts.get(fixture.postKeys[0]).coverImage, type: fixture.type, visibility: 'public', savedBy: saved.map(key => users.get(key)._id), savedCount: saved.length, items: fixture.postKeys.map((key, position) => ({ publication: posts.get(key)._id, position })) } });
  }
}

async function seedCompetitions(users, posts) {
  const fixtures = [
    { key: 'open', title: 'Small Details, Big Worlds', description: 'Show how one overlooked detail changes the way we understand a familiar place or system.', status: 'open', openDate: ago(2), closeDate: ahead(5), resultsDate: ahead(8), votingMode: 'readers', competitionType: 'theme', entries: [['maya', 'walkable-city', ['noah', 'priya']], ['arjun', 'recommendation-systems', ['priya']]] },
    { key: 'judging', title: 'Explain Tomorrow', description: 'Make an emerging idea clear without hiding its uncertainty, limits, or effect on real people.', status: 'judging', openDate: ago(12), closeDate: ago(1), resultsDate: ahead(2), votingMode: 'hybrid', competitionType: 'timed', entries: [['leila', 'restoring-reefs', ['noah', 'priya']], ['arjun', 'recommendation-systems', ['maya']]] },
    { key: 'closed', title: 'Journey in 1,000 Words', description: 'Tell a complete journey through a change of place, perspective, or understanding.', status: 'closed', openDate: ago(40), closeDate: ago(30), resultsDate: ago(25), votingMode: 'judges', competitionType: 'reader_choice', entries: [['maya', 'fiction-station', ['noah', 'priya']], ['arjun', 'recommendation-systems', ['leila']]], winnerIndex: 0 },
  ];
  fixtures.push(
    { key: 'everyday', title: 'An Ordinary Day, Closely Observed', description: 'Find a story in a small routine. Give readers a particular place, a concrete detail, and a reason to look again.', coverImage: covers.coffee, status: 'open', openDate: ago(4), closeDate: ahead(12), resultsDate: ahead(12), votingMode: 'readers', competitionType: 'reader_choice', entries: [['nisha', 'recipe-margin', []], ['zoe', 'friendship-calendar', []], ['daniel', 'noticeboard', []], ['maya', 'square-seating', []]] },
    { key: 'departures', title: 'Between Arrivals and Departures', description: 'A short-fiction invitation for encounters on platforms, in doorways, and at the moment someone decides to stay.', coverImage: covers.train, status: 'open', openDate: ago(1), closeDate: ahead(18), resultsDate: ahead(21), votingMode: 'hybrid', competitionType: 'collective_choice', entries: [['mateo', 'wrong-platform', []], ['maya', 'fiction-station', []]] },
    { key: 'field-notes', title: 'Notes from a Changing Season', description: 'Write from repeated observation. Show what changed between visits and keep your questions as visible as your conclusions.', coverImage: covers.forest, status: 'closed', openDate: ago(50), closeDate: ago(20), resultsDate: ago(18), votingMode: 'readers', competitionType: 'reader_choice', entries: [['anika', 'rain-notebook', []], ['leila', 'three-tides', []], ['sofia', 'one-neighborhood', []]], winnerIndex: 0 },
  );
  const competitions = new Map();
  for (const fixture of fixtures) {
    if (fixture.key === 'open') { fixture.competitionType = 'reader_choice'; fixture.coverImage = covers.architecture; }
    if (fixture.key === 'judging') { fixture.competitionType = 'collective_choice'; fixture.coverImage = covers.data; }
    if (fixture.key === 'closed') { fixture.votingMode = 'readers'; fixture.coverImage = covers.train; }
    let competition = await Competition.findOne({ title: fixture.title });
    if (!competition) competition = new Competition({ title: fixture.title, closeDate: fixture.closeDate });
    competition.set({ description: fixture.description, coverImage: fixture.coverImage, status: fixture.status, openDate: fixture.openDate, closeDate: fixture.closeDate, resultsDate: fixture.resultsDate, votingMode: fixture.votingMode, competitionType: fixture.competitionType, rules: ['Submit one original, published piece that you own.', 'Keep your writing connected to the announced theme.', 'Vote for one entry. Independent reader votes may be changed before voting closes.'], prizes: [{ rank: 'Winner', amount: 'Featured writer placement' }], maxEntries: 50, createdBy: users.get('admin')._id, judgeRoster: fixture.status === 'judging' ? [users.get('moderator')._id] : [], finalizedAt: fixture.status === 'closed' ? fixture.resultsDate : null });
    const existingEntries = new Map(competition.entries.map(entry => [String(entry.publication), entry]));
    const participatingReaders = selectReaders(engagementReaderKeys, fixture.key, 'contest-voters', 17 + stableNumber(fixture.key, 'turnout') % 52);
    competition.entries = fixture.entries.map(([author, post], index) => {
      const voters = participatingReaders.filter((key, position) => position % fixture.entries.length === index && key !== author);
      return { ...(existingEntries.get(String(posts.get(post)._id))?._id ? { _id: existingEntries.get(String(posts.get(post)._id))._id } : {}), author: users.get(author)._id, publication: posts.get(post)._id, publicationRevision: 1,
        note: `My entry explores the theme through “${posts.get(post).title}”.`, votes: voters.map(key => users.get(key)._id), votesCount: voters.length,
        judgeScores: fixture.status === 'judging' && index === 0 ? [{ judgeId: users.get('moderator')._id, submittedBy: users.get('moderator')._id, craft: 8, originality: 9, relevance: 8, note: 'A clear central question, specific examples, and an ending that stays honest about the evidence.' }] : [] };
    });
    if (fixture.status === 'closed') fixture.winnerIndex = competition.entries.reduce((best, entry, index, entries) => entry.votesCount > entries[best].votesCount ? index : best, 0);
    const winningVotes = fixture.status === 'closed' ? Math.max(...competition.entries.map(entry => entry.votesCount)) : null;
    competition.winnerEntryIds = winningVotes == null ? [] : competition.entries.filter(entry => entry.votesCount === winningVotes).map(entry => entry._id);
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
  const notebookNotes = {
    sofia: 'The train piece began as a list of practical tips. The bakery changed the draft because it gave the journey a scene. I kept the timetable in my notes and let the shared breakfast carry the opening. For the next trip, I am leaving a whole morning without bookings so I can follow a smaller story.',
    theo: 'I photographed the lamp before opening it, then took another photograph at each step. The most useful image showed the broken clip rather than the loose connection. It changed the piece from a repair anecdote into a question about the choices made before an object reaches its owner.',
    nisha: 'I called my mother to check the recipe and we spent twenty minutes discussing the cup in the photograph. That conversation did not belong in the finished essay, but it clarified its subject. I was writing about the small ways a kitchen becomes familiar, with the recipe as a route into it.',
    lucas: 'The decision-log draft originally included our entire template. I removed most of it after a reader asked why any of the fields mattered. The revised piece starts with the forgotten constraint, then explains only the lines that would have saved us from repeating the discussion.',
    anika: 'My first week of bird notes looked impressively consistent until I checked the times. I had watched at a different hour on the rainy days. I kept those pages and marked the limitation. The next month will use the same observation window, with weather recorded separately.',
    mateo: 'The first version explained who the visitor was before Amir noticed the suitcase. I moved that information later and cut the final paragraph. The spare chair now has room to carry a feeling the character is not ready to name. I am still deciding whether the balcony needs one more concrete detail.',
    zoe: 'I nearly gave the walk essay a list of rules. Reading it aloud made that ending feel wrong: the piece was asking for more choice, and I had answered with another routine to follow. The final version leaves room for tracking a route and leaving the watch at home.',
    daniel: 'I returned to the library at noon and after school with the same lens and viewpoint. The arrangement of chairs told the story more clearly than a wide view of the building. I kept identifiable faces out of the photographs and asked the staff which details would be misleading without a caption.',
  };
  updates.push(...communityWriters.map(writer => [writer.key, `Inside the notebook: ${communityStories.find(post => post.author === writer.key).title}`, notebookNotes[writer.key], 'members']));
  for (const [index, [creator, title, body, audience]] of updates.entries()) await upsert(CreatorUpdate, { creatorId: users.get(creator)._id, title }, { $set: { body, audience, status: 'published', publishedAt: ago(0.5 + index * 0.8) } });
  for (const [index, writer] of communityWriters.entries()) {
    await upsert(Membership, { userId: users.get(writer.key)._id }, { $set: { plan: 'member', status: 'active', provider: null, currentPeriodStart: ago(10 + index), currentPeriodEnd: ahead(20 - index), cancelAtPeriodEnd: false } });
    if (index % 2) continue;
    const title = ({ sofia: 'Writing the Journey Between Destinations', nisha: 'Finding an Essay in a Family Story', anika: 'Start a Seasonal Nature Notebook', zoe: 'Make Space for a Sustainable Writing Routine' })[writer.key];
    const workshop = await upsert(Workshop, { hostId: users.get(writer.key)._id, title }, { $set: { description: `Join ${writer.username} for a small-group session with a guided exercise, a discussion of your notes, and time for questions. Bring one unfinished idea; no polished draft is needed.`, startsAt: ahead(5 + index * 2), endsAt: new Date(ahead(5 + index * 2).getTime() + 90 * 60 * 1000), capacity: 12 + index * 3, meetingUrl: `https://meet.example.test/${writer.key}-writing`, status: 'published' } });
    for (const key of ['priya', ...communityWriters.slice(0, index + 1).map(item => item.key)].filter(key => key !== writer.key)) await upsert(WorkshopAttendance, { workshopId: workshop._id, userId: users.get(key)._id }, { $set: { status: 'registered' } });
  }

  const requests = [
    ['priya', 'maya', 'How do you structure an essay from field notes?', 'Please show how fragments become a coherent argument.', 'pending', null],
    ['noah', 'maya', 'Could you write about hostile architecture?', 'I am interested in design choices that quietly exclude people.', 'accepted', 'Yes, I am collecting examples now.'],
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
  const events = [];
  const checkpoints = [];
  for (const fixture of postFixtures) {
    if (fixture.publicationStatus === 'unpublished' || (fixture.publicAt && fixture.publicAt > now)) continue;
    const post = posts.get(fixture.key);
    const interestedIds = new Set((await Appreciation.find({ publicationId: post._id }).select('userId').lean()).map(row => String(row.userId)));
    const readers = [...new Set([
      ...engagementReaderKeys.filter(key => interestedIds.has(String(users.get(key)._id))),
      ...selectReaders(engagementReaderKeys, fixture.key, 'readers', 9 + stableNumber(fixture.key, 'read-count') % 64, [fixture.author]),
      'noah', 'priya',
    ])].filter(key => key !== fixture.author);
    for (const key of readers) {
      const actorId = users.get(key)._id;
      const age = fixture.age * (0.05 + (stableNumber(`${key}:${fixture.key}`, 'read-age') % 80) / 100);
      const progress = [20, 40, 60, 80, 100][stableNumber(`${key}:${fixture.key}`, 'progress') % 5];
      const eventAt = ago(age);
      for (const eventType of ['impression', 'open', progress === 100 ? 'complete' : 'reading_depth']) {
        const eventId = `community-${stableNumber(key, fixture.key).toString(16)}-${fixture.key.slice(0, 28)}-${eventType}`;
        const data = { actorId, eventType, publicationId: post._id, writerId: post.author, surface: eventType === 'impression' ? 'home' : 'story', eventAt, metadata: { readingDepth: ['impression', 'open'].includes(eventType) ? null : progress } };
        events.push({ updateOne: { filter: { eventId }, update: { $set: data }, upsert: true } });
      }
      checkpoints.push({ updateOne: { filter: { userId: actorId, publicationId: post._id }, update: { $set: { progress, completed: progress === 100, lastReadAt: eventAt } }, upsert: true } });
    }
  }
  for (let offset = 0; offset < events.length; offset += 500) await InteractionEvent.bulkWrite(events.slice(offset, offset + 500));
  for (let offset = 0; offset < checkpoints.length; offset += 500) await ReadingState.bulkWrite(checkpoints.slice(offset, offset + 500));
  const views = await InteractionEvent.aggregate([
    { $match: { publicationId: { $in: [...posts.values()].map(post => post._id) }, eventType: 'open' } },
    { $group: { _id: '$publicationId', count: { $sum: 1 } } },
  ]);
  await Publication.bulkWrite(views.map(row => ({ updateOne: { filter: { _id: row._id }, update: { $set: { 'metadata.views': row.count } } } })));
}

async function seedModerationAndNotifications(users, posts, questions, competitions) {
  const comment = await Comment.findOne({ publicationId: posts.get('walkable-city')._id });
  const reports = [
    { key: 'pending', reporter: 'noah', subjectType: 'publication', subjectId: posts.get('recommendation-systems')._id, reason: 'misinformation', details: 'Could a reviewer check whether the example is clearly presented as an illustration rather than a measured result?', status: 'pending' },
    { key: 'reviewing', reporter: 'priya', subjectType: 'comment', subjectId: comment._id, reason: 'toxicity', details: 'I may be missing context, but the wording felt directed at another participant. Please review the surrounding discussion.', status: 'reviewing' },
    { key: 'dismissed', reporter: 'maya', subjectType: 'question', subjectId: questions.get('fiction')._id, reason: 'other', details: 'This looked similar to an earlier question about sensory detail. Please check whether they should be connected.', status: 'dismissed' },
  ];
  const reportMap = new Map();
  for (const fixture of reports) reportMap.set(fixture.key, await upsert(Report, { reporterId: users.get(fixture.reporter)._id, subjectType: fixture.subjectType, subjectId: fixture.subjectId }, { $set: { reason: fixture.reason, details: fixture.details, status: fixture.status } }));
  await upsert(ModerationAction, { reportId: reportMap.get('reviewing')._id, action: 'begin_review' }, { $set: { moderatorId: users.get('moderator')._id, note: 'Reading the full conversation before making a recommendation.' } });
  await upsert(ModerationAction, { reportId: reportMap.get('dismissed')._id, action: 'dismiss' }, { $set: { moderatorId: users.get('moderator')._id, note: 'The questions ask for different examples. No policy violation found; both can remain available.' } });

  const request = await CreatorRequest.findOne({ requesterId: users.get('priya')._id, creatorId: users.get('maya')._id, status: 'pending' });
  const notificationFixtures = [
    ['noah', 'arjun', 'question_answered', 'Your question has a new story', 'Arjun Rao responded to your question about discovering unfamiliar ideas.', `/post/${posts.get('recommendation-systems')._id}`, 'publication', posts.get('recommendation-systems')._id, null],
    ['maya', 'priya', 'direct_request_received', 'New direct member request', 'Priya Mehta asked how you turn field notes into an essay.', '/studio?writingTab=requests', 'creator_request', request._id, null],
    ['maya', 'admin', 'competition_result', 'You placed in Journey in 1,000 Words', 'The results are now public.', `/explore/competitions/${competitions.get('closed')._id}`, 'competition', competitions.get('closed')._id, ago(2)],
    ['noah', 'moderator', 'moderation', 'Report received', 'Your report is waiting for review.', '/notifications', 'report', reportMap.get('pending')._id, ago(1)],
  ];
  for (const [index, fixture] of communityStories.entries()) {
    for (const recipient of ['noah', 'priya', fixture.author]) {
      const actor = recipient === fixture.author ? engagementReaderKeys[(index * 7) % engagementReaderKeys.length] : fixture.author;
      notificationFixtures.push([recipient, actor, 'publication_commented', `${users.get(actor).username} joined the discussion`, `A new comment on “${fixture.title}”.`, `/post/${posts.get(fixture.key)._id}`, 'publication', posts.get(fixture.key)._id, index % 3 ? null : ago(index / 5 + 0.1)]);
    }
  }
  for (const [index, [recipient, actor, type, title, body, href, entityType, entityId, readAt]] of notificationFixtures.entries()) {
    const post = entityType === 'publication' ? [...posts.values()].find(item => String(item._id) === String(entityId)) : null;
    const age = Math.min(0.01 + index * 0.08, post ? Math.max(0.001, (now - post.publicAt) / DAY * 0.3) : Infinity);
    const createdAt = ago(age);
    await upsert(Notification, { recipientId: users.get(recipient)._id, type, entityType, entityId }, { $set: { actorId: users.get(actor)._id, title, body, href, readAt: readAt ? new Date(Math.max(readAt.getTime(), createdAt.getTime())) : null }, $setOnInsert: { createdAt } });
  }
}

async function refreshLegacyEditorial() {
  const noah = await User.findOne({ email: 'noah@inkrider.local' }).select('_id').lean();
  if (noah) {
    const oldShorts = await Publication.find({ author: noah._id, title: { $in: ['A browser-tested short reading flow', ...legacyShorts.map(([title]) => title)] } }).sort({ _id: 1 });
    for (const [index, post] of oldShorts.entries()) {
      if (index >= legacyShorts.length) break;
      const [title, text, image, tags] = legacyShorts[index];
      // These are specifically identified browser-created examples, not user writing.
      const fixture = { key: `legacy-${String(index + 1).padStart(2, '0')}`, format: 'short', blocks: [['text', text]] };
      fixture.blocks = enrichPublicationBody(fixture);
      post.set({ title, body: makeBlocks(fixture), tags, coverImage: covers[image] });
      await post.save();
    }
  }
  const missingCovers = await Publication.find({ coverImage: { $in: ['', null] } }).select('_id tags title').lean();
  if (missingCovers.length) await Publication.bulkWrite(missingCovers.map(post => ({ updateOne: {
    filter: { _id: post._id, coverImage: { $in: ['', null] } },
    update: { $set: { coverImage: covers[post.tags.includes('news') ? 'street' : post.tags.includes('technology') ? 'data' : post.tags.includes('science') ? 'forest' : 'notebook'] } },
  } })));
  for (const Model of [Collection, ShortSeries]) {
    const missing = await Model.find({ coverImage: { $in: ['', null] } }).select('_id title').lean();
    if (missing.length) await Model.bulkWrite(missing.map(item => ({ updateOne: {
      filter: { _id: item._id, coverImage: { $in: ['', null] } },
      update: { $set: { coverImage: covers[/coast|ocean|reef/i.test(item.title) ? 'coast' : /city|place|street/i.test(item.title) ? 'architecture' : 'books'] } },
    } })));
  }
  await Competition.updateOne({ title: 'The Places That Shape Us', coverImage: { $in: ['', null] } }, { $set: { coverImage: covers.architecture } });
  const maya = await User.findOne({ email: 'maya@inkrider.local' }).select('_id').lean();
  if (maya) {
    const obsoleteTitle = `${'I tried to explain why the old riverside footpath still matters to our neighborhood, then kept adding details until the title became much too long for a comfortable card'.slice(0, 160)}: draft notes`;
    const replacement = await Draft.exists({ authorId: maya._id, title: 'Draft: Returning to the Riverside Path' });
    if (replacement) await Draft.deleteOne({ authorId: maya._id, title: obsoleteTitle, body: /CHECK QUOTE WITH NEIGHBOR BEFORE PUBLISHING/ });
  }
  const leila = await User.findOne({ email: 'leila@inkrider.local' }).select('_id').lean();
  if (leila) await Publication.updateOne({ author: leila._id, title: 'Field Notes from a Living Breakwater' }, { $set: { coverImage: covers.coast } });
  console.log('Legacy sample shorts refreshed; missing publication covers filled; task-created duplicate draft reconciled.');
}

async function refreshUniqueCovers() {
  const allocate = createCoverAllocator();
  const counts = {};
  const identities = new Set();
  for (const [name, Model] of [['publications', Publication], ['collections', Collection], ['series', ShortSeries], ['competitions', Competition]]) {
    const records = await Model.find({}).sort({ _id: 1 }).select('_id title tags description coverImage').lean();
    const updates = [];
    for (const record of records) {
      const coverImage = allocate(`${name}:${record._id}`, record);
      const identity = photoIdentity(coverImage);
      if (identities.has(identity)) throw new Error('Development cover photo was assigned more than once');
      identities.add(identity);
      if (record.coverImage !== coverImage) updates.push({ updateOne: { filter: { _id: record._id }, update: { $set: { coverImage } } } });
    }
    if (updates.length) await Model.bulkWrite(updates);
    counts[name] = { records: records.length, updated: updates.length };
  }
  const persisted = new Set();
  for (const Model of [Publication, Collection, ShortSeries, Competition]) {
    for (const record of await Model.find({}).select('coverImage').lean()) {
      const identity = photoIdentity(record.coverImage);
      if (persisted.has(identity)) throw new Error('Persisted development covers repeat an underlying photo');
      persisted.add(identity);
    }
  }
  console.log('Distinct development cover photos verified:', { photos: persisted.size, counts });
}

async function verifySeed() {
  const counts = Object.fromEntries(await Promise.all([
    ['users', User], ['profiles', Profile], ['posts', Publication], ['drafts', Draft], ['questions', Question], ['collections', Collection], ['series', ShortSeries],
    ['competitions', Competition], ['memberships', Membership], ['workshops', Workshop], ['creatorUpdates', CreatorUpdate], ['creatorRequests', CreatorRequest],
    ['notifications', Notification], ['reports', Report], ['events', InteractionEvent],
  ].map(async ([key, Model]) => [key, await Model.countDocuments(key === 'users' ? { email: /@inkrider\.local$/ } : {})])));
  const minimums = { users: 91, profiles: 91, posts: 114, drafts: 16, questions: 26, collections: 27, series: 23, competitions: 6, memberships: 2, workshops: 4, creatorUpdates: 3, creatorRequests: 3, notifications: 76, reports: 3, events: 1000 };
  for (const [key, minimum] of Object.entries(minimums)) if (counts[key] < minimum) throw new Error(`Seed verification failed: expected at least ${minimum} ${key}, found ${counts[key]}`);
  const seededUsers = await User.find({ email: { $in: userFixtures.map(user => user.email) } }).select('_id email').lean();
  const userIds = new Map(seededUsers.map(user => [user.email, user._id]));
  const publications = await Publication.find({ $or: postFixtures.map(fixture => ({ author: userIds.get(userFixtures.find(user => user.key === fixture.author).email), title: fixture.title })) }).lean();
  if (publications.length !== postFixtures.length) throw new Error('Seed verification failed: missing or duplicated keyed publications');
  const ids = publications.map(post => post._id);
  const [appreciations, comments, views] = await Promise.all([
    Appreciation.aggregate([{ $match: { publicationId: { $in: ids } } }, { $group: { _id: '$publicationId', count: { $sum: 1 } } }]),
    Comment.aggregate([{ $match: { publicationId: { $in: ids }, deletedAt: null } }, { $group: { _id: '$publicationId', count: { $sum: 1 } } }]),
    InteractionEvent.aggregate([{ $match: { publicationId: { $in: ids }, eventType: 'open' } }, { $group: { _id: '$publicationId', count: { $sum: 1 } } }]),
  ]);
  const countMap = rows => new Map(rows.map(row => [String(row._id), row.count]));
  const actual = [appreciations, comments, views].map(countMap);
  for (const post of publications) {
    const id = String(post._id);
    if (!/^https:\/\//.test(post.coverImage) || `${post.title}${post.body}`.includes('\u2014')
      || post.appreciationsCount !== (actual[0].get(id) || 0) || post.commentsCount !== (actual[1].get(id) || 0)
      || post.metadata.views !== (actual[2].get(id) || 0)) throw new Error('Seed verification failed: publication content, cover, or source counters disagree');
  }
  console.log('Verified keyed publication content, covers, and relationship/event counters:', publications.length);
  return counts;
}

async function run() {
  let stage = 'connecting to MongoDB';
  try {
    await connectToMongoDB();
    stage = 'checking database isolation';
    if (!/(?:dev|test|sandbox|local)/i.test(mongoose.connection.name)) throw new Error('Development seed requires an explicitly isolated database name');
    stage = 'ensuring canonical topics';
    await ensureCanonicalTopics();
    stage = 'loading canonical topics';
    const topics = new Map((await Topic.find({ status: 'active' })).map(topic => [topic.slug, topic]));
    stage = 'seeding users and profiles';
    const users = await seedUsers();
    console.log('Development people and profiles ready.');
    stage = 'seeding publications';
    const posts = await seedPosts(users, topics);
    console.log('Development publications and covers ready.');
    stage = 'seeding relationships';
    await seedRelationships(users, posts, topics);
    console.log('Development engagement reconciled to source relationships.');
    stage = 'seeding questions';
    const questions = await seedQuestions(users, posts);
    stage = 'seeding authoring data';
    await seedAuthoring(users, posts, questions);
    stage = 'seeding collections and series';
    await seedCollectionsAndSeries(users, posts);
    stage = 'seeding competitions';
    const competitions = await seedCompetitions(users, posts);
    stage = 'seeding premium data';
    await seedPremium(users, posts);
    stage = 'seeding events';
    await seedEvents(users, posts);
    stage = 'seeding moderation and notifications';
    await seedModerationAndNotifications(users, posts, questions, competitions);
    stage = 'refreshing editorial data';
    await refreshLegacyEditorial();
    stage = 'refreshing unique covers';
    await refreshUniqueCovers();
    stage = 'verifying seed';
    const counts = await verifySeed();
  console.log('Comprehensive development fixtures are ready:', counts);
  console.log('Demo account credentials are configured through SEED_PASSWORD and are not printed.');
  } catch (error) {
    error.seedStage = stage;
    throw error;
  }
}

function validateCatalog() {
  const keys = new Set();
  const coverPhotos = new Set();
  const authors = new Set(userFixtures.map(user => user.key));
  const lengths = { stories: [], shorts: [] };
  const blockCounts = {};
  for (const fixture of postFixtures) {
    if (keys.has(fixture.key) || !authors.has(fixture.author)) throw new Error(`Duplicate key or unknown author: ${fixture.key}`);
    keys.add(fixture.key);
    const identity = photoIdentity(fixture.coverImage);
    if (coverPhotos.has(identity)) throw new Error(`Repeated publication cover photo: ${fixture.key}`);
    coverPhotos.add(identity);
    const words = fixture.blocks.filter(([type]) => type !== 'image').reduce((total, [, content]) => total + content.trim().split(/\s+/).filter(Boolean).length, 0);
    if (!['edge-minimal-story', 'edge-tiny-short', 'edge-long-short-body'].includes(fixture.key)) lengths[fixture.format === 'short' ? 'shorts' : 'stories'].push(words);
    for (const [type, content, alt] of fixture.blocks) {
      blockCounts[type] = (blockCounts[type] || 0) + 1;
      if (!['text', 'h1', 'h2', 'h3', 'quote', 'code', 'image', 'divider'].includes(type)
        || content.length > (type === 'code' ? 50_000 : 10_000)
        || (type === 'image' && (!/^https:\/\//.test(content) || !alt || alt.length > 300))) throw new Error(`Invalid editorial block: ${fixture.key}`);
    }
    if (!parsePostBody(makeBlocks(fixture)) || fixture.title.length > (fixture.format === 'short' ? 120 : 180) || (fixture.format === 'short' && words > 500)
      || JSON.stringify({ title: fixture.title, blocks: fixture.blocks }).includes('\u2014') || !/^https:\/\//.test(fixture.coverImage)) throw new Error(`Invalid content or cover: ${fixture.key}`);
  }
  if (tenStorySeries.postKeys.length !== 10 || new Set(tenStorySeries.postKeys).size !== 10) throw new Error('Ten-story series requires ten distinct publications');
  for (const fixture of [...communityCollections, ...communitySeries, tenStorySeries]) {
    if (fixture.title.length > 100 || fixture.description.length > 500) throw new Error(`Invalid curation: ${fixture.title}`);
    for (const key of fixture.postKeys) {
      const post = postFixtures.find(item => item.key === key);
      if (!post || (fixture.type && (post.author !== fixture.author || (post.format || 'story') !== fixture.type))) throw new Error(`Invalid curation item: ${fixture.title}/${key}`);
    }
  }
  console.log('Development catalog validated:', { people: userFixtures.length, publications: postFixtures.length, newStories: communityStories.length, newShorts: communityShorts.length });
  console.log('Reading content:', { lengths: Object.fromEntries(Object.entries(lengths).map(([format, words]) => [format, { count: words.length, min: Math.min(...words), max: Math.max(...words) }])), blockCounts });
}

validateCatalog();
async function repairReadingContent() {
  await connectToMongoDB();
  if (!/(?:dev|test|sandbox|local)/i.test(mongoose.connection.name)) throw new Error('Development seed requires an explicitly isolated database name');
  const people = await User.find({ email: { $in: userFixtures.map(user => user.email) } }).select('_id email').lean();
  const authors = new Map(people.map(user => [user.email, user._id]));
  const targets = [];
  const scopes = postFixtures.map(fixture => {
    const email = userFixtures.find(user => user.key === fixture.author).email;
    if (!authors.has(email)) throw new Error('Seed the development catalog before refreshing reading content');
    return { author: authors.get(email), title: fixture.title };
  });
  const legacyAuthor = authors.get('noah@inkrider.local');
  if (legacyAuthor) scopes.push(...legacyShorts.map(([title]) => ({ author: legacyAuthor, title })));
  const records = await Publication.find({ $or: scopes }).lean();
  // Resolve the complete owned catalog before writing; never fall back to an
  // unscoped title match or rewrite another writer's work.
  for (const fixture of postFixtures) {
    const email = userFixtures.find(user => user.key === fixture.author).email;
    if (!authors.has(email)) throw new Error('Seed the development catalog before refreshing reading content');
    const matches = records.filter(post => String(post.author) === String(authors.get(email)) && post.title === fixture.title);
    if (matches.length !== 1) throw new Error(`Missing or ambiguous development publication: ${fixture.key}`);
    targets.push({ post: matches[0], body: makeBlocks(fixture) });
  }
  for (const [index, [title, text]] of legacyShorts.entries()) {
    const matches = records.filter(post => String(post.author) === String(legacyAuthor) && post.title === title);
    if (matches.length > 1) throw new Error('Ambiguous legacy development short');
    if (!matches.length) continue;
    const fixture = { key: `legacy-${String(index + 1).padStart(2, '0')}`, format: 'short', blocks: [['text', text]] };
    fixture.blocks = enrichPublicationBody(fixture);
    const body = makeBlocks(fixture);
    const words = fixture.blocks.filter(([type]) => type !== 'image').reduce((sum, [, content]) => sum + content.trim().split(/\s+/).filter(Boolean).length, 0);
    if (!parsePostBody(body) || words > 500) throw new Error('Invalid legacy development reading body');
    targets.push({ post: matches[0], body });
  }
  let updated = 0;
  for (const { post, body } of targets) {
    if (post.body === body) continue;
    const latest = await PublicationRevision.findOne({ publicationId: post._id }).sort({ revision: -1 }).select('revision').lean();
    const revision = Math.max(post.currentRevision || 1, latest?.revision || 0) + 1;
    const snapshot = await PublicationRevision.create({ publicationId: post._id, revision, authorId: post.author, title: post.title, body, coverImage: post.coverImage, format: post.format, tags: post.tags, publicAt: post.publicAt });
    let saved;
    try {
      saved = await Publication.updateOne({ _id: post._id, currentRevision: post.currentRevision, body: post.body }, { $set: { body, currentRevision: revision } });
    } catch (error) {
      await PublicationRevision.deleteOne({ _id: snapshot._id });
      throw error;
    }
    if (saved.matchedCount !== 1) {
      await PublicationRevision.deleteOne({ _id: snapshot._id });
      throw new Error('Development publication changed during refresh; rerun after editing stops');
    }
    updated += 1;
  }
  const protectedFields = post => JSON.stringify({ ...post, body: undefined, currentRevision: undefined, updatedAt: undefined });
  const savedRecords = await Publication.find({ _id: { $in: targets.map(({ post }) => post._id) } }).lean();
  const savedById = new Map(savedRecords.map(post => [String(post._id), post]));
  const revisions = await PublicationRevision.find({ $or: savedRecords.map(post => ({ publicationId: post._id, revision: post.currentRevision })) }).lean();
  const revisionsById = new Map(revisions.map(revision => [String(revision.publicationId), revision]));
  for (const { post, body } of targets) {
    const saved = savedById.get(String(post._id));
    if (!saved || saved.body !== body || protectedFields(saved) !== protectedFields(post)) throw new Error('Reading refresh failed body or preserved-field verification');
    const revision = revisionsById.get(String(saved._id));
    if (!revision) throw new Error('Reading refresh is missing its current revision');
    if (revision && revision.body !== body) throw new Error('Reading refresh revision does not match the body');
  }
  // This body-only operation checks the fields it promises to preserve. The
  // full seed's aggregate-counter reconciliation is intentionally not run on a
  // database that may have accumulated independent reading activity.
  console.log('Development reading bodies verified:', { publications: targets.length, updated, unchanged: targets.length - updated });
}
async function repairEditorial() {
  await connectToMongoDB();
  if (!/(?:dev|test|sandbox|local)/i.test(mongoose.connection.name)) throw new Error('Development seed requires an explicitly isolated database name');
  await refreshLegacyEditorial();
  await refreshUniqueCovers();
  await verifySeed();
}
async function repairCovers() {
  await connectToMongoDB();
  if (!/(?:dev|test|sandbox|local)/i.test(mongoose.connection.name)) throw new Error('Development seed requires an explicitly isolated database name');
  await refreshUniqueCovers();
}

async function addTenStorySeries() {
  await connectToMongoDB();
  if (!/(?:dev|test|sandbox|local)/i.test(mongoose.connection.name) || /prod|live/i.test(mongoose.connection.name)) throw new Error('Ten-story series requires an isolated development database');
  const fixture = tenStorySeries;
  const authorFixture = userFixtures.find(user => user.key === fixture.author);
  const author = await User.findOne({ email: authorFixture.email }).select('_id').lean();
  if (!author) throw new Error('Seed the development author before adding the ten-story series');
  const titles = fixture.postKeys.map(key => postFixtures.find(post => post.key === key).title);
  const publications = await Publication.find({
    author: author._id, title: { $in: titles }, format: 'story', publicationStatus: 'published',
    $or: [{ publicAt: { $lte: new Date() } }, { publicAt: null }],
  }).select('_id title').lean();
  if (publications.length !== 10 || titles.some(title => publications.filter(post => post.title === title).length !== 1)) throw new Error('Seed the ten released development stories before adding their series');
  const items = titles.map((title, position) => ({ publication: publications.find(post => post.title === title)._id, position }));
  const filter = { author: author._id, title: fixture.title };
  let series = await ShortSeries.findOne(filter).lean();
  let created = false;
  if (!series) {
    const usedPhotos = new Set();
    for (const Model of [Publication, Collection, ShortSeries, Competition]) {
      for (const record of await Model.find({ coverImage: { $nin: ['', null] } }).select('coverImage').lean()) {
        if (record.coverImage) usedPhotos.add(photoIdentity(record.coverImage));
      }
    }
    const allocate = createCoverAllocator();
    let coverImage;
    let attempt = 0;
    do { coverImage = allocate(`ten-story-series:${attempt++}`, fixture) } while (usedPhotos.has(photoIdentity(coverImage)));
    series = (await ShortSeries.create({ ...filter, description: fixture.description, type: fixture.type, visibility: 'public', coverImage, items })).toObject();
    created = true;
  }
  // Reruns verify the existing record without overwriting owner edits or saves.
  const persisted = await ShortSeries.findById(series._id).lean();
  if (!persisted || persisted.type !== 'story' || persisted.visibility !== 'public' || persisted.items.length !== 10
    || persisted.items.some((item, index) => String(item.publication) !== String(items[index].publication) || item.position !== index)) throw new Error('Seed verification failed: ten-story series membership or order differs');
  if (await ShortSeries.countDocuments(filter) !== 1) throw new Error('Seed verification failed: duplicated ten-story series');
  console.log('Ten-story development series verified:', { title: persisted.title, stories: persisted.items.length, created, path: `/series/${persisted._id}` });
}
if (!process.argv.includes('--check')) (process.argv.includes('--add-story-series') ? addTenStorySeries() : process.argv.includes('--refresh-content') ? repairReadingContent() : process.argv.includes('--refresh-covers') ? repairCovers() : process.argv.includes('--refresh-editorial') ? repairEditorial() : run())
  .catch(error => {
    const detail = error.code || error.message || 'Unknown error';
    console.error(`Development seed failed during ${error.seedStage || 'startup'}:`, error.name, detail);
    process.exitCode = 1;
  }).finally(() => mongoose.disconnect());
