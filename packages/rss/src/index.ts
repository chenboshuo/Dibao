export function normalizeFeedUrl(input: string) {
  const url = new URL(input.trim());
  url.hash = "";
  url.username = "";
  url.password = "";
  return url.toString();
}

