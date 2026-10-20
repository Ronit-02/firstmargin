// Valid, deliberately imperfect publications for exercising real reading UI.
// Invalid input belongs in request-validation tests, not in persisted fixtures.
const longStoryTitle = 'I tried to explain why the old riverside footpath still matters to our neighborhood, then kept adding details until the title became much too long for a comfortable card';
const longShortTitle = 'Three quick notes from a very ordinary walk that somehow became a surprisingly long title for a short read';
const longTag = 'observations-from-the-old-north-riverside-neighborhood';
const unbrokenWord = 'thisisoneverylongunbrokenwordthatkeepsgoingwithoutasingleplacetopauseorwrapcomfortably';

const longShortParagraphs = [
  'I meant to write a quick note about a morning walk. First I stopped beside the crossing and watched three people choose different routes around the same puddle. One person stepped into the road, another waited for a gap, and the third turned back. I wrote down the time because the puddle might be gone tomorrow, but the hesitation at that corner probably will not be.',
  'Then I noticed the signs. One pointed toward a library that had changed its entrance last month. The other used an arrow so small that it disappeared behind a parked bicycle. I almost rewrote the first observation as a complaint about signs, but the two details may belong together. Both ask someone to make a decision while moving through a place that is not quite as clear as its map.',
  'By the time I reached the square, my supposedly short note had become a list of questions. Who checks the crossing after rain? Who updates the sign when a door moves? Which route would a visitor choose if they could not easily turn back? I do not know the answers yet. The honest version of this piece leaves those questions open and describes what I actually saw.',
  'At the library I compared my notes with a neighbor’s route. She had chosen the other crossing because the curb was lower there. I had never noticed the difference. We marked both choices on the map and kept the reasons beside them. A route that looks obvious to one person may contain a quiet obstacle for someone else.',
  'The practical exercise is simple: choose one ordinary route, record its conditions, and mark every point where someone slows down or changes direction. Return at another hour. You may find that the route is not a single line but a series of small negotiations with weather, signs, traffic, and other people. That is more than a quick note can settle, even when it starts as one.',
  'On the return visit, the puddle had dried but the bicycle still blocked part of the sign. A woman carrying two bags stopped, looked toward the old entrance, and then asked someone for directions. I wrote that down without assuming she had made the same mistake I would have made. The difference between seeing a pause and knowing its cause matters, especially when the note may become a public claim about a place.',
  'The next walk has a narrower question. I want to see whether people arriving from the bus stop notice the temporary sign before reaching the old entrance. I will stand in the same place for a little while and record only the pauses and turns I can actually see. The rest can wait for a conversation.',
];

const edgeCaseFixtures = [
  {
    key: 'edge-minimal-story', author: 'maya', title: 'Wait.', tags: [], topicSlugs: ['essays'], age: 0.03,
    blocks: [['text', 'I came back. The bench was gone.']],
  },
  {
    key: 'edge-many-tags', author: 'arjun', previousTitle: 'A reading path with every tag I could think of', title: 'Follow a Question Beyond Its First Subject',
    tags: [' Design ', 'essays', 'science', 'technology', 'fiction', 'travel', 'wellness', 'public space', 'field notes', 'climate', 'urban planning', 'data literacy', 'writing craft', 'community', 'local history', 'coastal change', 'accessibility', 'reader questions', 'slower reading', longTag, 'DESIGN'],
    topicSlugs: ['technology', 'design'], age: 0.07,
    blocks: [
      ['text', 'My reading list began with a question about the street outside my home. It led to an essay about shade, a field note from a wetland, and a story about someone who missed a train. The connections were less tidy than a subject heading, but each piece changed the way I read the next.'],
      ['h2', 'What the labels can and cannot do'],
      ['text', 'Tags are useful paths into a collection of writing, but they cannot replace a clear title or an honest description. A reader should still understand the piece when the card hides most of the labels.'],
    ],
  },
  {
    key: 'edge-long-title', author: 'maya', previousTitle: longStoryTitle, title: 'The Riverside Path That Holds a Neighborhood’s Memories', tags: ['essays', 'public space', 'local memory'], topicSlugs: ['essays', 'design'], age: 0.11,
    blocks: [
      ['text', 'The riverside path is not the quickest route to the shops. It bends around an old wall and crosses a patch of uneven paving. Yet the neighbors I spoke with chose it again and again, each naming a different reason to take the longer walk.'],
      ['text', 'The story itself is about a path that changes meaning with the time of day. In the morning it is a shortcut. At dusk it is where neighbors pause for a view across the water. Neither description is wrong, but neither belongs in the title in full.'],
    ],
  },
  {
    key: 'edge-unbroken-text', author: 'arjun', previousTitle: `What happens when ${unbrokenWord}`, title: 'When a Link Tells You Nothing About Where It Goes',
    tags: ['technology', 'accessibility', 'interfaces'], topicSlugs: ['technology', 'design'], age: 0.15,
    blocks: [
      ['text', 'A message arrived with a link labeled “click here.” I knew who had sent it, but nothing about the destination. Before opening it, I had to ask a question the label could have answered.'],
      ['text', 'A useful link names its destination or the action it performs. That helps someone scanning a page, someone returning after a week, and someone navigating by a list of links. Clear language can remove a small uncertainty without adding another instruction.'],
    ],
  },
  {
    key: 'edge-unicode', author: 'leila', title: 'A café, a coast, and a question: mañana? 🌊',
    tags: ['science', 'café notes', 'mañana', 'தமிழ்', 'field notes'], topicSlugs: ['science', 'travel'], age: 0.19,
    blocks: [
      ['text', 'At the café I wrote “mañana” beside the tide time, then added தமிழ் and العربية from a conversation at the next table. The words belong to different languages, but the note belongs to one afternoon.'],
      ['quote', 'A field note can keep the exact words someone used without pretending that translation is simple.'],
      ['text', 'I asked the people at the next table to check the words before I left. They corrected one spelling and added the name of a place I had walked past twice. The note became a record of a conversation, with room for the parts I did not yet understand.'],
    ],
  },
  {
    key: 'edge-mixed-blocks', author: 'arjun', previousTitle: 'Headings, a quote, code, and one image in the same story', title: 'The Small Checks Behind a Clear Explanation',
    tags: ['technology', 'writing craft', 'code'], topicSlugs: ['technology', 'design'], age: 0.23,
    blocks: [
      ['h1', 'Start with the reader’s question'],
      ['text', 'Before adding another example, ask what the reader needs to understand next. **A clear sequence** does more work than a clever opening. Read the paragraph aloud and notice the point at which you need to explain a missing step.'],
      ['h2', 'Keep the reasoning visible'],
      ['quote', 'A quotation can be long enough to wrap over several lines without becoming the only thing on the page.'],
      ['h3', 'Make the next step explicit'],
      ['code', "const questions = ['What changed?', 'Who is affected?', 'What should happen next?'];\nquestions.forEach(question => console.log(question));"],
      ['divider', ''],
      ['image', 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80', 'Looking up between buildings toward the sky.'],
      ['text', 'A photograph can offer a pause, but its caption still needs to explain why it belongs. Every element on the page should help the reader follow the same question.'],
    ],
  },
  {
    key: 'edge-image-fallback', author: 'leila', previousTitle: 'The photo I forgot to check before publishing', title: 'What a Shoreline Photograph Leaves Out',
    tags: ['science', 'field notes', 'media'], topicSlugs: ['science'], age: 0.27,
    blocks: [
      ['text', 'The photograph made the shore look quiet and unchanged. Beyond the edge of the frame, a team was checking a marker moved by the previous night’s tide. I had captured a view, not a complete account.'],
      ['image', 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=80', 'A green landscape beneath an open sky.'],
      ['text', 'I now write the time and conditions beside each image. The caption cannot hold everything, but it can stop a passing moment from pretending to be the whole story.'],
    ],
  },
  {
    key: 'edge-rough-draft', author: 'maya', previousTitle: 'i think this is abit messy... maybe??', title: 'The Sign Was Still Pointing to the Old Door',
    tags: ['essays', 'design', 'wayfinding'], topicSlugs: ['essays', 'design'], age: 0.31,
    blocks: [
      ['text', 'The entrance moved in June. By September, the arrow beside the crossing still pointed toward the old door. Most regular visitors had learned the new route, which made the mistake easy to overlook.'],
      ['text', 'I watched three people pause beneath it in one afternoon. Two asked for directions. The third walked the long way around the building and arrived at the new entrance looking annoyed.'],
      ['quote', 'A familiar route can hide an unfamiliar person’s problem.'],
      ['text', 'The next week a temporary notice covered the arrow. It was handwritten, dated, and clear. A permanent replacement could wait a little longer because someone had finally answered the immediate question.'],
    ],
  },
  {
    key: 'edge-tiny-short', author: 'priya', title: 'Oh! 👀', format: 'short', tags: [], topicSlugs: ['essays'], age: 0.35,
    blocks: [['text', 'Look again.']],
  },
  {
    key: 'edge-long-short-title', author: 'arjun', previousTitle: longShortTitle, title: 'Three Things I Missed on a Familiar Walk', format: 'short',
    tags: ['technology', 'design', 'one-small-idea', longTag], topicSlugs: ['technology', 'design'], age: 0.39,
    blocks: [['text', 'The bakery had a new sign, the bus stop had moved, and the old bench had finally been repaired. I almost missed all three because I was looking at the route on my phone. The next morning I put it away for the familiar part of the walk. Knowing where I was going turned out to leave plenty of room for noticing where I was.']],
  },
  {
    key: 'edge-long-short-body', author: 'leila', title: 'The quick note that kept growing', format: 'short',
    tags: ['science', 'field notes', 'long read'], topicSlugs: ['science', 'travel'], age: 0.43,
    blocks: longShortParagraphs.map(paragraph => ['text', paragraph]),
  },
  {
    key: 'edge-multiline-short', author: 'maya', previousTitle: 'Wait—what did I mean by that?', title: 'What Did I Mean by That?', format: 'short',
    tags: ['essays', 'notebooks', 'observation'], topicSlugs: ['essays'], age: 0.47,
    blocks: [
      ['text', 'First note: the door was open.\nSecond note: I forgot why I wrote that down.'],
      ['quote', 'Maybe the question is more useful than the answer?'],
      ['text', 'I returned the next morning and understood the note. The door had been closed for years. Sometimes an observation needs a second visit before it becomes a sentence you can explain.'],
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
    key: 'edge-informal-question', author: 'priya', previousText: 'wait, why is this sign here??', text: 'Why does the old sign still point toward a closed entrance?', context: 'The library moved its entrance, but the sign at the crossing has not changed. Who usually owns this kind of update?',
    tags: [], voters: ['priya'], related: [], status: 'open',
  },
];

const edgeDraftFixtures = [
  {
    author: 'maya', previousTitle: `${longStoryTitle.slice(0, 160)} \u2014 draft notes`, title: 'Draft: Returning to the Riverside Path', format: 'story', tags: ['essays', 'design', 'draft notes'],
    blocks: [
      ['h1', 'Need a better opening'],
      ['text', 'I think the path matters because it is used differently at different hours. This sentence is too broad. Find the actual person and the exact moment.'],
      ['quote', 'CHECK QUOTE WITH NEIGHBOR BEFORE PUBLISHING'],
      ['text', 'The last paragraph is still missing...'],
    ],
  },
  {
    author: 'leila', previousTitle: 'not done yet?? 🌊', title: 'Before the Tide Turns', format: 'short', tags: ['science', 'field notes'],
    blocks: [['text', 'Check the tide time against yesterday’s notebook. The sheltered channel looked different this morning, but the wind had changed too. Return from the same marker before deciding which difference matters.']],
  },
];

const edgeCollectionFixtures = [
  { previousTitle: 'OK', title: 'One Small Reminder', description: 'A tiny reminder to look twice before moving on.', author: 'priya', visibility: 'public', postKeys: ['edge-tiny-short'], saved: [], followed: [] },
  { previousTitle: 'Still collecting...', title: 'Places to Return To', description: 'A new shelf for essays about familiar places. The first few stories are still on my reading list.', author: 'noah', visibility: 'public', postKeys: [], saved: [], followed: [] },
  {
    previousTitle: 'A long collection title about places, drafts, field notes, and questions that keep growing', title: 'The Questions We Carry Home',
    description: 'A reading path through public space, notebooks, clear explanations, and the questions that deserve another visit. Begin with a brief observation, then follow the longer pieces wherever your attention leads.',
    author: 'maya', visibility: 'public',
    postKeys: ['edge-minimal-story', 'edge-tiny-short', 'edge-long-title', 'edge-unbroken-text', 'edge-unicode', 'edge-mixed-blocks', 'edge-image-fallback', 'edge-rough-draft', 'edge-long-short-title', 'edge-long-short-body', 'edge-multiline-short', 'square-seating'],
    saved: ['noah', 'priya'], followed: ['noah'],
  },
];

const edgeSeriesFixtures = [
  {
    previousTitle: 'A long series title about observations, unfinished sentences, and routes we almost forgot to take', title: 'Returning to the Riverside',
    description: 'Two ways of returning to a familiar place: a brief moment of absence and a longer account of a riverside path that holds several neighborhood memories.',
    author: 'maya', type: 'story', postKeys: ['edge-minimal-story', 'edge-long-title'], saved: ['priya'],
  },
];

module.exports = { edgeCaseFixtures, edgeQuestionFixtures, edgeDraftFixtures, edgeCollectionFixtures, edgeSeriesFixtures };
