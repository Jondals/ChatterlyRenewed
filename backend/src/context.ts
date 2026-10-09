/**
 * src/context.ts
 * The shared context (database, configuration, realtime hub and login throttle) that every route receives.
 */
import type { AppConfig } from './config';
import type { Db } from './db';
import type { Hub } from './ws/hub';
import type { LoginThrottle } from './security/throttle';

export interface AppContext {
  db: Db;
  config: AppConfig;
  hub: Hub;
  throttle: LoginThrottle;
}
