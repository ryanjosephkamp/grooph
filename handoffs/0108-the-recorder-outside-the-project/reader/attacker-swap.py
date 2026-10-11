#!/usr/bin/env python3
"""
The tightest folder race macOS allows (race.mjs starts it with --attacker swap): a folder and a link to a folder
elsewhere change places in ONE system call, renamex_np(a, b, RENAME_SWAP), in a loop. The name is never missing
and nothing stands between the two states. Touches only the two paths it is given, both made by race.mjs under
its scratch folder.

    attacker-swap.py <the folder the hook steps into> <a folder elsewhere>
"""
import ctypes, os, signal, sys

target, far = sys.argv[1], sys.argv[2]
alt = target + ".alt"
if not os.path.lexists(alt):
    os.symlink(far, alt)
libc = ctypes.CDLL(None, use_errno=True)
RENAME_SWAP = 0x2
a, b = target.encode(), alt.encode()
stop = False
def on_term(*_):
    global stop
    stop = True
signal.signal(signal.SIGTERM, on_term)
rounds = 0
failed = 0
while not stop:
    for _ in range(2000):
        if libc.renamex_np(a, b, RENAME_SWAP) != 0:
            failed += 1
        rounds += 1
# Leave the real folder at its own name.
if os.path.islink(target):
    libc.renamex_np(a, b, RENAME_SWAP)
sys.stdout.write("rounds %d (failed %d)\n" % (rounds, failed))
