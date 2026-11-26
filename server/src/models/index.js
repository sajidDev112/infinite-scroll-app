import mongoose from 'mongoose';
import { newId } from '../utils/serialize.js';

const { Schema, model } = mongoose;
const Mixed = Schema.Types.Mixed;

// Ids are 20-character strings (not ObjectIds); existing ids are already in URLs,
// story image references and the desktop app's cache, so they must stay strings.
const idField = { type: String, default: newId };
const options = (collection) => ({ collection, versionKey: false, minimize: false });

/** Dashboard users. */
const adminSchema = new Schema({
  _id: idField,
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'editor'], default: 'admin' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: null },
}, options('admins'));

/** A story as edited in the dashboard (the working copy). */
const storySchema = new Schema({
  _id: idField,
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  author: { type: String, default: '' }, // shown on the cover as 'By …'
  category: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'active', 'inactive'], default: 'draft', index: true },
  coverImage: { type: Mixed, default: null },
  intro: { type: Mixed, default: null },
  scenes: { type: [Mixed], default: [] },
  // Derived on every write (see storyService):
  thumbnail: { type: Mixed, default: null },
  imageIds: { type: [String], default: [], index: true },
  imageCount: { type: Number, default: 0 },
  sceneCount: { type: Number, default: 0 },
  titleLower: { type: String, default: '' },
  // Image folder (S3 / GridFS) for this story, e.g. "the-lighthouse-xk3d9a"; set once, kept on rename.
  folder: { type: String, default: null },
  // Publishing:
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date, default: null },
  publishedVersion: { type: Number, default: 0 },
  hasUnpublishedChanges: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now, index: true },
  createdBy: { type: String, default: null },
  updatedBy: { type: String, default: null },
}, options('stories'));

/** The snapshot visitors see; _id equals the story's id. Only written by Publish. */
const publishedStorySchema = new Schema({
  _id: { type: String, required: true },
  storyId: { type: String, required: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  author: { type: String, default: '' }, // shown on the cover as 'By …'
  category: { type: String, default: '' },
  coverImage: { type: Mixed, default: null },
  intro: { type: Mixed, default: null },
  scenes: { type: [Mixed], default: [] },
  imageIds: { type: [String], default: [], index: true },
  sceneCount: { type: Number, default: 0 },
  titleLower: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  publishedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 },
}, options('publishedStories'));

/** An uploaded image. The WebP files themselves live in GridFS (bucket "images"). */
const imageSchema = new Schema({
  _id: idField,
  url: { type: String, required: true },
  thumbUrl: { type: String, required: true },
  fullPath: { type: String, required: true },
  thumbPath: { type: String, required: true },
  width: Number,
  height: Number,
  size: Number,
  originalName: String,
  originalSize: Number,
  mimeType: { type: String, default: 'image/webp' },
  // Where the files are: 's3' (bucket) or 'gridfs' (MongoDB; images from before S3).
  storage: { type: String, enum: ['s3', 'gridfs'], default: 'gridfs' },
  // The story whose folder holds the files; 'settings' for the footer logo; null = not filed yet.
  owner: { type: String, default: null, index: true },
  uploadedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
}, options('images'));

/** Site-wide settings; one document per key (e.g. _id 'footer' = the intro footer). */
const settingSchema = new Schema({
  _id: { type: String, required: true },
  value: { type: Mixed, default: null },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String, default: null },
}, options('settings'));

/**
 * A font uploaded in Settings → Fonts: one family, one file per weight/style.
 * The files live in GridFS (bucket "images") under fonts/<id>/…
 */
const fontSchema = new Schema({
  _id: idField,
  family: { type: String, required: true, trim: true, maxlength: 60 },
  familyLower: { type: String, required: true, unique: true },
  files: {
    type: [{
      _id: false,
      key: { type: String, required: true }, // "700-italic"
      weight: { type: Number, required: true },
      style: { type: String, enum: ['normal', 'italic'], default: 'normal' },
      format: { type: String, required: true }, // woff2 | woff | ttf | otf
      path: { type: String, required: true },
      url: { type: String, required: true },
      size: Number,
      originalName: String,
    }],
    default: [],
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: String, default: null },
}, options('fonts'));

export const Admin =mongoose.models.Admin || model('Admin', adminSchema);
export const Story = mongoose.models.Story || model('Story', storySchema);
export const PublishedStory = mongoose.models.PublishedStory || model('PublishedStory', publishedStorySchema);
export const Image = mongoose.models.Image || model('Image', imageSchema);
export const Setting = mongoose.models.Setting || model('Setting', settingSchema);
export const Font = mongoose.models.Font || model('Font', fontSchema);
