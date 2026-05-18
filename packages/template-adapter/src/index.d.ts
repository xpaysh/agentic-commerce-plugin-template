import type {
  PlatformAdapter,
  Product,
  Paginated,
  ProductQuery,
} from '@xpaysh/adapter-contract';

/** A working PlatformAdapter you can copy as a starting point. */
export type TemplateAdapter = PlatformAdapter;

export declare const DEMO_PRODUCTS: readonly Product[];

export declare function createTemplateAdapter(opts?: {
  currency?: string;
}): TemplateAdapter;

export declare const templateAdapter: TemplateAdapter;
