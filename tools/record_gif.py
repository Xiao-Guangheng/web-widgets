# -*- coding: utf-8 -*-
"""
录制 eave-curtain 交互演示 GIF 的脚本。

用法（在 web-widgets 目录下，先启动本地服务器 python -m http.server 8000）：
    python tools/record_gif.py

流程：
  1. 打开 eave-curtain/record.html（无正文的纯净页面）
  2. 模拟鼠标从左侧文字链划到右侧，展示"拨开珠帘"的交互
  3. 截帧合成 GIF，输出到 eave-curtain/images/demo.gif
"""
import math
import time
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

# ---------- 可调参数 ----------
VIEW_W, VIEW_H = 1280, 720      # 录制视口
FPS = 15                        # GIF 帧率（15 足够流畅，体积减半）
DURATION = 8                    # 录制总时长（秒）
STEP_COUNT = 3                  # 鼠标来回拨动几次
URL = "http://localhost:8000/eave-curtain/record.html"
OUT = Path(__file__).resolve().parent.parent / "eave-curtain" / "images" / "demo.gif"
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

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # 量化到 128 色，大幅减小体积（GIF 单帧最多 256 色）
    frames_rgb = [f.convert("RGB").quantize(colors=96, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG) for f in frames]
    frames_rgb[0].save(
        OUT,
        save_all=True,
        append_images=frames_rgb[1:],
        duration=int(1000 / FPS),
        loop=0,
        optimize=True,
    )
    size_kb = OUT.stat().st_size / 1024
    print(f"已生成: {OUT}")
    print(f"帧数: {len(frames)}, 大小: {size_kb:.0f} KB")


if __name__ == "__main__":
    main()
