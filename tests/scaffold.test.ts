/**
 * Scaffold validation tests for ScratchPad24 — Milestone 1.1
 *
 * These tests validate that the project scaffold is correctly set up.
 * They should FAIL initially (TDD) until the Developer implements the scaffold.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '..');

function readJson(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf-8'));
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(PROJECT_ROOT, relativePath));
}

function isDirectory(relativePath: string): boolean {
  const p = path.join(PROJECT_ROOT, relativePath);
  return fs.existsSync(p) && fs.statSync(p).isDirectory();
}

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf-8');
}

describe('Project structure', () => {
  it('has a /core directory for pure business logic', () => {
    expect(isDirectory('core')).toBe(true);
  });
  it('has a /components directory for React components', () => {
    expect(isDirectory('components')).toBe(true);
  });
  it('has an /api directory for platform-agnostic handlers', () => {
    expect(isDirectory('api')).toBe(true);
  });
  it('has an /adapters directory for platform-specific adapters', () => {
    expect(isDirectory('adapters')).toBe(true);
  });
  it('has a /storage directory for NoteStore interface + implementations', () => {
    expect(isDirectory('storage')).toBe(true);
  });
  it('has a /src directory as the Vite entry point', () => {

describe('package.json', () => {
  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };

  beforeAll(() => {
    pkg = readJson('package.json') as typeof pkg;
  });

  it('exists and is valid JSON', () => {
    expect(exists('package.json')).toBe(true);
    expect(pkg).toBeDefined();
  });

  describe('runtime dependencies', () => {
    it('includes react', () => {
      expect(pkg.dependencies?.react).toBeDefined();
    });
    it('includes react-dom', () => {
      expect(pkg.dependencies?.['react-dom']).toBeDefined();
    });
  });

  describe('dev dependencies', () => {
    it('includes typescript', () => {
      expect(pkg.devDependencies?.typescript).toBeDefined();
    });
    it('includes vitest', () => {
      expect(pkg.devDependencies?.vitest).toBeDefined();
    });
    it('includes vite', () => {
      expect(pkg.devDependencies?.vite).toBeDefined();
    });
    it('includes @vitejs/plugin-react', () => {
      expect(pkg.devDependencies?.['@vitejs/plugin-react']).toBeDefined();
    });
    it('includes @testing-library/react', () => {
      expect(pkg.devDependencies?.['@testing-library/react']).toBeDefined();
    });
    it('includes @testing-library/jest-dom', () => {
      expect(pkg.devDependencies?.['@testing-library/jest-dom']).toBeDefined();
    });
    it('includes @testing-library/user-event', () => {
      expect(pkg.devDependencies?.['@testing-library/user-event']).toBeDefined();
    });
    it('includes a vitest coverage provider', () => {
      const hasV8 = pkg.devDependencies?.['@vitest/coverage-v8'] !== undefined;
      const hasIstanbul = pkg.devDependencies?.['@vitest/coverage-istanbul'] !== undefined;
      expect(hasV8 || hasIstanbul).toBe(true);
    });
    it('includes jsdom for DOM testing', () => {
      expect(pkg.devDependencies?.jsdom).toBeDefined();
    });
  });

  describe('scripts', () => {
    it('has a "dev" script', () => {
      expect(pkg.scripts?.dev).toBeDefined();
    });
    it('has a "build" script', () => {
      expect(pkg.scripts?.build).toBeDefined();
    });
    it('has a "test" script that invokes vitest', () => {
      expect(pkg.scripts?.test).toBeDefined();
      expect(pkg.scripts?.test).toMatch(/vitest/);
    });
    it('has a "test:coverage" script', () => {
      expect(pkg.scripts?.['test:coverage']).toBeDefined();
      expect(pkg.scripts?.['test:coverage']).toMatch(/vitest/);
      expect(pkg.scripts?.['test:coverage']).toMatch(/coverage/);
    });
  });
});

    expect(isDirectory('src')).toBe(true);
  });

describe('tsconfig.json', () => {
  let tsconfig: {
    compilerOptions?: {
      strict?: boolean;
      noUnusedLocals?: boolean;
      noUnusedParameters?: boolean;
      noFallthroughCasesInSwitch?: boolean;
    };
  };

  beforeAll(() => {
    tsconfig = readJson('tsconfig.json') as typeof tsconfig;
  });

  it('exists and is valid JSON', () => {
    expect(exists('tsconfig.json')).toBe(true);
    expect(tsconfig).toBeDefined();
  });
  it('has compilerOptions defined', () => {
    expect(tsconfig.compilerOptions).toBeDefined();
  });
  it('has strict mode enabled', () => {
    expect(tsconfig.compilerOptions?.strict).toBe(true);
  });
  it('has noUnusedLocals enabled', () => {
    expect(tsconfig.compilerOptions?.noUnusedLocals).toBe(true);
  });
  it('has noUnusedParameters enabled', () => {
    expect(tsconfig.compilerOptions?.noUnusedParameters).toBe(true);
  });
  it('has noFallthroughCasesInSwitch enabled', () => {
    expect(tsconfig.compilerOptions?.noFallthroughCasesInSwitch).toBe(true);
  });
});

describe('Vitest configuration', () => {
  const possibleConfigFiles = [
    'vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs',
    'vite.config.ts', 'vite.config.js', 'vite.config.mjs',
  ];
  let configPath: string | null = null;
  let configContent = '';

  beforeAll(() => {
    for (const candidate of possibleConfigFiles) {
      if (exists(candidate)) {
        configPath = candidate;
        configContent = readText(candidate);
        break;
      }
    }
  });

  it('has a vitest or vite config file', () => {
    expect(configPath).not.toBeNull();
  });
  it('configures coverage thresholds at 100% for lines', () => {
    expect(configContent).toMatch(/lines\s*:\s*100/);
  });
  it('configures coverage thresholds at 100% for branches', () => {
    expect(configContent).toMatch(/branches\s*:\s*100/);
  });
  it('configures coverage thresholds at 100% for functions', () => {
    expect(configContent).toMatch(/functions\s*:\s*100/);
  });
  it('configures coverage thresholds at 100% for statements', () => {
    expect(configContent).toMatch(/statements\s*:\s*100/);
  });
});


describe('Vite configuration', () => {
  const viteConfigFiles = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'];

  it('has a vite config file', () => {
    const hasViteConfig = viteConfigFiles.some((f) => exists(f));
    expect(hasViteConfig).toBe(true);
  });

  it('vite config references @vitejs/plugin-react', () => {
    const viteConfig = viteConfigFiles.find((f) => exists(f));
    expect(viteConfig).toBeDefined();
    const content = readText(viteConfig!);
    expect(content).toMatch(/@vitejs\/plugin-react/);
  });
});

describe('GitHub Actions CI', () => {
  it('has a .github/workflows directory', () => {
    expect(isDirectory('.github/workflows')).toBe(true);
  });

  it('has at least one CI workflow YAML file', () => {
    const workflowDir = path.join(PROJECT_ROOT, '.github', 'workflows');
    expect(fs.existsSync(workflowDir)).toBe(true);
    const files = fs.readdirSync(workflowDir);
    const yamlFiles = files.filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
    expect(yamlFiles.length).toBeGreaterThan(0);
  });

  it('CI workflow runs lint, type-check, and tests', () => {
    const workflowDir = path.join(PROJECT_ROOT, '.github', 'workflows');
    const files = fs.readdirSync(workflowDir);
    const yamlFiles = files.filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
    const allContent = yamlFiles
      .map((f) => fs.readFileSync(path.join(workflowDir, f), 'utf-8'))
      .join('\n');
    expect(allContent).toMatch(/lint|typecheck|type-check|tsc/);
    expect(allContent).toMatch(/test/);
  });

  it('CI workflow enforces coverage', () => {
    const workflowDir = path.join(PROJECT_ROOT, '.github', 'workflows');
    const files = fs.readdirSync(workflowDir);
    const yamlFiles = files.filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
    const allContent = yamlFiles
      .map((f) => fs.readFileSync(path.join(workflowDir, f), 'utf-8'))
      .join('\n');
    expect(allContent).toMatch(/coverage/);
  });
});


describe('CSS Modules support', () => {
  it('has at least one *.module.css file in the project', () => {
    const searchDirs = ['src', 'components'];
    let found = false;

    for (const dir of searchDirs) {
      const fullPath = path.join(PROJECT_ROOT, dir);
      if (!fs.existsSync(fullPath)) continue;

      const walk = (currentDir: string): void => {
        if (found) return;
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (found) return;
          const entryPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            walk(entryPath);
          } else if (entry.name.endsWith('.module.css')) {
            found = true;
            return;
          }
        }
      };

      walk(fullPath);
      if (found) break;
    }

    expect(found).toBe(true);
  });
});

describe('Root configuration files', () => {
  it('has a .gitignore file', () => {
    expect(exists('.gitignore')).toBe(true);
  });

  it('.gitignore includes node_modules', () => {
    const content = readText('.gitignore');
    expect(content).toMatch(/node_modules/);
  });

  it('has a README.md', () => {
    expect(exists('README.md')).toBe(true);
  });

  it('has an index.html entry point for Vite', () => {
    expect(exists('index.html')).toBe(true);
  });
});

});
