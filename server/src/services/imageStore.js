import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { deleteFile, getFile, putFile } from './fileStorage.js';

/**
 * Where image files live. With the AWS_* settings in .env they go to the S3 bucket
 * (served straight from S3); without them, to MongoDB GridFS (served at /uploads/…).
 * Fonts always stay in GridFS.
 *
 * Keys look like  <S3_ROOT_FOLDER>/stories/<story-folder>/<name>-<imageId>-full.webp
 */
const CACHE_FOREVER = 'public, max-age=31536000, immutable'; // keys are unique per file

export const s3Config = () => ({
  region: (process.env.AWS_REGION || '').trim(),
  bucket: (process.env.AWS_S3_BUCKET || '').trim(),
  accessKeyId: (process.env.AWS_ACCESS_KEY_ID || '').trim(),
  secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || '').trim(),
  root: (process.env.S3_ROOT_FOLDER || 'infinite-scroll-app').trim().replace(/^\/+|\/+$/g, ''),
  publicUrl: (process.env.S3_PUBLIC_URL || '').trim().replace(/\/+$/, ''), // e.g. a CloudFront address
});

/** S3 is used when the bucket and keys are set (IMAGE_STORAGE=gridfs forces MongoDB). */
export function s3Enabled() {
  if ((process.env.IMAGE_STORAGE || '').toLowerCase() === 'gridfs') return false;
  const c = s3Config();
  return Boolean(c.region && c.bucket && c.accessKeyId && c.secretAccessKey);
}

export const rootFolder = () => s3Config().root || 'infinite-scroll-app';

let client = null;
let clientKey = '';
function s3() {
  const c = s3Config();
  const key = `${c.region}|${c.accessKeyId}`;
  if (!client || clientKey !== key) {
    client = new S3Client({ region: c.region, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } });
    clientKey = key;
  }
  return client;
}

const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');

export function s3Url(key) {
  const c = s3Config();
  return `${c.publicUrl || `https://${c.bucket}.s3.${c.region}.amazonaws.com`}/${encodeKey(key)}`;
}

const stores = {
  s3: {
    name: 's3',
    async put(key, body, contentType) {
      const { bucket } = s3Config();
      await s3().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: CACHE_FOREVER }));
      return s3Url(key);
    },
    async copy(fromKey, toKey) {
      const { bucket } = s3Config();
      await s3().send(new CopyObjectCommand({
        Bucket: bucket,
        Key: toKey,
        CopySource: `${bucket}/${encodeKey(fromKey)}`,
        MetadataDirective: 'COPY',
      }));
      return s3Url(toKey);
    },
    async read(key) {
      const { bucket } = s3Config();
      try {
        const out = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return { data: Buffer.from(await out.Body.transformToByteArray()), contentType: out.ContentType };
      } catch (err) {
        if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null;
        throw err;
      }
    },
    async exists(key) {
      const { bucket } = s3Config();
      try {
        await s3().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch (err) {
        if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') return false;
        throw err;
      }
    },
    async remove(key) {
      if (!key) return;
      const { bucket } = s3Config();
      await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    url: s3Url,
  },
  gridfs: {
    name: 'gridfs',
    put: (key, body, contentType) => putFile(key, body, contentType),
    async copy(fromKey, toKey) {
      const file = await getFile(fromKey);
      if (!file) throw new Error(`File not found: ${fromKey}`);
      return putFile(toKey, file.data, file.contentType);
    },
    read: (key) => getFile(key),
    exists: async (key) => Boolean(await getFile(key)),
    remove: (key) => deleteFile(key),
    url: (key) => `/uploads/${key}`,
  },
};

/** The store new images go to. */
export const currentStore = () => (s3Enabled() ? stores.s3 : stores.gridfs);

/** The store an existing image record lives in (records from before S3 have no `storage`). */
export const storeOf = (image) => stores[image?.storage] || stores.gridfs;

/** Checks the bucket can be written, read and deleted (used by the setup check script). */
export async function checkS3() {
  const key = `${rootFolder()}/.connection-check-${Date.now()}.txt`;
  const url = await stores.s3.put(key, Buffer.from('ok'), 'text/plain');
  const back = await stores.s3.read(key);
  const publicStatus = await fetch(url).then((r) => r.status).catch((e) => `error: ${e.message}`);
  await stores.s3.remove(key);
  return { url, readBack: back?.data?.toString() === 'ok', publicStatus };
}
