import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	"sourceMap": true,
	files: 'out/test/**/*.test.js',
});
