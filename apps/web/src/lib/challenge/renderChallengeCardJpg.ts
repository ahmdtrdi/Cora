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
  fill: string,
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

  ctx.fillStyle = "#f5f1e8";
  ctx.fillRect(0, 0, width, height);
  drawRoundedRect(ctx, { x: 30, y: 30 }, { width: 1540, height: 840 }, 16, "#fffdfa", "#d8d2c5");

  ctx.fillStyle = "#274137";
  ctx.font = `700 30px ${fonts.body}`;
  ctx.fillText(input.title.toUpperCase(), 78, 96);

  drawRoundedRect(ctx, { x: 70, y: 140 }, { width: 740, height: 620 }, 14, "#ffffff", "#d6d0c4");
  drawRoundedRect(ctx, { x: 835, y: 140 }, { width: 695, height: 620 }, 14, "#ffffff", "#d6d0c4");

  ctx.beginPath();
  ctx.arc(170, 258, 92, 0, Math.PI * 2);
  ctx.fillStyle = "#f1ede2";
  ctx.fill();
  ctx.strokeStyle = "#d1cabd";
  ctx.stroke();
  ctx.fillStyle = "#274137";
  ctx.font = `700 96px ${fonts.display}`;
  ctx.fillText(input.challengerName.slice(0, 1).toUpperCase(), 140, 286);

  ctx.fillStyle = "#1f2b24";
  ctx.font = `700 62px ${fonts.display}`;
  ctx.fillText(input.challengerName, 78, 420);

  ctx.fillStyle = "#4f6759";
  ctx.font = `500 32px ${fonts.body}`;
  ctx.fillText(input.challengerAddress, 78, 468);

  drawRoundedRect(ctx, { x: 78, y: 500 }, { width: 300, height: 62 }, 31, "#f6f3ea", "#d6d0c4");
  ctx.fillStyle = "#274137";
  ctx.font = `700 26px ${fonts.body}`;
  ctx.fillText(input.statusLabel.toUpperCase(), 104, 541);

  ctx.fillStyle = "#587062";
  ctx.font = `500 36px ${fonts.body}`;
  wrapText(ctx, input.description, 78, 610, 660, 44, 3);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=0&data=${encodeURIComponent(input.challengeLink)}`;
  drawRoundedRect(ctx, { x: 900, y: 185 }, { width: 565, height: 380 }, 12, "#f5f1e8", "#d4cec1");
  try {
    const qrImage = await loadImage(qrUrl);
    ctx.drawImage(qrImage, 1052, 245, 260, 260);
  } catch {
    ctx.fillStyle = "#6d8373";
    ctx.font = `600 28px ${fonts.body}`;
    ctx.fillText("QR unavailable", 1080, 374);
  }

  const metrics = [
    { label: "TOKEN", value: input.token },
    { label: "WAGER", value: `$${input.wagerUsd}` },
    { label: "ARENA", value: input.arenaLabel },
  ];
  metrics.forEach((metric, index) => {
    const boxX = 900 + index * 187;
    drawRoundedRect(ctx, { x: boxX, y: 590 }, { width: 175, height: 112 }, 8, "#fffdfa", "#d6d0c4");
    ctx.fillStyle = "#6d8373";
    ctx.font = `600 22px ${fonts.body}`;
    ctx.fillText(metric.label, boxX + 16, 626);
    ctx.fillStyle = "#274137";
    ctx.font = `700 34px ${fonts.body}`;
    ctx.fillText(metric.value, boxX + 16, 672);
  });

  ctx.fillStyle = "#52695b";
  ctx.font = `500 22px ${fonts.body}`;
  wrapText(ctx, input.challengeLink, 78, 820, 1440, 28, 2);

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
