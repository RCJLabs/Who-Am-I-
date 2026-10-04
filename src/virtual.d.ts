declare const __APP_VERSION__: string;

declare module 'virtual:content' {
  /** The bundle with every topic's items left out; see src/engine/bundle-split.ts. */
  const index: import('./model/content.ts').Bundle;
  export default index;
  /** Loads one domain's full topics, for each domain that has any. */
  export const loaders: Record<string, () => Promise<{ default: import('./model/content.ts').Topic[] }>>;
}

declare module 'virtual:analysis' {
  /** The analysis pack (content/analysis/): political traditions and readings; null without one. */
  const pack: import('./model/analysis.ts').AnalysisPack | null;
  export default pack;
}
