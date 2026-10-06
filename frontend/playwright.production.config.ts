import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: ['auth.spec.ts', 'navigation.spec.ts', 'initial-size.spec.ts'] });
