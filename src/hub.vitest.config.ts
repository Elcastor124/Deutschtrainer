import { mergeConfig } from 'vitest/config';
import config from '../vite.config.ts';

// Run both the existing suite and hub regressions without changing project configuration.
export default mergeConfig(config, { test: { include: ['tests/**/*.test.ts', 'src/**/*.test.ts'] } });
