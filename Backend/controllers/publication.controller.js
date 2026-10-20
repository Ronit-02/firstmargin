const fs = require("fs")
const crypto = require('crypto');
const mongoose = require('mongoose');
const Publication = require('../schemas/publication.schema');
const Save = require('../schemas/save.schema');
const Appreciation = require('../schemas/appreciation.schema');
const Profile = require('../schemas/profile.schema');
const Topic = require('../schemas/topic.schema');
const Follow = require('../schemas/follow.schema');
const UserInterest = require('../schemas/user-interest.schema');
const Question = require('../schemas/question.schema');
const ShortSeries = require('../schemas/short-series.schema');
const PublicationRevision = require('../schemas/publication-revision.schema');
const { uploadOnCloudinary } = require('../utils/cloudinary');
const { encodeCursor, decodeCursor } = require('../utils/cursor');
const { presentDiscoveryPosts } = require('../services/publication-presenter.service');
const { rankCandidates } = require('../services/recommendation.service');
const { hasCapability } = require('../services/entitlement.service');
const { notify } = require('../services/notification.service');

const MAX_LEGACY_POST_LIST_LIMIT = 100;
const DEFAULT_LEGACY_POST_LIST_LIMIT = 24;
const MAX_PERSONALIZED_CANDIDATES = 120;
const discoveryPostFields = 'coverImage title format body author tags appreciationsCount commentsCount createdAt';
const personalizedCandidateFields = 'author topics createdAt appreciationsCount';

const publicAccessClause = (now = new Date()) => ({
    publicationStatus: { $ne: 'unpublished' },
    $or: [{ publicAt: { $lte: now } }, { publicAt: null }, { publicAt: { $exists: false } }],
});

const supportedBlockTypes = new Set([
    'text',
    'h1',
    'h2',
    'h3',
    'quote',
    'code',
    'image',
    'divider',
]);

const isSafeImageUrl = (value) => {
    if (typeof value !== 'string' || value.length > 2_048) return false;
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol)
            && Boolean(url.hostname)
            && !url.username
            && !url.password;
    } catch {
        return false;
    }
};

const parsePostBody = (body) => {
    let blocks;
    try {
        blocks = JSON.parse(body);
    }
    catch(error) {
        return null;
    }

    if(!Array.isArray(blocks) || blocks.length === 0 || blocks.length > 500) return null;
    const ids = new Set();
    const isValid = blocks.every(block => (
        block
        && typeof block.id === 'string'
        && /^[a-zA-Z0-9_-]{1,80}$/.test(block.id)
        && !ids.has(block.id)
        && supportedBlockTypes.has(block.type)
        && typeof block.content === 'string'
        && (block.alt == null || (typeof block.alt === 'string' && block.alt.length <= 300))
        && block.content.length <= (block.type === 'code' ? 50_000 : 10_000)
        && (block.type !== 'divider' || block.content === '')
        && (block.type !== 'image' || isSafeImageUrl(block.content))
        && Boolean(ids.add(block.id))
    ));

    return isValid ? blocks : null;
};

const parseLegacyPostListQuery = query => {
    const sort = String(query.sort || 'date').toLowerCase();
    const sortFields = { views: 'metadata.views', likes: 'appreciationsCount', date: 'createdAt' };
    if (!sortFields[sort]) return null;

    const requestedLimit = Number.parseInt(query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), MAX_LEGACY_POST_LIST_LIMIT)
        : DEFAULT_LEGACY_POST_LIST_LIMIT;
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    if (query.cursor && !cursor) return null;

    if (cursor) {
        if (!mongoose.isValidObjectId(cursor.id)) return null;
        if (sort === 'date') {
            const createdAt = new Date(cursor.value);
            if (Number.isNaN(createdAt.getTime())) return null;
            cursor.value = createdAt;
        } else if (!Number.isFinite(cursor.value) || cursor.value < 0) {
            return null;
        }
    }

    return { sort, sortField: sortFields[sort], limit, cursor };
};

const loadDiscoveryPostPage = async (publicationIds, viewerId) => {
    if (!publicationIds.length) return [];
    const documents = await Publication.find({ _id: { $in: publicationIds } })
        .select(discoveryPostFields)
        .populate({ path: 'author', select: 'picture username' })
        .lean();
    const documentsById = new Map(documents.map(document => [document._id.toString(), document]));
    const orderedDocuments = publicationIds
        .map(publicationId => documentsById.get(publicationId.toString()))
        .filter(Boolean);
    return presentDiscoveryPosts(orderedDocuments, viewerId);
};

const applyAuthorProfile = (author, profile) => {
    if (!author) return author;
    author.handle = profile?.handle || null;
    author.picture = profile?.avatarUrl || author.picture || null;
    author.username = profile?.displayName || author.username || 'Unknown writer';
    author.bio = profile?.bio || author.bio || '';
    return author;
};

const attachAuthorHandles = async posts => {
    const authorIds = posts.map(post => post.author?._id).filter(Boolean);
    const profiles = await Profile.find({ userId: { $in: authorIds } }).select('userId handle displayName avatarUrl bio');
    const profilesByUser = new Map(profiles.map(profile => [profile.userId.toString(), profile]));

    return posts.map(post => {
        const data = post.toObject();
        if (data.author?._id) applyAuthorProfile(data.author, profilesByUser.get(data.author._id.toString()));
        return data;
    });
};

const createPost = async (req, res) => {

    let localImagePath = null;

    try{
        // post data is sent in request body
        const { title, tags, body, questionId, depthParentId } = req.body;
        const format = req.body.format || 'story';
        localImagePath = req.file?.path || null;

        // Check for required files
        if(!['story', 'short'].includes(format))
            return res.status(400).json({success: false, message: 'Invalid post format'})
        if(!title)
            return res.status(400).json({success: false, message: 'Title is required'})
        if(!body)
            return res.status(400).json({success: false, message: 'Content is required'})

        const normalizedTitle = title.trim();
        if(!normalizedTitle || normalizedTitle.length > (format === 'short' ? 120 : 180))
            return res.status(400).json({success: false, message: `Title must be between 1 and ${format === 'short' ? 120 : 180} characters`})

        const parsedBody = parsePostBody(body);
        if(!parsedBody)
            return res.status(400).json({success: false, message: 'Content contains unsupported or invalid blocks'})
        const wordCount = parsedBody.reduce((count, block) => (
            count + String(block.content || '').trim().split(/\s+/).filter(Boolean).length
        ), 0);
        if(format === 'short' && wordCount > 500)
            return res.status(400).json({success: false, message: 'Short posts cannot exceed 500 words'})

        const decodedTags = String(tags || '')
            .split(',')
            .map(tag => tag.trim().toLowerCase())
            .filter(Boolean);

        // Picking user id from token
        const author = req.auth.userId;
        let publicAt = new Date();
        if (req.body.publicAt) {
            publicAt = new Date(req.body.publicAt);
            if (Number.isNaN(publicAt.getTime()) || publicAt.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) return res.status(400).json({ success: false, message: 'Public release must be within the next 30 days' });
            if (publicAt > new Date() && !await hasCapability(author, 'early_access')) return res.status(403).json({ code: 'ENTITLEMENT_REQUIRED', message: 'Early release scheduling requires membership' });
        }

        let sourceQuestion = null;
        if (questionId) {
            if (!mongoose.isValidObjectId(questionId)) return res.status(400).json({ success: false, message: 'Invalid source question' });
            sourceQuestion = await Question.findOne({ _id: questionId, status: { $ne: 'closed' } }).select('_id');
            if (!sourceQuestion) return res.status(404).json({ success: false, message: 'Source question not found' });
        }

        let depthParent = null;
        if (depthParentId) {
            if (format !== 'short' || !mongoose.isValidObjectId(depthParentId)) return res.status(400).json({ success: false, message: 'Invalid deeper story link' });
            depthParent = await Publication.findOne({ _id: depthParentId, author, format: { $ne: 'short' } }).select('_id');
            if (!depthParent) return res.status(404).json({ success: false, message: 'Owned deeper story not found' });
        }

        const matchedTopics = await Topic.find({
            status: 'active',
            $or: [
                { slug: { $in: decodedTags } },
                { aliases: { $in: decodedTags } },
            ],
        }).select('_id');

        // Extracting file path and adding to cloudinary
        if (localImagePath && req.body.coverImageUrl) return res.status(400).json({ success: false, message: 'Choose an uploaded image or an image URL' });
        let linkedCover = null;
        if (req.body.coverImageUrl) { try { const url = new URL(req.body.coverImageUrl); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.toString().length > 2000) throw new Error('Invalid URL'); linkedCover = url.toString(); } catch { return res.status(400).json({ success: false, message: 'Cover image must be a valid HTTP(S) URL' }); } }
        const result = localImagePath ? await uploadOnCloudinary(localImagePath) : null;
        const coverUploadFailed = Boolean(localImagePath && !result?.secure_url);
    
        const post = new Publication({
            coverImage: result?.secure_url || linkedCover,
            title: normalizedTitle,
            format,
            body: JSON.stringify(parsedBody),
            author,
            tags: decodedTags,
            topics: matchedTopics.map(topic => topic._id),
            sourceQuestion: sourceQuestion?._id || null,
            depthParent: depthParent?._id || null,
            publicAt,
        });
    
        await post.save();
        try {
            await PublicationRevision.create({ publicationId: post._id, revision: 1, authorId: author, title: post.title, body: post.body, coverImage: post.coverImage, format: post.format, tags: post.tags, publicAt: post.publicAt });
        } catch (revisionError) {
            await Publication.deleteOne({ _id: post._id });
            throw revisionError;
        }

        let responseLinked = false;
        if (sourceQuestion) {
            try {
                await Question.updateOne(
                    { _id: sourceQuestion._id },
                    { $addToSet: { relatedPublications: post._id }, $set: { status: 'answered' } }
                );
                responseLinked = true;
                const questionOwner = await Question.findById(sourceQuestion._id).select('author');
                if (questionOwner) await notify({ recipientId: questionOwner.author, actorId: author, type: 'question_answered', title: 'Your question has a new story', body: normalizedTitle, href: `/post/${post._id}`, entityType: 'publication', entityId: post._id });
            } catch {
                console.error(`[${req.requestId}] Published post needs question-link repair`);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Publication created successfully', 
            publicationId: post._id,
            coverUploadFailed,
            responseLinked,
        });
    }
    catch(error){
        console.error(`[${req.requestId}] Publication creation failed`);
        return res.status(500).json({ 
            success: false, 
            message: 'Unable to create post'
        });
    }
    finally {
        if(localImagePath && fs.existsSync(localImagePath)) {
            try {
                fs.unlinkSync(localImagePath);
            }
            catch(cleanupError) {
                console.error('Unable to clean up temporary upload');
            }
        }
    }
};

const getPost = async (req, res) => {

    try{
        // post id is sent in request parameter
        const publicationId = req.params.id;
        let isBookmarked = false;
        let isAppreciated = false;
        let isEarlyAccess = false;

        if(!mongoose.isValidObjectId(publicationId)) {
            return res.status(400).json({ success: false, message: 'Invalid post id' });
        }

        // Fetching post
        const post = await Publication.findById(publicationId)
            .populate({
                path: 'author', 
                select: 'picture username bio'
            })

        if(!post){
            return res.status(404).json({
                success: false,
                message: 'Publication not found'
            });
        }
        if (post.publicationStatus === 'unpublished' && req.auth?.userId !== post.author?._id?.toString()) return res.status(404).json({ success: false, message: 'Publication not found' });
        if (post.publicAt && post.publicAt > new Date() && req.auth?.userId !== post.author?._id?.toString()) {
            if (!req.auth || !await hasCapability(req.auth.userId, 'early_access')) return res.status(404).json({ success: false, message: 'Publication not found' });
            isEarlyAccess = true;
        }

        // Optional auth check
        // if user is logged in, then we can check if the post is saved by the user or not
        if(req.auth){
            const [savedPost, likedPost] = await Promise.all([
                Save.findOne({ userId: req.auth.userId, publicationId }).select('_id'),
                Appreciation.findOne({ userId: req.auth.userId, publicationId }).select('_id'),
            ]);
            isBookmarked = Boolean(savedPost);
            isAppreciated = Boolean(likedPost);
        }

        const postData = post.toObject();
        postData.isEarlyAccess = isEarlyAccess;
        postData.isBookmarked = isBookmarked;
        postData.isAppreciated = isAppreciated;
        postData.isOwner = Boolean(req.auth?.userId && req.auth.userId === post.author?._id?.toString());
        postData.canAddToSeries = Boolean(postData.isOwner && post.publicationStatus !== 'unpublished' && (!post.publicAt || post.publicAt <= new Date()));
        if (post.author?._id) {
            const authorProfile = await Profile.findOne({ userId: post.author._id }).select('handle displayName avatarUrl bio');
            applyAuthorProfile(postData.author, authorProfile);
        }
        const visibilityFilter = req.auth
            ? { $or: [{ visibility: { $in: ['public', 'unlisted'] } }, { author: req.auth.userId }] }
            : { visibility: { $in: ['public', 'unlisted'] } };
        const series = await ShortSeries.findOne({ 'items.publication': post._id, ...visibilityFilter })
            .select('title items author')
            .populate({ path: 'items.publication', select: 'title publicationStatus publicAt' });
        if (series) {
            const owner = req.auth?.userId === series.author?.toString();
            const now = new Date();
            const entries = [...series.items]
                .sort((left, right) => left.position - right.position)
                .filter(item => item.publication && (owner || (item.publication.publicationStatus !== 'unpublished' && (!item.publication.publicAt || item.publication.publicAt <= now))));
            const position = entries.findIndex(item => item.publication._id.toString() === post._id.toString());
            postData.seriesContext = {
                id: series._id,
                title: series.title,
                position,
                total: entries.length,
                previous: position > 0 ? { id: entries[position - 1].publication._id, title: entries[position - 1].publication.title } : null,
                next: position >= 0 && position < entries.length - 1 ? { id: entries[position + 1].publication._id, title: entries[position + 1].publication.title } : null,
            };
        }
        if (post.format === 'short') {
            if (post.depthParent) {
                const deeper = await Publication.findById(post.depthParent).select('title');
                if (deeper) postData.depthContext = { deeper: { id: deeper._id, title: deeper.title } };
            }
        } else {
            const quick = await Publication.findOne({ depthParent: post._id, format: 'short' }).select('title');
            if (quick) postData.depthContext = { quick: { id: quick._id, title: quick.title } };
        }

        return res.status(200).json({
            success: true,
            message: "Publication fetched successfully",
            postData
        });
    }
    catch(error) {
        return res.status(500).json({
            success: false,
            message: 'Error Fetching Publication'
        })
    }
}

const getAllPosts = async (req, res) => {

    try {
        const pageQuery = parseLegacyPostListQuery(req.query);
        if (!pageQuery) {
            return res.status(400).json({ success: false, message: 'Invalid sort option' });
        }

        const filter = { $and: [publicAccessClause()] };
        if (pageQuery.cursor) {
            filter.$or = [
                { [pageQuery.sortField]: { $lt: pageQuery.cursor.value } },
                { [pageQuery.sortField]: pageQuery.cursor.value, _id: { $lt: pageQuery.cursor.id } },
            ];
        }

        const documents = await Publication.find(filter)
            .select(discoveryPostFields)
            .populate({ path: 'author', select: 'picture username' })
            .sort({ [pageQuery.sortField]: -1, _id: -1 })
            .limit(pageQuery.limit + 1)
            .lean();
        const hasMore = documents.length > pageQuery.limit;
        const page = hasMore ? documents.slice(0, pageQuery.limit) : documents;
        const posts = await presentDiscoveryPosts(page, req.auth?.userId);
        const lastPost = page.at(-1);
        const nextCursor = hasMore && lastPost
            ? encodeCursor({
                id: lastPost._id.toString(),
                value: pageQuery.sort === 'date'
                    ? lastPost.createdAt.toISOString()
                    : pageQuery.sort === 'views'
                        ? lastPost.metadata?.views || 0
                        : lastPost.appreciationsCount || 0,
            })
            : null;
        return res.status(200).json({
            success: true,
            message: 'Posts fetched successfully',
            posts,
            meta: { sort: pageQuery.sort, nextCursor },
        });
    }
    catch (error) {
        console.error(`[${req.requestId}] Publication listing failed`)
        return res.status(500).json({
            success: false,
            message: 'Error Fetching Posts'
        })
    }
};

const getDiscoveryFeed = async (req, res) => {
    try {
        const mode = String(req.query.mode || 'latest').toLowerCase();
        if (!['for-you', 'latest', 'popular', 'day'].includes(mode)) {
            return res.status(400).json({ message: 'Invalid feed mode' });
        }
        const sort = String(req.query.sort || (['popular', 'day'].includes(mode) ? 'popular' : 'latest')).toLowerCase();
        if (!['latest', 'popular'].includes(sort)) {
            return res.status(400).json({ message: 'Invalid feed sort' });
        }

        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 24)
            : 12;
        const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;
        if (req.query.cursor && !cursor) {
            return res.status(400).json({ message: 'Invalid feed cursor' });
        }

        if (mode === 'for-you') {
            if (!req.auth) return res.status(401).json({ message: 'Sign in to use the For You feed' });
            const asOf = cursor?.asOf ? new Date(cursor.asOf) : new Date();
            const offset = cursor?.offset ?? 0;
            if (Number.isNaN(asOf.getTime()) || !Number.isInteger(offset) || offset < 0 || offset > 10_000) {
                return res.status(400).json({ message: 'Invalid feed cursor' });
            }

            const [candidates, interests, follows] = await Promise.all([
                Publication.find({
                    format: { $ne: 'short' },
                    ...publicAccessClause(asOf),
                    createdAt: {
                        $lte: asOf,
                        $gte: new Date(asOf.getTime() - 90 * 24 * 60 * 60 * 1000),
                    },
                })
                    .select(personalizedCandidateFields)
                    .populate({ path: 'author', select: 'picture username' })
                    .sort({ createdAt: -1, _id: -1 })
                    .limit(MAX_PERSONALIZED_CANDIDATES)
                    .lean(),
                UserInterest.find({ userId: req.auth.userId, explicitWeight: { $gt: 0 } }).select('topicId'),
                Follow.find({ followerId: req.auth.userId }).select('followingId'),
            ]);
            const ranked = rankCandidates(candidates, {
                interestTopicIds: new Set(interests.map(interest => interest.topicId.toString())),
                followedWriterIds: new Set(follows.map(follow => follow.followingId.toString())),
                asOf,
            });
            const rankedPage = ranked.slice(offset, offset + limit);
            const data = await loadDiscoveryPostPage(rankedPage.map(item => item.publication._id), req.auth?.userId);
            const rankByPost = new Map(rankedPage.map(item => [item.publication._id.toString(), item]));
            const recommendationRequestId = crypto.randomUUID();
            const rankedData = data.map(post => ({
                ...post,
                recommendationScore: rankByPost.get(post.id.toString()).score,
                recommendationReason: rankByPost.get(post.id.toString()).reason,
                recommendationRequestId,
            }));
            const nextOffset = offset + rankedPage.length;
            const nextCursor = nextOffset < ranked.length
                ? encodeCursor({ asOf: asOf.toISOString(), offset: nextOffset })
                : null;
            return res.status(200).json({
                data: rankedData,
                meta: { mode, nextCursor, recommendationRequestId, asOf: asOf.toISOString() },
            });
        }

        const isPopularityFeed = sort === 'popular';
        const filter = { format: { $ne: 'short' }, $and: [publicAccessClause()] };
        if (mode === 'day') {
            filter.createdAt = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
        }

        if (cursor) {
            if (!mongoose.isValidObjectId(cursor.id)) {
                return res.status(400).json({ message: 'Invalid feed cursor' });
            }
            if (isPopularityFeed) {
                if (!Number.isInteger(cursor.likes) || cursor.likes < 0) {
                    return res.status(400).json({ message: 'Invalid feed cursor' });
                }
                filter.$or = [
                    { appreciationsCount: { $lt: cursor.likes } },
                    { appreciationsCount: cursor.likes, _id: { $lt: cursor.id } },
                ];
            } else {
                const cursorDate = new Date(cursor.createdAt);
                if (Number.isNaN(cursorDate.getTime())) {
                    return res.status(400).json({ message: 'Invalid feed cursor' });
                }
                filter.$or = [
                    { createdAt: { $lt: cursorDate } },
                    { createdAt: cursorDate, _id: { $lt: cursor.id } },
                ];
            }
        }

        const databaseSort = isPopularityFeed
            ? { appreciationsCount: -1, _id: -1 }
            : { createdAt: -1, _id: -1 };
        const posts = await Publication.find(filter)
            .select(discoveryPostFields)
            .populate({ path: 'author', select: 'picture username' })
            .sort(databaseSort)
            .limit(limit + 1)
            .lean();
        const hasMore = posts.length > limit;
        const page = hasMore ? posts.slice(0, limit) : posts;
        const data = await presentDiscoveryPosts(page, req.auth?.userId);
        const recommendationRequestId = crypto.randomUUID();
        const recommendationReason = sort === 'latest'
            ? 'Recently published'
            : mode === 'day'
                ? 'Popular in the past 24 hours'
                : 'Popular with readers';
        const rankedData = data.map(post => ({ ...post, recommendationReason, recommendationRequestId }));
        const lastPost = page.at(-1);
        const nextCursor = hasMore && lastPost
            ? encodeCursor(isPopularityFeed
                ? { likes: lastPost.appreciationsCount || 0, id: lastPost._id.toString() }
                : { createdAt: lastPost.createdAt.toISOString(), id: lastPost._id.toString() })
            : null;

        return res.status(200).json({
            data: rankedData,
            meta: { mode, sort, nextCursor, recommendationRequestId },
        });
    } catch (error) {
        console.error(`[${req.requestId}] Discovery feed failed`);
        return res.status(500).json({ message: 'Unable to load the discovery feed' });
    }
};

const getShortFeed = async (req, res) => {
    try {
        const sort = String(req.query.sort || 'latest').toLowerCase();
        if (!['latest', 'popular'].includes(sort)) return res.status(400).json({ message: 'Invalid short feed sort' });
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 24) : 12;
        const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;
        if(req.query.cursor && !cursor) return res.status(400).json({ message: 'Invalid short feed cursor' });
        const filter = { format: 'short', $and: [publicAccessClause()] };
        if(cursor) {
            if (!mongoose.isValidObjectId(cursor.id)) return res.status(400).json({ message: 'Invalid short feed cursor' });
            if (sort === 'popular') {
                if (!Number.isInteger(cursor.likes) || cursor.likes < 0) return res.status(400).json({ message: 'Invalid short feed cursor' });
                filter.$or = [
                    { appreciationsCount: { $lt: cursor.likes } },
                    { appreciationsCount: cursor.likes, _id: { $lt: cursor.id } },
                ];
            } else {
                const createdAt = new Date(cursor.createdAt);
                if (Number.isNaN(createdAt.getTime())) return res.status(400).json({ message: 'Invalid short feed cursor' });
                filter.$or = [
                    { createdAt: { $lt: createdAt } },
                    { createdAt, _id: { $lt: cursor.id } },
                ];
            }
        }
        const documents = await Publication.find(filter)
            .select(discoveryPostFields)
            .populate({ path: 'author', select: 'picture username' })
            .sort(sort === 'popular' ? { appreciationsCount: -1, _id: -1 } : { createdAt: -1, _id: -1 })
            .limit(limit + 1)
            .lean();
        const hasMore = documents.length > limit;
        const page = hasMore ? documents.slice(0, limit) : documents;
        const data = await presentDiscoveryPosts(page, req.auth?.userId);
        const last = page.at(-1);
        return res.status(200).json({
            data,
            meta: { sort, nextCursor: hasMore && last ? encodeCursor(sort === 'popular' ? { likes: last.appreciationsCount || 0, id: last._id.toString() } : { createdAt: last.createdAt.toISOString(), id: last._id.toString() }) : null },
        });
    } catch(error) {
        console.error(`[${req.requestId}] Short feed failed`);
        return res.status(500).json({ message: 'Unable to load short posts' });
    }
};

const getDepthOptions = async (req, res) => {
    const posts = await Publication.find({ author: req.auth.userId, format: { $ne: 'short' } })
        .sort({ createdAt: -1 }).select('title createdAt');
    return res.status(200).json({ data: posts.map(post => ({ id: post._id, title: post.title, createdAt: post.createdAt })) });
};

const getEarlyAccessFeed = async (req, res) => {
    try {
        if (!await hasCapability(req.auth.userId, 'early_access')) return res.status(403).json({ code: 'ENTITLEMENT_REQUIRED', message: 'Early access requires an active membership' });
        const now = new Date();
        const documents = await Publication.find({ publicAt: { $gt: now }, publicationStatus: { $ne: 'unpublished' }, format: { $ne: 'short' }, author: { $ne: req.auth.userId } })
            .populate({ path: 'author', select: 'picture username' })
            .sort({ publicAt: 1, _id: 1 })
            .limit(50);
        const data = (await presentDiscoveryPosts(documents, req.auth.userId)).map((post, index) => ({ ...post, isEarlyAccess: true, publicAt: documents[index].publicAt }));
        return res.status(200).json({ data });
    } catch {
        return res.status(500).json({ message: 'Unable to load early access articles' });
    }
};

const updatePost = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid post id' });
        const expectedRevision = Number(req.body.expectedRevision);
        if (!Number.isInteger(expectedRevision) || expectedRevision < 1) return res.status(400).json({ message: 'Expected revision is required' });
        const current = await Publication.findOne({ _id: req.params.id, author: req.auth.userId });
        if (!current) return res.status(404).json({ message: 'Publication not found' });
        if (current.currentRevision !== expectedRevision) return res.status(409).json({ code: 'REVISION_CONFLICT', message: 'This post changed in another session. Reload before editing.' });
        const title = String(req.body.title || '').trim();
        const parsedBody = parsePostBody(req.body.body);
        const tags = Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags || '').split(',');
        const normalizedTags = [...new Set(tags.map(tag => String(tag).trim().toLowerCase()).filter(Boolean))].slice(0, 20);
        if (!title || title.length > (current.format === 'short' ? 120 : 180) || !parsedBody) return res.status(400).json({ message: 'Invalid post update' });
        let publicAt = current.publicAt;
        if (Object.prototype.hasOwnProperty.call(req.body, 'publicAt') && !req.body.publicAt) {
            publicAt = new Date();
        } else if (req.body.publicAt) {
            publicAt = new Date(req.body.publicAt);
            if (Number.isNaN(publicAt.getTime()) || publicAt.getTime() > Date.now() + 30 * 86400000) return res.status(400).json({ message: 'Public release must be within the next 30 days' });
            if (publicAt > new Date() && !await hasCapability(req.auth.userId, 'early_access')) return res.status(403).json({ code: 'ENTITLEMENT_REQUIRED', message: 'Early release scheduling requires membership' });
        }
        const nextRevision = expectedRevision + 1;
        const nextBody = JSON.stringify(parsedBody);
        if (req.file && req.body.coverImageUrl) return res.status(400).json({ message: 'Choose an uploaded image or an image URL' });
        let linkedCover = null;
        if (req.body.coverImageUrl) { try { const url = new URL(req.body.coverImageUrl); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.toString().length > 2000) throw new Error('Invalid URL'); linkedCover = url.toString(); } catch { return res.status(400).json({ message: 'Cover image must be a valid HTTP(S) URL' }); } }
        const uploadedCover = req.file ? await uploadOnCloudinary(req.file.path) : null;
        const coverUploadFailed = Boolean(req.file && !uploadedCover?.secure_url);
        const nextCover = coverUploadFailed || req.body.removeCover === 'true' ? null : uploadedCover?.secure_url || linkedCover || current.coverImage;
        await PublicationRevision.create({ publicationId: current._id, revision: nextRevision, authorId: req.auth.userId, title, body: nextBody, coverImage: nextCover, format: current.format, tags: normalizedTags, publicAt });
        const updated = await Publication.findOneAndUpdate(
            { _id: current._id, author: req.auth.userId, currentRevision: expectedRevision },
            { $set: { title, body: nextBody, tags: normalizedTags, publicAt, coverImage: nextCover, currentRevision: nextRevision } },
            { returnDocument: 'after' }
        ).select('title currentRevision publicAt publicationStatus');
        if (!updated) {
            await PublicationRevision.deleteOne({ publicationId: current._id, revision: nextRevision });
            return res.status(409).json({ code: 'REVISION_CONFLICT', message: 'This post changed in another session. Reload before editing.' });
        }
        return res.json({ data: updated, coverUploadFailed });
    } catch (error) {
        if (error?.code === 11000) return res.status(409).json({ code: 'REVISION_CONFLICT', message: 'This revision already exists' });
        return res.status(500).json({ message: 'Unable to update post' });
    } finally {
        if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
    }
};

const setPublication = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid post id' });
    if (!['published', 'unpublished'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid publication status' });
    const post = await Publication.findOneAndUpdate({ _id: req.params.id, author: req.auth.userId }, { $set: { publicationStatus: req.body.status } }, { returnDocument: 'after' }).select('publicationStatus');
    if (!post) return res.status(404).json({ message: 'Publication not found' });
    return res.json({ data: post });
};

const searchPost = async (req, res) => {

    try{
        const {query} = req.query;
        if(!query)
            return res.status(400).json({success: false, message: 'Enter query to search'});

        const posts = await Publication.find({
            $text: { $search: query }, ...publicAccessClause()
        })
        .populate({
            path: 'author',
            select: 'picture username bio'
        })
        const postData = await attachAuthorHandles(posts);
        return res.status(200).json({
            success: true,
            message: "Posts fetched successfully",
            posts: postData
        })
    }
    catch(error){
        console.error(`[${req.requestId}] Publication search failed`);
        return res.status(500).json({
            success: false,
            message: 'Unable to fetch posts at this time'
        })
    }
}

const searchCategory = async (req, res) => {

    try {
        const { query } = req.query;
        if(!query)
            return res.status(400).json({success: false, message: 'Enter query to search'});

        const tagsArray = query
            .split(',')
            .map(tag => tag.trim().toLowerCase())
            .filter(Boolean);

        const posts = await Publication.find({
            tags: { $in: tagsArray }, ...publicAccessClause()
        })
        .populate({
            path: 'author',
            select: 'picture username bio'
        })
        // .limit(5);

        const postData = await attachAuthorHandles(posts);
        return res.status(200).json({
            success: true,
            message: "Posts fetched successfully",
            posts: postData
        })
    }
    catch(error){
        console.error(`[${req.requestId}] Category search failed`);
        return res.status(500).json({
            success: false,
            message: 'Unable to fetch categories at this time'
        })
    }
}

module.exports = {
    parsePostBody,
    isSafeImageUrl,
    parseLegacyPostListQuery,
    createPost,
    getAllPosts,
    getPost,
    getDiscoveryFeed,
    getShortFeed,
    getDepthOptions,
    getEarlyAccessFeed,
    updatePost,
    setPublication,
    searchPost,
    searchCategory
}
