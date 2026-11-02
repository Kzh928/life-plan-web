import {build} from 'vite';import fs from 'node:fs/promises';import path from 'node:path';
await build({configFile:path.resolve('portable/vite.config.ts')});
const dir='portable-build';let html=await fs.readFile(`${dir}/index.html`,'utf8');for(const name of await fs.readdir(`${dir}/assets`)){const content=await fs.readFile(`${dir}/assets/${name}`,'utf8');if(name.endsWith('.js'))html=html.replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/,()=>`<script type="module">${content.replaceAll('</script','<\\/script')}</script>`);if(name.endsWith('.css'))html=html.replace(/<link[^>]+rel="stylesheet"[^>]*>/,()=>`<style>${content.replaceAll('</style','<\\/style')}</style>`)}
await fs.writeFile(`${dir}/index.html`,html);await fs.rm(`${dir}/assets`,{recursive:true});
await fs.copyFile('portable/sw.js',`${dir}/sw.js`);await fs.writeFile(`${dir}/.nojekyll`,'');console.log('Standalone HTML ready (no CDN, auth or server API dependency)');
