import { type CSSProperties, useEffect, useRef } from "react";

type DesignCanvasProps = {
  className?: string;
  style?: CSSProperties;
  animate?: boolean;
  ariaLabel?: string;
};

const WIDTH = 1366;
const HEIGHT = 623;

// [x, y, radius, brightness] — traced from the supplied reference.
const POINTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [144.3, 3.5, 1.58, 0.41],
  [709.9, 12.1, 1.2, 0.427],
  [823.4, 37.5, 1.4, 0.442],
  [314.5, 39.5, 1.2, 0.472],
  [926.5, 58.0, 1.69, 0.435],
  [346.8, 58.8, 1.2, 0.452],
  [900.5, 79.5, 1.69, 0.461],
  [210.6, 81.8, 1.2, 0.464],
  [672.7, 89.9, 1.34, 0.437],
  [1361.4, 102.9, 3.25, 0.816],
  [541.1, 120.1, 1.2, 0.463],
  [216.8, 125.7, 1.47, 0.447],
  [830.0, 142.0, 1.2, 0.494],
  [397.5, 157.0, 1.2, 0.463],
  [976.2, 166.8, 1.84, 0.436],
  [546.1, 176.7, 1.2, 0.485],
  [775.5, 182.8, 1.53, 0.507],
  [1139.2, 187.0, 2.93, 0.837],
  [779.2, 188.5, 1.8, 0.491],
  [760.3, 192.0, 1.27, 0.512],
  [1119.6, 192.4, 3.86, 0.84],
  [560.4, 192.9, 1.74, 0.47],
  [1061.5, 195.5, 1.47, 0.5],
  [397.5, 200.4, 1.4, 0.458],
  [677.0, 203.5, 1.69, 0.478],
  [182.4, 211.8, 1.53, 0.455],
  [488.1, 226.1, 1.2, 0.482],
  [874.9, 229.7, 1.8, 0.447],
  [613.0, 231.0, 1.27, 0.502],
  [1078.5, 233.8, 1.8, 0.5],
  [314.6, 243.2, 1.2, 0.507],
  [239.2, 253.1, 1.84, 0.458],
  [1067.8, 260.4, 1.2, 0.537],
  [116.6, 264.4, 1.53, 0.487],
  [1087.5, 271.0, 1.2, 0.543],
  [767.5, 272.2, 1.34, 0.502],
  [705.5, 275.5, 1.47, 0.489],
  [289.0, 283.3, 1.2, 0.472],
  [1169.2, 284.0, 1.34, 0.477],
  [1003.6, 290.2, 1.2, 0.465],
  [63.6, 292.9, 1.74, 0.466],
  [346.5, 308.0, 1.2, 0.463],
  [559.2, 308.0, 1.34, 0.494],
  [145.5, 319.5, 1.69, 0.492],
  [622.8, 326.3, 1.47, 0.477],
  [522.5, 326.5, 1.58, 0.471],
  [829.7, 340.5, 1.58, 0.471],
  [162.2, 341.9, 1.84, 0.473],
  [1319.0, 345.7, 1.2, 0.41],
  [719.0, 354.5, 1.69, 0.45],
  [122.2, 355.6, 1.58, 0.477],
  [70.5, 359.1, 1.8, 0.467],
  [873.0, 361.0, 1.27, 0.469],
  [816.0, 368.0, 1.27, 0.468],
  [448.8, 376.3, 1.47, 0.446],
  [20.7, 379.9, 1.2, 0.448],
  [1131.2, 379.9, 1.94, 0.473],
  [1115.0, 380.7, 1.2, 0.515],
  [609.2, 383.2, 1.84, 0.442],
  [475.8, 390.0, 1.34, 0.453],
  [1119.4, 412.2, 1.2, 0.533],
  [919.4, 432.5, 1.74, 0.454],
  [1161.4, 442.4, 1.53, 0.491],
  [1272.5, 454.5, 1.2, 0.473],
  [944.5, 472.0, 1.2, 0.485],
  [261.1, 482.1, 1.2, 0.418],
  [1068.8, 487.6, 1.2, 0.501],
  [1337.8, 495.2, 1.2, 0.428],
  [848.7, 497.5, 1.58, 0.462],
  [1112.1, 514.0, 1.94, 0.475],
  [634.9, 534.7, 1.8, 0.422],
  [417.0, 538.5, 1.2, 0.497],
  [833.2, 542.5, 1.34, 0.45],
  [1154.4, 543.4, 1.53, 0.488],
  [1213.1, 547.3, 1.53, 0.486],
  [1155.0, 548.8, 1.34, 0.498],
  [413.6, 551.2, 1.58, 0.499],
  [555.1, 565.9, 1.2, 0.435],
  [328.1, 568.9, 1.2, 0.509],
  [892.1, 569.9, 1.2, 0.491],
  [163.4, 578.1, 1.74, 0.424],
  [345.5, 593.0, 1.47, 0.496],
  [913.9, 593.1, 1.2, 0.474],
  [1264.0, 596.5, 1.2, 0.492],
  [379.7, 604.1, 1.74, 0.489],
  [148.7, 609.1, 1.64, 0.423],
  [122.7, 610.2, 1.2, 0.484],
  [625.4, 615.8, 1.2, 0.433],
  [993.2, 618.0, 1.34, 0.425],
  [389.1, 620.9, 1.58, 0.476],
  [1080.0, 45.0, 1.4, 0.45],
  [1160.0, 70.0, 1.8, 0.52],
  [1220.0, 25.0, 1.2, 0.42],
  [1280.0, 85.0, 1.6, 0.48],
  [1120.0, 110.0, 1.3, 0.44],
  [1200.0, 130.0, 1.5, 0.49],
  [1290.0, 30.0, 1.4, 0.46],
  [1040.0, 75.0, 1.3, 0.45],
];

// Index pairs into POINTS. Everything is rendered with Canvas API only.
const EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 3],
  [0, 7],
  [0, 11],
  [1, 2],
  [1, 8],
  [1, 12],
  [2, 4],
  [2, 6],
  [2, 12],
  [3, 5],
  [3, 7],
  [3, 11],
  [4, 6],
  [4, 14],
  [5, 7],
  [5, 10],
  [5, 13],
  [6, 12],
  [6, 14],
  [7, 11],
  [8, 10],
  [8, 19],
  [8, 24],
  [10, 15],
  [10, 21],
  [10, 26],
  [11, 25],
  [11, 31],
  [12, 16],
  [12, 18],
  [12, 19],
  [12, 27],
  [13, 23],
  [13, 26],
  [14, 22],
  [14, 27],
  [15, 21],
  [15, 24],
  [15, 26],
  [15, 28],
  [16, 18],
  [16, 19],
  [16, 24],
  [16, 27],
  [16, 35],
  [17, 20],
  [17, 22],
  [17, 29],
  [17, 38],
  [18, 19],
  [18, 27],
  [18, 35],
  [19, 24],
  [19, 35],
  [20, 22],
  [20, 29],
  [21, 26],
  [21, 28],
  [22, 29],
  [22, 32],
  [22, 34],
  [23, 26],
  [23, 30],
  [23, 41],
  [24, 28],
  [24, 36],
  [25, 30],
  [25, 31],
  [25, 33],
  [26, 45],
  [27, 35],
  [27, 52],
  [28, 42],
  [28, 44],
  [29, 32],
  [29, 34],
  [29, 39],
  [30, 31],
  [30, 37],
  [30, 41],
  [31, 37],
  [32, 34],
  [32, 39],
  [33, 40],
  [33, 43],
  [33, 47],
  [34, 38],
  [34, 39],
  [35, 36],
  [35, 46],
  [35, 49],
  [35, 53],
  [36, 44],
  [36, 49],
  [37, 41],
  [38, 48],
  [38, 56],
  [40, 43],
  [40, 50],
  [40, 51],
  [40, 55],
  [41, 50],
  [41, 54],
  [42, 44],
  [42, 45],
  [42, 58],
  [42, 59],
  [43, 47],
  [43, 50],
  [44, 45],
  [44, 49],
  [44, 58],
  [45, 54],
  [45, 58],
  [45, 59],
  [46, 49],
  [46, 52],
  [46, 53],
  [47, 50],
  [48, 63],
  [48, 67],
  [49, 53],
  [50, 51],
  [50, 55],
  [51, 55],
  [52, 53],
  [52, 61],
  [54, 59],
  [56, 57],
  [56, 60],
  [56, 62],
  [57, 60],
  [57, 62],
  [58, 70],
  [60, 62],
  [60, 63],
  [60, 66],
  [61, 64],
  [61, 68],
  [62, 63],
  [63, 67],
  [63, 74],
  [64, 68],
  [64, 79],
  [65, 71],
  [65, 78],
  [65, 80],
  [65, 81],
  [65, 85],
  [66, 69],
  [66, 73],
  [66, 88],
  [67, 74],
  [67, 83],
  [68, 72],
  [68, 79],
  [69, 73],
  [69, 75],
  [70, 72],
  [70, 77],
  [70, 87],
  [71, 76],
  [71, 77],
  [71, 84],
  [71, 89],
  [72, 79],
  [72, 82],
  [73, 74],
  [73, 75],
  [74, 75],
  [74, 83],
  [74, 86],
  [75, 83],
  [75, 86],
  [76, 84],
  [76, 89],
  [77, 87],
  [78, 80],
  [78, 81],
  [78, 84],
  [78, 85],
  [78, 89],
  [79, 82],
  [79, 88],
  [80, 85],
  [81, 84],
  [81, 89],
  [82, 88],
  [83, 86],
  [84, 89],
  [90, 91],
  [90, 94],
  [90, 97],
  [90, 4],
  [91, 92],
  [91, 93],
  [91, 95],
  [92, 96],
  [92, 93],
  [93, 9],
  [93, 96],
  [94, 95],
  [94, 97],
  [95, 9],
  [96, 9],
  [97, 4],
  [97, 6],
];

export function DesignCanvas({
  className,
  style,
  animate = false,
  ariaLabel = "Abstract connected particle network",
}: DesignCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    let frame = 0;
    let width = WIDTH;
    let height = HEIGHT;
    let dpr = 1;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time = 0) => {
      const scaleX = width / WIDTH;
      const scaleY = height / HEIGHT;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = (width - WIDTH * scale) / 2;
      const offsetY = (height - HEIGHT * scale) / 2;

      // Premium light background radial gradient
      const bgGlow = context.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        Math.max(width, height),
      );
      bgGlow.addColorStop(0, "#ffffff");
      bgGlow.addColorStop(1, "#f0f4f9"); // Light blue-grey tint matching screenshot
      context.fillStyle = bgGlow;
      context.fillRect(0, 0, width, height);

      context.save();
      context.translate(offsetX, offsetY);
      context.scale(scale, scale);

      // Determine mouse coordinates in canvas local space
      let cx = 0;
      let cy = 0;
      const mouseActive = mouseRef.current.active;
      if (mouseActive) {
        cx = (mouseRef.current.x - offsetX) / scale;
        cy = (mouseRef.current.y - offsetY) / scale;
      }

      // Compute dynamic node positions with smooth mouse attraction
      const dynamicPoints: Array<{
        x: number;
        y: number;
        r: number;
        alpha: number;
        isBlue: boolean;
      }> = [];
      const pulse = animate ? Math.sin(time * 0.0015) * 0.12 : 0;

      for (let index = 0; index < POINTS.length; index += 1) {
        const ptData = POINTS[index];
        if (!ptData) continue;
        const [x, y, radius, brightness] = ptData;
        const localPulse = animate ? Math.sin(time * 0.0018 + index * 0.53) * 0.18 : 0;

        // Add slow, smooth constellation drift animation over time
        let driftX = 0;
        let driftY = 0;
        if (animate) {
          const driftSpeed = 0.00035;
          const driftRange = 16;
          // Use trigonometry seeded by index to ensure each particle moves in its own unique path
          driftX = Math.sin(time * driftSpeed + index * 12.3) * driftRange;
          driftY = Math.cos(time * driftSpeed * 0.85 + index * 7.7) * driftRange;
        }

        let dx = x + driftX;
        let dy = y + driftY;
        let hoverBonus = 0;

        if (mouseActive) {
          const distToMouse = Math.hypot(cx - dx, cy - dy);
          const maxAttractDist = 180;
          if (distToMouse < maxAttractDist) {
            // Smooth elastic attraction force towards mouse
            const force = (1 - distToMouse / maxAttractDist) * 14;
            const angle = Math.atan2(cy - dy, cx - dx);
            dx += Math.cos(angle) * force;
            dy += Math.sin(angle) * force;
            hoverBonus = (1 - distToMouse / maxAttractDist) * 1.5;
          }
        }

        const r = Math.max(1, radius + pulse + localPulse + hoverBonus);
        const alpha = Math.max(0.3, Math.min(1, brightness + 0.15));

        // Match the screenshot: highlight specific prominent nodes with blue, rest with light blue/gray
        const isBlue = index % 5 === 0 || radius > 1.8;

        dynamicPoints.push({ x: dx, y: dy, r, alpha, isBlue });
      }

      // Draw standard edges
      context.lineCap = "round";
      for (let index = 0; index < EDGES.length; index += 1) {
        const edge = EDGES[index];
        if (!edge) continue;
        const [fromIndex, toIndex] = edge;
        const from = dynamicPoints[fromIndex];
        const to = dynamicPoints[toIndex];
        if (!from || !to) continue;
        const distance = Math.hypot(to.x - from.x, to.y - from.y);

        // Lines get softer/transparent as distance grows
        const alpha = Math.max(0.04, Math.min(0.18, 0.22 - distance / 1100));

        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);

        // Render soft blue-gray connections
        context.strokeStyle = `rgba(59, 130, 246, ${alpha * 0.55})`;
        context.lineWidth = 0.8;
        context.stroke();
      }

      // Draw connection lines to mouse cursor
      if (mouseActive) {
        const maxConnectDist = 160;
        for (let index = 0; index < dynamicPoints.length; index += 1) {
          const pt = dynamicPoints[index];
          if (!pt) continue;
          const distToMouse = Math.hypot(cx - pt.x, cy - pt.y);
          if (distToMouse < maxConnectDist) {
            const connectionAlpha = (1 - distToMouse / maxConnectDist) * 0.18;
            context.beginPath();
            context.moveTo(cx, cy);
            context.lineTo(pt.x, pt.y);
            context.strokeStyle = `rgba(37, 99, 235, ${connectionAlpha})`;
            context.lineWidth = 0.7;
            context.stroke();
          }
        }
      }

      // Draw points with glowing radial circles
      for (let index = 0; index < dynamicPoints.length; index += 1) {
        const pt = dynamicPoints[index];
        if (!pt) continue;

        // Glowing background circle
        const glow = context.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.r * 4);
        if (pt.isBlue) {
          glow.addColorStop(0, `rgba(37, 99, 235, ${pt.alpha * 0.45})`);
          glow.addColorStop(0.35, `rgba(59, 130, 246, ${pt.alpha * 0.2})`);
          glow.addColorStop(1, "rgba(59, 130, 246, 0)");
        } else {
          glow.addColorStop(0, `rgba(148, 163, 184, ${pt.alpha * 0.35})`);
          glow.addColorStop(0.35, `rgba(148, 163, 184, ${pt.alpha * 0.15})`);
          glow.addColorStop(1, "rgba(148, 163, 184, 0)");
        }

        context.fillStyle = glow;
        context.beginPath();
        context.arc(pt.x, pt.y, pt.r * 4, 0, Math.PI * 2);
        context.fill();

        // Core solid dot
        if (pt.isBlue) {
          context.fillStyle = `rgba(37, 99, 235, ${pt.alpha})`;
        } else {
          context.fillStyle = `rgba(148, 163, 184, ${pt.alpha})`;
        }
        context.beginPath();
        context.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        context.fill();
      }

      context.restore();
      if (animate) frame = requestAnimationFrame(draw);
    };

    const ResizeObserverClass =
      typeof window !== "undefined" && "ResizeObserver" in window
        ? window.ResizeObserver
        : (class {
            observe() {}
            unobserve() {}
            disconnect() {}
          } as unknown as typeof ResizeObserver);

    resize();
    draw();
    const resizeObserver = new ResizeObserverClass(() => {
      resize();
      if (!animate) draw();
    });
    resizeObserver.observe(canvas);

    if (animate) frame = requestAnimationFrame(draw);

    // Track mouse events internally
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      resizeObserver?.disconnect();
      cancelAnimationFrame(frame);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={ariaLabel}
      style={{
        display: "block",
        width: "100%",
        aspectRatio: `${WIDTH} / ${HEIGHT}`,
        background: "#ffffff",
        ...style,
      }}
    />
  );
}
