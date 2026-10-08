import { randomUUID } from 'node:crypto';
import { priceOrderItems, roundMoney } from './order-pricing.js';

const activeNow = "p.active=true AND (p.starts_at IS NULL OR p.starts_at<=now()) AND (p.ends_at IS NULL OR p.ends_at>=now())";
const money = value => roundMoney(Number(value || 0));

export async function listPromotions(db, { publicOnly = false, activeOnly = false } = {}) {
  const promoRows = await db.query(`
    SELECT p.*, COALESCE(json_agg(DISTINCT jsonb_build_object('id',pp.product_id,'name',pr.name,'salePrice',pr.sale_price))
      FILTER (WHERE pp.product_id IS NOT NULL),'[]'::json) AS products
    FROM promotions p
    LEFT JOIN promotion_products pp ON pp.promotion_id=p.id
    LEFT JOIN products pr ON pr.id=pp.product_id
    WHERE ${publicOnly ? activeNow : activeOnly ? 'p.active=true' : 'true'}
    GROUP BY p.id ORDER BY p.priority DESC,p.code
  `);
  const groups = await db.query(`
    SELECT g.id,g.promotion_id,g.code,g.name,g.required_quantity,g.max_quantity,g.allow_same_product,g.allowed_options,
      COALESCE(json_agg(jsonb_build_object('id',p.id,'name',p.name,'category',p.category,'salePrice',p.sale_price,
        'surcharge',gp.surcharge,'allowedOptions',gp.allowed_options,'active',p.active)
        ORDER BY p.category,p.name) FILTER (WHERE gp.product_id IS NOT NULL),'[]'::json) AS products
    FROM promotion_groups g LEFT JOIN promotion_group_products gp ON gp.group_id=g.id
    LEFT JOIN products p ON p.id=gp.product_id
    ${publicOnly ? 'JOIN promotions active_p ON active_p.id=g.promotion_id AND active_p.active=true AND (active_p.starts_at IS NULL OR active_p.starts_at<=now()) AND (active_p.ends_at IS NULL OR active_p.ends_at>=now())' : activeOnly ? 'JOIN promotions active_p ON active_p.id=g.promotion_id AND active_p.active=true' : ''}
    WHERE g.active=true
    GROUP BY g.id ORDER BY g.promotion_id,g.code
  `);
  const groupsByPromotion = new Map();
  for (const group of groups.rows) {
    const list = groupsByPromotion.get(group.promotion_id) || [];
    list.push({ id: group.id, code: group.code, name: group.name, requiredQuantity: group.required_quantity,
      maxQuantity: group.max_quantity, allowSameProduct: group.allow_same_product,
      allowedOptions: group.allowed_options, products: group.products });
    groupsByPromotion.set(group.promotion_id, list);
  }
  const costs = await db.query(`
    SELECT p.id,p.name,p.purchase_cost,p.sale_price,(ts.id IS NOT NULL) AS has_sheet,ts.product_id,ts.yield,COUNT(tsi.ingredient_id)::int AS ingredient_count,
      COUNT(*) FILTER (WHERE i.id IS NULL OR i.active=false OR i.unit<>tsi.unit OR i.unit_cost IS NULL OR i.unit_cost<=0)::int AS incomplete_count,
      COALESCE(SUM(tsi.quantity/NULLIF(ts.yield,0)*i.unit_cost),0) AS recipe_cost
    FROM products p LEFT JOIN technical_sheets ts ON ts.product_id=p.id
    LEFT JOIN technical_sheet_items tsi ON tsi.sheet_id=ts.id
    LEFT JOIN ingredients i ON i.id=tsi.ingredient_id
    GROUP BY p.id,ts.id,ts.product_id,ts.yield
  `);
  const costById = new Map(costs.rows.map(row => [row.id, row]));
  const optionVariants = {
    'p-drk001': { flavor: { morango: 'p-drk002', maracuja: 'p-drk003' } },
    'p-pet001': { size: { G: 'p-pet006' } },
    'p-pet002': { size: { G: 'p-pet007' }, drink: { 'coca-cola': 'p-ref005', guarana: 'p-ref002', agua: 'p-agu001' } },
    'p-drk010': { size: { '700ml': 'p-drk011' } },
    'p-drk011': { size: { '700ml': 'p-drk011' } },
    'p-ref001': { sodaFlavor: { 'coca-cola': 'p-ref005', guarana: 'p-ref002', sprite: 'p-ref003' } },
  };
  return promoRows.rows.map(promotion => {
    const promoGroups = groupsByPromotion.get(promotion.id) || [];
    const referenced = promotion.rule_type === 'combo'
      ? promoGroups.flatMap(group => group.products.map(product => product.id))
      : promotion.products.map(product => product.id);
    const uniqueRefs = [...new Set(referenced)];
    const variantRefs = new Set();
    for (const id of uniqueRefs) {
      const variants = optionVariants[id] || {};
      const product = promotion.rule_type === 'combo'
        ? promoGroups.flatMap(group => group.products.map(item=>({...item,allowedOptions:intersectOptions(group.allowedOptions,item.allowedOptions)}))).find(item => item.id === id)
        : promotion.products.find(item => item.id === id);
      const constraints = product?.allowedOptions || {};
      for (const [key, values] of Object.entries(variants)) {
        const permitted = constraints[key];
        for (const [value, variantId] of Object.entries(values)) {
          if (!permitted || permitted.includes(value)) variantRefs.add(variantId);
        }
      }
    }
    const missingCosts = [...new Set([...uniqueRefs, ...variantRefs])].filter(id => {
      const row = costById.get(id);
      if (!row) return true;
      if (row.has_sheet) return Number(row.ingredient_count) === 0 || Number(row.incomplete_count) > 0;
      return row.purchase_cost === null;
    });
    const productCost = id => {
      const row = costById.get(id);
      if (!row) return null;
      if (row.has_sheet) return Number(row.ingredient_count) === 0 || Number(row.incomplete_count) ? null : Number(row.recipe_cost);
      return row.purchase_cost === null ? null : Number(row.purchase_cost);
    };
    const costsComplete = missingCosts.length === 0 && uniqueRefs.length > 0;
    const worstOptionCost = product => {
      const variants = optionVariants[product.id] || {};
      const allowed = product.allowedOptions || {};
      let total = productCost(product.id);
      if (total === null) return null;
      for (const [key, choices] of Object.entries(variants)) {
        const permitted = allowed[key];
        const optionCosts = Object.entries(choices).filter(([value]) => !permitted || permitted.includes(value))
          .map(([, variantId]) => productCost(variantId));
        if (optionCosts.some(value => value === null)) return null;
        if (optionCosts.length) total = Math.max(total, ...optionCosts);
      }
      if (product.id === 'p-pet002') {
        const drinkOptions = Object.entries(variants.drink || {}).filter(([value]) => !allowed.drink || allowed.drink.includes(value));
        const drinkCost = drinkOptions.map(([, id]) => productCost(id));
        if (drinkCost.some(value => value === null)) return null;
        if (drinkCost.length) total += Math.max(...drinkCost);
      }
      return total;
    };
    const lowestOptionPrice = product => {
      const variants=optionVariants[product.id]||{},allowed=product.allowedOptions||{};
      const base=Number(costById.get(product.id)?.sale_price ?? product.salePrice ?? 0);
      let total=base;
      for(const [key,choices] of Object.entries(variants)){
        const permitted=allowed[key];
        const values=Object.entries(choices).filter(([value])=>!permitted||permitted.includes(value)).map(([,id])=>Number(costById.get(id)?.sale_price));
        if(values.some(value=>!Number.isFinite(value)))return null;
        if(values.length&&key==='drink')total+=Math.min(...values);
        else if(values.length)total=Math.min(total,...values);
      }
      return money(total+Number(product.surcharge||0));
    };
    const normalEstimate = promotion.rule_type==='combo'
      ? promoGroups.reduce((sum,group)=>{
          const prices=group.products.filter(product=>product.active).map(product=>lowestOptionPrice({...product,allowedOptions:intersectOptions(group.allowedOptions,product.allowedOptions)})).filter(price=>price!==null);
          return sum+(prices.length?Math.min(...prices)*Number(group.requiredQuantity):0);
        },0)
      : uniqueRefs.reduce((sum,id)=>sum+Number(promotion.products.find(product=>product.id===id)?.salePrice||0),0);
    const costTotal = costsComplete ? promotion.rule_type==='combo'
      ? promoGroups.reduce((sum,group)=>sum+Math.max(0,...group.products.map(product=>worstOptionCost({...product,allowedOptions:intersectOptions(group.allowedOptions,product.allowedOptions)})))*Number(group.maxQuantity),0)
      : uniqueRefs.reduce((sum, id) => {
          const product=promotion.products.find(item=>item.id===id);
          const unit=worstOptionCost({...product,allowedOptions:{}});
          return unit===null?sum:sum+unit;
        },0) : null;
    const estimate = promotion.rule_type === 'combo' && promotion.combo_price !== null
      ? Number(promotion.combo_price) : promotion.rule_type === 'percentage' && promotion.discount_percent !== null
        ? money(normalEstimate * (1 - Number(promotion.discount_percent) / 100))
        : promotion.rule_type === 'fixed' && promotion.discount_amount !== null
          ? money(Math.max(0, normalEstimate - Number(promotion.discount_amount))) : null;
    const estimatedCost = costTotal === null && promotion.cmv_estimate_percent !== null && promotion.cmv_estimate_percent !== undefined
      ? money(normalEstimate * Number(promotion.cmv_estimate_percent) / 100) : costTotal === null ? null : money(costTotal);
    return { ...promotion, stackWithCoupon: promotion.stack_with_coupon, groups: promoGroups, costComplete: costsComplete,
      missingCostProductIds: missingCosts, missingCostProductNames:missingCosts.map(id=>costById.get(id)?.name||id), normalPriceEstimate: money(normalEstimate),
      marginBasis:promotion.cmv_estimate_percent !== null && promotion.cmv_estimate_percent !== undefined && !costsComplete
        ? `estimativa usando CMV de referência de ${Number(promotion.cmv_estimate_percent).toFixed(1)}% aplicado ao menor preço normal; custo real pendente`
        : promotion.rule_type==='combo'?'custo máximo considerando o máximo de escolhas de cada grupo':'uma unidade de cada produto; descontos fixos variam com o carrinho',
      estimatedCost,
      estimatedMargin: estimatedCost === null || estimate === null ? null : money(estimate - estimatedCost),
      marginPercent: estimatedCost === null || estimate === null || estimate === 0 ? null : money((estimate - estimatedCost) / estimate * 100),
      estimatedCmvPercent: estimatedCost === null || estimate === null || estimate === 0 ? null : money(estimatedCost / estimate * 100) };
  });
}

function intersectOptions(group={}, product={}) {
  const keys=new Set([...Object.keys(group||{}),...Object.keys(product||{})]);
  return Object.fromEntries([...keys].map(key=>{
    if(group[key]&&product[key])return [key,group[key].filter(value=>product[key].includes(value))];
    return [key,group[key]||product[key]];
  }));
}

function allocateDiscount(items, selected, discount) {
  const total = selected.reduce((sum, index) => sum + items[index].listSubtotal, 0);
  let left = money(Math.min(discount, total));
  return selected.map((index, position) => {
    const item = items[index];
    const share = position === selected.length - 1 ? left : money(Math.min(left, total ? discount * item.listSubtotal / total : 0));
    left = money(left - share);
    item.promotionDiscount = money(item.promotionDiscount + share);
    return { index, orderItem: index, productId: item.productId, amount: share };
  });
}

function optionsAllowed(options, allowed) {
  if (!allowed || !Object.keys(allowed).length) return true;
  return Object.entries(options || {}).every(([key, value]) => {
    const values = allowed[key];
    if (values === undefined) return false;
    const choices = Array.isArray(value) ? value : [value];
    return Array.isArray(values) && choices.every(choice => values.includes(choice));
  });
}

export async function calculatePromotions(db, requestedItems, requestedCombos = [], { lock = false } = {}) {
  const allLines = requestedItems.flatMap(item => Array.from({length:item.quantity},()=>({ ...item, quantity:1, source: 'cart' })));
  const promos = await listPromotions(db, { activeOnly: true });
  const now=Date.now();
  const periodReason=promotion=>promotion.starts_at&&new Date(promotion.starts_at).getTime()>now?'promotion_not_started':promotion.ends_at&&new Date(promotion.ends_at).getTime()<now?'promotion_expired':null;
  const eligiblePromos=promos.filter(promotion=>!periodReason(promotion));
  const promoById = new Map(promos.map(promo => [promo.id, promo]));
  const comboReservations = [];
  const rejected = [];

  for (const [comboIndex,combo] of requestedCombos.entries()) {
    const promotion = promoById.get(combo.promotionId);
    if (!promotion || promotion.rule_type !== 'combo') return { error: 'promotion_unavailable' };
    if(periodReason(promotion))return {error:periodReason(promotion)};
    const selections = combo.selections || [];
    const groupById = new Map(promotion.groups.map(group => [group.id, group]));
    const seenGroups = new Set();
    for (const selection of selections) {
      const group = groupById.get(selection.groupId);
      if (!group || seenGroups.has(group.id)) return { error: 'combo_invalid_selection' };
      seenGroups.add(group.id);
      const selected = selection.items || [];
      const count = selected.reduce((sum, item) => sum + item.quantity, 0);
      if (count < group.requiredQuantity || count > group.maxQuantity) return { error: 'combo_group_quantity' };
      if (!group.allowSameProduct && new Set(selected.map(item => item.productId)).size !== count) return { error: 'combo_duplicate_product' };
      for (const item of selected) {
        const allowedProduct = group.products.find(product => product.id === item.productId && product.active);
        if (!allowedProduct) return { error: 'combo_product_not_allowed' };
        const productAllowedOptions = allowedProduct.allowedOptions || {};
        if (!optionsAllowed(item.options, group.allowedOptions) || !optionsAllowed(item.options, productAllowedOptions)) return { error: 'combo_options_not_allowed' };
        for (let unit=0; unit<item.quantity; unit++) {
          const line = { productId:item.productId, quantity:1, options:{...(item.options||{}),...(item.flavoredIce?{flavoredIce:true}:{})}, expectedUnitPrice:item.expectedUnitPrice,
          comboPromotionId:promotion.id, comboInstanceToken:comboIndex, comboGroupId:group.id, comboGroupName:group.name, groupSurcharge:Number(allowedProduct.surcharge || 0), source:'combo' };
          allLines.push(line);
          comboReservations.push({ promotion, group, lineIndex:allLines.length-1, comboInstanceToken:comboIndex });
        }
      }
    }
    if (seenGroups.size !== promotion.groups.length) return { error: 'combo_group_required' };
    if (promotion.combo_price === null) return { error: 'promotion_price_unconfigured' };
  }

  const priced = await priceOrderItems(db, allLines, { lock });
  if (!priced) return { error: 'product_unavailable' };
  const items = priced.items.map((item,index) => ({ ...item, listUnitPrice:item.unitPrice,
    listSubtotal:item.subtotal, optionSurcharge:money(Math.max(0,item.unitPrice - priced.basePrices.get(item.productId))), promotionDiscount:0, promotionId:null, promotionApplicationId:null,
    comboGroupId:allLines[index].comboGroupId || null, comboGroupName:allLines[index].comboGroupName || null,
    comboPromotionId:allLines[index].comboPromotionId || null, comboInstanceId:allLines[index].comboPromotionId || null,
    groupSurcharge:Number(allLines[index].groupSurcharge || 0) }));
  const promoRows = await db.query(`SELECT p.* FROM promotions p WHERE id=ANY($1::uuid[]) AND ${activeNow} ORDER BY priority DESC,code ${lock ? 'FOR UPDATE' : ''}`,
    [[...new Set([...requestedCombos.map(combo=>combo.promotionId),...eligiblePromos.filter(p=>p.rule_type!=='combo').map(p=>p.id)])]]);
  const locked = new Map(promoRows.rows.map(row => [row.id, row]));
  if (requestedCombos.some(combo=>!locked.has(combo.promotionId))) return { error:'promotion_unavailable' };
  const applications = [];
  const used = new Set();
  const candidates = [];
  for (const promo of eligiblePromos) {
    if (!locked.has(promo.id)) continue;
    if (promo.rule_type === 'combo') {
      for(const combo of requestedCombos.entries())if(combo[1].promotionId===promo.id)candidates.push({promo,combo:true,comboInstanceToken:combo[0]});
      continue;
    }
    const targets = new Set(promo.products.map(product => product.id));
    const selected = items.map((item,index) => item.comboPromotionId ? -1 : targets.has(item.productId) ? index : -1).filter(index => index >= 0);
    if (selected.length) candidates.push({ promo, selected });
  }
  candidates.sort((a,b)=>Number(b.promo.priority)-Number(a.promo.priority)||a.promo.code.localeCompare(b.promo.code));
  for (const candidate of candidates) {
    const { promo } = candidate;
    if (candidate.combo) {
      const lineIndexes = comboReservations.filter(row => row.promotion.id===promo.id&&row.comboInstanceToken===candidate.comboInstanceToken).map(row=>row.lineIndex);
      if (lineIndexes.some(index=>used.has(index))) { rejected.push({ promotionId:promo.id,code:promo.code,reason:'priority_conflict' }); continue; }
      const normal = money(lineIndexes.reduce((sum,index)=>sum+items[index].listSubtotal,0));
      const selectedSurcharges = money(lineIndexes.reduce((sum,index)=>sum+items[index].groupSurcharge+items[index].optionSurcharge,0));
      const total = money(Number(promo.combo_price) + selectedSurcharges);
      if (total > normal) {
        rejected.push({ promotionId:promo.id,code:promo.code,reason:'combo_price_exceeds_normal' });
        return { error:'combo_price_exceeds_normal', promotion:promo.code, normalPrice:normal };
      }
      const appId = randomUUID();
      const alloc = allocateDiscount(items,lineIndexes,money(normal-total));
      for (const index of lineIndexes) { used.add(index); items[index].promotionId=promo.id; items[index].promotionApplicationId=appId; }
      applications.push({ id:appId,promotionId:promo.id,code:promo.code,name:promo.name,ruleType:'combo',
        discount:money(normal-total),normalSubtotal:normal,appliedSubtotal:money(normal-total),items:alloc,stackWithCoupon:promo.stackWithCoupon,
        comboGroups:comboReservations.filter(row=>row.promotion.id===promo.id&&row.comboInstanceToken===candidate.comboInstanceToken).map(row=>({groupId:row.group.id,groupName:row.group.name,productId:items[row.lineIndex].productId,options:items[row.lineIndex].options})),
        price:total, estimatedCmvPercent:promo.cmv_estimate_percent===null||promo.cmv_estimate_percent===undefined?null:money(Number(promo.cmv_estimate_percent)*normal/Math.max(total,0.01)) });
    } else {
      const selected = candidate.selected.filter(index=>!used.has(index));
      if (!selected.length) { rejected.push({promotionId:promo.id,code:promo.code,reason:'priority_conflict'}); continue; }
      const normal = money(selected.reduce((sum,index)=>sum+items[index].listSubtotal,0));
      const discount = promo.rule_type==='percentage' ? money(normal*Number(promo.discount_percent)/100) : money(Math.min(normal,Number(promo.discount_amount)));
      const appId = randomUUID();
      const alloc = allocateDiscount(items,selected,discount);
      for (const index of selected) { used.add(index); items[index].promotionId=promo.id; items[index].promotionApplicationId=appId; }
      applications.push({id:appId,promotionId:promo.id,code:promo.code,name:promo.name,ruleType:promo.rule_type,
        discount,normalSubtotal:normal,appliedSubtotal:money(normal-discount),items:alloc,stackWithCoupon:promo.stackWithCoupon});
    }
  }
  for (const promo of promos.filter(p=>p.rule_type!=='combo'&&!candidates.some(c=>c.promo.id===p.id))) {
    const reason=periodReason(promo);
    if(reason&&promo.products.some(product=>items.some(item=>item.comboPromotionId===null&&item.productId===product.id))){rejected.push({promotionId:promo.id,code:promo.code,reason});continue;}
    rejected.push({promotionId:promo.id,code:promo.code,reason:'no_matching_items'});
  }
  items.forEach(item=>{ item.unitPrice=money(item.listUnitPrice-item.promotionDiscount/Math.max(1,item.quantity)); item.subtotal=money(item.unitPrice*item.quantity); });
  return { items, subtotal:money(items.reduce((sum,item)=>sum+item.listSubtotal,0)),
    promotionDiscount:money(applications.reduce((sum,application)=>sum+application.discount,0)),
    promotions:applications, rejectedPromotions:rejected, productSubtotal:priced.subtotal };
}

export function couponCanStack(calculation) {
  return calculation.promotions.every(application => application.stackWithCoupon === true);
}
