import { geoMercator, geoPath } from "d3-geo";
import { STATE_BY_UF } from "../data/states";
import type {
  MunicipalityPath,
  PathData,
  RegionName,
  RegionalMunicipalityPath,
} from "../types";
import { UF_NAME_MAP, VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "./constants";
import { normalizeName } from "./utils";

export function resolveUf(properties: Record<string, unknown>): string {
  const directKeys = ["sigla", "UF_05", "abbrev", "SIGLA", "uf"];
  for (const key of directKeys) {
    const value = properties[key];
    if (typeof value === "string" && value.length === 2) {
      return value.toUpperCase();
    }
  }
  const candidateNames = [properties.name, properties.nome, properties.NAME].filter(
    (item): item is string => typeof item === "string",
  );
  for (const name of candidateNames) {
    const normalized = normalizeName(name);
    if (UF_NAME_MAP[normalized]) {
      return UF_NAME_MAP[normalized];
    }
  }
  return "";
}

export function buildStatePaths(geoData: any): PathData[] {
  const projection = geoMercator();
  projection.fitExtent([[20, 20], [VIEWBOX_WIDTH - 20, VIEWBOX_HEIGHT - 20]], geoData);
  const generator = geoPath(projection);
  return geoData.features
    .map((feature: any) => {
      const uf = resolveUf(feature.properties ?? {});
      const d = generator(feature) ?? "";
      const centroid = generator.centroid(feature) as [number, number];
      return { uf, d, centroid };
    })
    .filter((pathItem: PathData) => pathItem.uf && pathItem.d);
}

export function buildRegionPaths(geoData: any, region: RegionName): PathData[] {
  if (!geoData?.features?.length) return [];
  const regionFeatures = geoData.features.filter((feature: any) => {
    const uf = resolveUf(feature.properties ?? {});
    return STATE_BY_UF[uf]?.region === region;
  });
  if (regionFeatures.length === 0) return [];
  const regionGeo = { type: "FeatureCollection", features: regionFeatures };
  const projection = geoMercator();
  projection.fitExtent([[20, 20], [VIEWBOX_WIDTH - 20, VIEWBOX_HEIGHT - 20]], regionGeo as any);
  const generator = geoPath(projection);
  return regionFeatures
    .map((feature: any) => {
      const uf = resolveUf(feature.properties ?? {});
      const d = generator(feature) ?? "";
      const centroid = generator.centroid(feature) as [number, number];
      return { uf, d, centroid };
    })
    .filter((item: PathData) => item.uf && item.d);
}

export function buildMunicipalityPaths(geoData: any): MunicipalityPath[] {
  const projection = geoMercator();
  projection.fitExtent([[16, 16], [VIEWBOX_WIDTH - 16, VIEWBOX_HEIGHT - 16]], geoData);
  const generator = geoPath(projection);
  return geoData.features
    .map((feature: any) => {
      const props = feature.properties ?? {};
      const code = String(props.id ?? props.codigo ?? props.codarea ?? props.CD_MUN ?? props.geocodigo ?? "");
      const name = String(props.name ?? props.nome ?? props.NM_MUNICIP ?? "Municipio");
      const d = generator(feature) ?? "";
      return { code, name, d };
    })
    .filter((item: MunicipalityPath) => item.code && item.d);
}

export function buildRegionalMunicipalityPaths(featuresWithUf: any[]): RegionalMunicipalityPath[] {
  if (featuresWithUf.length === 0) return [];
  const collection = { type: "FeatureCollection", features: featuresWithUf };
  const projection = geoMercator();
  projection.fitExtent([[16, 16], [VIEWBOX_WIDTH - 16, VIEWBOX_HEIGHT - 16]], collection as any);
  const generator = geoPath(projection);
  return featuresWithUf
    .map((feature: any) => {
      const props = feature.properties ?? {};
      const code = String(props.id ?? props.codigo ?? props.codarea ?? props.CD_MUN ?? props.geocodigo ?? "");
      const name = String(props.name ?? props.nome ?? props.NM_MUNICIP ?? "Municipio");
      const uf = String(props._uf ?? "");
      const d = generator(feature) ?? "";
      return { code, name, d, uf };
    })
    .filter((item: RegionalMunicipalityPath) => item.code && item.d);
}

export async function fetchMunicipalityGeo(ibgeCode: string): Promise<any | null> {
  const urls = [
    `https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-${ibgeCode}-mun.json`,
    `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${ibgeCode}?formato=application/vnd.geo+json&intrarregiao=municipio`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (data?.features?.length) return data;
    } catch {
      continue;
    }
  }
  return null;
}
