export function decodeBuffer(buf) {
    const bytes = new Uint8Array(buf);
    const avisos = [];
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        const texto = new TextDecoder('utf-8').decode(bytes.subarray(3));
        return { texto, encoding: 'utf-8 (BOM)', avisos };
    }
    // TextDecoder com fatal:true rejeita sequências inválidas em UTF-8.
    try {
        const texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return { texto, encoding: 'utf-8', avisos };
    }
    catch {
        avisos.push('O arquivo não é UTF-8 válido; foi lido como Windows-1252 (Latin-1). Verifique se os acentos aparecem corretamente.');
        const texto = new TextDecoder('windows-1252').decode(bytes);
        return { texto, encoding: 'windows-1252', avisos };
    }
}
