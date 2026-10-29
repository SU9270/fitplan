const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function ftInToCm(ft: number, inch: number): number {
  return (ft * INCHES_PER_FOOT + inch) * CM_PER_INCH;
}

export function cmToFtIn(cm: number): { ft: number; in: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return {
    ft: Math.floor(totalInches / INCHES_PER_FOOT),
    in: totalInches % INCHES_PER_FOOT,
  };
}
