import { SettingsProvider } from "./components/SettingsContext";
import { ToadProvider } from "./components/ToadContext";
import ToadGame from "./components/ToadGame";

export default function App() {
  return (
    <SettingsProvider>
      <ToadProvider>
        <ToadGame />
      </ToadProvider>
    </SettingsProvider>
  );
}
