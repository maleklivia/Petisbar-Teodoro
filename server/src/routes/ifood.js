import { z } from 'zod';
import { config } from '../config.js';
import { suggestedIfoodPrice } from '../domain/ifood-pricing.js';
import { requirePermission } from '../middleware/auth.js';

const pricingSchema=z.object({price:z.number().positive()});

export default async function ifoodRoutes(app){
  app.get('/integrations/ifood/status',{preHandler:requirePermission('settings.manage')},async()=>({data:{enabled:config.IFOOD_ENABLED,merchantConfigured:Boolean(config.IFOOD_MERCHANT_ID),plan:'Entrega',commissionPercent:23,paymentFeePercent:3.2,totalFeePercent:config.IFOOD_TOTAL_FEE_PERCENT,pollSeconds:config.IFOOD_POLL_SECONDS}}));
  app.post('/integrations/ifood/pricing-preview',{preHandler:requirePermission('catalog.write')},async(request,reply)=>{const parsed=pricingSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'validation_error'});return{data:{storePrice:parsed.data.price,ifoodPrice:suggestedIfoodPrice(parsed.data.price,config.IFOOD_TOTAL_FEE_PERCENT),totalFeePercent:config.IFOOD_TOTAL_FEE_PERCENT}};});
}
