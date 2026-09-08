import assert from 'node:assert';
import { hasCustomTextColor } from '../components/ui/Button';

console.log('==================================================');
console.log('RUNNING GLOBAL BUTTON TEXT COLOR REGRESSION TESTS');
console.log('==================================================\n');

let passCount = 0;

function assertTest(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${testName}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${testName}`);
  passCount++;
}

// BUTTON-COLOR-01: Primary default has text-white (hasCustomTextColor is false)
assertTest(
  hasCustomTextColor('') === false,
  'BUTTON-COLOR-01: Primary default (empty className) preserves text-white'
);

// BUTTON-COLOR-02: Primary + text-xs MUST keep text-white
assertTest(
  hasCustomTextColor('text-xs font-bold') === false,
  'BUTTON-COLOR-02: Primary + text-xs font-bold preserves text-white'
);

// BUTTON-COLOR-03: Primary + text-sm MUST keep text-white
assertTest(
  hasCustomTextColor('w-full mt-4 bg-brand-primary font-bold py-3 text-sm') === false,
  'BUTTON-COLOR-03: Primary + text-sm preserves text-white'
);

// BUTTON-COLOR-04: Primary + sm:text-sm MUST keep text-white
assertTest(
  hasCustomTextColor('inline-flex items-center sm:text-sm font-bold shrink-0 px-2.5 sm:px-3.5') === false,
  'BUTTON-COLOR-04: Primary + sm:text-sm responsive font size preserves text-white'
);

// BUTTON-COLOR-05: Primary + text-center MUST keep text-white
assertTest(
  hasCustomTextColor('text-center font-semibold') === false,
  'BUTTON-COLOR-05: Primary + text-center alignment utility preserves text-white'
);

// BUTTON-COLOR-06: Primary + text-slate-700 MUST treat text-slate-700 as custom color
assertTest(
  hasCustomTextColor('text-slate-700 font-medium') === true,
  'BUTTON-COLOR-06: Primary + text-slate-700 correctly detected as intentional custom text color'
);

// BUTTON-COLOR-07: Secondary + text-xs MUST keep text-white
assertTest(
  hasCustomTextColor('text-xs font-semibold px-3') === false,
  'BUTTON-COLOR-07: Secondary + text-xs preserves text-white'
);

// BUTTON-COLOR-08: Danger + text-sm MUST keep text-white
assertTest(
  hasCustomTextColor('text-sm px-4 py-2') === false,
  'BUTTON-COLOR-08: Danger + text-sm preserves text-white'
);

// BUTTON-COLOR-09: Intentional custom brand color text-brand-primary correctly detected
assertTest(
  hasCustomTextColor('text-brand-primary border-brand-primary/30') === true,
  'BUTTON-COLOR-09: Intentional custom text color (text-brand-primary) correctly overrides default'
);

// BUTTON-COLOR-10: Intentional responsive custom color sm:text-red-500 correctly detected
assertTest(
  hasCustomTextColor('sm:text-red-500 font-bold') === true,
  'BUTTON-COLOR-10: Intentional responsive custom text color (sm:text-red-500) correctly overrides default'
);

console.log('\n==================================================');
console.log(`SUMMARY: ${passCount} PASSED, 0 FAILED`);
console.log('==================================================');
