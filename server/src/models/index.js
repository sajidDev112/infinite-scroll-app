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
  uploadedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
}, options('images'));

export const Admin = mongoose.models.Admin || model('Admin', adminSchema);
export const Story = mongoose.models.Story || model('Story', storySchema);
export const PublishedStory = mongoose.models.PublishedStory || model('PublishedStory', publishedStorySchema);
export const Image = mongoose.models.Image || model('Image', imageSchema);
