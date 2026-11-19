# Storyframe — Interactive Storytelling Platform

Four apps that share one animation engine:

| Folder | What it is | Dev URL |
|---|---|---|
| `server/` | Express REST API on MongoDB (Mongoose models, image files in GridFS), JWT + bcrypt auth | http://localhost:4000/api |
| `admin/` | React dashboard and Story Builder (Vite, Tailwind, Konva, GSAP) | http://localhost:5173/admin/ |
| `client/` | Public website: active stories as cards → scroll story experience | http://localhost:5173/client/stories |
| `desktop/` | Electron viewer (list stories → scroll-driven story) | Electron window |
| `shared/` | Animation engine (pure math) + `StoryPlayer`, used by admin preview, client site **and** desktop | — |

The architecture, data model and animation math are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 1. MongoDB (once)

Install [MongoDB Community Server](https://www.mongodb.com/try/download/community) and keep it
running (on Windows it runs as the `MongoDB` service on `127.0.0.1:27017`). The server creates
the database `infinite_scroll_app`, its collections and indexes on first start:

| Collection | Model (`server/src/models`) | Holds |
|---|---|---|
| `admins` | `Admin` | dashboard users (bcrypt password hashes) |
| `stories` | `Story` | the working copy of each story (intro, scenes, steps, text) |
| `publishedStories` | `PublishedStory` | the snapshot visitors see, written by Publish |
| `images` | `Image` | uploaded image records |
| `images.files` / `images.chunks` | GridFS | the WebP files, served at `/uploads/...` |

**Old Firebase data** (one time, already done for this project): this copies the Firestore
collections (same ids) and the image files into MongoDB. Safe to run again.
```bash
npm --prefix server run import-from-firebase -- --key ./serviceAccount.json
```

## 2. Server

```bash
cd server
npm install
cp .env.example .env        # then fill in JWT_SECRET (MONGODB_URI defaults to the local MongoDB)
npm run create-admin -- --email you@example.com --password "a-strong-password" --name "Your Name"
npm run dev
```
`--role editor` creates an editor (can edit, cannot publish or delete).

## 3. Admin dashboard

```bash
cd admin
npm install
cp .env.example .env        # VITE_API_URL, default http://localhost:4000/api
npm run dev                 # production: npm run build → static files in admin/dist
```
Add the dashboard's URL to `CORS_ORIGINS` in `server/.env` when you deploy it.

## 4. Client website

Two pages: `/client/stories` lists every active story as a card; `/client/stories/:id` plays that story.
Both apps share one port: `npm run dev` starts the API and one web server (`scripts/dev-web.mjs`, port 5173)
that serves `/admin/` and `/client/` and forwards `/api` + `/uploads` to the API. `/` and old links like
`/stories` redirect to `/admin/`.
It uses only the two public endpoints (`GET /api/desktop/stories` and `/api/desktop/stories/:id`).

```bash
npm run dev                 # from the repo root: API + one web server (admin + client on port 5173)
npm run dev:web             # just the web server (needs the API running)
npm run build:client        # production: static files in client/dist
```
In development `/api` and `/uploads` are forwarded to the API, so phones on your network can open
`http://<this-PC-IP>:5173/client/stories`. In production, serve `admin/dist` at `/admin/` and `client/dist` at `/client/`, each with a fallback to its `index.html`, and either
proxy `/api` + `/uploads` to the server or set `VITE_API_URL` (and add the site to `CORS_ORIGINS`).
`VITE_SHARE_URL` sets the share link (default: the story's own page on this site).

## 5. Desktop app

```bash
cd desktop
npm install
cp .env.example .env        # VITE_API_URL baked into the build
npm run dev                 # Electron + hot reload
npm run dist                # → desktop/release/Storyframe-Setup-1.0.0.exe and Storyframe-Portable-1.0.0.exe
```
An installed app can be pointed at another server without rebuilding:
`%APPDATA%\Storyframe\config.json` → `{ "apiUrl": "https://your-server/api" }`.
The desktop app only calls the two public read-only endpoints and holds no secrets.

## 6. Deploy on Render

One Web Service runs the API and also serves the built admin and client sites
(`server/src/web.js`), so everything lives at one address:
`https://<name>.onrender.com/admin/`, `/client/stories`, `/api/...`.

1. Render → **New → Blueprint** → choose this GitHub repository. It reads `render.yaml`
   (build: `npm run build`, start: `npm start`, health check: `/api/health`).
2. Render can't reach the MongoDB on your PC. Create a free **MongoDB Atlas** cluster
   (cloud.mongodb.com), allow access from anywhere (`0.0.0.0/0`), and copy its connection
   string. Copy your local data there once with `mongodump` / `mongorestore` or MongoDB Compass.
3. Fill in the values Render asks for: `MONGODB_URI` (the Atlas string, ending in
   `/infinite_scroll_app`), `CORS_ORIGINS` (your `https://<name>.onrender.com`), `ADMIN_EMAIL`,
   `ADMIN_PASSWORD`. `JWT_SECRET` is generated. Images live in MongoDB (GridFS), so nothing
   is lost when Render restarts.
4. Desktop app: set `apiUrl` to `https://<name>.onrender.com/api` (see above).

## Tests

```bash
npm test                       # engine math + API suite (uses a temporary database on the local MongoDB)
cd desktop && npm run build && npx electron scripts/smoke-test.cjs ./smoke-out   # Electron smoke test (API must be running)
```

## Demo stories

`server/scripts/demo/` holds 8 ready-made stories (20 images, texts, focal points, steps) for client demos.
With the server running:
```bash
cd server
node --env-file=.env scripts/demo/seed-demo.js http://localhost:4000            # add missing demo stories
node --env-file=.env scripts/demo/seed-demo.js http://localhost:4000 --replace  # rebuild them from stories.js
node scripts/demo/preview-framing.js ./framing   # contact sheets of every step's framing, to check focal points
```

## Authoring tips

* **Step 1** – each uploaded image becomes a scene; drag tiles to reorder.
* **Step 2** – the introduction is the first screen; its text animates in by time (seconds).
* **Step 3** – per scene, add steps along the scroll timeline. In *Focal point* view click the image to
  choose what the camera zooms toward; the dashed frame shows exactly what the viewer will see at that zoom.
  Scene text reveals as the viewer scrolls (timing is a share of the scene's scroll).
* **Save draft** never changes the live story. **Publish / Update story** validates and pushes a snapshot to the desktop app.
