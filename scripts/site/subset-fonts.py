#!/usr/bin/env python3
"""
How the site's fonts were made (handoff 0077). Not part of any build: the fonts are committed, and this is the recipe.

    python3 scripts/site/subset-fonts.py <folder with the three source .woff2 files> [--check]

The sources are Atkinson Hyperlegible Next (upright and italic) and Atkinson Hyperlegible Mono, version 2.001, in the
Latin subset Google Fonts serves (216 characters: Basic Latin, Latin-1 and common punctuation), as Link Meteor's site
carries them under site/assets/fonts/. Each is cut to what grooph's pages use:

  - the weight axis to the weights the stylesheets ask for (400 to 800; the mono face 400 to 700), which drops the
    lighter masters;
  - no hinting (the pages are read on screens that ignore it);
  - the same characters. A graph's name is typed by a person, so every Latin-1 letter stays. `--check` reads the
    app's sources, the templates and the documents, and prints the characters they use that the fonts do not hold;
    those are drawn by the system font, as before.

It needs fontTools 4.39 or later and brotli (`pip install fonttools brotli`). The files it writes are named with a
version, `.v1.`, because the app's service worker keeps anything under assets/ for good: a new cut gets a new name,
and the name changes in apps/web/src/styles.css, scripts/site/layout.mjs and scripts/perf-budget.mjs with it.
"""
import io
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "apps", "web", "public", "assets", "fonts")
VERSION = "v1"
FACES = {
    "atkinson-hyperlegible-next": (400, 800),
    "atkinson-hyperlegible-next-italic": (400, 800),
    "atkinson-hyperlegible-mono": (400, 700),
}


def cut(source, weights):
    font = TTFont(source)
    characters = sorted(font.getBestCmap())
    low, high = weights
    font = instancer.instantiateVariableFont(font, {"wght": (low, low, high)})
    held = io.BytesIO()
    font.flavor = None
    font.save(held)
    held.seek(0)
    font = TTFont(held)
    options = subset.Options()
    options.hinting = False
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    cutter = subset.Subsetter(options)
    cutter.populate(unicodes=characters)
    cutter.subset(font)
    font.flavor = "woff2"
    return font


def used():
    """Every character in the text a visitor can be shown: the app, the templates, the documents, the README."""
    found = set()
    places = [("apps/web/src", (".ts", ".tsx")), ("packages/core/src", (".ts",)), ("patterns", (".json",)), ("docs", (".md",)), ("community", (".md", ".json")), ("scripts/site", (".mjs", ".js"))]
    for folder, endings in places:
        for at, _, names in os.walk(os.path.join(ROOT, folder)):
            for name in names:
                if name.endswith(endings):
                    with open(os.path.join(at, name), encoding="utf-8") as f:
                        found.update(f.read())
    with open(os.path.join(ROOT, "README.md"), encoding="utf-8") as f:
        found.update(f.read())
    return {c for c in found if ord(c) >= 0x20}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--check" in sys.argv:
        for name in FACES:
            held = set(TTFont(os.path.join(OUT, f"{name}.{VERSION}.woff2")).getBestCmap())
            missing = sorted(c for c in used() if ord(c) not in held)
            print(f"{name}: {len(held)} characters; the pages also use {len(missing)} it does not hold: {' '.join(missing)}")
        return
    if len(args) != 1:
        sys.exit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    for name, weights in FACES.items():
        source = os.path.join(args[0], f"{name}.woff2")
        target = os.path.join(OUT, f"{name}.{VERSION}.woff2")
        font = cut(source, weights)
        font.save(target)
        axes = [(a.axisTag, a.minValue, a.defaultValue, a.maxValue) for a in TTFont(target)["fvar"].axes]
        print(f"{name}: {os.path.getsize(source)} -> {os.path.getsize(target)} bytes, {axes}")


if __name__ == "__main__":
    main()
