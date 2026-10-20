#!/usr/bin/env python3
"""
render.py — frame-exact capture of the animation to PNG frames and an MP4.

Usage:
  python3 render.py                 # 900 frames at 30 fps -> out/frames + out/ni-de-aqui-ni-de-alla.mp4
  python3 render.py --frames 0,90,180   # only specific frames (debugging)
  python3 render.py --fps 60        # other rates; duration always comes from recipe.js

Requires:  pip install playwright && python3 -m playwright install chromium
           ffmpeg on PATH (for the MP4 step)

The page is opened with ?capture=1, which fixes the canvas at 1080x1080,
hides controls, and exposes window.renderAt(t). Each frame is drawn
synchronously for t = frame / fps, so the output is deterministic.
"""
import argparse, json, os, pathlib, re, shutil, subprocess, sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "out"
FRAMES = OUT / "frames"

def read_recipe_duration():
    src = (ROOT / "recipe.js").read_text(encoding="utf-8")
    m = re.search(r"duration:\s*([0-9.]+)", src)
    return float(m.group(1)) if m else 30.0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--frames", type=str, default="", help="comma-separated frame indices to render (default: all)")
    ap.add_argument("--no-video", action="store_true")
    ap.add_argument("--crf", type=int, default=17)
    args = ap.parse_args()

    duration = read_recipe_duration()
    total = int(round(duration * args.fps))
    wanted = [int(x) for x in args.frames.split(",") if x.strip()] if args.frames else list(range(total))

    FRAMES.mkdir(parents=True, exist_ok=True)
    url = (ROOT / "index.html").resolve().as_uri() + "?capture=1"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1080, "height": 1080}, device_scale_factor=1)
        page.goto(url)
        page.wait_for_function("window.__ready === true", timeout=30000)
        canvas = page.locator("#stage")
        for i in wanted:
            t = i / args.fps
            page.evaluate("t => window.renderAt(t)", t)
            canvas.screenshot(path=str(FRAMES / f"frame_{i:04d}.png"), type="png")
            if i % 60 == 0 or i == wanted[-1]:
                print(f"frame {i}/{total-1}  t={t:.3f}s", flush=True)
        browser.close()

    if args.no_video or args.frames:
        print(f"frames written to {FRAMES}")
        return

    if not shutil.which("ffmpeg"):
        print("ffmpeg not found; frames are in out/frames. Encode with:\n"
              f"  ffmpeg -framerate {args.fps} -i out/frames/frame_%04d.png -c:v libx264 -pix_fmt yuv420p -crf {args.crf} -movflags +faststart out/ni-de-aqui-ni-de-alla.mp4")
        sys.exit(2)

    mp4 = OUT / "ni-de-aqui-ni-de-alla.mp4"
    cmd = ["ffmpeg", "-y", "-framerate", str(args.fps), "-i", str(FRAMES / "frame_%04d.png"),
           "-frames:v", str(total), "-c:v", "libx264", "-preset", "slow", "-crf", str(args.crf),
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)]
    print(" ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height,r_frame_rate,nb_frames",
                            "-of", "json", str(mp4)], capture_output=True, text=True)
    print(probe.stdout)
    print(f"wrote {mp4}")

if __name__ == "__main__":
    main()
