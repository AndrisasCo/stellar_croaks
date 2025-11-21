import React, { useState, useEffect, createContext, useContext } from "react";

export type NotificationType = "warn" | "success" | "danger";

export interface Notification {
  id: string;
  content: string;
  type: NotificationType;
  timeout?: number;
  isExiting?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id">) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

// Хук для использования уведомлений
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }
  return context;
};

// Провайдер уведомлений
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = { ...notification, id, isExiting: false };

    setNotifications((prev) => [newNotification, ...prev]);

    // Автоматическое удаление через timeout
    if (notification.timeout !== 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.timeout || 5000);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id
          ? { ...notification, isExiting: true }
          : notification
      )
    );

    // Даем время для анимации выхода перед удалением из DOM
    setTimeout(() => {
      setNotifications((prev) =>
        prev.filter((notification) => notification.id !== id)
      );
    }, 300);
  };

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification }}
    >
      {children}
      <NotificationStack />
    </NotificationContext.Provider>
  );
};

// Компонент стека уведомлений
const NotificationStack: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) return null;

  const getTypeStyles = (type: NotificationType) => {
    switch (type) {
      case "success":
        return "bg-green-500 border-green-400";
      case "danger":
        return "bg-red-500 border-red-400";
      case "warn":
      default:
        return "bg-yellow-500 border-yellow-400";
    }
  };

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case "success":
        return "✅";
      case "danger":
        return "❌";
      case "warn":
      default:
        return "⚠️";
    }
  };

  return (
    <div className="fixed bottom-5 left-0 w-full flex justify-center z-[100] pointer-events-none">
      <div className="flex flex-col items-center gap-3 max-w-md w-full mx-4">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            className={`
              w-full text-white px-4 py-3 rounded-xl shadow-2xl 
              border transform transition-all duration-500 ease-out
              flex items-center gap-3 pointer-events-auto
              backdrop-blur-sm bg-opacity-95
              ${getTypeStyles(notification.type)}
              ${
                notification.isExiting
                  ? "animate-out fade-out slide-out-to-bottom-full duration-300 ease-in"
                  : "animate-in fade-in slide-in-from-bottom-full duration-500 ease-out"
              }
            `}
            style={{
              transform: `
                translateY(${index * -8}px) 
                scale(${1 - index * 0.03})
                ${notification.isExiting ? "translateX(100%)" : "translateX(0)"}
              `,
              zIndex: 100 - index,
              transition: `
                transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
                opacity 0.3s ease-in-out
              `,
              opacity: notification.isExiting ? 0 : 1 - index * 0.1,
            }}
          >
            {/* Анимированная полоска прогресса */}
            {notification.timeout !== 0 && (
              <div className="absolute top-0 left-1 right-1 h-1 bg-white/30 rounded-t-2xl overflow-hidden">
                <div
                  className={`
                    h-full transition-all duration-300 ease-linear
                    ${notification.isExiting ? "w-0" : "w-full"}
                    ${
                      notification.type === "success"
                        ? "bg-green-200"
                        : notification.type === "danger"
                        ? "bg-red-200"
                        : "bg-yellow-200"
                    }
                  `}
                  style={{
                    animation: notification.isExiting
                      ? "none"
                      : `progress ${
                          notification.timeout || 5000
                        }ms linear forwards`,
                  }}
                />
              </div>
            )}

            <span
              className={`
                text-lg flex-shrink-0 transition-transform duration-300
                ${notification.isExiting ? "scale-0" : "scale-100"}
              `}
              style={{
                transitionDelay: notification.isExiting ? "0ms" : "100ms",
              }}
            >
              {getTypeIcon(notification.type)}
            </span>

            <span
              className={`
                flex-1 text-sm font-medium transition-all duration-300
                ${
                  notification.isExiting
                    ? "opacity-0 translate-x-2"
                    : "opacity-100 translate-x-0"
                }
              `}
              style={{
                transitionDelay: notification.isExiting ? "50ms" : "150ms",
              }}
            >
              {notification.content}
            </span>

            <button
              onClick={() => removeNotification(notification.id)}
              className={`
                flex-shrink-0 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 
                flex items-center justify-center transition-all duration-300
                ${
                  notification.isExiting
                    ? "scale-0 opacity-0"
                    : "scale-100 opacity-100"
                }
              `}
              style={{
                transitionDelay: notification.isExiting ? "0ms" : "200ms",
              }}
            >
              <svg
                className="w-3 h-3 text-white transition-transform duration-200 hover:scale-110"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }

        @keyframes gentleBounce {
          0% {
            transform: translateY(100%) scale(0.8);
            opacity: 0;
          }
          60% {
            transform: translateY(-10%) scale(1.02);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes gentleExit {
          0% {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateX(100%) scale(0.8);
            opacity: 0;
          }
        }

        .animate-in {
          animation: gentleBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)
            forwards;
        }

        .animate-out {
          animation: gentleExit 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53)
            forwards;
        }
      `}</style>
    </div>
  );
};

// Функция для обратной совместимости
export const triggerNotification = ({
  content,
  timeout = 5000,
  type = "warn",
}: {
  content: string;
  timeout?: number;
  type?: NotificationType;
}) => {
  console.warn(
    "triggerNotification is deprecated. Use useNotifications hook instead."
  );
};
