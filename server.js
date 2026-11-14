const express = require('express');
const { PrismaClient, Prisma } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
app.use(express.json({ limit: '1mb' }));

const authorInclude = { books: { include: { _count: { select: { reviews: true } } } } };
const bookInclude = { author: true, reviews: true };

function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function parseId(value, name = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw httpError(400, `"${name}" must be a positive integer.`);
  return id;
}

function validate(body, rules, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'Request body must be a JSON object.');
  }
  const errors = [];
  const data = {};
  for (const [field, rule] of Object.entries(rules)) {
    const value = body[field];
    if (value === undefined) {
      if (rule.required && !partial) errors.push(`${field} is required.`);
      continue;
    }
    if (value === null && rule.nullable) {
      data[field] = null;
      continue;
    }
    if (rule.type === 'string') {
      if (typeof value !== 'string' || (rule.trim && !value.trim())) {
        errors.push(`${field} must be a non-empty string.`);
      } else if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push(`${field} must be a valid email address.`);
      } else if (rule.max && value.length > rule.max) {
        errors.push(`${field} must be at most ${rule.max} characters.`);
      } else {
        data[field] = rule.trim ? value.trim() : value;
      }
    } else if (rule.type === 'integer') {
      if (!Number.isInteger(value) || value < rule.min || value > rule.max) {
        errors.push(`${field} must be an integer between ${rule.min} and ${rule.max}.`);
      } else data[field] = value;
    } else if (rule.type === 'date') {
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        errors.push(`${field} must be a valid date string.`);
      } else data[field] = new Date(value);
    }
  }
  if (errors.length) throw httpError(400, 'Request validation failed.', errors);
  return data;
}

const authorRules = {
  name: { type: 'string', required: true, trim: true, max: 120 },
  email: { type: 'string', required: true, trim: true, email: true, max: 254 },
  bio: { type: 'string', nullable: true, max: 2000 }
};
const bookRules = {
  title: { type: 'string', required: true, trim: true, max: 200 },
  isbn: { type: 'string', required: true, trim: true, max: 20 },
  description: { type: 'string', nullable: true, max: 5000 },
  publishedAt: { type: 'date', nullable: true },
  authorId: { type: 'integer', required: true, min: 1, max: 2147483647 }
};
const reviewRules = {
  reviewer: { type: 'string', required: true, trim: true, max: 120 },
  rating: { type: 'integer', required: true, min: 1, max: 5 },
  body: { type: 'string', required: true, trim: true, max: 2000 }
};

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Authors
app.get('/authors', asyncRoute(async (req, res) => {
  const authors = await prisma.author.findMany({ include: { _count: { select: { books: true } } }, orderBy: { id: 'asc' } });
  res.json({ data: authors });
}));
app.post('/authors', asyncRoute(async (req, res) => {
  const data = validate(req.body, authorRules);
  const author = await prisma.author.create({ data });
  res.status(201).json({ data: author });
}));
app.get('/authors/:id', asyncRoute(async (req, res) => {
  const author = await prisma.author.findUnique({ where: { id: parseId(req.params.id) }, include: authorInclude });
  if (!author) throw httpError(404, 'Author not found.');
  res.json({ data: author });
}));
app.put('/authors/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id);
  const data = validate(req.body, authorRules);
  const result = await prisma.author.updateMany({ where: { id }, data });
  if (!result.count) throw httpError(404, 'Author not found.');
  res.json({ data: await prisma.author.findUnique({ where: { id } }) });
}));
app.patch('/authors/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id);
  const data = validate(req.body, authorRules, { partial: true });
  if (!Object.keys(data).length) throw httpError(400, 'Provide at least one author field to update.');
  const result = await prisma.author.updateMany({ where: { id }, data });
  if (!result.count) throw httpError(404, 'Author not found.');
  res.json({ data: await prisma.author.findUnique({ where: { id } }) });
}));
app.delete('/authors/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id);
  const result = await prisma.author.deleteMany({ where: { id } });
  if (!result.count) throw httpError(404, 'Author not found.');
  res.status(204).end();
}));
app.get('/authors/:id/books', asyncRoute(async (req, res) => {
  const authorId = parseId(req.params.id);
  const author = await prisma.author.findUnique({ where: { id: authorId }, select: { id: true } });
  if (!author) throw httpError(404, 'Author not found.');
  const books = await prisma.book.findMany({ where: { authorId }, include: { _count: { select: { reviews: true } } }, orderBy: { id: 'asc' } });
  res.json({ data: books });
}));

// Books
app.get('/books', asyncRoute(async (req, res) => {
  const books = await prisma.book.findMany({ include: bookInclude, orderBy: { id: 'asc' } });
  res.json({ data: books });
}));
app.post('/books', asyncRoute(async (req, res) => {
  const data = validate(req.body, bookRules);
  if (!(await prisma.author.findUnique({ where: { id: data.authorId }, select: { id: true } }))) throw httpError(404, 'Author not found.');
  const book = await prisma.book.create({ data, include: bookInclude });
  res.status(201).json({ data: book });
}));
app.get('/books/:id', asyncRoute(async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: parseId(req.params.id) }, include: bookInclude });
  if (!book) throw httpError(404, 'Book not found.');
  res.json({ data: book });
}));
app.put('/books/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id);
  const data = validate(req.body, bookRules);
  if (!(await prisma.author.findUnique({ where: { id: data.authorId }, select: { id: true } }))) throw httpError(404, 'Author not found.');
  const result = await prisma.book.updateMany({ where: { id }, data });
  if (!result.count) throw httpError(404, 'Book not found.');
  res.json({ data: await prisma.book.findUnique({ where: { id }, include: bookInclude }) });
}));
app.patch('/books/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id);
  const data = validate(req.body, bookRules, { partial: true });
  if (!Object.keys(data).length) throw httpError(400, 'Provide at least one book field to update.');
  if (data.authorId && !(await prisma.author.findUnique({ where: { id: data.authorId }, select: { id: true } }))) throw httpError(404, 'Author not found.');
  const result = await prisma.book.updateMany({ where: { id }, data });
  if (!result.count) throw httpError(404, 'Book not found.');
  res.json({ data: await prisma.book.findUnique({ where: { id }, include: bookInclude }) });
}));
app.delete('/books/:id', asyncRoute(async (req, res) => {
  const result = await prisma.book.deleteMany({ where: { id: parseId(req.params.id) } });
  if (!result.count) throw httpError(404, 'Book not found.');
  res.status(204).end();
}));
app.get('/books/:id/reviews', asyncRoute(async (req, res) => {
  const bookId = parseId(req.params.id);
  if (!(await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } }))) throw httpError(404, 'Book not found.');
  res.json({ data: await prisma.review.findMany({ where: { bookId }, orderBy: { id: 'asc' } }) });
}));

// Reviews
app.get('/reviews', asyncRoute(async (req, res) => {
  const reviews = await prisma.review.findMany({ include: { book: { select: { id: true, title: true } } }, orderBy: { id: 'asc' } });
  res.json({ data: reviews });
}));
app.post('/books/:id/reviews', asyncRoute(async (req, res) => {
  const bookId = parseId(req.params.id);
  const data = validate(req.body, reviewRules);
  if (!(await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } }))) throw httpError(404, 'Book not found.');
  const review = await prisma.review.create({ data: { ...data, bookId }, include: { book: { select: { id: true, title: true } } } });
  res.status(201).json({ data: review });
}));
app.get('/reviews/:id', asyncRoute(async (req, res) => {
  const review = await prisma.review.findUnique({ where: { id: parseId(req.params.id) }, include: { book: { select: { id: true, title: true } } } });
  if (!review) throw httpError(404, 'Review not found.');
  res.json({ data: review });
}));
app.patch('/reviews/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id);
  const data = validate(req.body, reviewRules, { partial: true });
  if (!Object.keys(data).length) throw httpError(400, 'Provide at least one review field to update.');
  const result = await prisma.review.updateMany({ where: { id }, data });
  if (!result.count) throw httpError(404, 'Review not found.');
  res.json({ data: await prisma.review.findUnique({ where: { id }, include: { book: { select: { id: true, title: true } } } }) });
}));
app.delete('/reviews/:id', asyncRoute(async (req, res) => {
  const result = await prisma.review.deleteMany({ where: { id: parseId(req.params.id) } });
  if (!result.count) throw httpError(404, 'Review not found.');
  res.status(204).end();
}));

app.use((req, res) => res.status(404).json({ error: { message: 'Route not found.' } }));
app.use((error, req, res, next) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return res.status(409).json({ error: { message: 'A record with this unique value already exists.', details: error.meta?.target } });
    if (error.code === 'P2003') return res.status(400).json({ error: { message: 'The referenced record does not exist.' } });
  }
  const status = error.status || 500;
  res.status(status).json({ error: { message: status === 500 ? 'Internal server error.' : error.message, ...(error.details ? { details: error.details } : {}) } });
});

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`Bookstore API listening on http://localhost:${port}`));

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
