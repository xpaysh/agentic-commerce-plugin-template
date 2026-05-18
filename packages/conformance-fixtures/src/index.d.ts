export interface FixtureMeta {
  protocol: 'acp' | 'ucp' | 'ap2';
  spec_version: string;
  operation?: string;
  method?: string;
  path?: string;
  status?: number;
  summary?: string;
  source?: string;
  path_params?: Record<string, string>;
}

export interface Fixture {
  _meta: FixtureMeta;
  headers?: Record<string, string>;
  body: unknown;
}

export declare const FIXTURES_DIR: string;
export declare function loadFixture(relativePath: string): Fixture;
export declare function listFixtures(protocol: 'acp' | 'ucp' | 'ap2'): string[];
export declare function loadAllFixtures(
  protocol: 'acp' | 'ucp' | 'ap2',
): Array<{ filename: string; fixture: Fixture }>;
export declare function acpFixturesByName(): Record<string, Fixture>;
