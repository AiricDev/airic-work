import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig(({mode}) => {
 const environment={...loadEnv(mode,resolve(import.meta.dirname,'..'),''),...process.env};
 return {define:{'import.meta.env.VITE_REFERENCE_TEMPLATES':JSON.stringify(environment.VITE_REFERENCE_TEMPLATES??'{}')},plugins:[react()],server:{proxy:{'/api':{target:environment.AIRIC_API_TARGET??'http://127.0.0.1:8010',changeOrigin:false}}}};
});
