const crypto = require('crypto');
const { photos } = require('./development-covers.json');

const photoIdentity = value => {
  const url = new URL(value);
  return `${url.hostname}${url.pathname}`;
};
const topicRules = [
  [/lamp|lighting/, ['lamp', 'desk', 'home']],
  [/bench|seating/, ['bench', 'street', 'architecture']],
  [/reef|ocean|coast|shore|tide|marsh|wetland|breakwater|wave/, ['reef', 'coast', 'sea', 'lake']],
  [/train|rail|platform|station|departure|arrival/, ['train', 'travel', 'street']],
  [/recipe|cook|kitchen|food|tomato|breakfast/, ['food', 'coffee', 'home']],
  [/coffee|cup|caf[eé]|tea/, ['coffee', 'food', 'home']],
  [/bird|wildlife/, ['birds', 'forest', 'garden']],
  [/tree|forest|garden|nature|season|ecology|field note/, ['forest', 'garden', 'birds', 'coast']],
  [/rain|storm|weather|cloud/, ['rain', 'weather', 'coast']],
  [/library|librar|bookshop|book|reading|read aloud/, ['books', 'reading', 'writing']],
  [/market|shop|stall/, ['market', 'street', 'community']],
  [/home|room|chair|door|neighbor|belong/, ['home', 'architecture', 'community']],
  [/bench|city|cities|street|crossing|walk|public space|route|pavement|shade/, ['street', 'architecture', 'walking', 'community']],
  [/map|journey|travel|landscape/, ['maps', 'travel', 'mountains', 'lake']],
  [/code|software|app|data|model|dashboard|metric|chart|recommend|digital|technology|interface|form|notification|system/, ['technology', 'data', 'desk', 'design']],
  [/lamp|repair|object|design|craft|creative/, ['design', 'desk', 'art', 'architecture']],
  [/friend|family|conversation|community|together/, ['community', 'coffee', 'home']],
  [/rest|wellness|slow|morning|evening|attention/, ['lake', 'light', 'walking', 'garden']],
  [/essay|draft|note|write|writing|question|fiction|story|sentence|paragraph/, ['writing', 'reading', 'books', 'art']],
];
const stableNumber = value => crypto.createHash('sha256').update(value).digest().readUInt32BE(0);

function createCoverAllocator() {
  const used = new Set();
  const assignments = new Map();
  return (key, { title = '', tags = [], description = '' } = {}) => {
    if (assignments.has(key)) return assignments.get(key);
    const titleText = title.toLowerCase();
    const context = `${title} ${tags.join(' ')} ${description}`.toLowerCase();
    const rules = topicRules.filter(([pattern]) => pattern.test(context));
    const primary = topicRules.find(([pattern]) => pattern.test(titleText))?.[1] || rules[0]?.[1] || ['writing', 'books', 'light'];
    const secondary = new Set(rules.flatMap(([, topics]) => topics));
    const words = new Set(titleText.match(/[a-z]{4,}/g) || []);
    const candidates = photos.filter(photo => !used.has(photo.photo)).map(photo => {
      const primaryIndex = primary.findIndex(topic => photo.topics.includes(topic));
      let score = primaryIndex < 0 ? 0 : 100 - primaryIndex * 12;
      if (photo.topics.some(topic => secondary.has(topic))) score += 15;
      const caption = photo.description.toLowerCase();
      for (const word of words) if (caption.includes(word)) score += 4;
      return { photo, score, tie: stableNumber(`${key}:${photo.photo}`) };
    }).sort((a, b) => b.score - a.score || a.tie - b.tie || a.photo.photo.localeCompare(b.photo.photo));
    const chosen = candidates[0]?.photo;
    if (!chosen) throw new Error('Development cover catalog exhausted; add distinct photos before seeding more records');
    used.add(chosen.photo);
    const url = `https://images.unsplash.com/${chosen.photo}?auto=format&fit=crop&w=1400&q=80`;
    assignments.set(key, url);
    return url;
  };
}

module.exports = { createCoverAllocator, photoIdentity };
