import { contextoAudio, audioDoTake } from './audio';
import { dbParaLinear, ganhoEm } from './mixagem';
/** Um MediaElementSource por elemento: a API não permite criar dois. */
const fontes = new WeakMap();
/**
 * Prévia da mixagem em tempo real: o áudio do vídeo passa por um ganho que
 * segue a curva de ducking, e os takes são agendados no relógio do
 * AudioContext. A cada play, pausa, busca ou mudança de velocidade, tudo é
 * reagendado a partir do tempo do vídeo.
 *
 * Limite: em reprodução longa sem interrupção, os relógios de vídeo e de áudio
 * podem divergir alguns milissegundos. A renderização final não tem esse
 * problema (é amostra a amostra).
 */
export class MotorPrevia {
    constructor(video) {
        Object.defineProperty(this, "video", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: video
        });
        Object.defineProperty(this, "ctx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: contextoAudio()
        });
        Object.defineProperty(this, "fonte", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ganhoOriginal", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ganhoAd", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** volume e posição estéreo do filme, para a conferência de sincronia da Libras */
        Object.defineProperty(this, "volFilme", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "panFilme", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ativos", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "clipes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "curva", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "ligado", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "eventos", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ['play', 'pause', 'seeked', 'ratechange']
        });
        Object.defineProperty(this, "reagendar", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => this.reprogramar()
        });
        let f = fontes.get(video);
        if (!f) {
            f = this.ctx.createMediaElementSource(video);
            fontes.set(video, f);
        }
        this.fonte = f;
        this.fonte.disconnect();
        this.ganhoOriginal = this.ctx.createGain();
        this.ganhoAd = this.ctx.createGain();
        this.volFilme = this.ctx.createGain();
        this.panFilme = this.ctx.createStereoPanner();
        this.fonte.connect(this.ganhoOriginal).connect(this.volFilme).connect(this.panFilme).connect(this.ctx.destination);
        this.ganhoAd.connect(this.volFilme);
        for (const e of this.eventos)
            video.addEventListener(e, this.reagendar);
    }
    atualizar(clipes, curva) {
        this.clipes = clipes;
        this.curva = curva;
        this.reprogramar();
    }
    /** desligado: original sem ducking e sem AD (para gravar ou comparar) */
    definirLigado(ligado) {
        this.ligado = ligado;
        this.reprogramar();
    }
    parar() {
        for (const s of this.ativos) {
            try {
                s.stop();
            }
            catch {
                /* já terminou */
            }
        }
        this.ativos = [];
        const g = this.ganhoOriginal.gain;
        g.cancelScheduledValues(0);
        g.value = this.ligado ? ganhoEm(this.curva, this.video.currentTime * 1000) : 1;
    }
    reprogramar() {
        this.parar();
        if (this.video.paused || !this.ligado)
            return;
        void this.ctx.resume();
        const agora = this.ctx.currentTime + 0.01;
        const t0 = this.video.currentTime * 1000;
        const vel = this.video.playbackRate || 1;
        const quando = (ms) => agora + (ms - t0) / 1000 / vel;
        const g = this.ganhoOriginal.gain;
        g.setValueAtTime(ganhoEm(this.curva, t0), agora);
        for (const p of this.curva)
            if (p.ms > t0)
                g.linearRampToValueAtTime(p.ganho, quando(p.ms));
        for (const c of this.clipes) {
            if (c.posicaoMs + c.duracaoMs <= t0)
                continue;
            const audio = audioDoTake(c.takeId);
            if (!audio)
                continue;
            const src = this.ctx.createBufferSource();
            src.buffer = audio.buffer;
            src.playbackRate.value = vel;
            const ganho = this.ctx.createGain();
            // mesma lei de pan da renderização (voz mono no centro, −3 dB)
            ganho.gain.value = dbParaLinear(c.ganhoDb) * Math.SQRT1_2;
            src.connect(ganho).connect(this.ganhoAd);
            const decorrido = Math.max(0, t0 - c.posicaoMs);
            src.start(c.posicaoMs >= t0 ? quando(c.posicaoMs) : agora, (c.offsetMs + decorrido) / 1000, (c.duracaoMs - decorrido) / 1000);
            this.ativos.push(src);
        }
    }
    /** Conferência de ouvido: filme ao centro, à esquerda (com o intérprete à direita) ou mudo. */
    definirEscuta(modo) {
        this.volFilme.gain.value = modo === 'interprete' ? 0 : 1;
        this.panFilme.pan.value = modo === 'ambos' ? -1 : 0;
    }
    descartar() {
        this.parar();
        for (const e of this.eventos)
            this.video.removeEventListener(e, this.reagendar);
        this.fonte.disconnect();
        this.ganhoOriginal.disconnect();
        this.ganhoAd.disconnect();
        this.volFilme.disconnect();
        this.panFilme.disconnect();
        // devolve o som do vídeo ao destino, sem processamento
        this.fonte.connect(this.ctx.destination);
    }
}
/**
 * Som-guia do clipe de Libras na conferência de sincronia: à direita no modo
 * "ambos", ao centro no modo "intérprete", mudo no modo "filme".
 */
export class CanalInterprete {
    constructor(video) {
        Object.defineProperty(this, "video", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: video
        });
        Object.defineProperty(this, "ctx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: contextoAudio()
        });
        Object.defineProperty(this, "fonte", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "vol", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pan", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        let f = fontes.get(video);
        if (!f) {
            f = this.ctx.createMediaElementSource(video);
            fontes.set(video, f);
        }
        this.fonte = f;
        this.fonte.disconnect();
        this.vol = this.ctx.createGain();
        this.pan = this.ctx.createStereoPanner();
        this.fonte.connect(this.vol).connect(this.pan).connect(this.ctx.destination);
        this.definirEscuta('filme');
    }
    definirEscuta(modo) {
        this.video.muted = modo === 'filme';
        this.vol.gain.value = modo === 'filme' ? 0 : 1;
        this.pan.pan.value = modo === 'ambos' ? 1 : 0;
        if (modo !== 'filme')
            void this.ctx.resume();
    }
    descartar() {
        this.fonte.disconnect();
        this.vol.disconnect();
        this.pan.disconnect();
    }
}
