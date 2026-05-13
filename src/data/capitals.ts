export type CapitalInfo = {
  uf: string;
  name: string;
  code: string;
  lng: number;
  lat: number;
};

export const ALL_CAPITALS: CapitalInfo[] = [
  { uf: "AC", name: "Rio Branco", code: "1200401", lng: -67.8076, lat: -9.9754 },
  { uf: "AL", name: "Maceio", code: "2704302", lng: -35.7353, lat: -9.6658 },
  { uf: "AP", name: "Macapa", code: "1600303", lng: -51.0669, lat: 0.0349 },
  { uf: "AM", name: "Manaus", code: "1302603", lng: -60.0212, lat: -3.1019 },
  { uf: "BA", name: "Salvador", code: "2927408", lng: -38.5014, lat: -12.9722 },
  { uf: "CE", name: "Fortaleza", code: "2304400", lng: -38.5434, lat: -3.7172 },
  { uf: "DF", name: "Brasilia", code: "5300108", lng: -47.9292, lat: -15.7801 },
  { uf: "ES", name: "Vitoria", code: "3205309", lng: -40.3378, lat: -20.3155 },
  { uf: "GO", name: "Goiania", code: "5208707", lng: -49.2539, lat: -16.6864 },
  { uf: "MA", name: "Sao Luis", code: "2111300", lng: -44.3028, lat: -2.5297 },
  { uf: "MT", name: "Cuiaba", code: "5103403", lng: -56.0974, lat: -15.5989 },
  { uf: "MS", name: "Campo Grande", code: "5002704", lng: -54.6163, lat: -20.4697 },
  { uf: "MG", name: "Belo Horizonte", code: "3106200", lng: -43.9378, lat: -19.9208 },
  { uf: "PA", name: "Belem", code: "1501402", lng: -48.5044, lat: -1.4558 },
  { uf: "PB", name: "Joao Pessoa", code: "2507507", lng: -34.8631, lat: -7.1153 },
  { uf: "PR", name: "Curitiba", code: "4106902", lng: -49.2731, lat: -25.4284 },
  { uf: "PE", name: "Recife", code: "2611606", lng: -34.8813, lat: -8.0539 },
  { uf: "PI", name: "Teresina", code: "2211001", lng: -42.8016, lat: -5.0892 },
  { uf: "RJ", name: "Rio de Janeiro", code: "3304557", lng: -43.1729, lat: -22.9068 },
  { uf: "RN", name: "Natal", code: "2408102", lng: -35.2094, lat: -5.7793 },
  { uf: "RS", name: "Porto Alegre", code: "4314902", lng: -51.2177, lat: -30.0277 },
  { uf: "RO", name: "Porto Velho", code: "1100205", lng: -63.9004, lat: -8.7612 },
  { uf: "RR", name: "Boa Vista", code: "1400100", lng: -60.6733, lat: 2.8235 },
  { uf: "SC", name: "Florianopolis", code: "4205407", lng: -48.5482, lat: -27.5954 },
  { uf: "SP", name: "Sao Paulo", code: "3550308", lng: -46.6333, lat: -23.5505 },
  { uf: "SE", name: "Aracaju", code: "2800308", lng: -37.0731, lat: -10.9472 },
  { uf: "TO", name: "Palmas", code: "1721000", lng: -48.3558, lat: -10.2491 },
];

export const DEFAULT_IMPORTANT_CAPITAL_UFS = ["SP", "RJ", "MG", "BA"];
