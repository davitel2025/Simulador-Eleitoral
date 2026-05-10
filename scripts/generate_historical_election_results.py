import csv
import json
import unicodedata
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

SOURCES = {
    "2018_1t": (ROOT / "tse_tmp/2018/votacao_candidato_munzona_2018_BR.csv", "1"),
    "2018": (ROOT / "tse_tmp/2018/votacao_candidato_munzona_2018_BR.csv", "2"),
    "2022_1t": (ROOT / "tse_tmp/2022/votacao_candidato_munzona_2022_BR.csv", "1"),
    "2022": (ROOT / "tse_tmp/2022/votacao_candidato_munzona_2022_BR.csv", "2"),
}


def normalize_name(value: str) -> str:
    without_accents = "".join(
        char
        for char in unicodedata.normalize("NFD", value)
        if unicodedata.category(char) != "Mn"
    )
    normalized_chars = []
    for char in without_accents.lower():
        if char.isalnum() or char.isspace():
            normalized_chars.append(char)
        elif char in {"'", "’", "`", "´", ".", "-", "‐", "‑", "‒", "–", "—", "―"}:
            normalized_chars.append(" ")
        else:
            normalized_chars.append(" ")
    return " ".join("".join(normalized_chars).split())


def read_scenario(path: Path, turn: str):
    municipalities = defaultdict(lambda: defaultdict(int))
    states = defaultdict(lambda: defaultdict(int))
    candidates = {}

    with path.open(encoding="latin-1", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        for row in reader:
            if row["NR_TURNO"] != turn:
                continue
            if row["DS_CARGO"] != "Presidente":
                continue
            if row["SG_UF"] == "ZZ":
                continue

            number = row["NR_CANDIDATO"]
            uf = row["SG_UF"]
            municipality_key = f"{uf}:{normalize_name(row['NM_MUNICIPIO'])}"
            votes = int(row["QT_VOTOS_NOMINAIS_VALIDOS"] or row["QT_VOTOS_NOMINAIS"] or 0)

            municipalities[municipality_key][number] += votes
            states[uf][number] += votes
            candidates[number] = {
                "number": number,
                "name": row["NM_URNA_CANDIDATO"],
                "party": row["SG_PARTIDO"],
            }

    return municipalities, states, candidates


def to_plain_votes(data):
    return {
        key: {number: votes for number, votes in sorted(votes_by_number.items(), key=lambda item: int(item[0]))}
        for key, votes_by_number in sorted(data.items())
    }


def to_percentages_by_number(data):
    output = {}
    for key, votes_by_number in sorted(data.items()):
        total = sum(votes_by_number.values())
        output[key] = {
            number: (votes / total) * 100 if total else 0
            for number, votes in sorted(votes_by_number.items(), key=lambda item: int(item[0]))
        }
    return output


def ts_object(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def ts_json_parse(value) -> str:
    return f"JSON.parse({json.dumps(ts_object(value), ensure_ascii=False)})"


def main():
    municipalities_by_scenario = {}
    states_by_scenario = {}
    candidates_by_scenario = {}

    for scenario_key, (path, turn) in SOURCES.items():
        municipalities, states, candidates = read_scenario(path, turn)
        municipalities_by_scenario[scenario_key] = to_plain_votes(municipalities)
        states_by_scenario[scenario_key] = to_percentages_by_number(states)
        candidates_by_scenario[scenario_key] = {
            number: candidates[number]
            for number in sorted(candidates, key=int)
        }

    output = ROOT / "src/data/historicalElectionResults.ts"
    output.write_text(
        "\n".join(
            [
                'import type { Candidate, CandidateId, HistoricalMunicipalityScenarioKey } from "../types";',
                "",
                "export type HistoricalMunicipalityVotes = Record<string, number>;",
                "export type HistoricalStateResultsByNumber = Record<string, Record<string, number>>;",
                "",
                "export const HISTORICAL_MUNICIPALITY_RESULTS = "
                + ts_json_parse(municipalities_by_scenario)
                + " as Record<HistoricalMunicipalityScenarioKey, Record<string, HistoricalMunicipalityVotes>>;",
                "",
                "export const HISTORICAL_STATE_RESULTS_BY_NUMBER = "
                + ts_json_parse(states_by_scenario)
                + " as Record<HistoricalMunicipalityScenarioKey, HistoricalStateResultsByNumber>;",
                "",
                "export const HISTORICAL_CANDIDATE_SUMMARY_BY_NUMBER = "
                + ts_json_parse(candidates_by_scenario)
                + " as Record<HistoricalMunicipalityScenarioKey, Record<string, { number: string; name: string; party: string }>>;",
                "",
                "export function normalizeHistoricalMunicipalityName(value: string): string {",
                "  return value",
                "    .normalize('NFD')",
                "    .replace(/[\\u0300-\\u036f]/g, '')",
                "    .toLocaleLowerCase('pt-BR')",
                "    .replace(/[’'`´]/g, ' ')",
                "    .replace(/[.\\u2010-\\u2015-]/g, ' ')",
                "    .replace(/[^a-z0-9\\s]/g, ' ')",
                "    .replace(/\\s+/g, ' ')",
                "    .trim();",
                "}",
                "",
                "function buildHistoricalMunicipalityNameVariants(name: string): string[] {",
                "  const base = normalizeHistoricalMunicipalityName(name);",
                "  const variants = new Set<string>([base]);",
                "  const add = (value: string) => {",
                "    const normalized = value.replace(/\\s+/g, ' ').trim();",
                "    if (normalized) variants.add(normalized);",
                "  };",
                "",
                "  add(base.replace(/\\s+/g, '-'));",
                "  add(base.replace(/-/g, ' '));",
                "  add(base.replace(/\\s+/g, ''));",
                "  add(base.replace(/\\bd\\s+/g, 'do '));",
                "  add(base.replace(/\\bd\\s+/g, 'de '));",
                "  add(base.replace(/\\bdo\\s+/g, 'd '));",
                "  add(base.replace(/\\bde\\s+/g, 'd '));",
                "  add(base.replace(/^(de|do|da|dos|das)\\s+/, ''));",
                "",
                "  Array.from(variants).forEach((variant) => {",
                "    add(variant.replace(/\\s+/g, '-'));",
                "    add(variant.replace(/\\s+/g, ''));",
                "  });",
                "",
                "  return Array.from(variants);",
                "}",
                "",
                "export function getHistoricalMunicipalityVotes(scenarioKey: HistoricalMunicipalityScenarioKey | undefined, uf: string, name: string): HistoricalMunicipalityVotes | undefined {",
                "  if (!scenarioKey) return undefined;",
                "  const source = HISTORICAL_MUNICIPALITY_RESULTS[scenarioKey];",
                "  if (!source) return undefined;",
                "  const upperUf = uf.toUpperCase();",
                "  for (const nameVariant of buildHistoricalMunicipalityNameVariants(name)) {",
                "    const match = source[`${upperUf}:${nameVariant}`];",
                "    if (match) return match;",
                "  }",
                "  return undefined;",
                "}",
                "",
                "export function getHistoricalMunicipalityCandidatePcts(",
                "  scenarioKey: HistoricalMunicipalityScenarioKey | undefined,",
                "  uf: string,",
                "  name: string,",
                "  candidates: Candidate[]",
                "): Record<CandidateId, number> | undefined {",
                "  const votesByNumber = getHistoricalMunicipalityVotes(scenarioKey, uf, name);",
                "  if (!votesByNumber) return undefined;",
                "  const total = Object.values(votesByNumber).reduce((sum, votes) => sum + votes, 0);",
                "  if (total <= 0) return undefined;",
                "  const result: Record<CandidateId, number> = {};",
                "  candidates.forEach((candidate) => {",
                "    const votes = votesByNumber[candidate.number] ?? 0;",
                "    result[candidate.id] = (votes / total) * 100;",
                "  });",
                "  return result;",
                "}",
                "",
                "export function getHistoricalWinnerCandidateId(votes: Record<CandidateId, number> | undefined): CandidateId | null {",
                "  if (!votes) return null;",
                "  let winner: CandidateId | null = null;",
                "  let winnerPct = -1;",
                "  let ties = 0;",
                "  Object.entries(votes).forEach(([id, pct]) => {",
                "    if (pct > winnerPct) {",
                "      winner = Number(id);",
                "      winnerPct = pct;",
                "      ties = 1;",
                "    } else if (pct === winnerPct) {",
                "      ties += 1;",
                "    }",
                "  });",
                "  return winnerPct > 0 && ties === 1 ? winner : null;",
                "}",
                "",
                "export function buildHistoricalStateResults(",
                "  scenarioKey: HistoricalMunicipalityScenarioKey,",
                "  candidates: Omit<Candidate, 'id'>[]",
                "): Record<string, Record<number, number>> {",
                "  const source = HISTORICAL_STATE_RESULTS_BY_NUMBER[scenarioKey];",
                "  return Object.fromEntries(",
                "    Object.entries(source).map(([uf, byNumber]) => [",
                "      uf,",
                "      Object.fromEntries(candidates.map((candidate, index) => [index + 1, byNumber[candidate.number] ?? 0])),",
                "    ])",
                "  );",
                "}",
                "",
            ]
        ),
        encoding="utf-8",
    )

    print("generated", output)
    for scenario_key, municipalities in municipalities_by_scenario.items():
        print(scenario_key, len(municipalities), len(states_by_scenario[scenario_key]))


if __name__ == "__main__":
    main()
