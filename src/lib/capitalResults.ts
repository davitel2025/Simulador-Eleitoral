import type {
  Candidate,
  CandidateId,
  HistoricalMunicipalityScenarioKey,
  StateResult,
} from "../types";
import type { CapitalInfo } from "../data/capitals";
import {
  getHistoricalMunicipalityCandidatePcts,
  getHistoricalWinnerCandidateId,
} from "../data/historicalElectionResults";
import { getWinner, normalizeVotesForCandidates } from "./utils";

export function getCapitalWinnerId({
  capital,
  candidates,
  results,
  municipalityScenarioKey,
}: {
  capital: CapitalInfo;
  candidates: Candidate[];
  results: Record<string, StateResult>;
  municipalityScenarioKey?: HistoricalMunicipalityScenarioKey;
}): CandidateId | null {
  const stateResult = results[capital.uf];
  const candidateIds = candidates.map((candidate) => candidate.id);
  const savedVotes = stateResult?.municipalities?.[capital.code];
  if (savedVotes) {
    return getWinner(normalizeVotesForCandidates(savedVotes, candidateIds));
  }

  const savedWinner = stateResult?.municipalityPaint?.[capital.code];
  if (savedWinner) return savedWinner;

  const officialVotes = getHistoricalMunicipalityCandidatePcts(
    municipalityScenarioKey,
    capital.uf,
    capital.name,
    candidates
  );
  return getHistoricalWinnerCandidateId(officialVotes);
}
