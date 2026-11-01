export function ponte() {
    return typeof window !== 'undefined' && window.estudio ? window.estudio : null;
}
