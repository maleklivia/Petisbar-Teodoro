/* ============================================================
   Petisbar Teodoro — OcrService
   OCR client-side via Tesseract.js para cupons fiscais.
   Carrega a lib sob demanda (CDN). Parseia padrões comuns de
   cupom fiscal brasileiro (NFC-e, ECF, SAT e formato livre).
   ============================================================ */

const OcrService = {
  _ready: false,
  _qrReady: false,

  async _carregarTesseract() {
    if (this._ready || typeof Tesseract !== 'undefined') { this._ready = true; return; }
    await new Promise((resolve, reject) => {
      const s    = document.createElement('script');
      s.src      = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload   = () => { this._ready = true; resolve(); };
      s.onerror  = () => reject(new Error('Falha ao carregar Tesseract.js'));
      document.head.appendChild(s);
    });
  },

  async _carregarJsQR() {
    if (this._qrReady || typeof jsQR !== 'undefined') { this._qrReady = true; return; }
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.onload = () => { this._qrReady = true; resolve(); };
      script.onerror = () => reject(new Error('Falha ao carregar leitor de QR Code'));
      document.head.appendChild(script);
    });
  },

  async _desenharImagem(file, maxSide = 2400) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return { canvas, ctx };
  },

  async lerQr(file) {
    const { canvas, ctx } = await this._desenharImagem(file, 2200);
    if ('BarcodeDetector' in window) {
      try {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const codes = await detector.detect(canvas);
        if (codes[0]?.rawValue) return this._dadosQrFiscal(codes[0].rawValue);
      } catch (_) { /* usa o leitor alternativo */ }
    }
    await this._carregarJsQR();
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
    return result?.data ? this._dadosQrFiscal(result.data) : null;
  },

  _dadosQrFiscal(raw) {
    const value = String(raw || '').trim();
    let url = '';
    try {
      const parsed = new URL(value);
      if (['http:', 'https:'].includes(parsed.protocol) && /(^|\.)gov\.br$/i.test(parsed.hostname)) url = parsed.href;
    } catch (_) { /* QR pode conter somente a chave */ }
    const chave = (value.match(/\d{44}/) || [])[0] || '';
    return (url || chave) ? { conteudo: value, url, chaveAcesso: chave } : null;
  },

  async prepararImagem(file) {
    const { canvas, ctx } = await this._desenharImagem(file);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = image.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const gray = (pixels[i] * 0.299) + (pixels[i + 1] * 0.587) + (pixels[i + 2] * 0.114);
      const contrasted = Math.max(0, Math.min(255, ((gray - 128) * 1.35) + 128));
      pixels[i] = pixels[i + 1] = pixels[i + 2] = contrasted;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  },

  async processar(file, onProgress) {
    await this._carregarTesseract();
    const imagemPreparada = await this.prepararImagem(file);
    const worker = await Tesseract.createWorker('por', 1, {
      logger: m => {
        if (onProgress && m.status === 'recognizing text') {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });
    const { data: { text } } = await worker.recognize(imagemPreparada);
    await worker.terminate();
    return text;
  },

  parsearCupom(texto) {
    const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    const itens  = [];
    let   total  = 0;

    // Detectar total
    for (const l of linhas) {
      const m = l.match(/(?:TOTAL|VALOR\s+TOTAL)[^\d]*([\d.,]+)/i);
      if (m) {
        const v = this._parseBR(m[1]);
        if (!isNaN(v) && v > total) total = v;
      }
    }

    // Normalizar unidade para padrão do sistema
    const normUnit = u => {
      const map = {
        KG:'kg', KGS:'kg', G:'g', GR:'g', L:'L', LT:'L', LTS:'L',
        ML:'ml', UN:'un', UNID:'un', CX:'cx', SC:'sc', PCT:'un', PC:'un', PÇ:'un',
      };
      return map[(u || '').toUpperCase().trim()] || 'un';
    };

    // Padrão 1 — NFC-e / ECF com código: "001 NOME QTD UN *PRECO TOTAL"
    const RE1 = /^\d{1,3}\s+(.+?)\s+([\d,]+)\s+(KG|KGS|G|GR|L|LT|LTS|ML|UN|UNID|CX|SC|PCT?|P[CÇ])\s+\*?([\d,]+)\s+([\d,]+)/i;

    // Padrão 2 — "NOME QTD UN PRECO TOTAL" (sem código)
    const RE2 = /^([A-ZÀ-Ú][A-ZÀ-Ú0-9\s]{2,30})\s+([\d,]+)\s+(KG|KGS|G|GR|L|LT|LTS|ML|UN|UNID|CX|SC|PCT?|P[CÇ])\s+\*?([\d,]+)\s+([\d,]+)$/i;

    // Padrão 3 — "QTD UN x PRECO = TOTAL NOME"
    const RE3 = /^([\d,]+)\s+(KG|G|GR|L|LT|ML|UN)\s+[xX×]\s+([\d,]+)\s*=\s*([\d,]+)\s+(.+)/i;

    // Padrão 4 — "NOME PRECO/un simples"  (mercados menores)
    const RE4 = /^([A-ZÀ-Ú][A-ZÀ-Ú\s]{2,25})\s+(\d[\d,]*)\s+(KG|G|L|ML|UN)\s+([\d,]+)$/i;

    const vistos = new Set();

    for (const l of linhas) {
      let m;
      if ((m = l.match(RE1))) {
        const nome = m[1].trim().replace(/\s+/g, ' ');
        const qty  = this._parseBR(m[2]);
        const un   = normUnit(m[3]);
        const cu   = this._parseBR(m[4]);
        const sub  = this._parseBR(m[5]);
        if (this._itemValido(nome, qty, cu) && !vistos.has(nome)) {
          vistos.add(nome);
          itens.push({ nome, quantidade: qty, unidade: un, custoUnitario: cu, subtotal: sub, ingredienteId: '' });
        }
      } else if ((m = l.match(RE2))) {
        const nome = m[1].trim().replace(/\s+/g, ' ');
        const qty  = this._parseBR(m[2]);
        const un   = normUnit(m[3]);
        const cu   = this._parseBR(m[4]);
        const sub  = this._parseBR(m[5]);
        if (this._itemValido(nome, qty, cu) && !vistos.has(nome)) {
          vistos.add(nome);
          itens.push({ nome, quantidade: qty, unidade: un, custoUnitario: cu, subtotal: sub, ingredienteId: '' });
        }
      } else if ((m = l.match(RE3))) {
        const qty  = this._parseBR(m[1]);
        const un   = normUnit(m[2]);
        const cu   = this._parseBR(m[3]);
        const sub  = this._parseBR(m[4]);
        const nome = m[5].trim().replace(/\s+/g, ' ');
        if (this._itemValido(nome, qty, cu) && !vistos.has(nome)) {
          vistos.add(nome);
          itens.push({ nome, quantidade: qty, unidade: un, custoUnitario: cu, subtotal: sub, ingredienteId: '' });
        }
      } else if ((m = l.match(RE4))) {
        const nome = m[1].trim().replace(/\s+/g, ' ');
        const qty  = this._parseBR(m[2]);
        const un   = normUnit(m[3]);
        const cu   = this._parseBR(m[4]);
        if (this._itemValido(nome, qty, cu) && !vistos.has(nome)) {
          vistos.add(nome);
          itens.push({ nome, quantidade: qty, unidade: un, custoUnitario: cu, subtotal: qty * cu, ingredienteId: '' });
        }
      }
    }

    // DANFE NFC-e com descrição quebrada e os números na linha seguinte.
    const RE_DETALHE = /^([\d.,]+)\s+(KG|KGS|G|GR|L|LT|LTS|ML|UN|UNID|CX|SC|PCT?|P[CÇ])\s+([\d.,]+)\s+([\d.,]+)$/i;
    for (let i = 1; i < linhas.length; i++) {
      const detalhe = linhas[i].match(RE_DETALHE);
      if (!detalhe) continue;
      const partesNome = [];
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const anterior = linhas[j];
        if (RE_DETALHE.test(anterior) || /^(CÓDIGO|DESCRIÇÃO|QTD|QTDE|SUBTOTAL|TOTAL|DESCONTOS|FORMAS? DE PAGAMENTO)/i.test(anterior)) break;
        const parte = anterior.replace(/^\d{3,14}\s+/, '').trim();
        if (parte.length >= 3 && !/^(CNPJ|CPF|DANFE|NFC|AVENIDA|RUA|CEP|TELEFONE)/i.test(parte)) partesNome.unshift(parte);
      }
      const nome = partesNome.join(' ').replace(/\s+/g, ' ').trim();
      const qty = this._parseBR(detalhe[1]);
      const un = normUnit(detalhe[2]);
      const cu = this._parseBR(detalhe[3]);
      const sub = this._parseBR(detalhe[4]);
      if (this._itemValido(nome, qty, cu) && !vistos.has(nome)) {
        vistos.add(nome);
        itens.push({ nome, quantidade: qty, unidade: un, custoUnitario: cu, subtotal: sub, ingredienteId: '' });
      }
    }

    // Fallback: extração simples quando nenhum padrão estruturado funcionou
    if (!itens.length) {
      for (const l of linhas) {
        if (l.length < 5) continue;
        if (/^(CNPJ|CPF|TOTAL|DATA|HORA|TROCO|DINHEIRO|CARTAO|PIX|DANFE|NFC|ITEM|QTD|PRECO|DESCONTO|SUBTOTAL|CAIXA|CEST|NCM|ICMS)/i.test(l)) continue;
        const priceMatch = l.match(/([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})/g);
        if (!priceMatch) continue;
        const nome = l.replace(/[\d.,*R$%]/g, '').trim().replace(/\s+/g, ' ');
        if (nome.length < 3) continue;
        const cu = this._parseBR(priceMatch[priceMatch.length - 1]);
        if (cu <= 0 || cu > 9999) continue;
        if (!vistos.has(nome)) {
          vistos.add(nome);
          itens.push({ nome, quantidade: 1, unidade: 'un', custoUnitario: cu, subtotal: cu, ingredienteId: '' });
        }
      }
    }

    const cnpj = (texto.match(/CNPJ\s*[:.]?\s*([\d./-]{14,18})/i) || [])[1] || '';
    const chaveAcesso = (texto.replace(/\s/g, '').match(/\d{44}/) || [])[0] || '';
    return { itens, total, cnpj, chaveAcesso };
  },

  matchIngrediente(nomeItem, ingredientes) {
    const nome = (nomeItem || '').toLowerCase().trim();
    // Exato
    let found = ingredientes.find(i => i.nome.toLowerCase() === nome);
    if (found) return found;
    // Começa com primeiras 4 letras do ingrediente
    found = ingredientes.find(i => {
      const prefix = i.nome.toLowerCase().slice(0, 4);
      return prefix.length >= 3 && nome.includes(prefix);
    });
    if (found) return found;
    // Ingrediente contém primeira palavra do item
    const palavra = nome.split(/\s+/)[0];
    if (palavra.length >= 4) {
      found = ingredientes.find(i => i.nome.toLowerCase().includes(palavra));
    }
    return found || null;
  },

  _parseBR(s) {
    return parseFloat((s || '').replace(/\./g, '').replace(',', '.')) || 0;
  },

  _itemValido(nome, qty, cu) {
    return nome.length >= 3 && qty > 0 && cu > 0;
  },
};
