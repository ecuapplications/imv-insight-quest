export function stripToDigits(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

// Quita el 0 inicial de troncal (convención de marcado nacional en Ecuador y
// buena parte de Latinoamérica) que no debe ir en el número en formato E.164.
export function stripTrunkZero(digits: string): string {
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

// Normaliza lo que el usuario escribe en el campo de número local: solo
// dígitos, sin el 0 inicial de troncal.
export function normalizeLocalNumber(raw: string): string {
  return stripTrunkZero(stripToDigits(raw));
}

export type ParsedPhone = { countryCode: string | null; localNumber: string };

// Analiza un número pegado desde el portapapeles (con o sin "+", espacios,
// guiones, paréntesis) y separa el código de país (si coincide con uno
// conocido) del número local ya normalizado.
export function parsePastedPhone(pasted: string, knownCodes: string[]): ParsedPhone {
  const digits = stripToDigits(pasted);
  const hadPlus = pasted.trim().startsWith("+");

  // Solo intentamos detectar código de país si viene con "+" o si el total de
  // dígitos es mayor a un número local típico (10) — evita falsos positivos
  // con números locales que por coincidencia empiezan como algún código.
  if (digits !== "" && (hadPlus || digits.length > 10)) {
    const sorted = [...knownCodes].sort((a, b) => b.length - a.length);
    for (const code of sorted) {
      if (digits.startsWith(code) && digits.length > code.length) {
        return { countryCode: code, localNumber: stripTrunkZero(digits.slice(code.length)) };
      }
    }
  }

  return { countryCode: null, localNumber: stripTrunkZero(digits) };
}
