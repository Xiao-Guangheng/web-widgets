/*!
 * eave-curtain.js
 * 屋檐挂件 —— 自包含网页装饰脚本
 * ------------------------------------------------------------
 * 用法：在页面 </body> 前加入一行即可
 *   <script src="eave-curtain.js" defer></script>
 *
 * 零依赖、纯原生 JavaScript。脚本会自动完成三件事：
 *   1. 注入所需样式（定位 / 鼠标穿透 / 响应式隐藏）
 *   2. 创建 DOM（容器 + 左右屋檐图片 + 全屏 Canvas）
 *   3. 运行 Verlet 物理模拟 + Canvas 文字链条渲染
 *
 * 注意：屋檐图片需要与脚本一起部署，并在下方 CONFIG.imgBase
 *       中填写正确的路径（可以是相对路径或 CDN 绝对地址）。
 */

(function () {
    "use strict";

    /* =====================================================================
     * ① 可自定义配置区（用户主要改这里）
     * ===================================================================== */
    const CONFIG = {
        // 屋檐图片所在目录。结尾请带 /
        // 相对路径示例："images/"         （图片与脚本在同级 images 目录）
        // CDN 示例    ："https://cdn.jsdelivr.net/gh/你的用户名/仓库名/eave-curtain/images/"
        imgBase: "images/",

        // 季节切换间隔（毫秒），默认 15 秒
        switchInterval: 15000,

        // 是否开启鼠标互动（靠近时拨开文字链条）
        mouseInteraction: true,

        // 鼠标推力作用半径（像素）
        mouseRadius: 90,

        // 重力大小（越大字坠得越快、越沉）
        gravity: 0.28,

        // 相邻两个字的间距（像素）
        spacing: 30,

        // 屋檐显示宽度（像素）
        roofWidth: 240,

        // 是否在窄屏（手机）自动隐藏挂件
        hideOnMobile: true,
        // 窄屏阈值（像素）
        mobileMaxWidth: 900,
    };

    // 支持外部覆盖：在引入本脚本之前，页面可先定义 window.eaveCurtainConfig 来覆盖默认配置
    // 示例：<script>window.eaveCurtainConfig = { hideOnMobile: false };</script>
    if (typeof window !== "undefined" && window.eaveCurtainConfig) {
        Object.assign(CONFIG, window.eaveCurtainConfig);
    }

    /* =====================================================================
     * ② 主题配置（屋檐图 + 挂在下面的左右两串文字）
     *
     *   想自定义：
     *     - 改 img        → 换成你自己的图片（必须透明 PNG）
     *     - 改 leftText / rightText → 换成你想显示的文字（逐字挂成链条）
     *     - 增删整个对象 → 增加或减少季节主题
     * ===================================================================== */
    const THEMES = [
        {
            season: "Spring",
            img: "eave_spring.png",
            leftText: "春江潮水连海平海上明月共潮生滟滟随波千万里何处春江无月明江流宛转绕芳甸月照花林皆似霰空里流霜不觉飞汀上白沙看不见江天一色无纤尘皎皎空中孤月轮",
            rightText: "江畔何人初见月江月何年初照人人生代代无穷已江月年年望相似不知江月待何人但见长江送流水白云一片去悠悠青枫浦上不胜愁谁家今夜扁舟子何处相思明月楼"
        },
        {
            season: "Summer",
            img: "eave_summer.png",
            leftText: "环滁皆山也其西南诸峰林壑尤美望之蔚然而深秀者琅琊也山行六七里渐闻水声潺潺而泻出于两峰之间者酿泉也峰回路转有亭翼然临于泉上者醉翁亭也",
            rightText: "若夫日出而林霏开云归而岩穴暝晦明变化者山间之朝暮也野芳发而幽香佳木秀而繁阴风霜高洁水落而石出者山间之四时也朝而往暮而归四时之景不同"
        },
        {
            season: "Autumn",
            img: "eave_autumn.png",
            leftText: "披绣闼俯雕甍山原旷其盈视川泽纡其骇瞩闾阎扑地钟鸣鼎食之家舸舰弥津青雀黄龙之舳云销雨霁彩彻区明落霞与孤鹜齐飞秋水共长天一色渔舟唱晚响穷彭蠡之滨",
            rightText: "雁阵惊寒声断衡阳之浦遥襟甫畅逸兴遄飞爽籁发而清风生纤歌凝而白云遏浩浩乎如冯虚御风而不知其所止飘飘乎如遗世独立羽化而登仙相与枕藉乎舟中"
        },
        {
            season: "Winter",
            img: "eave_winter.png",
            leftText: "北风卷地白草折胡天八月即飞雪忽如一夜春风来千树万树梨花开散入珠帘湿罗幕狐裘不暖锦衾薄将军角弓不得控都护铁衣冷难着瀚海阑干百丈冰愁云惨淡万里凝",
            rightText: "中军置酒饮归客胡琴琵琶与羌笛纷纷暮雪下辕门风掣红旗冻不翻轮台东门送君去去时雪满天山路山回路转不见君雪上空留马行处燕山雪花大如席片片吹落轩辕台"
        }
    ];

    /* =====================================================================
     * ③ 注入样式
     * ===================================================================== */
    function injectStyle() {
        const css = `
/* ==== eave-curtain 样式（由脚本自动注入）==== */
.ec-curtain-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    z-index: 100;
    pointer-events: none;   /* 关键：让鼠标点击穿透，不挡正文 */
    overflow: hidden;
}
.ec-building-img {
    position: absolute;
    top: 0;
    width: ${CONFIG.roofWidth}px;
    display: none;
    pointer-events: none;
}
#ec-roof-left  { left: 0; }
#ec-roof-right { right: 0; }
#ec-main-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}
${CONFIG.hideOnMobile ? `
@media (max-width: ${CONFIG.mobileMaxWidth}px) {
    .ec-curtain-container { display: none !important; }
}` : ""}
`;
        const style = document.createElement("style");
        style.setAttribute("data-eave-curtain", "");
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* =====================================================================
     * ④ 创建 DOM
     * ===================================================================== */
    function buildDom() {
        const container = document.createElement("div");
        container.className = "ec-curtain-container";
        container.setAttribute("aria-hidden", "true");

        const imgLeft = document.createElement("img");
        imgLeft.id = "ec-roof-left";
        imgLeft.className = "ec-building-img";
        imgLeft.alt = "";

        const imgRight = document.createElement("img");
        imgRight.id = "ec-roof-right";
        imgRight.className = "ec-building-img";
        imgRight.alt = "";
        imgRight.style.transform = "scaleX(-1)";

        const canvas = document.createElement("canvas");
        canvas.id = "ec-main-canvas";

        container.appendChild(imgLeft);
        container.appendChild(imgRight);
        container.appendChild(canvas);
        document.body.appendChild(container);

        return { container, imgLeft, imgRight, canvas };
    }

    /* =====================================================================
     * ⑤ 物理引擎 + 渲染（基于原 symmetric_curtain 移植）
     * ===================================================================== */
    function start() {
        const dom = buildDom();
        const canvas = dom.canvas;
        const imgLeft = dom.imgLeft;
        const imgRight = dom.imgRight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const DRAG = 1 - 0.025;   // 速度阻尼
        const BOUNCE = 0.6;       // 约束弹性

        let mouse = { x: -1000, y: -1000, radius: CONFIG.mouseRadius };
        if (CONFIG.mouseInteraction) {
            window.addEventListener("mousemove", (e) => {
                mouse.x = e.clientX;
                mouse.y = e.clientY;
            });
        }

        class Point {
            constructor(x, y, isPinned, char = "") {
                this.x = x; this.y = y;
                this.oldX = x; this.oldY = y;
                this.isPinned = isPinned;
                this.char = char;
            }
            update() {
                if (this.isPinned) return;
                let vx = (this.x - this.oldX) * DRAG;
                let vy = (this.y - this.oldY) * DRAG;
                this.oldX = this.x;
                this.oldY = this.y;
                this.x += vx;
                this.y += vy + CONFIG.gravity;

                let dx = this.x - mouse.x;
                let dy = this.y - mouse.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < mouse.radius && dist > 0) {
                    let force = (mouse.radius - dist) / mouse.radius;
                    this.x += (dx / dist) * force * 4;
                    this.y += (dy / dist) * force * 4;
                }
            }
        }

        function constrain(p1, p2, restLength) {
            let dx = p2.x - p1.x;
            let dy = p2.y - p1.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return;
            let diff = (restLength - dist) / dist;
            let offsetX = dx * 0.5 * diff * BOUNCE;
            let offsetY = dy * 0.5 * diff * BOUNCE;
            if (!p1.isPinned) { p1.x -= offsetX; p1.y -= offsetY; }
            if (!p2.isPinned) { p2.x += offsetX; p2.y += offsetY; }
        }

        let canvasWidth = window.innerWidth;
        let canvasHeight = window.innerHeight;
        let allChains = [];
        let isActive = false;
        let currentThemeIndex = 0;

        function resize() {
            canvasWidth = window.innerWidth;
            canvasHeight = window.innerHeight;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
        }
        window.addEventListener("resize", resize);
        resize();

        // 扫描屋檐图片每一列的不透明下边缘，得到该列文字链条的悬挂高度
        function scanRoofEdge(tempImg) {
            const roofW = CONFIG.roofWidth;
            const roofH = tempImg.naturalHeight * (roofW / tempImg.naturalWidth);

            const offCanvas = document.createElement("canvas");
            offCanvas.width = roofW;
            offCanvas.height = roofH;
            const offCtx = offCanvas.getContext("2d");
            offCtx.drawImage(tempImg, 0, 0, roofW, roofH);

            let imgData = null;
            try {
                imgData = offCtx.getImageData(0, 0, roofW, roofH).data;
            } catch (e) {
                // file:// 等场景下读取本地图片像素被浏览器禁止（Canvas 污染）
                return null;
            }

            function getHitY(localX) {
                let hitY = 0;
                for (let y = Math.floor(roofH); y >= 0; y--) {
                    const alpha = imgData[(y * roofW + Math.floor(localX)) * 4 + 3];
                    if (alpha > 50) { hitY = y; break; }
                }
                return hitY === 0 ? roofH - 10 : hitY;
            }
            return { getHitY, roofH };
        }

        function loadTheme(theme) {
            isActive = false;
            allChains = [];

            const tempImg = new Image();
            tempImg.src = CONFIG.imgBase + theme.img;
            imgLeft.src = CONFIG.imgBase + theme.img;
            imgRight.src = CONFIG.imgBase + theme.img;

            tempImg.onload = () => {
                const edge = scanRoofEdge(tempImg);
                // 兜底：读取像素失败时，文字统一挂在图片底部
                const fallbackHitY = (() => {
                    const roofW = CONFIG.roofWidth;
                    const roofH = tempImg.naturalHeight * (roofW / tempImg.naturalWidth);
                    return roofH - 10;
                })();

                const leftText = theme.leftText || "";
                const rightText = theme.rightText || "";

                // 左侧链条
                let leftCharIndex = 0;
                const startX = CONFIG.roofWidth - 25;
                for (let x = startX; x >= 25; x -= 32) {
                    let hitY = edge ? edge.getHitY(x) : fallbackHitY;
                    let chain = [new Point(x, hitY, true)];
                    const chainLength = Math.floor(Math.random() * 9) + 14;
                    for (let i = 0; i < chainLength; i++) {
                        let char = leftText.length
                            ? leftText[leftCharIndex % leftText.length]
                            : "";
                        chain.push(new Point(x, hitY + (i + 1) * CONFIG.spacing, false, char));
                        leftCharIndex++;
                    }
                    allChains.push(chain);
                }

                // 右侧链条（映射到屏幕右侧全局坐标）
                let rightCharIndex = 0;
                for (let localX = startX; localX >= 25; localX -= 32) {
                    let hitY = edge ? edge.getHitY(localX) : fallbackHitY;
                    let absX = canvasWidth - localX;
                    let chain = [new Point(absX, hitY, true)];
                    const chainLength = Math.floor(Math.random() * 9) + 14;
                    for (let i = 0; i < chainLength; i++) {
                        let char = rightText.length
                            ? rightText[rightCharIndex % rightText.length]
                            : "";
                        chain.push(new Point(absX, hitY + (i + 1) * CONFIG.spacing, false, char));
                        rightCharIndex++;
                    }
                    allChains.push(chain);
                }

                imgLeft.style.display = "block";
                imgRight.style.display = "block";
                isActive = true;
            };
        }

        function tick() {
            if (!isActive) {
                requestAnimationFrame(tick);
                return;
            }

            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            ctx.font = "18px 'STKaiti','Kaiti TC','KaiTi','BiauKai','FangSong','Ma Shan Zheng','Noto Serif SC',serif";

            const isDarkMode =
                document.body.classList.contains("dark") ||
                document.documentElement.classList.contains("dark") ||
                document.documentElement.getAttribute("data-theme") === "dark";

            ctx.fillStyle = isDarkMode ? "#e3d3b6" : "#2e2b2a";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            allChains.forEach((chain) => {
                chain.forEach((p) => p.update());

                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < chain.length - 1; j++) {
                        constrain(chain[j], chain[j + 1], CONFIG.spacing);
                    }
                }

                ctx.beginPath();
                ctx.moveTo(chain[0].x, chain[0].y);
                for (let j = 1; j < chain.length; j++) {
                    const p = chain[j];
                    ctx.lineTo(p.x, p.y);

                    const dissolveWeight = j / chain.length;
                    ctx.globalAlpha = Math.max(0.05, 1 - dissolveWeight * 0.95);
                    ctx.fillText(p.char, p.x, p.y);
                    ctx.globalAlpha = 1.0;
                }

                ctx.strokeStyle = isDarkMode
                    ? "rgba(227, 211, 182, 0.12)"
                    : "rgba(46, 43, 42, 0.05)";
                ctx.lineWidth = 1;
                ctx.stroke();
            });

            requestAnimationFrame(tick);
        }
        tick();

        function switchTheme() {
            loadTheme(THEMES[currentThemeIndex]);
            currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
        }

        switchTheme();
        setInterval(switchTheme, CONFIG.switchInterval);
    }

    /* =====================================================================
     * ⑥ 启动：等 DOM 就绪后运行
     * ===================================================================== */
    function init() {
        injectStyle();
        if (document.body) {
            start();
        } else {
            document.addEventListener("DOMContentLoaded", start);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
