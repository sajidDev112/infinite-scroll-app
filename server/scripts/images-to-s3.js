/**
 * Moves story images from MongoDB (GridFS) into the S3 bucket, one folder per story:
 *   <S3_ROOT_FOLDER>/stories/<story-name>-<id>/…   and   <S3_ROOT_FOLDER>/settings/footer-logo/…
 *
 *   npm run images:check                 test the bucket connection (writes + deletes a tiny file)
 *   npm run images:to-s3 -- --dry-run    show what would happen, change nothing
 *   npm run images:to-s3                 copy to S3 and update the links (GridFS copies kept)
 *   npm run images:to-s3 -- --cleanup-gridfs   afterwards: delete the old GridFS image copies
 *
 * Safe to run again: images already in their story's S3 folder are skipped.
 */
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import { assertEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { Image, Setting, Story } from '../src/models/index.js';
import { checkS3, s3Config, s3Enabled } from '../src/services/imageStore.js';
import { fileFooterLogo, fileStoryImages } from '../src/services/imageService.js';
import { deleteFile } from '../src/services/fileStorage.js';

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    'cleanup-gridfs': { type: 'boolean', default: false },
  },
});
const dryRun = values['dry-run'];

if (!s3Enabled()) {
  console.error('S3 is not configured. Add AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to server/.env.');
  process.exit(1);
}
const cfg = s3Config();
console.log(`Bucket "${cfg.bucket}" (${cfg.region}), folder "${cfg.root}/"`);

if (values.check) {
  try {
    const r = await checkS3();
    console.log(`Upload + read back: ${r.readBack ? 'OK' : 'FAILED'}`);
    console.log(`Public link (${r.url}): HTTP ${r.publicStatus}`);
    if (r.publicStatus !== 200) {
      console.log('  Visitors could not open it: check the bucket policy (public read for the project folder)');
      console.log('  and that "Block all public access" is off for the bucket.');
    }
    process.exit(r.readBack ? 0 : 1);
  } catch (err) {
    console.error(`S3 check failed: ${err.name}: ${err.message}`);
    process.exit(1);
  }
}

assertEnv();
await connectDb();
const log = (m) => console.log(`  ${m}`);

try {
  if (values['cleanup-gridfs']) {
    // Delete GridFS image files no Image record points at any more (fonts live in their own bucket).
    const files = mongoose.connection.db.collection('images.files');
    const used = new Set();
    (await Image.find({ storage: { $ne: 's3' } }, 'fullPath thumbPath').lean()).forEach((i) => { used.add(i.fullPath); used.add(i.thumbPath); });
    const all = await files.find({}, { projection: { filename: 1 } }).toArray();
    const unused = all.filter((f) => !f.filename.startsWith('fonts/') && !used.has(f.filename));
    console.log(`${unused.length} old GridFS image file(s) to delete${dryRun ? ' (dry run)' : ''}.`);
    if (!dryRun) for (const f of unused) await deleteFile(f.filename);
  } else {
    const stories = await Story.find({}, 'title').sort({ createdAt: 1 }).lean();
    let changed = 0;
    let missing = 0;
    for (const s of stories) {
      console.log(`Story "${s.title}" (${s._id})`);
      const r = await fileStoryImages(s._id, { dryRun, log, keepOld: true });
      const n = Object.values(r.changes).filter((c) => c.url !== undefined).length;
      changed += dryRun ? Object.keys(r.changes).length : n;
      missing += r.missing.length;
      if (r.missing.length) log(`! ${r.missing.length} image(s) missing (lost earlier): ${r.missing.join(', ')}`);
    }

    const footer = await Setting.findById('footer').lean();
    if (footer?.value?.logo?.imageId) {
      console.log('Footer logo');
      const logo = await fileFooterLogo(footer.value.logo, { dryRun, log, keepOld: true });
      if (!dryRun) await Setting.updateOne({ _id: 'footer' }, { $set: { 'value.logo': logo } });
    }

    const leftover = await Image.countDocuments({ storage: { $ne: 's3' } });
    console.log(`\nDone${dryRun ? ' (dry run, nothing changed)' : ''}. Stories: ${stories.length}. Missing images: ${missing}.`);
    console.log(`Images still in MongoDB: ${leftover}${leftover ? ' (not used by any story; they are left as they are)' : ''}.`);

    if (!dryRun) {
      // Every S3 image should open from its public link.
      const s3Images = await Image.find({ storage: 's3' }, 'url thumbUrl').lean();
      let bad = 0;
      for (const img of s3Images) {
        for (const u of [img.url, img.thumbUrl]) {
          const st = await fetch(u, { method: 'HEAD' }).then((r) => r.status).catch(() => 0);
          if (st !== 200) {
            bad++;
            if (bad <= 5) console.log(`  ! ${u} → HTTP ${st}`);
          }
        }
      }
      console.log(`Public link check: ${s3Images.length * 2 - bad}/${s3Images.length * 2} files open.`);
    }
  }
} finally {
  await disconnectDb();
}
