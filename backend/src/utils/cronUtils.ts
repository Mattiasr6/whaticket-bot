const matchCron = (expr: string, date: Date): boolean => {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const minutes = date.getMinutes();
  const hours = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  const fields = [minutes, hours, dayOfMonth, month, dayOfWeek];

  for (let i = 0; i < 5; i++) {
    if (!fieldMatches(parts[i], fields[i])) return false;
  }

  return true;
};

const fieldMatches = (pattern: string, value: number): boolean => {
  if (pattern === "*") return true;

  const parts = pattern.split(",");
  for (const part of parts) {
    if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      if (isNaN(step)) continue;

      let start = 0;
      let end = 59;
      if (range !== "*") {
        const [s, e] = range.split("-");
        start = parseInt(s, 10);
        end = e ? parseInt(e, 10) : start;
      }
      if (isNaN(start) || isNaN(end)) continue;

      if (value >= start && value <= end && (value - start) % step === 0) return true;
    } else if (part.includes("-")) {
      const [s, e] = part.split("-");
      const start = parseInt(s, 10);
      const end = parseInt(e, 10);
      if (!isNaN(start) && !isNaN(end) && value >= start && value <= end) return true;
    } else {
      if (parseInt(part, 10) === value) return true;
    }
  }

  return false;
};

const getNextRun = (expr: string, from: Date = new Date()): Date | null => {
  const check = new Date(from.getTime() + 60000);
  check.setSeconds(0, 0);

  for (let i = 0; i < 525600; i++) {
    if (matchCron(expr, check)) return check;
    check.setTime(check.getTime() + 60000);
  }
  return null;
};

export { matchCron, getNextRun };
