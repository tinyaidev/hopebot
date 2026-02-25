import db, { UPLOADS_DIR } from './db';
import { createBlobService } from './services/blobs';

export const blobService = createBlobService(db, UPLOADS_DIR);
