// 리턴AI 인센티브 계산 엔진
import { BASE_SALARY, INCENTIVE_PER_ITEM, GRADES } from '../data/constants.js';

export function calculateGrade(totalCount) {
  return GRADES.find(g => totalCount >= g.min && totalCount <= g.max) || GRADES[0];
}

export function calculateIncentive({ internetCount = 0, rentalCount = 0, usimCount = 0, usedPhoneCount = 0 }) {
  const totalCount = internetCount + rentalCount + usimCount + usedPhoneCount;
  const grade = calculateGrade(totalCount);

  const raw = {
    internet: internetCount * INCENTIVE_PER_ITEM.internet.avg,
    rental: rentalCount * INCENTIVE_PER_ITEM.rental.avg,
    usim: usimCount * INCENTIVE_PER_ITEM.usim.avg,
    usedPhone: usedPhoneCount * INCENTIVE_PER_ITEM.usedPhone.avg,
  };

  const rawTotal = Object.values(raw).reduce((a, b) => a + b, 0);
  const multiplied = Math.round(rawTotal * grade.multiplier);
  const totalIncentive = multiplied + grade.bonus;
  const totalSalary = BASE_SALARY + totalIncentive;

  return {
    baseSalary: BASE_SALARY,
    counts: { internet: internetCount, rental: rentalCount, usim: usimCount, usedPhone: usedPhoneCount, total: totalCount },
    grade: { id: grade.id, label: grade.label, multiplier: grade.multiplier, bonus: grade.bonus },
    breakdown: {
      internet: { count: internetCount, perItem: INCENTIVE_PER_ITEM.internet.avg, raw: raw.internet, applied: Math.round(raw.internet * grade.multiplier) },
      rental: { count: rentalCount, perItem: INCENTIVE_PER_ITEM.rental.avg, raw: raw.rental, applied: Math.round(raw.rental * grade.multiplier) },
      usim: { count: usimCount, perItem: INCENTIVE_PER_ITEM.usim.avg, raw: raw.usim, applied: Math.round(raw.usim * grade.multiplier) },
      usedPhone: { count: usedPhoneCount, perItem: INCENTIVE_PER_ITEM.usedPhone.avg, raw: raw.usedPhone, applied: Math.round(raw.usedPhone * grade.multiplier) },
    },
    gradeBonus: grade.bonus,
    totalIncentive,
    totalSalary,
  };
}

export { GRADES as GRADE_INFO, INCENTIVE_PER_ITEM as ITEM_INFO };
