const Publication = require('../schemas/publication.schema');
const Profile = require('../schemas/profile.schema');
const { publicPostClause } = require('../services/publication-access.service');
const { buildRobotsTxt, buildSitemapXml, publicSitemapEntries } = require('../services/seo.service');

const robots = (req, res) => res.type('text/plain').send(buildRobotsTxt());

const sitemap = async (req, res) => {
  try {
    const [posts, profiles] = await Promise.all([
      Publication.find(publicPostClause()).select('_id publicAt updatedAt').sort({ updatedAt: -1 }).limit(50_000).lean(),
      Profile.find({ writerStatus: 'writer' }).select('handle updatedAt').sort({ handle: 1 }).limit(10_000).lean(),
    ]);
    return res.type('application/xml').send(buildSitemapXml({ entries: publicSitemapEntries({ posts, profiles }) }));
  } catch {
    return res.status(503).type('text/plain').send('Sitemap temporarily unavailable');
  }
};

module.exports = { robots, sitemap };
