import json, os, wave, numpy as np
OUT = os.environ.get('OUT', '.video')
SR = 44100
tl = json.load(open(os.path.join(OUT, 'timeline.json')))
offset = max(0.0, tl.get('firstFrame', 0.0))
total = tl['total'] - offset + 0.6
N = int(total * SR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR

def env_exp(n, tau):
    return np.exp(-np.arange(n) / SR / tau)

def add(buf, start, sig, gain=1.0):
    i = int(start * SR)
    if i >= len(buf) or i < 0: return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain

def onepole_lp(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); acc = 0.0
    # vectorizado por bloques no es trivial: usamos lfilter manual con numpy cumulativo aproximado
    for k in range(len(x)):
        acc = (1 - a) * x[k] + a * acc
        y[k] = acc
    return y

def midi(n): return 440.0 * 2 ** ((n - 69) / 12)

# ── Música ─────────────────────────────────────────────
bpm = 78; beat = 60 / bpm; bar = 4 * beat
music = np.zeros(N)
# Am7 – Dm9 – Gmaj7 – Cmaj7 (voicings cálidas)
chords = [[57, 60, 64, 67, 71], [50, 57, 60, 64, 65], [55, 59, 62, 66, 69], [48, 55, 59, 62, 64]]
bass = [45, 38, 43, 36]
def epiano(freq, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    tone = np.sin(2*np.pi*freq*t) + 0.35*np.sin(2*np.pi*2*freq*t)*np.exp(-t/0.25) + 0.12*np.sin(2*np.pi*3*freq*t)*np.exp(-t/0.12)
    trem = 1 + 0.12*np.sin(2*np.pi*4.2*t)
    attack = np.minimum(1, t/0.012)
    return tone * trem * attack * np.exp(-t/1.6)
nbars = int(total / bar) + 2
for b in range(nbars):
    st = b * bar
    ch = chords[b % 4]
    # acorde en el 1 y un "rasgueo" sincopado en el 2.5
    for k, n in enumerate(ch):
        add(music, st + k*0.018, epiano(midi(n), bar*0.95), 0.055)
        add(music, st + 1.5*beat + k*0.012, epiano(midi(n+12 if k > 2 else n), beat*1.4), 0.025)
    # bajo
    bn = int(bar * SR); tb = np.arange(bn)/SR
    add(music, st, np.sin(2*np.pi*midi(bass[b%4])*tb) * np.minimum(1, tb/0.02) * np.exp(-tb/1.2), 0.22)
    add(music, st + 2.5*beat, np.sin(2*np.pi*midi(bass[b%4]+7)*tb[:int(beat*SR)]) * np.exp(-tb[:int(beat*SR)]/0.5), 0.12)
    # batería
    for q in range(4):
        bt = st + q*beat
        if q in (0, 2) or (q == 3 and b % 2):
            kn = int(0.35*SR); tk = np.arange(kn)/SR
            f = 50 + 70*np.exp(-tk/0.04)
            add(music, bt + (0.5*beat if q == 3 else 0), np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-tk/0.12), 0.38)
        if q in (1, 3):
            sn = int(0.25*SR); noise = rng.standard_normal(sn)
            add(music, bt, onepole_lp(noise, 2600) * np.exp(-np.arange(sn)/SR/0.07), 0.16)
        for h in (0, 1):
            swing = 0.0 if h == 0 else beat*0.58
            hn = int(0.05*SR); hh = rng.standard_normal(hn); hh = hh - np.concatenate([[0], hh[:-1]])
            add(music, bt + swing, hh * np.exp(-np.arange(hn)/SR/0.012), 0.035 if h else 0.05)
# vinilo: crujidos + siseo
crackle = np.zeros(N)
for _ in range(int(total*9)):
    add(crackle, rng.uniform(0, total), rng.standard_normal(60)*np.exp(-np.arange(60)/12), rng.uniform(0.01, 0.05))
hiss = onepole_lp(rng.standard_normal(N)*0.006, 5000)
music = onepole_lp(music, 6200) + crackle + hiss
# fade in/out
fade = np.ones(N); fi = int(1.5*SR); fo = int(3.0*SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
music *= fade

# ── Efectos ────────────────────────────────────────────
sfx = np.zeros(N)
def pop():
    n = int(0.07*SR); t = np.arange(n)/SR
    f = 700 + 600*np.exp(-t/0.012)
    return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t/0.022)
def tick():
    n = int(0.012*SR); x = rng.standard_normal(n); x = x - np.concatenate([[0], x[:-1]])
    return x*np.exp(-np.arange(n)/SR/0.003)
def chime():
    n = int(0.6*SR); t = np.arange(n)/SR
    a = np.sin(2*np.pi*midi(84)*t)*np.exp(-t/0.25)
    b = np.zeros(n); d = int(0.07*SR); b[d:] = np.sin(2*np.pi*midi(91)*t[:n-d])*np.exp(-t[:n-d]/0.3)
    return (a + 0.8*b) * np.minimum(1, t/0.004)
for e in tl['ev']:
    tt = e['t'] - offset
    if e['k'] == 'tap': add(sfx, tt, pop(), 0.30)
    elif e['k'] == 'key': add(sfx, tt, tick(), 0.05)
    elif e['k'] == 'ok': add(sfx, tt + 0.35, chime(), 0.20)

mix = music * 0.9 + sfx
mix /= max(1e-9, np.abs(mix).max()) / 0.89
# estéreo con leve ensanche de la música
L = mix; R = np.concatenate([[0]*30, mix[:-30]])*0.97 + 0.03*mix
st = np.stack([L, R], axis=1)
pcm = (np.clip(st, -1, 1) * 32767).astype(np.int16)
with wave.open(os.path.join(OUT, 'audio.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('audio', round(total, 1), 's', 'offset', round(offset, 2))
