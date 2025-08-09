export function toRelativeTime(isoOrDate) {
  try {
    const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    const diffMs = Date.now() - date.getTime();
    const seconds = Math.round(diffMs / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    if (Math.abs(seconds) < 60) return 'just now';
    if (Math.abs(minutes) < 60) return `${minutes}m ago`;
    if (Math.abs(hours) < 24) return `${hours}h ago`;
    return `${days}d ago`;
  } catch {
    return '';
  }
}

export function toUTCString(isoOrDate) {
  try {
    const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    return date.toISOString();
  } catch {
    return '';
  }
}


