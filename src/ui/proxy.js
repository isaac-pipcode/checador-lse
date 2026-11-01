import { ponte } from '../desktop/ponte';
/**
 * Gera o proxy de um original e acompanha o progresso no estado
 * (`proxies[caminho]`). Devolve null se cancelado ou indisponível.
 */
export async function gerarProxyDe(despachar, caminho, projetoCaminho) {
    const d = ponte();
    if (!d)
        return null;
    despachar({ tipo: 'proxyTrabalho', caminho, progresso: 0 });
    try {
        const r = await d.gerarProxy(caminho, projetoCaminho, (f) => despachar({ tipo: 'proxyTrabalho', caminho, progresso: f }));
        despachar({ tipo: 'proxyTrabalho', caminho, progresso: null });
        return { caminho: r.caminho, url: r.url };
    }
    catch (e) {
        const cancelado = /cancelado|abort/i.test(String(e));
        despachar({
            tipo: 'proxyTrabalho',
            caminho,
            progresso: null,
            erro: cancelado ? null : `Falha ao gerar o proxy: ${e instanceof Error ? e.message : String(e)}`,
        });
        return null;
    }
}
