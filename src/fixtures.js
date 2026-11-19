import cleanPackage from './fixtures/clean/package.json';
import cleanConfig from './fixtures/clean/tsconfig.json';
import cleanLock from './fixtures/clean/package-lock.json';
import reviewPackage from './fixtures/review/package.json';
import reviewConfig from './fixtures/review/tsconfig.json';

const fixtures = {
  clean: { package: cleanPackage, config: cleanConfig, lock: cleanLock },
  review: { package: reviewPackage, config: reviewConfig, lock: null }
};

export const names = Object.keys(fixtures);
export const rootFor = name => '/synthetic/' + name;

function check(category, rule, title, needsReview, evidence, action, perspective) {
  return {
    category, rule, title, evidence, action, perspective, source: '.',
    kind: 'check', status: needsReview ? 'review' : 'checked'
  };
}

export function inspectFixture(name, id, time) {
  const fixture = fixtures[name];
  const dependencies = Object.values(fixture.package.dependencies);
  const floating = dependencies.filter(version => !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)).length;
  const strict = fixture.config.compilerOptions.strict === true;
  const checks = [
    check('Dependencies', 'dependency-policy', 'Dependency specification review', floating > 0,
      `package.json: ${floating} of ${dependencies.length} dependency declarations lack an exact version.`,
      'Review version reproducibility. Installed versions and known advisories were not checked.', 'packages'),
    check('Dependencies', 'lock-presence', 'Lockfile presence', !fixture.lock,
      fixture.lock ? 'A root package-lock.json is present.' : 'No recognized root lockfile present.',
      'Presence alone does not verify dependency integrity.', 'packages'),
    check('Configuration', 'typescript-strict', 'TypeScript strictness', !strict,
      `tsconfig.json: compilerOptions.strict is ${strict}.`,
      'Verify the effective build settings before relying on this result.', 'settings')
  ];
  return {
    id, root: rootFor(name), time, sourceTime: time, mode: 'local',
    scope: `Synthetic ${name} example`, synthetic: true, coverage: 'partial',
    discovery: {}, checks, findings: checks.filter(item => item.status === 'review'),
    perspectives: [
      { id: 'code', name: 'Code review', status: 'not-run', explanation: 'Source code review is outside this demo.' },
      { id: 'packages', name: 'Package checks', status: 'partial', explanation: 'Checks declarations and lockfile presence only.' },
      { id: 'settings', name: 'Settings review', status: 'completed', explanation: 'Reads the declared TypeScript strict setting.' },
      { id: 'secrets', name: 'Secret patterns', status: 'not-run', explanation: 'Secret detection is outside this demo.' },
      { id: 'access', name: 'Access testing', status: 'not-run', explanation: 'Runtime access testing is outside this demo.' }
    ]
  };
}
