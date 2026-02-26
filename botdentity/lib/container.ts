import db from './db';
import { createIdentityService } from './services/identity';
import { createJwtService } from './services/jwt';
import { createCreditsService } from './services/credits';

export const identityService = createIdentityService(db);
export const jwtService = createJwtService(db);
export const creditsService = createCreditsService(db);
