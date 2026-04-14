import { AuthLandingView } from "./components/AuthLandingView";
import { WorkspaceMainView } from "./components/WorkspaceMainView";
import { useAppShell } from "./app/useAppShell";

// Predeploy marker: uploaded: "В очереди OCR"

export default function App() {
  const { token, authLandingProps, workspaceMainViewProps } = useAppShell();

  if (!token) {
    return <AuthLandingView {...authLandingProps} />;
  }

  return <WorkspaceMainView {...workspaceMainViewProps} />;
}
