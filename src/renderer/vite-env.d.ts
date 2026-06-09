/// <reference types="vite/client" />

import type { PoscoreApi } from '../preload/preload';

declare global {
  interface Window {
    poscore: PoscoreApi;
  }
}
