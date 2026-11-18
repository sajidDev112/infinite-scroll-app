# Interactive Storytelling Platform — Architecture

## 1. System overview

```
┌──────────────────────┐        REST (JWT)        ┌──────────────────────────┐
│ admin/  (React+Vite) │ ───────────────────────▶ │ server/ (Express)        │
│ Dashboard, Builder,  │                          │  firebase-admin SDK      │
│ Live Preview         │                          │   ├─ Firestore (data)    │
└──────────┬───────────┘                          │   └─ Storage (images)    │
           │ imports                              └────────────▲─────────────┘
┌──────────▼───────────┐                                       │ REST (public,
│ shared/              │  ◀── same engine ──┐                  │ read-only)
│  engine/ (pure math) │                    │      ┌───────────┴─────────────┐
│  react/StoryPlayer   │ ───────────────────┴────▶ │ desktop/ (Electron+React)│
└──────────────────────┘                           │ Story list + Viewer      │
                                                   └─────────────────────────┘
```

* **server/** is the only component that holds Firebase service-account credentials
  and the JWT secret. Neither front end ever talks to Firebase directly
  (images are fetched from Firebase Storage download URLs, which carry their own token).
* **shared/** holds the animation engine. `shared/engine` is framework-free math
  (camera/focal-point zoom, text reveal, easing, validation, defaults) that the server
  also imports for publish validation. `shared/react` holds `StoryPlayer` and the scene/text
  renderers used by both the admin preview and the Electron viewer, so both produce the
  same output.
* The desktop app only uses two endpoints: list published stories and get one story.

## 2. Folder structure

```
Infinite_Scroll_App/
├─ docs/ARCHITECTURE.md
├─ shared/
│  ├─ engine/      constants, easing, camera, text, layout, defaults, validate
│  ├─ react/       StoryPlayer, SceneView, TextElementView, IntroView, styles.css
│  └─ test/        node --test unit tests for the engine
├─ server/
│  ├─ src/
│  │  ├─ config/       env, firebase
│  │  ├─ middleware/   auth, roles, error handler, validation, upload
│  │  ├─ routes/       auth, stories, uploads, desktop, dashboard
│  │  ├─ services/     admin, story, image, storage
│  │  ├─ validation/   zod schemas
│  │  └─ utils/
│  └─ scripts/create-admin.js
├─ admin/
│  └─ src/  api/, context/, components/{ui,layout}, pages/, features/builder/
└─ desktop/
   ├─ electron/  main.cjs, preload.cjs
   └─ src/       pages/Home, pages/Viewer, components
```

## 3. Firestore data model

Firestore is document-based, so a story's scenes, steps and text elements are embedded
in the story document (one atomic write per save, one read per story view).
A story with 30 scenes × 6 steps × 3 text elements is roughly 300 KB, well within the 1 MB
document limit.

| Collection | Document | Purpose |
|---|---|---|
| `admins/{id}` | `name, email, passwordHash, role ('admin' \| 'editor'), createdAt, updatedAt, lastLoginAt` | Dashboard users (bcrypt hashes) |
| `stories/{id}` | working copy edited by the Builder | Admin only |
| `publishedStories/{id}` | immutable snapshot written by **Publish** | What the desktop app reads |
| `images/{id}` | metadata for every uploaded image | Cleanup, counts |

### Story (`stories/{id}`)
```
title, titleLower, description, category,
coverImage: ImageRef | null,
status: 'draft' | 'active' | 'inactive',
intro: Intro,
scenes: Scene[],
imageIds: string[]           // every image referenced (cover, intro, scenes)
sceneCount, isPublished, publishedAt, hasUnpublishedChanges,
createdAt, updatedAt, createdBy, updatedBy
```
Draft vs published: **Save Draft** only changes `stories/{id}`. **Publish / Update Story**
validates and copies the working copy into `publishedStories/{id}` and sets status `active`.
So a live story keeps showing its last published version while it is being edited.
Desktop rule: a story is visible only when it has a published snapshot **and** status is `active`.

### ImageRef
`{ imageId, url, thumbUrl, width, height }`

### Scene
```
sceneId, imageId, imageUrl, thumbUrl, imageWidth, imageHeight, order, title,
scrollLength   // viewport heights of scrolling while pinned (1–8, default 3)
fit            // 'cover' (default) | 'contain'
transition     // { type: 'crossfade'|'fadeBlack'|'slideUp'|'zoomThrough', duration (vh) }
animationSteps: AnimationStep[]
```

### AnimationStep
```
stepId, progress (0–1 of the scene's scroll), zoomLevel (1–3),
focalPoint: { x, y, targetPositionX, targetPositionY }   // all normalized 0–1
transitionSettings: { easing, duration }   // duration = share (0.05–1) of the gap from
                                           // the previous step used for the camera move
textElements: TextElement[]
```

### TextElement
```
id, content, fontFamily, fontSize, fontWeight, fontStyle, textDecoration,
letterSpacing (em), lineHeight, textAlignment, textTransform,
color, backgroundType ('none'|'solid'|'gradient'), backgroundColor, backgroundOpacity,
backgroundGradient { from, to, angle }, borderColor, borderWidth, borderRadius, padding,
shadow { enabled, color, blur, x, y },
positionX, positionY, width, height (0 = auto)   // normalized to the stage
rotation, zIndex, opacity,
animationType ('slideUp'|'slideDown'|'slideLeft'|'slideRight'|'fadeIn'|'scaleIn'),
animationDuration, animationDelay, easing, persist
```
Sizes (`fontSize`, `padding`, `borderRadius`, `borderWidth`, shadow) are in **design units**
relative to a 1920 px wide stage. Renderers set a CSS variable `--u = stageWidth / 1920 px`, so
the 900 px editor canvas and a 4K full-screen window show identical layouts.
Timing: on the intro screen, duration/delay are seconds (played on open); on scenes they are
fractions of the scene's scroll (scrubbed by scrolling).

### Intro
`{ imageId, imageUrl, thumbUrl, imageWidth, imageHeight, overlayColor, overlayOpacity, textElements[] }`

## 4. REST API

| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/login` | public, rate-limited |
| GET | `/api/auth/me` · PATCH `/api/auth/me` · POST `/api/auth/change-password` | admin/editor |
| GET | `/api/dashboard/stats` | admin/editor |
| GET | `/api/stories?page&limit&search&status&sort` | admin/editor |
| GET/PUT | `/api/stories/:id` | admin/editor |
| POST | `/api/stories` · `/api/stories/:id/duplicate` | admin/editor |
| DELETE | `/api/stories/:id` | admin only |
| PATCH | `/api/stories/:id/status` | admin/editor |
| POST | `/api/stories/:id/publish` | admin only |
| POST | `/api/uploads/images` (multipart) · DELETE `/api/uploads/:id` | admin/editor |
| GET | `/api/desktop/stories?search&category` · `/api/desktop/stories/:id` | public, read-only |

Uploads are validated by MIME type, size, and by actually decoding them with `sharp`
(rejects spoofed files). Each upload is auto-rotated, resized to a 3840 px long edge
(enough for 3× zoom on 1080p screens), re-encoded as WebP, and gets a 640 px thumbnail.

Story listing: Firestore has no full-text search, so the server reads lightweight summaries
(`select()` without scenes) and filters, sorts and paginates in memory. This is fine up to
several thousand stories; beyond that, add Algolia/Typesense.

## 5. Main screens

**Admin**: Login → Dashboard (stat cards, status overview, recent stories) → Stories
(grid, search, filter, sort, status toggle, duplicate, delete) → Story Builder:
1. *Information*: title, description, category, status, cover, image uploader
   (multi-file, progress, drag-reorder, replace, remove).
2. *Introduction*: left image list · center 16:9 stage with draggable text boxes, zoom & fit ·
   right typography / colors / background / position / animation / layers.
3. *Scroll Experience*: left scene list (reorder, duplicate, delete) · center focal-point canvas
   (Konva; click/drag marker, live viewport frame) or the stage (exact render, draggable text) ·
   scrub bar · step timeline · right step + text properties. Autosave, Save Draft, Preview,
   Publish/Update.
   Preview is a full-screen route that runs the shared `StoryPlayer`.

**Desktop**: Home (cinematic grid, search, category filter, refresh, logo, version) →
Viewer (full-screen `StoryPlayer`, auto-hiding back button, completion screen).

## 6. Animation strategy (core feature)

### Focal-point zoom math
For viewport `W×H`, image `w×h`, base fit `b = max(W/w, H/h)` (cover; `min` for contain), zoom `z`:

```
s  = b · z                      // rendered scale
X  = tx·W − fx·w·s              // puts image point (fx,fy) at viewport point (tx,ty)
Y  = ty·H − fy·h·s
X  = clamp(X, W − w·s, 0)       // never reveal empty edges
Y  = clamp(Y, H − h·s, 0)       // (if w·s < W the image is centered instead)
transform: translate3d(X, Y, 0) scale(s)   with transform-origin 0 0
```
The focal point lands exactly on its target unless that would expose the image edge,
in which case it stays as close as possible. Positions are normalized, so the same story
frames identically at any resolution or aspect ratio.

Between two steps the engine interpolates **camera parameters**, not pixels: zoom is
interpolated in log space (constant perceived zoom speed), focal/target points linearly,
both shaped by the step's easing. The transform is then recomputed for the current viewport.

### Scroll timeline
One GSAP timeline per story, driven by one ScrollTrigger (`pin` the stage, `scrub`).
Units are viewport heights:
`intro exit (0.8) → scene 1 (scrollLength) → transition → scene 2 → … → end card`.
Each scene contributes a tween of a proxy `{p: 0→1}` whose `onUpdate` renders that scene's
camera and text state through refs (no React re-renders while scrolling). Transitions are
tweens on scene wrappers (crossfade, fade through black, slide up, zoom-through).
Since everything is a function of scroll position, scrolling up reverses it exactly.

### Text reveal
A text box belongs to a step: it enters at `step.progress + delay` over `duration`
and exits before the next step begins (unless `persist`). Opacity and offset are computed
from progress with the element's easing; the default is bottom-to-top.

### Smoothness
Lenis drives scrolling: `lenis.on('scroll', ScrollTrigger.update)` with Lenis advanced
from `gsap.ticker` and `lagSmoothing(0)`, so the two stay in sync. Only `transform` and `opacity`
are animated; each scene shows a thumbnail immediately and swaps in the full image after
`img.decode()`. Full images load for the current scene plus 2 ahead and 1 behind, and are
released when far away. Everything (ScrollTriggers, Lenis, tickers) is cleaned up on unmount.
