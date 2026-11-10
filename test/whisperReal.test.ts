import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { configDoPerfil, PERFIL_PADRAO } from '../src/model/perfis';
import { montarLegendas } from '../src/transcricao/montar';
import { palavrasDoWhisper } from '../src/transcricao/whisperJson';

// Saída verdadeira do whisper-cli embutido, gravada pelo CI (scripts/verificar-whisper.mjs).
// Fora do CI, sem o arquivo, o teste não se aplica.
const arq = process.env.OUVER_WHISPER_SAIDA;
describe.runIf(!!arq && existsSync(arq))('leitor do JSON sobre a saída real do whisper.cpp', () => {
  it('extrai palavras com tempos crescentes e monta legendas', () => {
    const { palavras } = palavrasDoWhisper(JSON.parse(readFileSync(arq!, 'utf8')));
    expect(palavras.length).toBeGreaterThan(2);
    for (let i = 1; i < palavras.length; i++)
      expect(palavras[i].inicioMs).toBeGreaterThanOrEqual(palavras[i - 1].inicioMs);
    for (const w of palavras) expect(w.texto).not.toMatch(/^\[_|^\s|\s$/);
    const cues = montarLegendas(palavras, configDoPerfil(PERFIL_PADRAO.perfilId));
    expect(cues.length).toBeGreaterThan(0);
  });
});
