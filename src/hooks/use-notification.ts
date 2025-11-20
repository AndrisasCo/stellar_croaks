export const triggerNotification = (content: string, timeout = 5000) => {
  const notification = document.getElementById("notification");
  if (!notification) {
    return;
  }

  notification.innerText = content;

  notification.classList.remove("opacity-0", "scale-95");
  notification.classList.add("opacity-100", "scale-100");

  setTimeout(() => {
    notification.classList.remove("opacity-100", "scale-100");
    notification.classList.add("opacity-0", "scale-95");
  }, timeout);
};
