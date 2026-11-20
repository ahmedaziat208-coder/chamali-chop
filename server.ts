import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import { productImages, products } from './src/db/schema.ts';
import { adminRouter, authRouter } from './src/server/routes/admin.ts';
import { publicRouter } from './src/server/routes/public.ts';
import { webhooksRouter } from './src/server/routes/webhooks.ts';

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function injectProductOgTags(html: string, slug: string): Promise<string> {
  try {
    const [prod] = await db
      .select()
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);
    if (!prod) return html;

    const [img] = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, prod.id))
      .limit(1);

    const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const price = Number(prod.salePrice ?? prod.originalPrice).toFixed(2);
    const title = escapeHtml(`${prod.nameAr} — ${price} MAD | الشمالي شوب CHAMALI SHOP`);
    const desc = escapeHtml(prod.descriptionAr.slice(0, 155));
    const ogImg = img?.url
      ? img.url.startsWith('http')
        ? img.url
        : `${baseUrl}${img.url}`
      : '';

    const ogTags = `
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta property="og:type" content="product" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    ${ogImg ? `<meta property="og:image" content="${escapeHtml(ogImg)}" />` : ''}
    <meta property="product:price:amount" content="${price}" />
    <meta property="product:price:currency" content="MAD" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    `;

    return html
      .replace(/<title>[\s\S]*?<\/title>/i, '')
      .replace('</head>', `${ogTags}</head>`);
  } catch {
    return html;
  }
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  // Security headers (preserve iframe compatibility)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // JSON body parser capturing rawBody for Meta HMAC-SHA256 webhook verification
  app.use(
    express.json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  // Serve uploaded product media safely
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'chamali-shop' });
  });

  // Mount API routes
  app.use('/api', publicRouter);
  app.use('/api/webhooks', webhooksRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.get('/product/:slug', async (req, res, next) => {
      const accept = req.headers.accept || '';
      if (!accept.includes('text/html') && !accept.includes('*/*')) return next();
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        template = await injectProductOgTags(template, decodeURIComponent(req.params.slug));
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api/')) return next();
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', async (req, res) => {
      const indexPath = path.resolve(distDir, 'index.html');
      let html = fs.readFileSync(indexPath, 'utf-8');
      const productMatch = req.originalUrl.match(/^\/product\/([^/?#]+)/);
      if (productMatch) {
        html = await injectProductOgTags(html, decodeURIComponent(productMatch[1]));
      }
      res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CHAMALI SHOP server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
