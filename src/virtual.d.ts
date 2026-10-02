declare const __APP_VERSION__: string;

declare module 'virtual:content' {
  const bundle: import('./model/content.ts').Bundle;
  export default bundle;
}
