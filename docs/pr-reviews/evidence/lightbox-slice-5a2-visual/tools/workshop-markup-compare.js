// Compare the Workshop markup workshopMarkupParity.test.tsx rendered at the base and at the head, state by state.
//   node workshop-markup-compare.js <dir holding base.json and head.json>
const path = require('path');
const dir = path.resolve(process.argv[2] || __dirname);
const base = require(path.join(dir, 'base.json'));
const head = require(path.join(dir, 'head.json'));
let same = 0;
for (const key of Object.keys(base)) {
  if (base[key] === head[key]) {
    same += 1;
    continue;
  }
  const x = base[key];
  const y = head[key] ?? '';
  let i = 0;
  while (x[i] === y[i]) {
    i += 1;
  }
  console.log('DIFF', key);
  console.log(' base:', x.slice(Math.max(0, i - 100), i + 150));
  console.log(' head:', y.slice(Math.max(0, i - 100), i + 150));
}
console.log(`${same} of ${Object.keys(base).length} states identical`);
