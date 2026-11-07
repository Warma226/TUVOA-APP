# /// script
# requires-python = ">=3.10"
# dependencies = ["librosa>=0.10", "numpy", "scipy", "soundfile"]
# ///
"""La minute cyber, ép. 6 : bande son (nappe sombre en ré mineur, 96 bpm) + voix off de Mara posée sur la timeline.
Écrit audio/music.wav, audio/vo.wav, beats.json.
"""
import json
import os
import sys
from pathlib import Path


import numpy as np

from scipy import signal

sys.path.insert(0, str(Path(__file__).resolve().parent / "stub"))
sys.path.insert(0, str(Path(os.environ["MOTION_REEL_SKILL"]) / "scripts"))
from dsp import *  # noqa: E402,F403
import soundfile as sf

HERE = Path(__file__).resolve().parent
FILM = HERE.parent
BPM = 96
BEAT = 60 / BPM
DUR = 56.3
N = int(SR * DUR)
seed(20261107)


def T(s):  # secondes -> temps
    return s


# ---------------------------------------------------------------- voix off
# (fichier, position dans le film) ; les prises sont posées bout à bout, silences de tête et de fin retirés
VO = [("p1.mp3", 0.30), ("p2.mp3", 21.70), ("p3.mp3", 48.30)]


def vo_track():
    out = np.zeros(N + SR * 2)
    for f, at in VO:
        from scipy.io import wavfile
        _, y = wavfile.read(HERE / "vo" / f.replace(".mp3", ".wav"))
        y = y.astype(np.float64) / 32768
        if f == "p3.mp3":  # le slogan de fin est déjà dans le générique : on coupe la prise après « vos proches »
            cut = int(7.40 * SR); y = y[:cut]; y[-int(0.08 * SR):] *= np.linspace(1, 0, int(0.08 * SR))
        y = filt(y, "highpass", 75)
        y = peq(y, 250, -2.5, 1.0)     # moins de boue
        y = peq(y, 3200, 2.0, 0.9)     # présence
        y = peq(y, 7500, -1.5, 1.5)    # sifflantes
        # compression douce (suivi d'enveloppe)
        env = env_follow(np.abs(y), 0.004, 0.12)
        thr = 0.12
        g = np.where(env > thr, (thr + (env - thr) / 3) / (env + 1e-9), 1.0)
        y = y * g
        s = int(at * SR)
        out[s:s + len(y)] += y[: len(out) - s]
    out = out[:N]
    out = out / (np.abs(out).max() + 1e-9) * 0.8
    # petite pièce, très discrète
    st = np.stack([out, out])
    st = reverb(st, wet=0.06, length=0.6, decay=0.18)
    return st / (np.abs(st).max() + 1e-9) * 0.8


# ---------------------------------------------------------------- musique
def soft_kick():
    n = int(0.5 * SR); t = tvec(n)
    f = 45 + 70 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22) * (1 - np.exp(-t / 0.002))


def heartbeat():
    a = soft_kick() * 0.9
    b = soft_kick() * 0.6
    out = np.zeros(int(0.9 * SR))
    out[: len(a)] += a
    s = int(0.24 * SR)
    out[s:s + len(b)] += b[: len(out) - s]
    return filt(out, "lowpass", 180)


def tick():
    n = int(0.03 * SR); t = tvec(n)
    return filt(rng.standard_normal(n), "highpass", 5000) * np.exp(-t / 0.006)


def drone(note, length, cutoff=380):
    n = int(length * SR); t = tvec(n)
    x = np.zeros(n)
    for det in (1.0, 1.004, 0.997):
        x += saw(hz(note) * det, n, phase0=rng.uniform())
    x = filt(x, "lowpass", cutoff) / 3
    lfo = 0.8 + 0.2 * np.sin(2 * np.pi * 0.15 * t)
    return x * lfo * adsr(n, 1.5, 0.5, 0.9, 1.5)


def main():
    music = Bus(DUR, BPM)   # pads, bass
    drums = Bus(DUR, BPM)
    fx = Bus(DUR, BPM)

    bar = 4 * BEAT
    s16 = BEAT / 4

    def groove(t0, t1, chords, *, kick_pat, clap_beats=(2,), hats=True, hat_vel=0.13, bass=True, bass_cut=700, arp=True, arp_oct="5", pad=0.3, pad_cut=(500, 1500)):
        """Boucle rythmée entre t0 et t1 (mesures de 4 temps)."""
        i = 0
        while t0 + i * bar < t1 - 0.05:
            b0 = t0 + i * bar
            ch = chords[i % len(chords)]
            if pad:
                music.add(pad_chord(ch, bar + 0.2, pad_cut, attack=0.05), 0, pad, at=b0)
            for st in range(16):
                at = b0 + st * s16
                if at >= t1:
                    break
                if st in kick_pat:
                    drums.add(kick(), 0, 0.62, at=at)
                if hats:
                    v = hat_vel * (1.0 if st % 4 == 2 else 0.55 if st % 2 == 0 else 0.35)
                    if st in (14, 15) and i % 2 == 1:  # roulement
                        drums.add(hat(), 0, v * 1.4, pan=0.25, at=at + s16 / 2)
                    drums.add(hat(open_=(st % 8 == 6)), 0, v, pan=0.25 if st % 2 else -0.2, at=at)
                if bass and st % 2 == 0:
                    root = ch[0][:-1] + str(int(ch[0][-1]) - 1)
                    note = root if st % 8 != 6 else ch[2][:-1] + str(int(ch[2][-1]) - 1)
                    music.add(bass_note(note, s16 * 1.8, bass_cut), 0, 0.34 if st % 4 == 0 else 0.24, at=at)
                if arp and st % 2 == 1:
                    nt = ch[(st // 2) % 3][:-1] + arp_oct
                    music.add(pluck([nt], 0.16, 2600), 0, 0.075, pan=0.45 if (st // 2) % 2 else -0.45, at=at)
            for cb in clap_beats:
                at = b0 + cb * BEAT
                if at < t1:
                    drums.add(clap(), 0, 0.32, at=at)
            i += 1

    Dm = [["D3", "F3", "A3"], ["Bb2", "D3", "F3"], ["G2", "Bb2", "D3"], ["A2", "C#3", "E3"]]
    DARK = [["D3", "F3", "A3"], ["Eb3", "G3", "Bb3"], ["D3", "F3", "A3"], ["C#3", "E3", "A3"]]

    # Accroche (0 -> 4.9) : pulsation de basse qui monte, tic-tac, filtre qui s'ouvre
    music.add(drone("D2", 5.4), 0, 0.45, at=0)
    for k in range(int(4.9 / (BEAT / 2))):
        at = k * BEAT / 2
        drums.add(tick(), 0, 0.22 if k % 2 == 0 else 0.13, pan=0.3 if k % 2 else -0.3, at=at)
        music.add(bass_note("D1", BEAT / 2 * 0.8, 200 + 900 * at / 4.9), 0, 0.22 + 0.12 * at / 4.9, at=at)
    music.add(riser(1.6), 0, 0.28, at=3.3)

    # Histoire (4.9 -> 21.7) : groove demi-tempo, arpèges ironiques
    groove(4.9, 21.7, Dm, kick_pat=(0, 6, 10), clap_beats=(2,), arp_oct="5", pad=0.22)
    drums.add(crash(1.6), 0, 0.22, at=4.9)

    # Tension (21.7 -> 32.25) : sombre, plus serré, battements de cœur + montée
    groove(21.7, 32.25, DARK, kick_pat=(0, 3, 6, 10, 12), clap_beats=(2,), arp_oct="4", pad=0.26, pad_cut=(400, 900), bass_cut=500)
    t = 28.0
    period = 0.9
    while t < 32.0:
        drums.add(heartbeat(), 0, 0.7, at=t)
        t += period
        period = max(0.55, period * 0.92)
    music.add(riser(2.0), 0, 0.3, at=30.3)
    drums.add(crash(1.6), 0, 0.2, at=32.28)

    # « Il paie encore » : le groove repart (32.25 -> 33.75)
    groove(32.25, 33.75, DARK, kick_pat=(0, 4, 8, 12), clap_beats=(1, 3), arp_oct="5", pad=0.2)

    # « Plus personne ne répond » (33.8 -> 37.0) : coupure, filtre fermé, montée vers l'impact
    music.add(drone("D1", 3.6, 160), 0, 0.5, at=33.75)
    music.add(riser(2.6), 0, 0.38, at=34.4)

    # Révélation + cybercriminel (37.0 -> 48.2) : drop, quatre temps, basse qui roule
    music.add(sub_drop(1.4), 0, 0.6, at=37.0)
    drums.add(crash(2.0), 0, 0.3, at=37.0)
    groove(37.0, 48.2, DARK, kick_pat=(0, 4, 8, 12), clap_beats=(1, 3), hat_vel=0.16, arp_oct="5", pad=0.3, pad_cut=(600, 2600), bass_cut=900)
    drums.add(crash(1.6), 0, 0.25, at=44.07)

    # Réflexes (48.2 -> 55.5) : plus clair, toujours en mouvement
    CALM = [["F3", "A3", "C4"], ["C3", "E3", "G3"], ["D3", "F3", "A3"], ["Bb2", "D3", "F3"]]
    groove(48.2, 55.5, CALM, kick_pat=(0, 8, 10), clap_beats=(2,), hat_vel=0.10, arp_oct="5", pad=0.2, pad_cut=900, bass_cut=600)
    # Fin : accord résolu, puis le générique prend le relais
    music.add(pad_chord(["D3", "F3", "A3", "D4"], 1.2, (600, 2400), attack=0.05), 0, 0.4, at=55.5)
    drums.add(crash(1.2), 0, 0.2, at=55.5)

    ir = reverb_ir(2.2, 0.6)
    wet_src = music.x * 0.5 + fx.x * 0.2
    wet = np.stack([signal.fftconvolve(wet_src[c], ir[c])[: wet_src.shape[1]] for c in range(2)])
    bed = drums.x * 0.9 + music.x * 0.8 + wet * 0.5
    bed = np.stack([filt(ch, "highpass", 28) for ch in bed])[:, :N]
    bed /= np.abs(bed).max() + 1e-9
    bed *= 0.5
    fade = int(1.2 * SR)
    bed[:, -fade:] *= np.linspace(1, 0, fade) ** 2
    # Accroche flash (2,2 s) placée avant l'histoire : basse en 16es qui accélère + montée, coupée net sur le titre
    INTRO = 2.2
    ni = int(INTRO * SR)
    ib = Bus(INTRO + 0.5, BPM)
    k = 0; at = 0.0
    while at < 1.55:
        ib.add(bass_note("D1", 0.09, 300 + 2400 * at / 1.6), 0, 0.5, at=at)
        ib.add(hat(), 0, 0.2, pan=0.3 if k % 2 else -0.3, at=at)
        k += 1; at += max(0.06, 0.13 - 0.045 * at)
    ib.add(riser(1.5), 0, 0.5, at=0.1)
    ib.add(sub_drop(0.9), 0, 0.8, at=1.62)
    intro_bed = ib.x[:, :ni]
    intro_bed = intro_bed / (np.abs(intro_bed).max() + 1e-9) * 0.5
    bed = np.concatenate([intro_bed, bed], axis=1)
    sf.write(HERE / "music.wav", bed.T, SR, subtype="PCM_24")

    v = vo_track()
    v = np.concatenate([np.zeros((2, ni)), v], axis=1)
    sf.write(HERE / "vo.wav", v.T, SR, subtype="PCM_24")

    beats = [round(k * BEAT, 4) for k in range(int(DUR / BEAT) + 1)]
    grid = {"bpm": BPM, "designed_bpm": BPM, "period": BEAT, "offset": 0.0, "beats": beats, "downbeats": beats[::4],
            "sections": {"accroche": [0, 7.84], "histoire": [7.84, 34.72], "tension": [34.72, 58.56], "revelation": [58.56, 76.8],
                         "reflexes": [76.8, 92.64], "fin": [92.64, 95.2]},
            "source": "grille conçue (score.py), 96 bpm, offset 0"}
    (FILM / "beats.json").write_text(json.dumps(grid, indent=1))
    print("ok", BPM, "bpm")


main()
