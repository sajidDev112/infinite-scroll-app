import { randomBytes } from 'node:crypto';
import { Font, Story } from '../models/index.js';
import { deleteFile, putFile } from './fileStorage.js';
import { ApiError } from '../utils/errors.js';
import { newId, now, plain } from '../utils/serialize.js';
import {
  FONT_FORMATS,
  FONT_NAME_PATTERN,
  isBuiltInFontName,
  sniffFontFormat,
  variantKey,
  variantLabel,
} from '../../../shared/engine/fonts.js';

const toPublic = (doc) => {
  const { familyLower: _drop, ...rest } = plain(doc);
  rest.files = (rest.files || [])
    .map(({ path: _path, ...f }) => f)
    .sort((a, b) => a.weight - b.weight || a.style.localeCompare(b.style));
  return rest;
};

/** How many stories (working copies) use each font family. */
async function usageCounts(families) {
  const counts = {};
  await Promise.all(families.map(async (family) => {
    counts[family] = await Story.countDocuments({
      $or: [
        { 'intro.textElements.fontFamily': family },
        { 'scenes.animationSteps.textElements.fontFamily': family },
      ],
    });
  }));
  return counts;
}

/** All uploaded fonts, A–Z. `withUsage` adds `usedBy` (stories using the font). */
export async function listFonts({ withUsage = false } = {}) {
  const docs = await Font.find().sort({ familyLower: 1 }).lean();
  const fonts = docs.map(toPublic);
  if (withUsage) {
    const counts = await usageCounts(fonts.map((f) => f.family));
    fonts.forEach((f) => { f.usedBy = counts[f.family] || 0; });
  }
  return fonts;
}

export function checkFamilyName(raw) {
  const family = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!family) throw ApiError.badRequest('Give the font a name.');
  if (!FONT_NAME_PATTERN.test(family)) {
    throw ApiError.badRequest('Font names can use letters, numbers, spaces, - and _ (up to 60 characters).');
  }
  if (isBuiltInFontName(family)) throw ApiError.conflict(`"${family}" is already a built-in font. Choose another name.`);
  return family;
}

/**
 * Adds font files to a family (created if new). `variants[i]` = { weight, style } for files[i].
 * A file for a weight/style the family already has replaces the old one.
 */
export async function addFontFiles({ family: rawFamily, files, variants }, admin) {
  if (!files?.length) throw ApiError.badRequest('Attach at least one font file.');
  if (variants.length !== files.length) throw ApiError.badRequest('Each font file needs a weight and style.');
  const family = checkFamilyName(rawFamily);

  // Check every file before storing any of them.
  const incoming = files.map((file, i) => {
    const format = sniffFontFormat(file.buffer.subarray(0, 4));
    if (!format) throw ApiError.badRequest(`${file.originalname}: not a font file. Use WOFF2, WOFF, TTF or OTF.`);
    const { weight, style } = variants[i];
    return { file, format, weight, style, key: variantKey(weight, style) };
  });
  const keys = incoming.map((x) => x.key);
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) {
    const v = incoming.find((x) => x.key === dup);
    throw ApiError.badRequest(`Two files are set to ${variantLabel(v)}. Give each file a different weight or style.`);
  }

  let doc = await Font.findOne({ familyLower: family.toLowerCase() });
  if (!doc) doc = new Font({ _id: newId(), family, familyLower: family.toLowerCase(), files: [], createdBy: admin.id });

  const replaced = [];
  for (const x of incoming) {
    const path = `fonts/${doc._id}/${x.key}-${randomBytes(4).toString('hex')}.${x.format}`;
    const url = await putFile(path, x.file.buffer, FONT_FORMATS[x.format].contentType);
    const entry = {
      key: x.key, weight: x.weight, style: x.style, format: x.format, path, url,
      size: x.file.size, originalName: x.file.originalname,
    };
    const at = doc.files.findIndex((f) => f.key === x.key);
    if (at >= 0) {
      replaced.push(doc.files[at].path);
      doc.files.splice(at, 1, entry);
    } else {
      doc.files.push(entry);
    }
  }
  doc.updatedAt = now();
  await doc.save();
  await Promise.all(replaced.map((p) => deleteFile(p).catch(() => {})));
  return toPublic(doc.toObject());
}

/** Removes one weight/style; removing the last one deletes the font. Returns the font or null. */
export async function deleteFontFile(id, key) {
  const doc = await Font.findById(id);
  if (!doc) throw ApiError.notFound('Font not found.');
  const file = doc.files.find((f) => f.key === key);
  if (!file) throw ApiError.notFound('That weight is not part of this font.');
  if (doc.files.length === 1) {
    await deleteFont(id);
    return null;
  }
  doc.files = doc.files.filter((f) => f.key !== key);
  doc.updatedAt = now();
  await doc.save();
  await deleteFile(file.path).catch(() => {});
  return toPublic(doc.toObject());
}

/** Deletes the font and its files. Stories using it fall back to Inter. */
export async function deleteFont(id) {
  const doc = await Font.findById(id).lean();
  if (!doc) throw ApiError.notFound('Font not found.');
  await Font.deleteOne({ _id: id });
  await Promise.all(doc.files.map((f) => deleteFile(f.path).catch(() => {})));
}
