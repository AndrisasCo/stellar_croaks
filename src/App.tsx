import { SettingsProvider } from "./components/SettingsContext";
import { ToadProvider } from "./components/ToadContext";
import ToadGame from "./components/MainScreen";
import { NotificationProvider } from "./hooks/use-notification";
import { OfflineEventsProvider } from "./hooks/use-offline-events";
import { ModalProvider } from "./components/modals/ModalProvider";

export default function App() {
  return (
    <NotificationProvider>
      {/* Журнал событий отсутствия должен быть выше ModalProvider: модалку
          открывает портал, но контекст берётся из дерева провайдера. */}
      <OfflineEventsProvider>
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
      </OfflineEventsProvider>
    </NotificationProvider>
  );
}
