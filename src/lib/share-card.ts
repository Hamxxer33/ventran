export type ShareCardData = {
  handle: string;
  realized: number;
  unrealized: number;
  total: number;
};

function money(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (n > 0) return `+${abs}`;
  if (n < 0) return `-${abs}`;
  return abs;
}

export function paintShareCard(canvas: HTMLCanvasElement, data: ShareCardData) {
  const w = 900;
  const h = 1125;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#F4F3EE";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#FFFCF7";
  roundRect(ctx, 48, 48, w - 96, h - 96, 28);
  ctx.fill();

  ctx.fillStyle = "#111110";
  ctx.beginPath();
  ctx.roundRect(88, 88, 56, 56, 12);
  ctx.fill();
  ctx.fillStyle = "#F4F3EE";
  ctx.beginPath();
  ctx.moveTo(102, 102);
  ctx.lineTo(116, 102);
  ctx.lineTo(116, 130);
  ctx.lineTo(102, 102);
  ctx.moveTo(130, 102);
  ctx.lineTo(116, 130);
  ctx.lineTo(116, 102);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#111110";
  ctx.font = "600 28px 'DM Sans', ui-sans-serif, sans-serif";
  ctx.fillText("Ventran", 160, 126);

  ctx.fillStyle = "#6B6A64";
  ctx.font = "500 22px 'DM Sans', ui-sans-serif, sans-serif";
  ctx.fillText(`@${data.handle}`, 88, 220);

  const up = data.total >= 0;
  ctx.fillStyle = up ? "#1A7A4C" : "#C23B2E";
  ctx.font = "500 72px 'IBM Plex Mono', ui-monospace, monospace";
  ctx.fillText(money(data.total), 88, 330);

  ctx.fillStyle = "#8A8982";
  ctx.font = "500 20px 'DM Sans', ui-sans-serif, sans-serif";
  ctx.fillText("Total P&L  ·  paper USDC", 88, 372);

  ctx.fillStyle = "#DDD9CF";
  ctx.fillRect(88, 430, w - 176, 1);

  drawCol(ctx, 88, 480, "Realized", data.realized);
  drawCol(ctx, 460, 480, "Unrealized", data.unrealized);

  ctx.fillStyle = "#8A8982";
  ctx.font = "500 20px 'DM Sans', ui-sans-serif, sans-serif";
  ctx.fillText("Trade what’s next", 88, h - 108);
}

function drawCol(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: number,
) {
  ctx.fillStyle = "#6B6A64";
  ctx.font = "500 18px 'DM Sans', ui-sans-serif, sans-serif";
  ctx.fillText(label, x, y);
  ctx.fillStyle = value >= 0 ? "#1A7A4C" : "#C23B2E";
  ctx.font = "500 36px 'IBM Plex Mono', ui-monospace, monospace";
  ctx.fillText(money(value), x, y + 48);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function shareCardBlob(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  paintShareCard(canvas, data);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not paint card."))), "image/png");
  });
}

export async function sharePnlCard(data: ShareCardData): Promise<"shared" | "saved"> {
  const blob = await shareCardBlob(data);
  const file = new File([blob], `ventran-pnl-${data.handle}.png`, { type: "image/png" });
  const payload = { files: [file], title: "Ventran P&L", text: `${data.handle} on Ventran` };
  if (typeof navigator.share === "function" && navigator.canShare?.(payload)) {
    await navigator.share(payload);
    return "shared";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return "saved";
}
