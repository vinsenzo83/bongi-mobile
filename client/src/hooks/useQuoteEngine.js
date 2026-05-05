/**
 * useQuoteEngine.js — React hook wrapper around the pure quoteEngine.calc().
 *
 * Phase A — provides a single state container for all calculator inputs and
 * memoized calc() output. UI components in Phase B import this hook to get
 * { input, setInput, patch, result, ticket, isValid }.
 *
 * Inputs are deliberately mirrors of vanilla form fields:
 *   carrier, speed, tv, wifi, bundle, lines, range, settopId, tvCount,
 *   tv2, tv3, settop2, settop3, youthAdd, lguBonus, premiumPlan,
 *   premiumMembers (array — for kt-premium 5-row table)
 */

import { useMemo, useState, useCallback } from 'react';
import { calc, D } from '../lib/quoteEngine.js';

const DEFAULT_INPUT = {
  carrier: 'skt',
  speed: '500M',
  tv: 0,
  wifi: true,
  bundle: '',
  lines: 1,
  range: 0,
  settopId: null,
  tvCount: 1,
  tv2: 0,
  tv3: 0,
  settop2: null,
  settop3: null,
  youthAdd: false,
  lguBonus: 'wifi2',
  premiumPlan: 0,
  premiumMembers: []
};

export function useQuoteEngine(initialInput) {
  const [input, setInput] = useState(() => ({ ...DEFAULT_INPUT, ...(initialInput || {}) }));

  const patch = useCallback((updates) => {
    setInput((prev) => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => setInput({ ...DEFAULT_INPUT }), []);

  const result = useMemo(() => calc(input), [input]);

  return {
    input,
    setInput,
    patch,
    reset,
    result,
    ticket: result?.ticket || null,
    isValid: !!result?.isValid,
    D
  };
}

export default useQuoteEngine;
