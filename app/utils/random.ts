export function generateRandomString(length: number): string {
    return [...crypto.getRandomValues(new Uint8Array(length))]
        .map((x) => ('0' + x.toString(16)).slice(-2))
        .join('');
}
