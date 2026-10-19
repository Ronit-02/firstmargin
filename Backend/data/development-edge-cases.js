// Valid, deliberately imperfect publications for exercising real reading UI.
// Invalid input belongs in request-validation tests, not in persisted fixtures.
const longStoryTitle = 'I tried to explain why the old riverside footpath still matters to our neighborhood, then kept adding details until the title became much too long for a comfortable card';
const longShortTitle = 'Three quick notes from a very ordinary walk that somehow became a surprisingly long title for a short read';
const longTag = 'observations-from-the-old-north-riverside-neighborhood';
const unbrokenWord = 'thisisoneverylongunbrokenwordthatkeepsgoingwithoutasingleplacetopauseorwrapcomfortably';
const longUrl = `https://example.test/${'a-very-long-path-segment-with-no-obvious-break-'.repeat(6)}`;

const longShortParagraphs = [
  'I meant to write a quick note about a morning walk. First I stopped beside the crossing and watched three people choose different routes around the same puddle. One person stepped into the road, another waited for a gap, and the third turned back. I wrote down the time because the puddle might be gone tomorrow, but the hesitation at that corner probably will not be.',
  'Then I noticed the signs. One pointed toward a library that had changed its entrance last month. The other used an arrow so small that it disappeared behind a parked bicycle. I almost rewrote the first observation as a complaint about signs, but the two details may belong together. Both ask someone to make a decision while moving through a place that is not quite as clear as its map.',
  'By the time I reached the square, my supposedly short note had become a list of questions. Who checks the crossing after rain? Who updates the sign when a door moves? Which route would a visitor choose if they could not easily turn back? I do not know the answers yet. The honest version of this piece leaves those questions open and describes what I actually saw.',
  'I also copied one sentence twice in my notebook. That kind of mistake is useful to notice before publishing because repetition can sound like emphasis when it is only a paste error. I kept the idea once here and left this reminder in the draft. The next walk will tell me whether the first detail was unusual or part of a pattern.',
  'The practical exercise is simple: choose one ordinary route, record its conditions, and mark every point where someone slows down or changes direction. Return at another hour. You may find that the route is not a single line but a series of small negotiations with weather, signs, traffic, and other people. That is more than a quick note can settle, even when it starts as one.',
  'On the return visit, the puddle had dried but the bicycle still blocked part of the sign. A woman carrying two bags stopped, looked toward the old entrance, and then asked someone for directions. I wrote that down without assuming she had made the same mistake I would have made. The difference between seeing a pause and knowing its cause matters, especially when the note may become a public claim about a place.',
  'I could cut this down to a neat tip, but the extra observations show why a short can still need room to breathe. The first version had a typo in the street name and an arrow drawn the wrong way. I corrected both after checking the sign. Keeping the working notes reminds me that careful writing is partly a record of corrections, not only a polished final sentence.',
];

const edgeCaseFixtures = [
  {
    key: 'edge-minimal-story', author: 'maya', title: 'Wait.', tags: [], topicSlugs: ['essays'], age: 0.03,
    blocks: [['text', 'I came back. The bench was gone.']],
  },
  {
    key: 'edge-many-tags', author: 'arjun', title: 'A reading path with every tag I could think of',
    tags: [' Design ', 'essays', 'science', 'technology', 'fiction', 'travel', 'wellness', 'public space', 'field notes', 'climate', 'urban planning', 'data literacy', 'writing craft', 'community', 'local history', 'coastal change', 'accessibility', 'reader questions', 'slower reading', longTag, 'DESIGN'],
    topicSlugs: ['technology', 'design'], age: 0.07,
    blocks: [
      ['text', 'I added too many tags to this piece. Some describe its subject, some describe the way I researched it, and one is probably a category I should have removed. That is a common publishing mistake, and it changes how a reader encounters a story in search.'],
      ['h2', 'What the labels can and cannot do'],
      ['text', 'Tags are useful paths into a collection of writing, but they cannot replace a clear title or an honest description. A reader should still understand the piece when the card hides most of the labels.'],
    ],
  },
  {
    key: 'edge-long-title', author: 'maya', title: longStoryTitle, tags: ['essays', 'public space', 'editing'], topicSlugs: ['essays', 'design'], age: 0.11,
    blocks: [
      ['text', 'The title grew every time I tried to explain another part of the story. It now carries more information than a title should, which makes it useful for checking how cards, menus, browser tabs, and share dialogs handle a long line.'],
      ['text', 'The story itself is about a path that changes meaning with the time of day. In the morning it is a shortcut. At dusk it is where neighbors pause for a view across the water. Neither description is wrong, but neither belongs in the title in full.'],
    ],
  },
  {
    key: 'edge-unbroken-text', author: 'arjun', title: `What happens when ${unbrokenWord}`,
    tags: ['technology', 'layout', 'longwordwithoutanyspacesatall'], topicSlugs: ['technology', 'design'], age: 0.15,
    blocks: [
      ['text', `A reader pasted a long address into the draft: ${longUrl} The link is plain text here, but it still has to wrap inside the reading column without widening the page.`],
      ['text', `The same problem appears in names and invented words: ${unbrokenWord.repeat(2)}. It is an awkward thing to publish, but a useful thing to test at narrow widths.`],
    ],
  },
  {
    key: 'edge-unicode', author: 'leila', title: 'A café, a coast, and a question: mañana? 🌊',
    tags: ['science', 'café notes', 'mañana', 'தமிழ்', 'field notes'], topicSlugs: ['science', 'travel'], age: 0.19,
    blocks: [
      ['text', 'At the café I wrote “mañana” beside the tide time, then added தமிழ் and العربية from a conversation at the next table. The words belong to different languages, but the note belongs to one afternoon.'],
      ['quote', 'A field note can keep the exact words someone used without pretending that translation is simple.'],
      ['text', 'Names, accents, right-to-left text, and emoji should remain readable in the title, body, tags, search results, and share labels. I still need to check the spelling with the people who said the words.'],
    ],
  },
  {
    key: 'edge-mixed-blocks', author: 'arjun', title: 'Headings, a quote, code, and one image in the same story',
    tags: ['technology', 'writing craft', 'code'], topicSlugs: ['technology', 'design'], age: 0.23,
    blocks: [
      ['h1', 'A heading before the first paragraph'],
      ['text', 'This line uses **bold**, *italic*, and an unfinished **marker that should stay visible. The literal text <b>not HTML</b> should be escaped by the reader.'],
      ['h2', 'A smaller section'],
      ['quote', 'A quotation can be long enough to wrap over several lines without becoming the only thing on the page.'],
      ['h3', 'A compact heading'],
      ['code', `const note = 'keep the meaning clear';\nconst longValue = '${unbrokenWord.repeat(3)}';\nconsole.log(note, longValue);`],
      ['divider', ''],
      ['image', 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80', 'A street scene beneath tall buildings, included to test descriptive image text.'],
      ['text', 'After the divider and image, the reader should return to the same text width and rhythm.'],
    ],
  },
  {
    key: 'edge-image-fallback', author: 'leila', title: 'The photo I forgot to check before publishing',
    tags: ['science', 'field notes', 'media'], topicSlugs: ['science'], age: 0.27,
    blocks: [
      ['text', 'I attached a picture and wrote useful alternative text, but the image address no longer works. A reader should still understand what the missing picture was meant to show.'],
      ['image', 'https://fixture-image.example.invalid/missing-shoreline.jpg', 'A low-tide shoreline with exposed stones and a narrow channel of water.'],
      ['text', 'This is a deliberate broken-media fixture. The paragraph after it should remain readable and the image fallback should not collapse the page.'],
    ],
  },
  {
    key: 'edge-rough-draft', author: 'maya', title: 'i think this is abit messy... maybe??',
    tags: [' Essays ', 'desgin', 'ESSAYS', 'unfinished thoughts'], topicSlugs: ['essays', 'design'], age: 0.31,
    blocks: [
      ['text', 'I went back to the same street and, um, noticed the sign again. It was still there... I should probaly check who put it up before I say anything more.'],
      ['text', 'The notes have   extra spaces, odd punctuation!!! and a sentence that trails off because I have not decided what I mean yet. Maybe the point is—'],
      ['quote', 'Need to verify this quote before using it in a real story.'],
      ['text', 'Readers write imperfectly while thinking. This published demo is intentionally rough so the app can be checked with plausible mistakes as well as polished copy.'],
    ],
  },
  {
    key: 'edge-tiny-short', author: 'priya', title: 'Oh! 👀', format: 'short', tags: [], topicSlugs: ['essays'], age: 0.35,
    blocks: [['text', 'Look again.']],
  },
  {
    key: 'edge-long-short-title', author: 'arjun', title: longShortTitle, format: 'short',
    tags: ['technology', 'design', 'one-small-idea', longTag], topicSlugs: ['technology', 'design'], age: 0.39,
    blocks: [['text', 'This short has more title than explanation. The body is still a useful test: a single paragraph should fit naturally beneath a title that needs two lines on a narrow card, and its tags should remain complete in the reader.']],
  },
  {
    key: 'edge-long-short-body', author: 'leila', title: 'The quick note that kept growing', format: 'short',
    tags: ['science', 'field notes', 'long read'], topicSlugs: ['science', 'travel'], age: 0.43,
    blocks: longShortParagraphs.map(paragraph => ['text', paragraph]),
  },
  {
    key: 'edge-multiline-short', author: 'maya', title: 'Wait—what did I mean by that?', format: 'short',
    tags: ['essays', 'memo', 'typo'], topicSlugs: ['essays'], age: 0.47,
    blocks: [
      ['text', 'First note: the door was open.\nSecond note: I forgot why I wrote that down.'],
      ['quote', 'Maybe the question is more useful than the answer?'],
      ['text', 'A line break, a dash, a question mark, and a small correction can all appear in a genuine short draft.'],
    ],
  },
];

const edgeQuestionFixtures = [
  {
    key: 'edge-long-question', author: 'noah',
    text: 'How could a city make a confusing crossing safer for a visitor who cannot read the sign, moves slowly, and arrives after dark when the pavement is wet and the route is closed?',
    context: 'I tried the route twice and got different answers from the signs. The first sign pointed to an entrance that had moved; the second was partly hidden by a bicycle. A friend using a cane said the crossing felt different after rain. I may have the street name wrong in my notes, so I would like an answer that explains what to observe before proposing a fix, rather than treating my first impression as a complete diagnosis.',
    tags: ['design', 'accessibility', 'public space', 'urban life', 'route-finding'], voters: ['noah', 'priya', 'maya'], related: ['edge-long-title'], status: 'answered',
    answers: [
      ['maya', 'I would visit at the same hour on a dry day and a wet day, note where people pause, and ask the maintenance team when the signs were last checked. The entrance change may be the simplest place to start.', ['priya']],
      ['arjun', 'Before changing the crossing, check whether the map, sign, and actual route agree. A clear temporary notice can help while a permanent repair is planned.', []],
    ],
  },
  {
    key: 'edge-informal-question', author: 'priya', text: 'wait, why is this sign here??', context: '',
    tags: [], voters: ['priya'], related: [], status: 'open',
  },
];

const edgeDraftFixtures = [
  {
    author: 'maya', title: `${longStoryTitle.slice(0, 160)} — draft notes`, format: 'story', tags: [' Essays ', 'DESIGN', 'desgin', 'draft notes'],
    blocks: [
      ['h1', 'Need a better opening'],
      ['text', 'I think the path matters because it is used differently at different hours. This sentence is too broad. Find the actual person and the exact moment.'],
      ['quote', 'CHECK QUOTE WITH NEIGHBOR BEFORE PUBLISHING'],
      ['text', 'The last paragraph is still missing...'],
    ],
  },
  {
    author: 'leila', title: 'not done yet?? 🌊', format: 'short', tags: ['science', 'feild notes', 'science'],
    blocks: [['text', 'Tide time? Check notebook. I wrote this quickly and left the spelling mistake in the tag so the draft list can be tested with ordinary unfinished work.']],
  },
];

const edgeCollectionFixtures = [
  { title: 'OK', description: '', author: 'priya', visibility: 'public', postKeys: ['edge-tiny-short'], saved: [], followed: [] },
  { title: 'Still collecting...', description: 'An intentionally empty collection that a reader created before choosing any stories.', author: 'noah', visibility: 'public', postKeys: [], saved: [], followed: [] },
  {
    title: 'A long collection title about places, drafts, field notes, and questions that keep growing',
    description: 'I started this as a tidy list and then kept adding things. The order moves from a one-line observation to a long short read, a broken image, and several fuller stories. Some tags are misspelled; one title is too long; another piece has no tags at all. That is the point of this demo collection: it lets us see how the same mixed reading list behaves on a phone, in search, and on a detail page without making every entry look polished.',
    author: 'maya', visibility: 'public',
    postKeys: ['edge-minimal-story', 'edge-tiny-short', 'edge-long-title', 'edge-unbroken-text', 'edge-unicode', 'edge-mixed-blocks', 'edge-image-fallback', 'edge-rough-draft', 'edge-long-short-title', 'edge-long-short-body', 'edge-multiline-short', 'square-seating'],
    saved: ['noah', 'priya'], followed: ['noah'],
  },
];

const edgeSeriesFixtures = [
  {
    title: 'A long series title about observations, unfinished sentences, and routes we almost forgot to take',
    description: 'Two very different story lengths in one ordered path. The first is a few words; the second has a title that nearly fills the publishing limit. This series helps check previews and navigation when chapter names do not share a tidy shape.',
    author: 'maya', type: 'story', postKeys: ['edge-minimal-story', 'edge-long-title'], saved: ['priya'],
  },
];

module.exports = { edgeCaseFixtures, edgeQuestionFixtures, edgeDraftFixtures, edgeCollectionFixtures, edgeSeriesFixtures };
