import { z } from 'zod';
import { STORY_STATUSES, ZOOM_MAX, ZOOM_MIN } from '../../../shared/engine/constants.js';
import { FOOTER_MAX_BUTTONS, FOOTER_TYPE_IDS } from '../../../shared/engine/footer.js';

const id = z.string().min(1).max(80);
const color = z.string().max(64);
const unit = z.number().min(0).max(1);
const num = (min, max) => z.number().finite().min(min).max(max);
const urlish = z.string().max(2048);

// ---- auth ---------------------------------------------------------------------
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.').max(200),
  remember: z.boolean().optional().default(false),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.').max(200),
});

// ---- story content -------------------------------------------------------------
export const textElementSchema = z
  .object({
    id,
    content: z.string().max(2000),
    fontFamily: z.string().max(80),
    fontSize: num(4, 400),
    fontWeight: z.number().int().min(100).max(900),
    fontStyle: z.enum(['normal', 'italic']),
    textDecoration: z.enum(['none', 'underline']),
    letterSpacing: num(-0.2, 1),
    lineHeight: num(0.6, 4),
    textAlignment: z.enum(['left', 'center', 'right', 'justify']),
    textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']),
    color,
    backgroundType: z.enum(['none', 'solid', 'gradient']),
    backgroundColor: color,
    backgroundOpacity: unit,
    backgroundGradient: z.object({ from: color, to: color, angle: num(0, 360) }),
    borderColor: color,
    borderWidth: num(0, 40),
    borderRadius: num(0, 400),
    padding: num(0, 400),
    shadow: z.object({ enabled: z.boolean(), color, blur: num(0, 200), x: num(-200, 200), y: num(-200, 200) }),
    positionX: num(-1, 2),
    positionY: num(-1, 2),
    width: unit,
    height: unit,
    rotation: num(-180, 180),
    zIndex: z.number().int().min(0).max(999),
    opacity: unit,
    animationType: z.enum(['slideUp', 'slideDown', 'slideLeft', 'slideRight', 'fadeIn', 'scaleIn']),
    animationDuration: num(0, 10),
    animationDelay: num(0, 10),
    easing: z.string().max(40),
    persist: z.boolean(),
  })
  .partial()
  .required({ id: true, content: true });

const focalSchema = z.object({ x: unit, y: unit, targetPositionX: unit, targetPositionY: unit });

export const stepSchema = z.object({
  stepId: id,
  progress: unit,
  zoomLevel: num(ZOOM_MIN, ZOOM_MAX),
  focalPoint: focalSchema,
  transitionSettings: z.object({ easing: z.string().max(40), duration: num(0.05, 1), blur: num(0, 30) }).partial().optional(),
  textElements: z.array(textElementSchema).max(20).default([]),
});

export const sceneSchema = z.object({
  sceneId: id,
  imageId: id,
  imageUrl: urlish,
  thumbUrl: urlish.optional(),
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  order: z.number().int().min(0),
  title: z.string().max(200).optional().default(''),
  // Shown to viewers behind the (i) icon on the image.
  imageCredit: z.string().max(1000).optional(),
  scrollLength: num(1, 12).optional(),
  fit: z.enum(['cover', 'contain']).optional(),
  openWithFullImage: z.boolean().optional(),
  overlayColor: color.optional(),
  overlayOpacity: unit.optional(),
  transition: z
    .object({ type: z.enum(['slideOver', 'crossfade', 'fadeBlack', 'slideUp', 'zoomThrough']), duration: num(0.2, 2) })
    .optional(),
  animationSteps: z.array(stepSchema).max(30),
});

export const imageRefSchema = z
  .object({ imageId: id, url: urlish, thumbUrl: urlish.optional(), width: z.number().int().positive(), height: z.number().int().positive(), credit: z.string().max(1000).optional() })
  .nullable();

// Part of the intro (cover) image the admin chose: a box in fractions of the image
// (x, y = top-left, w, h = size); see introCropBox() in shared/engine/defaults.js.
// `zoom` is the first crop format ({ x, y, zoom }), still read for drafts saved with it.
const introCropSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().gt(0).max(1).optional(),
  h: z.number().gt(0).max(1).optional(),
  zoom: z.number().min(1).max(4).optional(),
  aspect: z.number().positive().max(10).optional(),
});

export const introSchema = z.object({
  imageId: id.nullable().optional(),
  imageUrl: urlish.nullable().optional(),
  thumbUrl: urlish.nullable().optional(),
  imageWidth: z.number().int().positive().nullable().optional(),
  imageHeight: z.number().int().positive().nullable().optional(),
  overlayColor: color.optional(),
  overlayOpacity: unit.optional(),
  exitType: z.enum(['fade', 'slideOver']).optional(),
  textElements: z.array(textElementSchema).max(30).default([]),
  showFooter: z.boolean().optional(),
  crop: introCropSchema.optional(),
  // Text + overlay kept for the other background choices (key = image id or 'auto').
  layouts: z
    .record(
      z.string().max(64),
      z.object({
        textElements: z.array(textElementSchema).max(30).default([]),
        overlayColor: color.optional(),
        overlayOpacity: unit.optional(),
        showFooter: z.boolean().optional(),
        crop: introCropSchema.optional(),
      }),
    )
    .refine((r) => Object.keys(r).length <= 60, 'Too many saved intro layouts.')
    .optional(),
});

const storyFields = {
  title: z.string().trim().min(1, 'Story title is required.').max(160),
  description: z.string().max(2000).default(''),
  // Who wrote the story; shown on the cover as 'By …'. Empty = no byline.
  author: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).default(''),
  coverImage: imageRefSchema.default(null),
  status: z.enum(STORY_STATUSES).default('draft'),
  intro: introSchema.optional(),
  scenes: z.array(sceneSchema).max(60).default([]),
};

export const createStorySchema = z.object(storyFields);

export const updateStorySchema = z
  .object({
    title: storyFields.title,
    description: z.string().max(2000),
    author: z.string().trim().max(120),
    category: z.string().trim().max(60),
    coverImage: imageRefSchema,
    status: z.enum(STORY_STATUSES),
    intro: introSchema,
    scenes: z.array(sceneSchema).max(60),
  })
  .partial();

export const statusSchema = z.object({ status: z.enum(STORY_STATUSES) });

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  search: z.string().trim().max(100).optional().default(''),
  status: z.enum(['all', ...STORY_STATUSES]).optional().default('all'),
  sort: z.enum(['newest', 'oldest', 'updated', 'title']).optional().default('newest'),
});

export const desktopQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(''),
  category: z.string().trim().max(60).optional().default(''),
});

export const idParamSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'Invalid id.') });

// ---- site settings: intro footer ----------------------------------------------------
export const footerSchema = z.object({
  brandName: z.string().trim().max(80),
  showBrandName: z.boolean(),
  showLogo: z.boolean(),
  logo: z.object({ imageId: z.string().max(64).nullable().optional(), url: z.string().min(1).max(2048) }).nullable(),
  buttons: z.array(z.object({
    type: z.enum(FOOTER_TYPE_IDS),
    enabled: z.boolean(),
    mode: z.enum(['action', 'share', 'link']),
    url: z.string().trim().max(500).optional().default(''),
  })).max(FOOTER_MAX_BUTTONS),
});
