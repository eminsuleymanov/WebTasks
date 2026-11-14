# Bookstore REST API

A Node.js REST API for authors, books, and book reviews. It uses Express, Prisma ORM, and SQLite.

## Requirements

- Node.js 18+
- npm

## Run locally

```sh
npm install
cp .env.example .env
npm run db:generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

The API listens at `http://localhost:3000`. Import `postman/Bookstore-API.postman_collection.json` into Postman; its `baseUrl` variable is already set to that address. The seed creates author ID `1`, books IDs `1` and `2`, and review ID `1`. Run the delete examples last, since they remove seed data. `npm run db:seed` resets the sample data.

## Data model

- **Author** has many **Books** (`Author 1 → N Book`). Deleting an author cascades to its books and their reviews.
- **Book** has many **Reviews** (`Book 1 → N Review`). Deleting a book cascades to its reviews.
- **Review** belongs to one **Book**.

SQLite stores the data in `prisma/dev.db`. `email` and `isbn` are unique.

## API conventions

- All request and response bodies use JSON except empty `204 No Content` responses.
- Successful lists and records use `{ "data": ... }`.
- Errors use `{ "error": { "message": "...", "details": [...] } }`; `details` is included when relevant.
- IDs are positive integers. Ratings are integers from 1 through 5. Date input uses an ISO date string, such as `2020-01-01`.
- `PUT` replaces all writable fields for the resource; `PATCH` updates only provided fields.

## Endpoint reference

### Health

| Method | URL | Parameters/body | Success response |
|---|---|---|---|
| GET | `/health` | None | `200 {"status":"ok"}` |

### Authors

Author body: `{ "name": "Octavia Butler", "email": "octavia@example.com", "bio": "Optional biography" }`. `name` and `email` are required; `bio` is optional and may be `null`.

| Method | URL | Parameters/body | Success response |
|---|---|---|---|
| GET | `/authors` | None | `200 {"data":[...authors]}` (includes book counts) |
| POST | `/authors` | Author body | `201 {"data": author}` |
| GET | `/authors/{id}` | Path: positive integer `id` | `200 {"data": author}` with books; `404` if missing |
| PUT | `/authors/{id}` | Path `id`; complete Author body | `200 {"data": author}` |
| PATCH | `/authors/{id}` | Path `id`; any subset of Author fields | `200 {"data": author}` |
| DELETE | `/authors/{id}` | Path `id` | `204` empty response; cascades to books/reviews |
| GET | `/authors/{id}/books` | Path `id` | `200 {"data":[...books]}`; `404` if author missing |

### Books

Book body: `{ "title": "Kindred", "isbn": "9780807083697", "description": "Optional", "publishedAt": "1979-01-01", "authorId": 1 }`. `title`, `isbn`, and `authorId` are required. `description` and `publishedAt` are optional and may be `null`.

| Method | URL | Parameters/body | Success response |
|---|---|---|---|
| GET | `/books` | None | `200 {"data":[...books]}` with author/reviews |
| POST | `/books` | Book body | `201 {"data": book}` |
| GET | `/books/{id}` | Path: positive integer `id` | `200 {"data": book}` with author/reviews; `404` if missing |
| PUT | `/books/{id}` | Path `id`; complete Book body | `200 {"data": book}` |
| PATCH | `/books/{id}` | Path `id`; any subset of Book fields | `200 {"data": book}` |
| DELETE | `/books/{id}` | Path `id` | `204` empty response; cascades to reviews |
| GET | `/books/{id}/reviews` | Path `id` | `200 {"data":[...reviews]}`; `404` if book missing |

### Reviews

Review body: `{ "reviewer": "Alex Reader", "rating": 5, "body": "Excellent." }`. All fields are required when creating; PATCH accepts any subset.

| Method | URL | Parameters/body | Success response |
|---|---|---|---|
| GET | `/reviews` | None | `200 {"data":[...reviews]}` with book summaries |
| POST | `/books/{id}/reviews` | Path: book `id`; Review body | `201 {"data": review}`; `404` if book missing |
| GET | `/reviews/{id}` | Path: positive integer `id` | `200 {"data": review}` with book summary; `404` if missing |
| PATCH | `/reviews/{id}` | Path `id`; any subset of Review fields | `200 {"data": review}` |
| DELETE | `/reviews/{id}` | Path `id` | `204` empty response |

## HTTP errors

- `400 Bad Request`: invalid JSON body shape, field validation failure, or invalid ID.
- `404 Not Found`: unknown route, record, or referenced author/book.
- `409 Conflict`: duplicate author email or book ISBN.
- `500 Internal Server Error`: unexpected server failure.

The Postman collection includes a request for every endpoint. It uses the seeded author/book/review IDs and includes write examples. Run delete requests after other examples, or reseed with `npm run db:seed`.
