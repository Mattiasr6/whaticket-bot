import BotCajeroConfig from "../../models/BotCajeroConfig";

const isInQuietMode = (config: BotCajeroConfig): boolean => {
  if (!config.quietModeEnabled) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = config.quietModeStart.split(":").map(Number);
  const [endH, endM] = config.quietModeEnd.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Same-day range (e.g., 01:00-08:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  // Crosses midnight (e.g., 23:00-08:00)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
};

export { isInQuietMode };
