const koreanNumberFormatter = new Intl.NumberFormat("ko-KR");

export function formatKoreanDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function formatKoreanDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatKoreanNumber(value: number) {
  return koreanNumberFormatter.format(value);
}

export function formatWon(value: number) {
  return `${formatKoreanNumber(value)}원`;
}

export function formatCompactWon(value: number) {
  if (value >= 100000000) {
    return `${formatKoreanNumber(Math.round(value / 100000000))}억`;
  }

  if (value >= 10000) {
    return `${formatKoreanNumber(Math.round(value / 10000))}만`;
  }

  return formatWon(value);
}
