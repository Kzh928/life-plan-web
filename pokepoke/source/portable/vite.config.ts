import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import path from 'node:path';
export default defineConfig({root:path.resolve('portable'),base:'./',plugins:[react()],resolve:{alias:{'@':path.resolve('.')}},build:{outDir:path.resolve('portable-build'),emptyOutDir:true,cssCodeSplit:false,rollupOptions:{output:{inlineDynamicImports:true}}}});
