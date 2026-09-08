import { createHash } from 'node:crypto';
import { z } from 'zod';
import { transaction } from '../db.js';
import { requirePermission } from '../middleware/auth.js';

const importSchema = z.object({
  snapshot: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(12).max(200).optional(),
});

const array = value => Array.isArray(value) ? value : [];
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const text = value => value == null ? '' : String(value);

export default async function migrationRoutes(app) {
  app.post('/migration/local-storage', {
    preHandler: requirePermission('migration.run'),
    bodyLimit: 5 * 1024 * 1024,
  }, async (request, reply) => {
    const parsed = importSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error' });

    const snapshot = parsed.data.snapshot;
    const idempotencyKey = parsed.data.idempotencyKey || createHash('sha256')
      .update(JSON.stringify(snapshot)).digest('hex');

    const existing = await app.db.query('SELECT id, summary, created_at FROM import_batches WHERE idempotency_key = $1', [idempotencyKey]);
    if (existing.rowCount) return { imported: false, duplicate: true, batch: existing.rows[0] };

    const summary = await transaction(async client => {
      const batch = await client.query(`
        INSERT INTO import_batches (idempotency_key, imported_by, payload)
        VALUES ($1, $2, $3) RETURNING id
      `, [idempotencyKey, request.user.id, snapshot]);
      const batchId = batch.rows[0].id;

      const collections = {
        produtos: array(snapshot.produtos), ingredientes: array(snapshot.ingredientes),
        fichas: array(snapshot.fichas), pedidos: array(snapshot.pedidos),
        clientes: array(snapshot.clientes), fornecedores: array(snapshot.fornecedores),
        compras: array(snapshot.compras), movimentacoes: array(snapshot.movimentacoes),
        cupons: array(snapshot.cupons), documentos: array(snapshot.documentos),
        financeiro: array(snapshot.financeiro),
      };

      for (const [resourceType, records] of Object.entries(collections)) {
        for (let index = 0; index < records.length; index += 1) {
          const record = records[index];
          const sourceId = text(record?.id || record?.codigo || `${resourceType}-${index}`);
          await client.query(`
            INSERT INTO legacy_records (resource_type, source_id, payload, import_batch_id)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (resource_type, source_id) DO UPDATE SET payload=EXCLUDED.payload, import_batch_id=EXCLUDED.import_batch_id
          `, [resourceType, sourceId, record, batchId]);
        }
      }

      for (const p of collections.produtos) {
        await client.query(`
          INSERT INTO products (id,sku,name,category,description,sale_price,purchase_cost,active,
            preparation_minutes,current_stock,minimum_stock,photo_url)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          ON CONFLICT (id) DO UPDATE SET sku=EXCLUDED.sku,name=EXCLUDED.name,category=EXCLUDED.category,
            description=EXCLUDED.description,sale_price=EXCLUDED.sale_price,purchase_cost=EXCLUDED.purchase_cost,
            active=EXCLUDED.active,preparation_minutes=EXCLUDED.preparation_minutes,current_stock=EXCLUDED.current_stock,
            minimum_stock=EXCLUDED.minimum_stock,photo_url=EXCLUDED.photo_url,updated_at=now()
        `, [text(p.id),p.sku||p.codigo||null,text(p.nome),text(p.categoria),text(p.descricao),number(p.precoVenda),
          p.custoCompra == null ? null : number(p.custoCompra),p.ativo !== false,number(p.tempoPreparo),
          p.estoqueAtual == null ? null : number(p.estoqueAtual),p.estoqueMinimo == null ? null : number(p.estoqueMinimo),p.foto||null]);
      }

      for (const i of collections.ingredientes) {
        await client.query(`
          INSERT INTO ingredients (id,sku,name,category,unit,current_stock,minimum_stock,average_daily_use,
            lead_time_days,package_quantity,unit_cost,supplier_name,active)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (id) DO UPDATE SET sku=EXCLUDED.sku,name=EXCLUDED.name,category=EXCLUDED.category,
            unit=EXCLUDED.unit,current_stock=EXCLUDED.current_stock,minimum_stock=EXCLUDED.minimum_stock,
            average_daily_use=EXCLUDED.average_daily_use,lead_time_days=EXCLUDED.lead_time_days,
            package_quantity=EXCLUDED.package_quantity,unit_cost=EXCLUDED.unit_cost,
            supplier_name=EXCLUDED.supplier_name,active=EXCLUDED.active,updated_at=now()
        `, [text(i.id),i.sku||null,text(i.nome),text(i.categoria),text(i.unidade),number(i.estoqueAtual),
          number(i.estoqueMinimo),number(i.consumoMedioDiario),number(i.prazoReposicaoDias),
          Math.max(0.001,number(i.quantidadePacote,1)),number(i.custoUnitario),text(i.fornecedor),i.ativo !== false]);
      }

      for (const c of collections.clientes) {
        await client.query(`
          INSERT INTO clients (id,name,phone,email,tax_id,notes,active)
          VALUES ($1,$2,$3,$4,$5,$6,true)
          ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,phone=EXCLUDED.phone,email=EXCLUDED.email,
            tax_id=EXCLUDED.tax_id,notes=EXCLUDED.notes,updated_at=now()
        `, [text(c.id),text(c.nome),text(c.telefone),text(c.email),text(c.cpf),text(c.observacoes)]);
        for (const address of array(c.enderecos)) {
          await client.query(`
            INSERT INTO client_addresses (id,client_id,street,number,district,city,state,postal_code,complement)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (id) DO UPDATE SET street=EXCLUDED.street,number=EXCLUDED.number,district=EXCLUDED.district,
              city=EXCLUDED.city,state=EXCLUDED.state,postal_code=EXCLUDED.postal_code,complement=EXCLUDED.complement
          `, [text(address.id),text(c.id),text(address.rua),text(address.numero),text(address.bairro),
            text(address.cidade),text(address.estado),text(address.cep),text(address.complemento)]);
        }
      }

      for (const s of collections.fornecedores) {
        await client.query(`
          INSERT INTO suppliers (id,name,tax_id,phone,email,contact_name,category,lead_time_days,payment_terms,notes,active)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,tax_id=EXCLUDED.tax_id,phone=EXCLUDED.phone,
            email=EXCLUDED.email,contact_name=EXCLUDED.contact_name,category=EXCLUDED.category,
            lead_time_days=EXCLUDED.lead_time_days,payment_terms=EXCLUDED.payment_terms,
            notes=EXCLUDED.notes,active=EXCLUDED.active
        `, [text(s.id),text(s.nome),text(s.cnpj),text(s.telefone),text(s.email),text(s.contato),
          text(s.categoria),number(s.prazoEntrega),text(s.condicoesPagamento),text(s.observacoes),s.ativo !== false]);
      }

      const clientIds = new Set(collections.clientes.map(c => text(c.id)));
      const productIds = new Set(collections.produtos.map(p => text(p.id)));
      for (const o of collections.pedidos) {
        await client.query(`
          INSERT INTO orders (id,order_number,source,client_id,client_name,status,subtotal,delivery_fee,
            discount,total,payment_method,notes,created_by,created_at,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,subtotal=EXCLUDED.subtotal,
            delivery_fee=EXCLUDED.delivery_fee,discount=EXCLUDED.discount,total=EXCLUDED.total,
            payment_method=EXCLUDED.payment_method,notes=EXCLUDED.notes,updated_at=EXCLUDED.updated_at
        `, [text(o.id),number(o.numeroPedido),text(o.origem),clientIds.has(text(o.clienteId)) ? text(o.clienteId) : null,
          text(o.clienteNome),text(o.status),number(o.subtotal),number(o.taxaEntrega),number(o.desconto),
          number(o.total),text(o.formaPagamento),text(o.observacoes),request.user.id,
          o.dataCriacao || new Date().toISOString(),o.dataAtualizacao || o.dataCriacao || new Date().toISOString()]);
        await client.query('DELETE FROM order_items WHERE order_id=$1', [text(o.id)]);
        for (const item of array(o.itens)) {
          await client.query(`
            INSERT INTO order_items (order_id,product_id,name,quantity,unit_price,subtotal)
            VALUES ($1,$2,$3,$4,$5,$6)
          `, [text(o.id),productIds.has(text(item.produtoId)) ? text(item.produtoId) : null,text(item.nome),
            number(item.qty,1),number(item.precoUnitario),number(item.subtotal)]);
        }
      }

      const supplierIds = new Set(collections.fornecedores.map(s => text(s.id)));
      const ingredientIds = new Set(collections.ingredientes.map(i => text(i.id)));
      for (const purchase of collections.compras) {
        await client.query(`
          INSERT INTO purchases (id,purchase_number,supplier_id,supplier_name,status,total,notes,purchased_at,
            received_at,invoice_number,payment_method,created_by,purchase_type)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,total=EXCLUDED.total,notes=EXCLUDED.notes,
            received_at=EXCLUDED.received_at,invoice_number=EXCLUDED.invoice_number,payment_method=EXCLUDED.payment_method,
            purchase_type=EXCLUDED.purchase_type
        `, [text(purchase.id),number(purchase.numeroPedidoCompra),supplierIds.has(text(purchase.fornecedorId)) ? text(purchase.fornecedorId) : null,
          text(purchase.fornecedorNome),text(purchase.status),number(purchase.total),text(purchase.observacoes),
          purchase.dataCompra || null,purchase.dataRecebimento || null,text(purchase.notaFiscal),text(purchase.formaPagamento),request.user.id,
          text(purchase.tipo || 'manual')]);
        await client.query('DELETE FROM purchase_items WHERE purchase_id=$1', [text(purchase.id)]);
        for (const item of array(purchase.itens)) {
          await client.query(`INSERT INTO purchase_items
            (purchase_id,ingredient_id,name,quantity,unit,unit_cost,subtotal) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [text(purchase.id),ingredientIds.has(text(item.ingredienteId)) ? text(item.ingredienteId) : null,
            text(item.nome),number(item.quantidade),text(item.unidade),number(item.custoUnitario),number(item.subtotal)]);
        }
      }

      for (const movement of collections.movimentacoes) {
        await client.query(`
          INSERT INTO stock_movements (id,ingredient_id,movement_type,quantity,unit,reason,reference,movement_date,created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (id) DO UPDATE SET movement_type=EXCLUDED.movement_type,quantity=EXCLUDED.quantity,
            unit=EXCLUDED.unit,reason=EXCLUDED.reason,reference=EXCLUDED.reference,movement_date=EXCLUDED.movement_date
        `, [text(movement.id),ingredientIds.has(text(movement.ingredienteId)) ? text(movement.ingredienteId) : null,
          text(movement.tipo),number(movement.quantidade),text(movement.unidade),text(movement.motivo),
          text(movement.referencia),movement.data || new Date().toISOString().slice(0,10),request.user.id]);
      }

      for (const entry of collections.financeiro) {
        await client.query(`
          INSERT INTO financial_entries (id,entry_date,description,category,entry_type,amount,created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT (id) DO UPDATE SET entry_date=EXCLUDED.entry_date,description=EXCLUDED.description,
            category=EXCLUDED.category,entry_type=EXCLUDED.entry_type,amount=EXCLUDED.amount
        `, [text(entry.id),entry.date || new Date().toISOString().slice(0,10),text(entry.description),
          text(entry.category),text(entry.type),number(entry.value),request.user.id]);
      }

      for (const f of collections.fichas) {
        if (!productIds.has(text(f.produtoId))) continue;
        await client.query(`
          INSERT INTO technical_sheets (id,product_id,yield) VALUES ($1,$2,$3)
          ON CONFLICT (id) DO UPDATE SET product_id=EXCLUDED.product_id,yield=EXCLUDED.yield,updated_at=now()
        `, [text(f.id),text(f.produtoId),Math.max(0.001,number(f.rendimento,1))]);
        await client.query('DELETE FROM technical_sheet_items WHERE sheet_id = $1', [text(f.id)]);
        for (const item of array(f.itens)) {
          if (!ingredientIds.has(text(item.ingredienteId))) continue;
          await client.query(`
            INSERT INTO technical_sheet_items (sheet_id,ingredient_id,quantity,unit)
            VALUES ($1,$2,$3,$4) ON CONFLICT (sheet_id,ingredient_id) DO UPDATE SET quantity=EXCLUDED.quantity,unit=EXCLUDED.unit
          `, [text(f.id),text(item.ingredienteId),number(item.quantidade),text(item.unidade)]);
        }
      }

      const counts = Object.fromEntries(Object.entries(collections).map(([key, records]) => [key, records.length]));
      await client.query('UPDATE import_batches SET summary = $1 WHERE id = $2', [counts, batchId]);
      await client.query(`
        INSERT INTO audit_logs (user_id,action,entity_type,entity_id,metadata,ip)
        VALUES ($1,'migration.import','import_batch',$2,$3,$4)
      `, [request.user.id,batchId,counts,request.ip]);
      return { batchId, counts };
    });

    return reply.code(201).send({ imported: true, duplicate: false, ...summary });
  });
}
