import { SettingsProvider } from "./components/SettingsContext";
import { ToadProvider } from "./components/ToadContext";
import ToadGame from "./components/MainScreen";
import { NotificationProvider } from "./hooks/use-notification";

export default function App() {
  return (
    <NotificationProvider>
      <SettingsProvider>
        <ToadProvider>
          <ToadGame />
        </ToadProvider>
      </SettingsProvider>
    </NotificationProvider>
  );
}
