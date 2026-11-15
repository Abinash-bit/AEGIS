/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** full backend URL, e.g. https://aegis-api.onrender.com */
  readonly VITE_API_BASE?: string
  /** backend host only (Render's fromService "host"), e.g. aegis-api.onrender.com */
  readonly VITE_API_HOST?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
