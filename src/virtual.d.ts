declare const __APP_VERSION__: string;

declare module 'virtual:content' {
  /** The bundle with every topic's items left out; see src/engine/bundle-split.ts. */
  const index: import('./model/content.ts').Bundle;
  export default index;
  /** Loads one domain's full topics, for each domain that has any. */
  export const loaders: Record<string, () => Promise<{ default: import('./model/content.ts').Topic[] }>>;
}
