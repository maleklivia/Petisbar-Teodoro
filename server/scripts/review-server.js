// Loopback-only UI harness. Never runs against the operational database.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import argon2 from 'argon2';
if(process.env.NODE_ENV!=='test'||!process.env.DATABASE_URL?.includes('petisbar_review_'))throw new Error('Dedicated review database required');
const {buildApp}=await import('../src/app.js');const {db}=await import('../src/db.js');
const app=await buildApp();await app.ready();
const password=randomUUID()+randomUUID(),email=`review-ui-${randomUUID()}@example.invalid`;
await db.query("INSERT INTO users(role_id,name,email,password_hash) SELECT id,'Homologação isolada',$1,$2 FROM roles WHERE name='admin'",[email,await argon2.hash(password)]);
const login=await app.inject({method:'POST',url:'/api/v1/auth/login',payload:{email,password}});
if(login.statusCode!==200)throw new Error('Review login failed');
const sessionCookie=login.headers['set-cookie'];
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
  try{
    if(req.url.startsWith('/api/')){
      const parts=[];for await(const part of req)parts.push(part);
      const result=await app.inject({method:req.method,url:req.url,headers:req.headers,payload:parts.length?Buffer.concat(parts):undefined});
      res.writeHead(result.statusCode,result.headers);res.end(result.rawPayload);return;
    }
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/pages/dashboard.html':pathname));
    if(!file.startsWith(root+path.sep)||pathname.startsWith('/server/')||!mime[path.extname(file)]){res.writeHead(404);res.end();return;}
    const body=await fs.readFile(file);const headers={'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store'};
    if(file.endsWith('.html'))headers['Set-Cookie']=sessionCookie;
    res.writeHead(200,headers);res.end(body);
  }catch{res.writeHead(404);res.end('Não encontrado');}
}).listen(3307,'127.0.0.1',()=>console.log('Isolated review UI ready on loopback port 3307'));
