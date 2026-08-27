# -*- coding: utf-8 -*-
"""
录制 eave-curtain 交互演示 GIF / MP4 的脚本。

用法（在 web-widgets 目录下，先启动本地服务器 python -m http.server 8000）：
    python tools/record_gif.py

流程：
  1. 打开 eave-curtain/record.html（无正文的纯净页面）
  2. 模拟鼠标从左侧文字链划到右侧，展示"拨开珠帘"的交互
  3. 截帧合成 GIF + MP4，输出到 eave-curtain/images/demo.gif / demo.mp4
"""
import math
import time
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

# ---------- 可调参数 ----------
VIEW_W, VIEW_H = 1280, 720      # 录制视口
FPS = 30                        # 录制帧率（MP4 用 30 保证流畅；GIF 会降到 15）
DURATION = 8                    # 录制总时长（秒）
STEP_COUNT = 3                  # 鼠标来回拨动几次
URL = "http://localhost:8000/eave-curtain/demo.html"   # 用带文字的真实演示页
BASE = Path(__file__).resolve().parent.parent / "eave-curtain" / "images"
GIF_OUT = BASE / "demo.gif"
MP4_OUT = BASE / "demo.mp4"
SCALE = 0.6                     # 输出缩放（控制文件体积）
CROP_BOTTOM = 500               # 只保留页面顶部 500px（挂件所在区域）
# --------------------------------


def main():
    frames = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": VIEW_W, "height": VIEW_H})
        page.goto(URL, wait_until="networkidle")
        # 等挂件图片加载并稳定
        time.sleep(2)

        total_frames = int(DURATION * FPS)
        interval = 1.0 / FPS

        for i in range(total_frames):
            t = i / total_frames  # 0 -> 1

            # 鼠标沿贝塞尔曲线横穿页面顶部，来回拨动文字链
            sweeps = STEP_COUNT
            phase = t * sweeps * math.pi  # 来回 sweeps 次
            x = VIEW_W / 2 + math.sin(phase) * (VIEW_W / 2 - 60)
            y = 260 + math.sin(phase * 0.7) * 60  # 上下轻微起伏
            page.mouse.move(x, y)

            time.sleep(interval)
            png = page.screenshot()
            frames.append(Image.open(__import__("io").BytesIO(png)))

        browser.close()

    # 裁剪到挂件区域 + 缩放帧以控制体积
    frames = [f.crop((0, 0, f.width, min(CROP_BOTTOM, f.height))) for f in frames]
    frames = [f.resize((int(f.width * SCALE), int(f.height * SCALE)), Image.LANCZOS)
              for f in frames]

    BASE.mkdir(parents=True, exist_ok=True)

    # --- 输出 MP4（视频格式：流畅、体积小，README 用 <video> 内联） ---
    try:
        import numpy as np
        import imageio.v2 as imageio
        rgb_frames = [np.array(f.convert("RGB")) for f in frames]
        imageio.mimsave(MP4_OUT, rgb_frames, fps=FPS,
                        macro_block_size=16, quality=8)
        print(f"已生成: {MP4_OUT}  ({MP4_OUT.stat().st_size/1024:.0f} KB)")
    except Exception as e:
        print(f"MP4 生成失败（不影响 GIF）: {e}")

    # --- 输出 GIF（兼容旧展示；降到 15fps 控制体积） ---
    gif_frames = frames[:: max(1, FPS // 15)]
    frames_rgb = [f.convert("RGB").quantize(colors=96, method=Image.MEDIANCUT,
                                            dither=Image.FLOYDSTEINBERG)
                  for f in gif_frames]
    frames_rgb[0].save(
        GIF_OUT,
        save_all=True,
        append_images=frames_rgb[1:],
        duration=int(1000 / 15),
        loop=0,
        optimize=True,
    )
    print(f"已生成: {GIF_OUT}  ({GIF_OUT.stat().st_size/1024:.0f} KB)")
    print(f"录制帧数: {len(frames)}")


if __name__ == "__main__":
    main()
