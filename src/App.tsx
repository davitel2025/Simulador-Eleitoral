import { useState } from "react";
import { InitialScreen } from "./components/screens/InitialScreen";
import { CandidateSetupScreen } from "./components/screens/CandidateSetupScreen";
import { ElectionSimulator } from "./components/screens/ElectionSimulator";
import { getWinner, sanitizeCandidate } from "./lib/utils";
import type { Candidate, CustomStateInfo, ElectionRound, PoliticalScenario, StateResult } from "./types";

function normalizeImportedResults(payload: any): Record<string, StateResult> | null {
  if (!payload?.results || typeof payload.results !== "object") return null;
  const payloadMunicipalities =
    payload.municipalities && typeof payload.municipalities === "object"
      ? (payload.municipalities as Record<string, any>)
      : {};
  const normalized: Record<string, StateResult> = {};
  for (const [uf, result] of Object.entries(payload.results as Record<string, any>)) {
    const votes = result?.votes && typeof result.votes === "object" ? result.votes : {};
    const municipalityPayload = payloadMunicipalities[uf] ?? {};
    const municipalities =
      result?.municipalities ?? municipalityPayload.municipalities ?? {};
    const municipalityPaint =
      result?.municipalityPaint ?? municipalityPayload.municipalityPaint ?? {};
    normalized[uf] = {
      uf,
      votes,
      winner: result?.winner ?? getWinner(votes),
      municipalities,
      municipalityPaint,
      usesMunicipalities: Object.keys(municipalityPaint).length > 0,
      excluded: Boolean(result?.excluded),
    };
  }
  return normalized;
}

function normalizeImportedCustomStates(payload: any): CustomStateInfo[] | undefined {
  const rawCustomStates = payload?.scenario?.customStates ?? payload?.customStates;
  if (!Array.isArray(rawCustomStates)) return undefined;
  const customStates = rawCustomStates
    .map((state: any) => ({
      uf: String(state?.uf ?? "").toUpperCase(),
      voters: Math.max(0, Math.round(Number(state?.voters ?? 0))),
    }))
    .filter((state) => state.uf && state.voters > 0);
  return customStates.length > 0 ? customStates : undefined;
}

function getImportedNationalVoters(payload: any): number | undefined {
  const value = Number(payload?.scenario?.nationalVoters ?? payload?.nationalVoters);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
}

export default function App() {
  const [electionRound, setElectionRound] = useState<ElectionRound | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [setupComplete, setSetupComplete] = useState(false);
  const [loadedScenario, setLoadedScenario] = useState<PoliticalScenario | null>(null);
  const [initialResults, setInitialResults] = useState<Record<string, StateResult> | null>(null);

  const handleSelectScenario = (scenario: PoliticalScenario) => {
    const candidatesWithIds: Candidate[] = scenario.candidates.map((c, i) =>
      sanitizeCandidate({
        ...c,
        id: i + 1,
      })
    );
    setCandidates(candidatesWithIds);
    setLoadedScenario(scenario);
    setInitialResults(null);
    setElectionRound(scenario.round ?? "segundo");
    setSetupComplete(!scenario.isCustom);
  };

  const handleImportScenario = (payload: unknown): boolean => {
    const data = payload as any;
    if (
      !data ||
      !Array.isArray(data.candidates) ||
      (data.round !== "primeiro" && data.round !== "segundo")
    ) {
      return false;
    }
    const importedCandidates: Candidate[] = data.candidates.map((candidate: any, index: number) =>
      sanitizeCandidate({
        ...candidate,
        id: Number(candidate.id) || index + 1,
      })
    );
    const scenarioCandidates = importedCandidates.map(({ id: _id, ...candidate }) => candidate);
    const scenarioPayload = data.scenario && typeof data.scenario === "object" ? data.scenario : {};
    const importedYear = Number(scenarioPayload.year ?? data.year);
    const customStates = normalizeImportedCustomStates(data);
    const nationalVoters = getImportedNationalVoters(data);
    setCandidates(importedCandidates);
    setLoadedScenario({
      id: `imported_${Date.now()}`,
      name: typeof scenarioPayload.name === "string" ? scenarioPayload.name : "Cenário importado",
      year: Number.isFinite(importedYear) ? importedYear : new Date().getFullYear(),
      round: data.round,
      description:
        typeof scenarioPayload.description === "string"
          ? scenarioPayload.description
          : "Cenário importado de JSON.",
      candidates: scenarioCandidates,
      customStates,
      nationalVoters,
      isCustom: true,
      generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : undefined,
    });
    setInitialResults(normalizeImportedResults(data));
    setElectionRound(data.round);
    setSetupComplete(true);
    return true;
  };

  if (!electionRound) {
    return (
      <InitialScreen
        onSelect={setElectionRound}
        onSelectScenario={handleSelectScenario}
        onImportScenario={handleImportScenario}
      />
    );
  }

  if (!setupComplete) {
    return (
      <CandidateSetupScreen
        round={electionRound}
        initialCandidates={candidates}
        onComplete={(newCandidates) => {
          setCandidates(newCandidates);
          setSetupComplete(true);
        }}
        onBack={() => {
          setElectionRound(null);
          setLoadedScenario(null);
          setInitialResults(null);
          setCandidates([]);
        }}
      />
    );
  }

  return (
    <ElectionSimulator
      round={electionRound}
      candidates={candidates}
      loadedScenario={loadedScenario}
      initialResults={initialResults}
      onImportScenario={handleImportScenario}
      onCandidatesChange={setCandidates}
      onRoundChange={setElectionRound}
      onRestart={() => {
        setElectionRound(null);
        setSetupComplete(false);
        setCandidates([]);
        setLoadedScenario(null);
        setInitialResults(null);
      }}
    />
  );
}
