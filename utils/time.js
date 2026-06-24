/**
 * Formats an ISO timestamp into a friendly "reset at" string,
 * e.g. "tomorrow at 6:30 PM" or "today at 11:45 PM".
 */
function formatResetTime(isoString) {
  const resetDate = new Date(isoString);
  const now = new Date();

  const isSameDay =
    resetDate.getDate() === now.getDate() &&
    resetDate.getMonth() === now.getMonth() &&
    resetDate.getFullYear() === now.getFullYear();

  const timeStr = resetDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  const dayStr = isSameDay ? 'today' : 'tomorrow';
  return `${dayStr} at ${timeStr}`;
}

module.exports = { formatResetTime };
