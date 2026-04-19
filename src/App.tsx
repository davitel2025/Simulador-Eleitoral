import { useState } from "react";
import { InitialScreen } from "./components/screens/InitialScreen";
import { CandidateSetupScreen } from "./components/screens/CandidateSetupScreen";
import { ElectionSimulator } from "./components/screens/ElectionSimulator";
import type { Candidate, ElectionRound, PoliticalScenario } from "./types";

export default function App() {
  const [electionRound, setElectionRound] = useState<ElectionRound | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [setupComplete, setSetupComplete] = useState(false);
  const [loadedScenario, setLoadedScenario] = useState<PoliticalScenario | null>(null);

  const handleSelectScenario = (scenario: PoliticalScenario) => {
    const candidatesWithIds: Candidate[] = scenario.candidates.map((c, i) => ({
      ...c,
      id: i + 1
    }));
    setCandidates(candidatesWithIds);
    setLoadedScenario(scenario);
    setElectionRound("segundo");
    setSetupComplete(true);
  };

  if (!electionRound) {
    return <InitialScreen onSelect={setElectionRound} onSelectScenario={handleSelectScenario} />;
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
        }}
      />
    );
  }

  return (
    <ElectionSimulator
      round={electionRound}
      candidates={candidates}
      loadedScenario={loadedScenario}
      onCandidatesChange={setCandidates}
      onRestart={() => {
        setElectionRound(null);
        setSetupComplete(false);
        setCandidates([]);
        setLoadedScenario(null);
      }}
    />
  );
}