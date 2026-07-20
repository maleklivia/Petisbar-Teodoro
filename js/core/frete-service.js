/* ============================================================
   Petisbar Teodoro — FreteService
   Consulta CEP via ViaCEP e calcula frete por zonas configuradas
   em Configurações → Entrega. Fallback = frete padrão.
   ============================================================ */

const FreteService = {

  async buscarCEP(cep) {
    const c = (cep || '').replace(/\D/g, '');
    if (c.length !== 8) return null;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
      if (!r.ok) return null;
      const d = await r.json();
      return d.erro ? null : d;
    } catch {
      return null;
    }
  },

  calcularFrete(cepDestino) {
    const cfg   = Stores.config.get();
    const zonas = cfg.frete?.zonas || [];
    const cep   = (cepDestino || '').replace(/\D/g, '');
    for (const z of zonas) {
      const pref = (z.prefixo || '').replace(/\D/g, '');
      if (pref && cep.startsWith(pref)) return Number(z.valor) || 0;
    }
    return Number(cfg.frete?.padrao ?? cfg.taxas?.taxaEntregaPadrao ?? 0);
  },

  async calcularFreteComEndereco(cepDestino) {
    const info  = await this.buscarCEP(cepDestino);
    const valor = this.calcularFrete(cepDestino);
    return {
      valor,
      bairro:     info?.bairro     || '',
      cidade:     info?.localidade || '',
      uf:         info?.uf         || '',
      logradouro: info?.logradouro || '',
    };
  },
};
