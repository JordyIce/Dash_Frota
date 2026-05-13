/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHEET_ID?: string;
  readonly VITE_GID_VELOE?: string;
  readonly VITE_SHEET_ID_OCIOSO?: string;
  readonly VITE_GID_OCIOSO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
