import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "")
  const apiUrl = environment.VITE_API_URL?.trim()

  if (!apiUrl) {
    throw new Error(`[vite] VITE_API_URL não está configurada para o modo "${mode}".`)
  }

  try {
    const parsedUrl = new URL(apiUrl)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error()
  } catch {
    throw new Error(`[vite] VITE_API_URL deve ser uma URL HTTP(S) absoluta válida.`)
  }

  return {
    base: '/',
    plugins: [inspectAttr(), react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
});
