export interface ACPSession {
  id: string;
  status?: string;
  currency?: string;
  line_items?: unknown[];
  totals?: unknown;
  fulfillment_options?: unknown[];
  capabilities?: Record<string, unknown>;
  expiresAt?: string;
  [key: string]: unknown;
}

export interface SessionStore {
  put(session: ACPSession): Promise<void>;
  get(sessionId: string): Promise<ACPSession | null>;
  patch(sessionId: string, patch: Partial<ACPSession>): Promise<ACPSession | null>;
  delete(sessionId: string): Promise<boolean>;
}

export interface InMemoryOptions {
  sweepEverySeconds?: number;
}

export interface DynamoDBOptions {
  pluginId: string;
  tableName?: string;
  region?: string;
  /** Optional pre-built DynamoDBClient (e.g. for tests with a local stub). */
  client?: unknown;
}

export interface FactoryOptions extends InMemoryOptions, Partial<DynamoDBOptions> {
  driver?: 'memory' | 'dynamodb';
}

export declare class InMemorySessionStore implements SessionStore {
  constructor(opts?: InMemoryOptions);
  put(session: ACPSession): Promise<void>;
  get(sessionId: string): Promise<ACPSession | null>;
  patch(sessionId: string, patch: Partial<ACPSession>): Promise<ACPSession | null>;
  delete(sessionId: string): Promise<boolean>;
}

export declare class DynamoDBSessionStore implements SessionStore {
  constructor(opts: DynamoDBOptions);
  put(session: ACPSession): Promise<void>;
  get(sessionId: string): Promise<ACPSession | null>;
  patch(sessionId: string, patch: Partial<ACPSession>): Promise<ACPSession | null>;
  delete(sessionId: string): Promise<boolean>;
}

export declare function createSessionStore(opts?: FactoryOptions): SessionStore;
