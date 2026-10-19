const express = require('express');
const morgan = require('morgan');
const cors = require('cors')
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const config = require('../config/config.js')
const routes = require("../routes/index.js");
const { createRequestTimingMiddleware, createErrorMonitor, logInternalError } = require('../services/observability.service.js')
const seo = require('../controllers/seo.controller.js');
const healthController = require('../controllers/health.controller.js');
const { createRateLimiter } = require('../middlewares/rate-limit.middleware.js');
const { normalizeLegacyRequest, addLegacyResponseAliases } = require('../middlewares/legacy-terminology.middleware.js');

const app = express();
const errorMonitor = createErrorMonitor({ url: config.ERROR_MONITOR_URL });

app.disable('x-powered-by');
if (config.TRUST_PROXY) app.set('trust proxy', config.TRUST_PROXY);

// Middlewares
app.use((req, res, next) => {
  const suppliedRequestId = String(req.headers['x-request-id'] || '');
  req.requestId = /^[A-Za-z0-9._:-]{1,128}$/.test(suppliedRequestId) ? suppliedRequestId : crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.setHeader('cross-origin-opener-policy', 'same-origin');
  res.setHeader('cross-origin-resource-policy', 'same-site');
  if (config.NODE_ENV === 'production') res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
  next();
});
// Keep legacy callers readable during the envelope migration while exposing the
// versioned error contract to every API route, including older controllers.
app.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = payload => {
    if (req.path.startsWith('/api') && res.statusCode >= 400 && payload && payload.message && !payload.error) {
      const { message, code, fields, ...legacy } = payload;
      const error = { code: code || 'REQUEST_FAILED', message, requestId: req.requestId };
      if (fields !== undefined) error.fields = fields;
      return json({ error, ...legacy });
    }
    return json(payload);
  };
  next();
});
app.use(createRequestTimingMiddleware({ monitor: errorMonitor }));
app.use(cors({            // defining cors
  origin: config.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}))
app.use('/api/auth', (req, res, next) => {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('pragma', 'no-cache');
  next();
});
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buffer) => {
    if (req.originalUrl === '/api/v1/billing/webhook') req.rawBody = Buffer.from(buffer);
  },
}));  // for express framework
app.use('/api', normalizeLegacyRequest, addLegacyResponseAliases);
const productionRequestLog = morgan((tokens, req, res) => JSON.stringify({
  requestId: req.requestId,
  method: tokens.method(req, res),
  path: req.path,
  status: Number(tokens.status(req, res)),
  responseTimeMs: Number(tokens['response-time'](req, res)),
  contentLength: tokens.res(req, res, 'content-length') || null,
}));
app.use(productionRequestLog);
app.use(cookieParser());   // for parsing cookies
app.use(express.urlencoded({ extended: true, limit: '1mb' }));  // for parsing form-data
const mutationLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 300, keyPrefix: 'api-mutation' });
app.use('/api', (req, res, next) => {
  if (req.originalUrl === '/api/v1/billing/webhook' || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  return mutationLimiter(req, res, next);
});
// app.use(express.static('public')); // for serving frontend static files from public folder


// Routes
app.get('/', healthController.health);
app.get('/robots.txt', seo.robots);
app.get('/sitemap.xml', seo.sitemap);
app.get('/health', healthController.health);
app.get('/readiness', healthController.readiness);
app.get('/database-status', healthController.databaseStatus);

app.use('/api', routes);
app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Route not found',
        requestId: req.requestId,
      },
    });
})

app.use((err, req, res, _next) => {
  const isUploadError = err?.name === 'MulterError';
  const isInvalidJson = err instanceof SyntaxError && err?.type === 'entity.parse.failed';
  const status = isUploadError || isInvalidJson ? 400 : 500;
  const code = isUploadError
    ? 'INVALID_UPLOAD'
    : isInvalidJson
      ? 'INVALID_JSON'
      : 'INTERNAL_ERROR';
  const message = isUploadError
    ? 'Upload must be a JPG, PNG, WebP, or GIF no larger than 8 MB'
    : isInvalidJson
      ? 'Request body contains invalid JSON'
      : 'The request could not be completed';

  if (status === 500) {
    logInternalError(req, err, status, { monitor: errorMonitor });
  }

  return res.status(status).json({
    error: { code, message, requestId: req.requestId },
  });
});


module.exports = app;
