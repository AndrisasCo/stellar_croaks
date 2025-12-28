import { SettingsProvider } from "./components/SettingsContext";
import { ToadProvider } from "./components/ToadContext";
import ToadGame from "./components/MainScreen";
import { NotificationProvider } from "./hooks/use-notification";
import { ModalProvider } from "./components/modals/ModalProvider";

export default function App() {
  return (
    <NotificationProvider>
      <SettingsProvider>
        <ToadProvider>
          <ModalProvider
            defaultOptions={{
              closeOnOverlayClick: true,
              showCloseButton: true,
              animation: "fade",
              disableScroll: true,
            }}
          >
            <ToadGame />
          </ModalProvider>
        </ToadProvider>
      </SettingsProvider>
    </NotificationProvider>
  );
}
