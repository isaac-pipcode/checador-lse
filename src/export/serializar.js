import { formatarTimecode } from '../core/texto';
/** Re-serializa em SRT válido, com numeração sequencial e timecodes HH:MM:SS,mmm. */
export function serializarSrt(cues) {
    return (cues
        .map((cue, i) => {
        const tempo = `${formatarTimecode(cue.startMs, ',')} --> ${formatarTimecode(cue.endMs, ',')}`;
        return `${i + 1}\n${tempo}\n${cue.lines.join('\n')}`;
    })
        .join('\n\n') + '\n');
}
export function serializarVtt(cues) {
    const corpo = cues
        .map((cue) => {
        const tempo = `${formatarTimecode(cue.startMs, '.')} --> ${formatarTimecode(cue.endMs, '.')}`;
        return `${tempo}\n${cue.lines.join('\n')}`;
    })
        .join('\n\n');
    return `WEBVTT\n\n${corpo}\n`;
}
