import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requirePermission } from '../middleware/auth.js';
const schema=z.object({titulo:z.string().trim().min(1).max(200),categoria:z.string().trim().min(1).max(100),
  data:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),
  link:z.string().max(2000).refine(v=>!v||/^https?:\/\//i.test(v)).default(''),notas:z.string().max(5000).default('')});
const map=d=>({id:d.id,titulo:d.title,categoria:d.category,data:d.expires_on?String(d.expires_on).slice(0,10):'',link:d.link,notas:d.notes,dataCadastro:d.created_at});
export default async function documentRoutes(app){
  app.get('/documents',{preHandler:requirePermission('reports.read')},async()=>({data:(await app.db.query('SELECT *,expires_on::text FROM business_documents WHERE active ORDER BY created_at DESC')).rows.map(map)}));
  const save=async(request,reply)=>{const b=schema.parse(request.body),id=request.params.id||`doc-${randomUUID()}`;
    const result=request.params.id?await app.db.query('UPDATE business_documents SET title=$2,category=$3,expires_on=nullif($4,\'\')::date,link=$5,notes=$6,updated_at=now() WHERE id=$1 AND active RETURNING *,expires_on::text',[id,b.titulo,b.categoria,b.data,b.link,b.notas]):await app.db.query('INSERT INTO business_documents(id,title,category,expires_on,link,notes,created_by) VALUES($1,$2,$3,nullif($4,\'\')::date,$5,$6,$7) RETURNING *,expires_on::text',[id,b.titulo,b.categoria,b.data,b.link,b.notas,request.user.id]);
    if(!result.rowCount)return reply.code(404).send({error:'document_not_found'});return{data:map(result.rows[0])};};
  app.post('/documents',{preHandler:requirePermission('settings.manage')},save);
  app.put('/documents/:id',{preHandler:requirePermission('settings.manage')},save);
  app.delete('/documents/:id',{preHandler:requirePermission('settings.manage')},async request=>({data:(await app.db.query('UPDATE business_documents SET active=false,updated_at=now() WHERE id=$1 RETURNING id',[request.params.id])).rows[0]}));
}
