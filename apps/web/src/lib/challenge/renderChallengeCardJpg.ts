export type ChallengeCardRenderInput = {
  title: string;
  challengerName: string;
  challengerAddress: string;
  statusLabel: string;
  description: string;
  token: string;
  wagerUsd: string;
  arenaLabel: string;
  challengeLink: string;
};

type Point = { x: number; y: number };
type Size = { width: number; height: number };
type RenderFontStacks = {
  display: string;
  body: string;
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  point: Point,
  size: Size,
  radius: number,
  fill: string | CanvasGradient,
  stroke?: string,
) {
  const { x, y } = point;
  const { width, height } = size;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines - 1) break;
      continue;
    }
    line = testLine;
  }

  if (line) lines.push(line);
  const trimmed = lines.slice(0, maxLines);

  trimmed.forEach((content, index) => {
    let output = content;
    if (index === maxLines - 1 && words.join(" ").length > trimmed.join(" ").length) {
      output = `${content.replace(/[.,;:!?-]*$/, "")}...`;
    }
    ctx.fillText(output, x, y + index * lineHeight);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function safeFilePart(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function shortenAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function normalizeFamilyName(raw: string, fallback: string) {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/^['"]+|['"]+$/g, "");
}

async function resolveRenderFonts(): Promise<RenderFontStacks> {
  const fallbackDisplay = "Caprasimo";
  const fallbackBody = "Gabarito";

  if (typeof document === "undefined") {
    return {
      display: `"${fallbackDisplay}", serif`,
      body: `"${fallbackBody}", sans-serif`,
    };
  }

  const rootStyles = getComputedStyle(document.documentElement);
  const displayFamily = normalizeFamilyName(rootStyles.getPropertyValue("--font-caprasimo"), fallbackDisplay);
  const bodyFamily = normalizeFamilyName(rootStyles.getPropertyValue("--font-gabarito"), fallbackBody);

  const displayStack = `"${displayFamily}", "${fallbackDisplay}", serif`;
  const bodyStack = `"${bodyFamily}", "${fallbackBody}", sans-serif`;

  if (document.fonts) {
    await document.fonts.ready;
    await Promise.allSettled([
      document.fonts.load(`700 96px ${displayStack}`),
      document.fonts.load(`700 62px ${displayStack}`),
      document.fonts.load(`700 30px ${bodyStack}`),
      document.fonts.load(`700 34px ${bodyStack}`),
      document.fonts.load(`500 36px ${bodyStack}`),
      document.fonts.load(`500 22px ${bodyStack}`),
    ]);
  }

  return {
    display: displayStack,
    body: bodyStack,
  };
}

export async function renderChallengeCardJpg(input: ChallengeCardRenderInput): Promise<Blob> {
  const fonts = await resolveRenderFonts();
  const width = 1600;
  const height = 900;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable.");
  }

  const backgroundGradient = ctx.createLinearGradient(0, 0, width, height);
  backgroundGradient.addColorStop(0, "#f7f0e3");
  backgroundGradient.addColorStop(0.58, "#f2e9d8");
  backgroundGradient.addColorStop(1, "#e8decb");
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, { x: 34, y: 34 }, { width: 1532, height: 832 }, 20, "rgba(255,252,246,0.72)", "#2f2f2f");
  drawRoundedRect(ctx, { x: 56, y: 56 }, { width: 1488, height: 788 }, 18, "rgba(255,248,238,0.82)", "#545454");

  const leftZoneGradient = ctx.createLinearGradient(84, 96, 934, 766);
  leftZoneGradient.addColorStop(0, "#fffaf0");
  leftZoneGradient.addColorStop(1, "#f2e7d3");
  drawRoundedRect(ctx, { x: 84, y: 96 }, { width: 850, height: 670 }, 16, leftZoneGradient, "#6a6a6a");

  const rightZoneGradient = ctx.createLinearGradient(960, 96, 1518, 766);
  rightZoneGradient.addColorStop(0, "#f8f1e5");
  rightZoneGradient.addColorStop(1, "#ede2cf");
  drawRoundedRect(ctx, { x: 960, y: 96 }, { width: 558, height: 670 }, 16, rightZoneGradient, "#6a6a6a");

  ctx.fillStyle = "rgba(38,33,29,0.72)";
  ctx.font = `700 24px ${fonts.body}`;
  ctx.fillText("CORA CHALLENGE", 122, 144);

  ctx.fillStyle = "#1f1b18";
  ctx.font = `700 76px ${fonts.display}`;
  wrapText(ctx, input.title, 122, 222, 770, 84, 2);

  drawRoundedRect(ctx, { x: 122, y: 288 }, { width: 200, height: 200 }, 20, "#dcd3c1", "#57514b");
  const portraitGradient = ctx.createLinearGradient(122, 288, 322, 488);
  portraitGradient.addColorStop(0, "#e8dfce");
  portraitGradient.addColorStop(0.62, "#d8cebc");
  portraitGradient.addColorStop(1, "#c7bead");
  drawRoundedRect(ctx, { x: 130, y: 296 }, { width: 184, height: 184 }, 16, portraitGradient, "#6d655d");
  ctx.fillStyle = "#24201c";
  ctx.font = `700 100px ${fonts.display}`;
  ctx.fillText(input.challengerName.slice(0, 1).toUpperCase(), 188, 415);

  ctx.fillStyle = "#1f1b18";
  ctx.font = `700 58px ${fonts.display}`;
  ctx.fillText(input.challengerName, 354, 362);
  ctx.fillStyle = "rgba(50,43,38,0.82)";
  ctx.font = `500 30px ${fonts.body}`;
  ctx.fillText(shortenAddress(input.challengerAddress), 354, 408);

  drawRoundedRect(ctx, { x: 354, y: 432 }, { width: 286, height: 58 }, 29, "rgba(255,255,255,0.7)", "#6c645c");
  ctx.fillStyle = "#22201d";
  ctx.font = `700 24px ${fonts.body}`;
  ctx.fillText(input.statusLabel.toUpperCase(), 380, 470);

  ctx.fillStyle = "rgba(52,46,41,0.86)";
  ctx.font = `500 34px ${fonts.body}`;
  wrapText(ctx, input.description, 122, 560, 770, 42, 4);

  drawRoundedRect(ctx, { x: 996, y: 136 }, { width: 486, height: 334 }, 14, "rgba(255,255,255,0.74)", "#6a6a6a");
  drawRoundedRect(ctx, { x: 1097, y: 180 }, { width: 284, height: 246 }, 10, "#f3ebdc", "#8d8376");
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=246x246&margin=0&data=${encodeURIComponent(input.challengeLink)}`;
  try {
    const qrImage = await loadImage(qrUrl);
    ctx.drawImage(qrImage, 1116, 199, 246, 246);
  } catch {
    ctx.fillStyle = "rgba(44,39,36,0.62)";
    ctx.font = `600 26px ${fonts.body}`;
    ctx.fillText("QR unavailable", 1140, 326);
  }

  const metrics = [
    { label: "TOKEN", value: input.token },
    { label: "WAGER", value: `$${input.wagerUsd}` },
    { label: "ARENA", value: input.arenaLabel },
  ];
  metrics.forEach((metric, index) => {
    const boxY = 500 + index * 86;
    drawRoundedRect(ctx, { x: 996, y: boxY }, { width: 486, height: 72 }, 10, "rgba(255,255,255,0.72)", "#7a7065");
    ctx.fillStyle = "rgba(48,42,37,0.7)";
    ctx.font = `700 22px ${fonts.body}`;
    ctx.fillText(metric.label, 1020, boxY + 30);
    ctx.fillStyle = "#1f1b18";
    ctx.font = `700 30px ${fonts.body}`;
    ctx.fillText(metric.value, 1162, boxY + 45);
  });

  drawRoundedRect(ctx, { x: 84, y: 790 }, { width: 1434, height: 40 }, 10, "rgba(255,255,255,0.68)", "#7d7368");
  ctx.fillStyle = "rgba(45,39,35,0.74)";
  ctx.font = `500 20px ${fonts.body}`;
  wrapText(ctx, input.challengeLink, 100, 818, 1400, 24, 1);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to render JPG."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.92,
    );
  });
}

export function createChallengeCardFileName(input: ChallengeCardRenderInput) {
  const arena = safeFilePart(input.arenaLabel || "arena");
  const challenger = safeFilePart(input.challengerName || "player");
  return `cora-challenge-${arena}-${challenger}.jpg`;
}
