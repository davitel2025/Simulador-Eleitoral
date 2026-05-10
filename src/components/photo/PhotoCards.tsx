import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Candidate, RankedItem } from "../../types";
import { formatPct } from "../../lib/utils";
import { UserIcon } from "../UserIcon";

export type PhotoCardShape = "circle" | "portrait";
export type PhotoExportFormat = "16:9" | "9:16";
type PhotoTypographyProps = {
  fontSizeBase?: number;
  fontColor?: string;
  useCandidateFontColor?: boolean;
};

function TitularBadge({ candidate }: { candidate: Candidate }) {
  const titular = candidate.titular?.trim();
  if (!titular) return null;
  return (
    <div className="absolute left-1 top-1 z-20 flex max-w-[88%] items-center gap-1.5 rounded bg-black/50 px-1.5 py-1 text-left shadow-lg backdrop-blur-sm">
      {candidate.titularPhoto && (
        <SafeImage
          src={candidate.titularPhoto}
          alt={titular}
          className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
        />
      )}
      <span className="truncate text-[10px] font-bold leading-tight text-slate-100">
        Titular: {titular}
      </span>
    </div>
  );
}

// ─── Configuração do retângulo ao redor dos top candidatos ───────────────────
export interface WinnerBoxConfig {
  show: boolean;
  backgroundMode: "same" | "custom" | "transparent";
  backgroundColor: string;
  borderRadius: number; // px
  padding: number;      // px
  borderWidth: number;  // px
}

export const DEFAULT_WINNER_BOX: WinnerBoxConfig = {
  show: true,
  backgroundMode: "same",
  backgroundColor: "#0f172a",
  borderRadius: 24,
  padding: 24,
  borderWidth: 4,
};

function getCandidateInitials(candidate: Candidate): string {
  return (
    candidate.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || candidate.number
  );
}

function CandidateImage({
  candidate,
  className,
  fallbackClassName = "text-3xl",
}: {
  candidate: Candidate;
  className: string;
  fallbackClassName?: string;
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const resolvedSrc = useResolvedImageSrc(candidate.photo);
  if (!candidate.photo || hasImageError) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center font-black ${fallbackClassName}`}
        style={{ color: candidate.color }}
      >
        {getCandidateInitials(candidate)}
      </div>
    );
  }
  return (
    <img
      src={resolvedSrc ?? candidate.photo}
      alt={candidate.name}
      className={className}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      onError={() => setHasImageError(true)}
    />
  );
}

function useResolvedImageSrc(src?: string): string | undefined {
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    let active = true;
    setResolvedSrc(src);
    if (!src?.includes("commons.wikimedia.org/wiki/Special:")) return;
    resolveCaptureImageUrl(src)
      .then((nextSrc) => {
        if (active) setResolvedSrc(nextSrc);
      })
      .catch(() => {
        if (active) setResolvedSrc(src);
      });
    return () => {
      active = false;
    };
  }, [src]);

  return resolvedSrc;
}

export function SafeImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const [hasError, setHasError] = useState(false);
  const resolvedSrc = useResolvedImageSrc(src);
  if (hasError) return null;
  return (
    <img
      src={resolvedSrc ?? src}
      alt={alt}
      className={className}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
}

export function getPhotoBackgroundStyle(
  bgValue: string,
  bgImage?: string
): CSSProperties {
  if (bgImage) {
    return {
      backgroundImage: `url(${bgImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }

  return bgValue.startsWith("linear-gradient")
    ? { background: bgValue }
    : { backgroundColor: bgValue };
}

export function getCaptureFallbackColor(bgValue: string, bgImage?: string): string {
  return bgImage || bgValue.startsWith("linear-gradient") ? "#0f172a" : bgValue;
}

export function getFrameSurfaceColor(bgValue: string, bgImage?: string): string {
  return bgImage || bgValue.startsWith("linear-gradient") ? "transparent" : bgValue;
}

async function preloadImagesAsBase64(root: HTMLElement): Promise<() => void> {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  const restoreFns: Array<() => void> = [];

  await Promise.allSettled(
    imgs.map(async (img) => {
      const src = img.src;
      if (!src || src.startsWith("data:")) return;

      try {
        const base64 = await fetchImageAsBase64(src);
        restoreFns.push(() => {
          img.src = src;
        });
        img.src = base64;
      } catch {
        // Mantem a imagem original se a conversao falhar.
      }
    })
  );

  return () => restoreFns.forEach((restore) => restore());
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const resolvedUrl = await resolveCaptureImageUrl(url);
  const response = await fetch(resolvedUrl, { mode: "cors" });
  if (response.ok) {
    return await blobToBase64(await response.blob());
  }

  throw new Error(`Nao foi possivel carregar a imagem: ${resolvedUrl}`);
}

async function resolveCaptureImageUrl(url: string): Promise<string> {
  if (!url.includes("commons.wikimedia.org/wiki/Special:")) {
    return url;
  }

  const parsedUrl = new URL(url);
  const fileName = decodeURIComponent(parsedUrl.pathname.split("/").pop() ?? "");
  if (!fileName) {
    return url;
  }

  const width = parsedUrl.searchParams.get("width") ?? "500";
  const apiUrl = new URL("https://commons.wikimedia.org/w/api.php");
  apiUrl.searchParams.set("action", "query");
  apiUrl.searchParams.set("format", "json");
  apiUrl.searchParams.set("origin", "*");
  apiUrl.searchParams.set("prop", "imageinfo");
  apiUrl.searchParams.set("iiprop", "url");
  apiUrl.searchParams.set("iiurlwidth", width);
  apiUrl.searchParams.set("titles", `File:${fileName}`);

  const response = await fetch(apiUrl.toString(), { mode: "cors" });
  if (!response.ok) {
    return url;
  }

  const data = await response.json();
  const pages = data?.query?.pages;
  const page = pages ? Object.values(pages)[0] as any : null;
  const imageInfo = page?.imageinfo?.[0];
  return imageInfo?.thumburl ?? imageInfo?.url ?? url;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function downloadCanvasAsPng(
  element: HTMLElement,
  filename: string,
  backgroundColor: string
): Promise<boolean> {
  try {
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(element, {
      backgroundColor,
      scale: Math.max(2, window.devicePixelRatio || 1),
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 15000,
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll("*").forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.colorScheme = "";
          const computedStyle = window.getComputedStyle(htmlEl);
          const color = computedStyle.color;
          const bg = computedStyle.backgroundColor;
          if (color.includes("oklab") || color.includes("oklch")) {
            htmlEl.style.color = "#ffffff";
          }
          if (bg.includes("oklab") || bg.includes("oklch")) {
            htmlEl.style.backgroundColor = backgroundColor;
          }
        });
      },
    });

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) return false;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (fallbackError) {
    console.error("Fallback html2canvas tambem falhou:", fallbackError);
    return false;
  }
}

export async function captureAndDownload(
  element: HTMLElement,
  filename: string,
  backgroundColor: string
): Promise<void> {
  let restoreImages: (() => void) | null = null;

  try {
    const { toPng } = await import("html-to-image");
    restoreImages = await preloadImagesAsBase64(element);

    const dataUrl = await toPng(element, {
      backgroundColor,
      pixelRatio: Math.max(2, window.devicePixelRatio || 1),
      cacheBust: true,
      includeQueryParams: true,
      skipFonts: false,
      filter: () => true,
    });

    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Erro ao gerar PNG:", error);
    const fallbackSucceeded = await downloadCanvasAsPng(element, filename, backgroundColor);
    if (!fallbackSucceeded) {
      alert(
        "Erro ao salvar imagem. Verifique o console para detalhes.\n\n" +
          "Dica: se o erro persistir, tente remover as fotos externas dos candidatos e usar apenas fotos enviadas por upload."
      );
    }
  } finally {
    restoreImages?.();
  }
}

// ─── TopCandidateCard ────────────────────────────────────────────────────────

export function TopCandidateCard({
  item,
  rank,
  avatarPx,
  portraitPx,
  showVice = true,
  showVotes = false,
  shape = "circle",
  frameConfig,
  frameSurfaceColor = "#0f172a",
  fontSizeBase = 14,
  fontColor = "#ffffff",
  useCandidateFontColor = false,
}: {
  item: RankedItem;
  rank: number;
  avatarPx: number;        // tamanho da BOLINHA
  portraitPx?: number;     // tamanho do RETRATO (altura); se omitido usa avatarPx * proporção padrão
  showVice?: boolean;
  showVotes?: boolean;
  shape?: PhotoCardShape;
  frameConfig?: WinnerBoxConfig;
  frameSurfaceColor?: string;
} & PhotoTypographyProps) {
  const { candidate, pct, votes } = item;
  const rankLabel = `${rank + 1}º colocado`;
  const textColor = fontColor;
  const percentageColor = useCandidateFontColor ? candidate.color : fontColor;
  const ideologyColor = useCandidateFontColor ? candidate.color : fontColor;

  // Retrato: largura = 75% da altura
  const portraitH = portraitPx ?? Math.round(avatarPx * 1.18);
  const portraitW = Math.round(portraitH * 0.75);
  const frameBackground =
    frameConfig?.backgroundMode === "custom"
      ? frameConfig.backgroundColor
      : frameConfig?.backgroundMode === "same"
      ? frameSurfaceColor
      : "transparent";
  const frameStyle: CSSProperties = frameConfig
    ? {
        borderColor: frameConfig.show ? candidate.color : "transparent",
        borderRadius: frameConfig.borderRadius,
        borderWidth: frameConfig.show ? frameConfig.borderWidth : 0,
        backgroundColor: frameBackground,
        padding: frameConfig.padding,
      }
    : { borderColor: `${candidate.color}40` };

  return (
    <div
      className="relative rounded-3xl border bg-slate-900/60 p-6 text-center flex flex-col items-center"
      style={frameStyle}
      aria-label={rankLabel}
    >
      <TitularBadge candidate={candidate} />
      {candidate.partyLogo && (
        <div className="mb-3 h-10 w-auto flex items-center justify-center">
          <SafeImage
            src={candidate.partyLogo}
            alt={candidate.party}
            className="h-10 object-contain"
          />
        </div>
      )}

      {shape === "portrait" ? (
        <div
          className="mb-3 overflow-hidden border-4 bg-slate-900 flex-shrink-0"
          style={{
            width: portraitW,
            height: portraitH,
            borderColor: candidate.color,
            borderRadius: "16px",
          }}
        >
          <CandidateImage candidate={candidate} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div
          className="mb-3 overflow-hidden rounded-full border-4 bg-slate-900 flex-shrink-0"
          style={{ width: avatarPx, height: avatarPx, borderColor: candidate.color }}
        >
          <CandidateImage candidate={candidate} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="font-black mb-1" style={{ color: textColor, fontSize: fontSizeBase * 2 }}>
        {candidate.name}
      </div>
      {showVice && candidate.vice && (
        <div className="mb-1 flex items-center gap-2">
          {candidate.vicePhoto && (
            <div
              className="h-8 w-8 overflow-hidden rounded-full border-2"
              style={{ borderColor: candidate.color }}
            >
              <SafeImage
                src={candidate.vicePhoto}
                alt={candidate.vice}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="font-semibold" style={{ color: textColor, fontSize: fontSizeBase * 0.85 }}>Vice: {candidate.vice}</div>
        </div>
      )}
      {candidate.ideology && (
        <div className="mb-1 rounded-lg px-3 py-1 font-bold bg-slate-800/50" style={{ color: ideologyColor, fontSize: fontSizeBase * 0.8 }}>
          {candidate.ideology}
        </div>
      )}
      <div className="font-black" style={{ color: percentageColor, fontSize: fontSizeBase * 4.2 }}>{formatPct(pct)}</div>
      {!candidate.partyLogo && (
        <div className="mt-1 font-bold" style={{ color: textColor, fontSize: fontSizeBase * 0.85 }}>{candidate.party}</div>
      )}
      {candidate.coalition && (
        <div className="mt-1 rounded-lg px-3 py-1 font-bold bg-slate-800/30 max-w-[200px] leading-relaxed" style={{ color: textColor, fontSize: fontSizeBase * 0.78 }}>
          🤝 {candidate.coalition}
        </div>
      )}
      {showVotes && votes !== undefined && (
        <div className="mt-1" style={{ color: textColor, fontSize: fontSizeBase }}>
          {Math.round(votes).toLocaleString("pt-BR")} votos
        </div>
      )}
    </div>
  );
}

// ─── BottomCandidateCard ─────────────────────────────────────────────────────
// Candidatos menores ficam SEMPRE em bolinha (só top 2 usam o modo retrato)

export function BottomCandidateCard({
  item,
  avatarPx,
  showVotes = false,
  fontSizeBase = 14,
  fontColor = "#ffffff",
  useCandidateFontColor = false,
}: {
  item: RankedItem;
  avatarPx: number;
  showVotes?: boolean;
  /** shape ignorado — bottom cards são sempre circle */
  shape?: PhotoCardShape;
} & PhotoTypographyProps) {
  const { candidate, pct, votes } = item;
  const textColor = fontColor;
  const percentageColor = useCandidateFontColor ? candidate.color : fontColor;
  const ideologyColor = useCandidateFontColor ? candidate.color : fontColor;

  return (
    <div
      className="relative rounded-2xl border bg-slate-900/40 p-4 text-center flex flex-col items-center"
      style={{ borderColor: `${candidate.color}30` }}
    >
      <TitularBadge candidate={candidate} />
      {candidate.partyLogo && (
        <div className="mb-2 h-7 flex items-center justify-center">
          <SafeImage
            src={candidate.partyLogo}
            alt={candidate.party}
            className="h-7 object-contain"
          />
        </div>
      )}

      {/* Sempre bolinha para candidatos menores */}
      <div
        className="mb-2 overflow-hidden rounded-full border-2 bg-slate-900"
        style={{ width: avatarPx, height: avatarPx, borderColor: candidate.color }}
      >
        <CandidateImage
          candidate={candidate}
          className="h-full w-full object-cover"
          fallbackClassName="text-sm"
        />
      </div>

      <div className="font-black mb-0.5" style={{ color: textColor, fontSize: fontSizeBase * 1.3 }}>
        {candidate.name}
      </div>
      {candidate.vice && (
        <div className="mb-0.5 font-semibold" style={{ color: textColor, fontSize: fontSizeBase * 0.72 }}>
          Vice: {candidate.vice}
        </div>
      )}
      {candidate.ideology && (
        <div className="mb-1" style={{ color: ideologyColor, fontSize: fontSizeBase * 0.75 }}>{candidate.ideology}</div>
      )}
      <div className="font-black" style={{ color: percentageColor, fontSize: fontSizeBase * 1.8 }}>{formatPct(pct)}</div>
      {!candidate.partyLogo && (
        <div className="mt-0.5" style={{ color: textColor, fontSize: fontSizeBase * 0.8 }}>{candidate.party}</div>
      )}
      {candidate.coalition && (
        <div className="mt-1 max-w-[160px] leading-snug" style={{ color: textColor, fontSize: fontSizeBase * 0.72 }}>
          🤝 {candidate.coalition}
        </div>
      )}
      {showVotes && votes !== undefined && (
        <div style={{ color: textColor, fontSize: fontSizeBase * 0.75 }}>{Math.round(votes).toLocaleString("pt-BR")}</div>
      )}
    </div>
  );
}

// ─── OthersCard ──────────────────────────────────────────────────────────────

export function OthersCard({
  othersPct,
  othersVotes,
  avatarPx,
  showVotes = false,
  fontSizeBase = 14,
  fontColor = "#ffffff",
}: {
  othersPct: number;
  othersVotes?: number;
  avatarPx: number;
  showVotes?: boolean;
} & PhotoTypographyProps) {
  return (
    <div className="rounded-2xl border border-slate-600/40 bg-slate-900/40 p-4 text-center flex flex-col items-center">
      <div
        className="mb-2 overflow-hidden rounded-full border-2 border-slate-500 bg-slate-800 flex items-center justify-center"
        style={{ width: avatarPx, height: avatarPx }}
      >
        <UserIcon className="h-3/5 w-3/5 text-slate-400" />
      </div>
      <div className="font-black mb-0.5" style={{ color: fontColor, fontSize: fontSizeBase * 1.3 }}>Outros</div>
      <div className="mb-1" style={{ color: fontColor, fontSize: fontSizeBase * 0.75 }}>Demais candidatos</div>
      <div className="font-black" style={{ color: fontColor, fontSize: fontSizeBase * 1.8 }}>{formatPct(othersPct)}</div>
      {showVotes && othersVotes !== undefined && (
        <div style={{ color: fontColor, fontSize: fontSizeBase * 0.75 }}>{Math.round(othersVotes).toLocaleString("pt-BR")}</div>
      )}
    </div>
  );
}

// ─── MapSizeSlider ───────────────────────────────────────────────────────────

export function MapSizeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 backdrop-blur-sm">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
        Mapa
      </span>
      <input
        type="range"
        min={280}
        max={1200}
        step={20}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-28 appearance-none rounded-full bg-slate-700 accent-violet-500"
      />
      <span className="text-xs font-bold text-slate-400 w-12 text-right">{value}px</span>
    </div>
  );
}

function VerticalCandidatePanel({
  item,
  fontColor = "#ffffff",
  useCandidateFontColor = false,
}: {
  item: RankedItem;
} & PhotoTypographyProps) {
  const { candidate } = item;
  const textColor = fontColor;
  const percentageColor = useCandidateFontColor ? candidate.color : fontColor;
  const ideologyColor = useCandidateFontColor ? candidate.color : fontColor;

  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center">
      <TitularBadge candidate={candidate} />
      <div
        className="mb-5 h-[420px] w-[310px] overflow-hidden rounded-[30px] border-[6px] bg-slate-950 shadow-[0_28px_70px_-34px_rgba(0,0,0,0.9)]"
        style={{ borderColor: candidate.color }}
      >
        {candidate.photo ? (
          <SafeImage
            src={candidate.photo}
            alt={candidate.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-7xl font-black" style={{ color: candidate.color }}>
            {getCandidateInitials(candidate)}
          </div>
        )}
      </div>
      <div className="max-w-[360px] text-center text-[34px] font-black leading-tight" style={{ color: textColor }}>
        {candidate.name}
      </div>
      {candidate.vice && (
        <div className="mt-3 max-w-[340px] text-center text-[18px] font-bold leading-tight" style={{ color: textColor }}>
          Vice: {candidate.vice}
        </div>
      )}
      {candidate.ideology && (
        <div className="mt-2 max-w-[300px] rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-center text-[16px] font-black leading-tight" style={{ color: ideologyColor }}>
          {candidate.ideology}
        </div>
      )}
      <div className="mt-4 text-[72px] font-black leading-none tracking-normal" style={{ color: percentageColor }}>
        {formatPct(item.pct)}
      </div>
      <div className="mt-4 flex max-w-[390px] flex-wrap justify-center gap-2">
        {candidate.partyLogo ? (
          <div className="flex h-10 max-w-[120px] items-center justify-center rounded-lg bg-white px-2 py-1">
            <SafeImage src={candidate.partyLogo} alt={candidate.party} className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <div className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-2 text-center text-[15px] font-bold leading-tight" style={{ color: textColor }}>
            {candidate.party}
          </div>
        )}
        {candidate.coalition && (
          <div className="max-w-[220px] rounded-full border border-white/10 bg-slate-900/80 px-3 py-2 text-center text-[15px] font-bold leading-tight" style={{ color: textColor }}>
            {candidate.coalition}
          </div>
        )}
      </div>
      {item.votes !== undefined && (
        <div className="mt-3 text-[18px] font-bold text-white/65">
          {Math.round(item.votes).toLocaleString("pt-BR")} votos
        </div>
      )}
    </div>
  );
}

export function VerticalPhotoCard({
  title,
  left,
  right,
  map,
  bgStyle,
  totalVotes,
  fontColor = "#ffffff",
  useCandidateFontColor = false,
}: {
  title: string;
  left: RankedItem;
  right: RankedItem;
  map: ReactNode;
  bgStyle: CSSProperties;
  totalVotes?: number;
} & PhotoTypographyProps) {
  return (
    <div
      className="relative overflow-hidden rounded-[54px] border border-white/10 p-14 text-white shadow-[0_60px_120px_-30px_rgba(0,0,0,0.85)]"
      style={{ ...bgStyle, width: 1080, height: 1920 }}
    >
      <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-white/10 to-transparent" />
      {totalVotes !== undefined && (
        <div className="absolute right-10 top-10 z-20 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-right shadow-2xl backdrop-blur-sm">
          <div className="text-[22px] font-black text-white">{Math.round(totalVotes).toLocaleString("pt-BR")}</div>
          <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Votos Válidos</div>
        </div>
      )}
      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-12 text-center text-[24px] font-black uppercase tracking-[0.34em] text-slate-400">
          {title}
        </div>

        <div className="flex min-h-[860px] items-start justify-center gap-8">
          <VerticalCandidatePanel item={left} fontColor={fontColor} useCandidateFontColor={useCandidateFontColor} />
          <VerticalCandidatePanel item={right} fontColor={fontColor} useCandidateFontColor={useCandidateFontColor} />
        </div>

        <div className="flex min-h-[620px] flex-1 items-center justify-center">
          <div className="scale-[1.18]">
            {map}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhotoFormatDialog({
  canUseVertical,
  onSelect,
  onClose,
}: {
  canUseVertical: boolean;
  onSelect: (format: PhotoExportFormat) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 text-lg font-black">Escolher formato</div>
        <div className="mb-4 text-sm text-slate-400">Selecione o layout do PNG.</div>
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => onSelect("16:9")}
            className="rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-4 py-4 text-left transition hover:bg-emerald-500/25"
          >
            <div className="text-sm font-black text-emerald-100">16:9 Horizontal</div>
            <div className="mt-1 text-xs font-semibold text-emerald-100/70">Layout atual adaptado para arte widescreen.</div>
          </button>
          <button
            type="button"
            onClick={() => canUseVertical && onSelect("9:16")}
            disabled={!canUseVertical}
            title={canUseVertical ? "Layout vertical para celular" : "Disponivel apenas no 2o turno"}
            className="rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-4 py-4 text-left transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/70 disabled:text-slate-500"
          >
            <div className="text-sm font-black">9:16 Celular</div>
            <div className="mt-1 text-xs font-semibold opacity-70">
              {canUseVertical ? "Layout vertical 1080x1920." : "Disponivel apenas no segundo turno."}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Preset de backgrounds ───────────────────────────────────────────────────

export const PHOTO_BACKGROUNDS = [
  { id: "dark", label: "Escuro (padrão)", value: "#0f172a", isGradient: false },
  { id: "slate", label: "Slate", value: "#1e293b", isGradient: false },
  { id: "black", label: "Preto", value: "#000000", isGradient: false },
  {
    id: "grad-dark",
    label: "Gradiente azul",
    value: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
    isGradient: true,
  },
  {
    id: "grad-purple",
    label: "Gradiente roxo",
    value: "linear-gradient(135deg,#0f172a 0%,#2d1b69 100%)",
    isGradient: true,
  },
  {
    id: "grad-emerald",
    label: "Gradiente verde",
    value: "linear-gradient(135deg,#0f172a 0%,#064e3b 100%)",
    isGradient: true,
  },
  {
    id: "grad-red",
    label: "Gradiente vermelho",
    value: "linear-gradient(135deg,#0f172a 0%,#450a0a 100%)",
    isGradient: true,
  },
];

// ─── PhotoBackgroundPicker ───────────────────────────────────────────────────
// Agora suporta upload de imagem como background

export function PhotoBackgroundPicker({
  value,
  onChange,
  onImageUpload,
  bgImage,
  onRemoveImage,
}: {
  value: string;
  onChange: (v: string) => void;
  onImageUpload?: (dataUrl: string) => void;
  bgImage?: string;
  onRemoveImage?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
        BG
      </span>

      {/* Presets de cor/gradiente */}
      {PHOTO_BACKGROUNDS.map((bg) => (
        <button
          key={bg.id}
          type="button"
          title={bg.label}
          onClick={() => {
            onChange(bg.value);
            if (onRemoveImage) onRemoveImage();
          }}
          className={`h-6 w-6 rounded-lg border-2 transition-all ${
            !bgImage && value === bg.value
              ? "border-white scale-110"
              : "border-transparent opacity-70 hover:opacity-100"
          }`}
          style={bg.isGradient ? { background: bg.value } : { backgroundColor: bg.value }}
        />
      ))}

      {/* Cor personalizada */}
      <div className="relative" title="Cor personalizada">
        <input
          type="color"
          value={value.startsWith("#") ? value : "#0f172a"}
          onChange={(e) => {
            onChange(e.target.value);
            if (onRemoveImage) onRemoveImage();
          }}
          className="h-6 w-6 rounded-lg border-2 border-transparent cursor-pointer opacity-70 hover:opacity-100"
          style={{ padding: "1px" }}
        />
      </div>

      {/* Upload de imagem */}
      {onImageUpload && (
        <div className="flex items-center gap-1">
          <label
            title="Imagem de fundo"
            className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border-2 transition-all text-[10px] font-black ${
              bgImage
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 scale-110"
                : "border-transparent bg-slate-700 text-slate-300 opacity-70 hover:opacity-100"
            }`}
          >
            🖼
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const result = ev.target?.result;
                  if (typeof result === "string") onImageUpload(result);
                };
                reader.readAsDataURL(file);
                e.target.value = "";
              }}
            />
          </label>
          {bgImage && onRemoveImage && (
            <button
              type="button"
              onClick={onRemoveImage}
              title="Remover imagem de fundo"
              className="text-[10px] font-black text-red-400 hover:text-red-300 leading-none"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── WinnerBoxControls ───────────────────────────────────────────────────────
// Controles para o retângulo ao redor dos top 2

export function WinnerBoxControls({
  config,
  onChange,
}: {
  config: WinnerBoxConfig;
  onChange: (c: WinnerBoxConfig) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
        Moldura
      </span>

      <button
        type="button"
        onClick={() => onChange({ ...config, show: !config.show })}
        className={`rounded-lg px-2 py-0.5 text-[10px] font-black transition-all border ${
          config.show
            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
            : "bg-slate-800 border-white/10 text-slate-500"
        }`}
      >
        {config.show ? "ON" : "OFF"}
      </button>

      <div className="flex rounded-lg border border-white/10 bg-slate-950/60 p-0.5">
        <button
          type="button"
          onClick={() => onChange({ ...config, backgroundMode: "same" })}
          className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
            config.backgroundMode === "same" ? "bg-violet-600 text-white" : "text-slate-400"
          }`}
        >
          BG
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...config, backgroundMode: "custom" })}
          className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
            config.backgroundMode === "custom" ? "bg-violet-600 text-white" : "text-slate-400"
          }`}
        >
          Cor
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...config, backgroundMode: "transparent" })}
          className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
            config.backgroundMode === "transparent" ? "bg-violet-600 text-white" : "text-slate-400"
          }`}
        >
          Sem
        </button>
      </div>

      {config.backgroundMode === "custom" && (
        <input
          type="color"
          value={config.backgroundColor}
          onChange={(e) => onChange({ ...config, backgroundColor: e.target.value })}
          className="h-5 w-5 rounded border border-slate-600 cursor-pointer"
          style={{ padding: "1px" }}
          title="Cor interna da moldura"
        />
      )}

      {config.show && (
        <>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500">Raio</span>
            <input
              type="range"
              min={0}
              max={60}
              step={4}
              value={config.borderRadius}
              onChange={(e) => onChange({ ...config, borderRadius: Number(e.target.value) })}
              className="h-1.5 w-14 appearance-none rounded-full bg-slate-700 accent-violet-400"
            />
            <span className="text-[10px] text-slate-500 w-6">{config.borderRadius}</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500">Tam</span>
            <input
              type="range"
              min={0}
              max={72}
              step={4}
              value={config.padding}
              onChange={(e) => onChange({ ...config, padding: Number(e.target.value) })}
              className="h-1.5 w-14 appearance-none rounded-full bg-slate-700 accent-violet-400"
            />
            <span className="text-[10px] text-slate-500 w-6">{config.padding}</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500">Borda</span>
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              value={config.borderWidth}
              onChange={(e) => onChange({ ...config, borderWidth: Number(e.target.value) })}
              className="h-1.5 w-12 appearance-none rounded-full bg-slate-700 accent-violet-400"
            />
            <span className="text-[10px] text-slate-500 w-4">{config.borderWidth}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── AvatarSizeControls ──────────────────────────────────────────────────────
// Slider separado para tamanho de bolinha e retrato

export function AvatarSizeControls({
  circleSize,
  portraitSize,
  onCircleChange,
  onPortraitChange,
  shape,
}: {
  circleSize: number;
  portraitSize: number;
  onCircleChange: (v: number) => void;
  onPortraitChange: (v: number) => void;
  shape: PhotoCardShape;
}) {
  if (shape === "portrait") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 backdrop-blur-sm">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
          Retrato
        </span>
        <input
          type="range"
          min={100}
          max={500}
          step={10}
          value={portraitSize}
          onChange={(e) => onPortraitChange(Number(e.target.value))}
          className="h-2 w-24 appearance-none rounded-full bg-slate-700 accent-violet-500"
        />
        <span className="text-xs font-bold text-slate-400 w-12 text-right">{portraitSize}px</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 backdrop-blur-sm">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
        Bola
      </span>
      <input
        type="range"
        min={60}
        max={300}
        step={10}
        value={circleSize}
        onChange={(e) => onCircleChange(Number(e.target.value))}
        className="h-2 w-24 appearance-none rounded-full bg-slate-700 accent-violet-500"
      />
      <span className="text-xs font-bold text-slate-400 w-12 text-right">{circleSize}px</span>
    </div>
  );
}
