export type CapitalInfo = {
  uf: string;
  name: string;
  lng: number;
  lat: number;
};

export const ALL_CAPITALS: CapitalInfo[] = [
  { uf: "AC", name: "Rio Branco", lng: -67.8076, lat: -9.9754 },
  { uf: "AL", name: "Maceio", lng: -35.7353, lat: -9.6658 },
  { uf: "AP", name: "Macapa", lng: -51.0669, lat: 0.0349 },
  { uf: "AM", name: "Manaus", lng: -60.0212, lat: -3.1019 },
  { uf: "BA", name: "Salvador", lng: -38.5014, lat: -12.9722 },
  { uf: "CE", name: "Fortaleza", lng: -38.5434, lat: -3.7172 },
  { uf: "DF", name: "Brasilia", lng: -47.9292, lat: -15.7801 },
  { uf: "ES", name: "Vitoria", lng: -40.3378, lat: -20.3155 },
  { uf: "GO", name: "Goiania", lng: -49.2539, lat: -16.6864 },
  { uf: "MA", name: "Sao Luis", lng: -44.3028, lat: -2.5297 },
  { uf: "MT", name: "Cuiaba", lng: -56.0974, lat: -15.5989 },
  { uf: "MS", name: "Campo Grande", lng: -54.6163, lat: -20.4697 },
  { uf: "MG", name: "Belo Horizonte", lng: -43.9378, lat: -19.9208 },
  { uf: "PA", name: "Belem", lng: -48.5044, lat: -1.4558 },
  { uf: "PB", name: "Joao Pessoa", lng: -34.8631, lat: -7.1153 },
  { uf: "PR", name: "Curitiba", lng: -49.2731, lat: -25.4284 },
  { uf: "PE", name: "Recife", lng: -34.8813, lat: -8.0539 },
  { uf: "PI", name: "Teresina", lng: -42.8016, lat: -5.0892 },
  { uf: "RJ", name: "Rio de Janeiro", lng: -43.1729, lat: -22.9068 },
  { uf: "RN", name: "Natal", lng: -35.2094, lat: -5.7793 },
  { uf: "RS", name: "Porto Alegre", lng: -51.2177, lat: -30.0277 },
  { uf: "RO", name: "Porto Velho", lng: -63.9004, lat: -8.7612 },
  { uf: "RR", name: "Boa Vista", lng: -60.6733, lat: 2.8235 },
  { uf: "SC", name: "Florianopolis", lng: -48.5482, lat: -27.5954 },
  { uf: "SP", name: "Sao Paulo", lng: -46.6333, lat: -23.5505 },
  { uf: "SE", name: "Aracaju", lng: -37.0731, lat: -10.9472 },
  { uf: "TO", name: "Palmas", lng: -48.3558, lat: -10.2491 },
];

export const DEFAULT_IMPORTANT_CAPITAL_UFS = ["SP", "RJ", "MG", "BA"];
