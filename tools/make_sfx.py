"""Create Summat's own sound effects (24 Nov), made from scratch here - synthesised, not recorded or copied - and given
away as CC0 (library/sfx/createsummat/LICENSE.txt). Run: python tools/make_sfx.py  (needs numpy + ffmpeg).

whoosh, whoosh-fast, hit, punch, boom, ding, ding-double, record-scratch, crowd-cheer, crowd-ooh, fail-trombone
("bruh"-style sad horn), pop, click, riser, glitch."""
import subprocess
import sys
from pathlib import Path

import numpy as np

SR = 48000
OUT = Path(__file__).resolve().parents[1] / "library" / "sfx" / "createsummat"
rng = np.random.default_rng(2411)


def t_(sec):
    return np.arange(int(SR * sec)) / SR


def env(n, attack, release, sustain=0.0):
    a, r = int(SR * attack), int(SR * release)
    e = np.ones(n)
    if a:
        e[:a] = np.linspace(0, 1, a) ** 2
    if r:
        e[-r:] *= np.linspace(1, 0, r) ** 1.6
    return e


def bandnoise(n, lo, hi):
    """Noise between lo and hi Hz (FFT mask)."""
    x = rng.standard_normal(n)
    f = np.fft.rfftfreq(n, 1 / SR)
    X = np.fft.rfft(x)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, n)


def sweep_filter(x, f0, f1, q=3.0):
    """A band-pass whose centre glides f0 -> f1 (state-variable filter, per sample)."""
    y = np.zeros_like(x)
    low = band = 0.0
    fc = np.geomspace(f0, f1, len(x))
    for i, v in enumerate(x):
        f = 2 * np.sin(np.pi * fc[i] / SR)
        high = v - low - band / q
        band += f * high
        low += f * band
        y[i] = band
    return y


def norm(x, peak=0.89):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def whoosh(sec=0.9, f0=300, f1=4000):
    n = int(SR * sec)
    x = sweep_filter(rng.standard_normal(n), f0, f1, 2.0)
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return norm(x * e)


def hit():
    t = t_(0.45)
    body = np.sin(2 * np.pi * (55 + 90 * np.exp(-t * 30)) * t) * np.exp(-t * 9)
    snap = bandnoise(len(t), 800, 6000) * np.exp(-t * 60)
    return norm(body * 1.0 + snap * 0.6)


def punch():
    t = t_(0.35)
    body = np.sin(2 * np.pi * (80 + 120 * np.exp(-t * 40)) * t) * np.exp(-t * 14)
    slap = bandnoise(len(t), 1500, 9000) * np.exp(-t * 90)
    return norm(np.tanh(2.5 * (body + slap * 0.8)))


def boom():
    t = t_(2.2)
    sub = np.sin(2 * np.pi * (38 + 40 * np.exp(-t * 6)) * t) * np.exp(-t * 2.2)
    rumble = bandnoise(len(t), 30, 400) * np.exp(-t * 1.8) * 0.8
    crack = bandnoise(len(t), 600, 7000) * np.exp(-t * 25) * 0.5
    return norm(np.tanh(1.8 * (sub + rumble + crack)))


def bell(freq, sec=1.6):
    t = t_(sec)
    parts = [(1, 1, 1.6), (2.76, 0.45, 2.6), (5.40, 0.25, 4.0), (8.93, 0.12, 6.0)]
    x = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t * d) for m, a, d in parts)
    return x * env(len(t), 0.002, 0.05)


def ding():
    return norm(bell(1318.5))


def ding_double():
    a = bell(1318.5, 1.2)
    b = bell(1046.5, 1.4)
    x = np.zeros(int(SR * 1.6))
    x[:len(a)] += a
    k = int(SR * 0.18)
    x[k:k + len(b)] += b[:len(x) - k]
    return norm(x)


def record_scratch():
    """A tone and noise run through a fast back-and-forth 'platter' speed curve."""
    sec = 0.7
    t = t_(sec)
    speed = np.concatenate([np.linspace(1, -1.4, len(t) // 3), np.linspace(-1.4, 1.8, len(t) // 3),
                            np.linspace(1.8, 0, len(t) - 2 * (len(t) // 3))])
    phase = np.cumsum(speed) / SR
    src = np.sin(2 * np.pi * 220 * phase * 3) + 0.6 * np.sin(2 * np.pi * 330 * phase * 3)
    hiss = bandnoise(len(t), 1000, 8000) * np.abs(speed) * 0.35
    return norm(np.tanh(2 * (src * np.abs(speed) + hiss)) * env(len(t), 0.005, 0.08))


def crowd(sec=3.2, cheer=True):
    """Many voices: lots of short vowel-like bursts (formant-filtered buzz) on a noise bed, swelling then fading."""
    n = int(SR * sec)
    x = bandnoise(n, 200, 3500) * 0.35
    vowels = [(700, 1220), (390, 2300), (300, 870), (500, 1700), (640, 1190)]
    for _ in range(140 if cheer else 90):
        dur = rng.uniform(0.25, 1.1)
        m = int(SR * dur)
        s = int(rng.uniform(0, sec - dur) * SR)
        f0 = rng.uniform(160, 420) if cheer else rng.uniform(110, 260)
        tt = np.arange(m) / SR
        glide = f0 * (1 + (0.25 if cheer else -0.18) * tt / dur)
        buzz = np.sign(np.sin(2 * np.pi * np.cumsum(glide) / SR)) * 0.5
        f1, f2 = vowels[rng.integers(len(vowels))]
        v = sweep_filter(buzz, f1, f1, 6) + 0.6 * sweep_filter(buzz, f2, f2, 8)
        x[s:s + m] += v * np.sin(np.linspace(0, np.pi, m)) * rng.uniform(0.3, 1.0)
    shape = np.minimum(1, np.linspace(0, 3, n)) * np.minimum(1, np.linspace(4, 0, n) + 0.2)
    return norm(sweep_filter(x, 900, 900, 0.7) * 0.7 + x * 0.3) * shape


def fail_trombone():
    """Four falling notes, the last one bending down with a wobble (a sad horn: our own 'fail' sound)."""
    notes = [(311.1, 0.32), (293.7, 0.32), (277.2, 0.32), (261.6, 1.1)]
    out = []
    for i, (f, d) in enumerate(notes):
        t = t_(d)
        bend = f * (1 - (0.06 * t / d if i == 3 else 0)) * (1 + (0.012 * np.sin(2 * np.pi * 6 * t) if i == 3 else 0))
        ph = np.cumsum(bend) / SR
        tone = sum(np.sin(2 * np.pi * k * ph) / k ** 0.9 for k in range(1, 9))
        out.append(np.tanh(1.4 * tone) * env(len(t), 0.02, 0.06 if i < 3 else 0.4))
    return norm(np.concatenate(out))


def pop():
    t = t_(0.12)
    return norm(np.sin(2 * np.pi * (900 * np.exp(-t * 40) + 300) * t) * np.exp(-t * 45))


def click():
    t = t_(0.05)
    return norm(bandnoise(len(t), 2000, 9000) * np.exp(-t * 200))


def riser(sec=2.5):
    t = t_(sec)
    x = sweep_filter(rng.standard_normal(len(t)), 200, 9000, 3) * np.linspace(0.1, 1, len(t)) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(np.geomspace(120, 1200, len(t))) / SR) * np.linspace(0, 0.5, len(t)) ** 2
    return norm(x + tone) * env(len(t), 0.05, 0.02)


def glitch():
    t = t_(0.5)
    x = np.sign(np.sin(2 * np.pi * 180 * t)) * (rng.random(len(t)) > 0.3)
    x = np.repeat(x[::60], 60)[:len(t)]
    return norm(x * env(len(t), 0.002, 0.05) * 0.7 + bandnoise(len(t), 3000, 12000) * 0.3)


SOUNDS = {"whoosh": lambda: whoosh(), "whoosh-fast": lambda: whoosh(0.45, 500, 6000), "hit": hit, "punch": punch, "boom": boom,
          "ding": ding, "ding-double": ding_double, "record-scratch": record_scratch, "crowd-cheer": lambda: crowd(),
          "crowd-ooh": lambda: crowd(2.4, cheer=False), "fail-trombone": fail_trombone, "pop": pop, "click": click,
          "riser": lambda: riser(), "glitch": glitch}

# the sustained ones sound much louder at the same peak: brought down to sit with the rest (about -15 dB average)
GAIN = {"record-scratch": 0.4, "fail-trombone": 0.5, "glitch": 0.55, "punch": 0.65}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[1:])
    for name, fn in SOUNDS.items():
        if only and name not in only:
            continue
        x = np.clip(fn() * GAIN.get(name, 1.0), -1, 1)
        stereo = np.stack([x, x], 1)
        pcm = (stereo * 32767).astype("<i2").tobytes()
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "libmp3lame",
                        "-b:a", "192k", str(OUT / f"{name}.mp3")], input=pcm, check=True, creationflags=0x08000000 if sys.platform == "win32" else 0)
        print(name, round(len(x) / SR, 2), "s")
    (OUT / "LICENSE.txt").write_text(
        "Create Summat sound effects - made from scratch by Create Summat (synthesised by tools/make_sfx.py; nothing recorded or\n"
        "copied). Dedicated to the public domain: CC0 1.0 Universal, https://creativecommons.org/publicdomain/zero/1.0/\n"
        "Use them in any video, commercial included, with no credit needed.\n", encoding="utf-8")
