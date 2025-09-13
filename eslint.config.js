import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import { includeIgnoreFile } from '@eslint/compat';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		rules: {
			// TypeScript rules
			'@typescript-eslint/no-explicit-any': 'warn', // warn instead of fail
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

			// Svelte accessibility warnings (won't fail CI)
			'svelte/valid-compile': 'warn',

			// JS rules
			'no-var': 'error', // still enforce serious errors
			'no-undef': 'error',
			'no-empty': 'warn' // empty blocks are not ideal but non-critical
		}
	}
);
