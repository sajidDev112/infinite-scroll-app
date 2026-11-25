import { Setting } from '../models/index.js';
import { ApiError } from '../utils/errors.js';
import { now } from '../utils/serialize.js';
import { DEFAULT_FOOTER, footerIssues, normalizeFooter } from '../../../shared/engine/footer.js';
import { cleanupImages, fileFooterLogo } from './imageService.js';

const FOOTER_ID = 'footer';

/** The intro footer settings (defaults until an admin saves). */
export async function getFooter() {
  const doc = await Setting.findById(FOOTER_ID).lean();
  return normalizeFooter(doc?.value || DEFAULT_FOOTER);
}

export async function updateFooter(input, admin) {
  const footer = normalizeFooter(input);
  const issues = footerIssues(footer);
  if (issues.length) {
    throw ApiError.unprocessable('Some footer buttons need a link.', issues.map((x) => ({ path: `buttons.${x.index}.url`, message: x.message })));
  }
  // A logo uploaded somewhere else is moved into settings/footer-logo.
  if (footer.logo?.imageId) footer.logo = await fileFooterLogo(footer.logo).catch(() => footer.logo);
  const before = await getFooter();
  await Setting.updateOne(
    { _id: FOOTER_ID },
    { $set: { value: footer, updatedAt: now(), updatedBy: admin.id } },
    { upsert: true },
  );
  // A replaced or removed logo upload is deleted (unless a story happens to use it).
  const oldLogo = before.logo?.imageId;
  if (oldLogo && oldLogo !== footer.logo?.imageId) cleanupImages([oldLogo]);
  return footer;
}

export async function resetFooter(admin) {
  return updateFooter(DEFAULT_FOOTER, admin);
}
