const { execSync } = require('child_process');

const watch = process.argv.find(a => a.startsWith('--watch'));

const cmd = [
  '.\\node_modules\\.bin\\esbuild',
  '@engine/src/index.ts',
  '--bundle',
  '--minify',
  '--sourcemap',
  '--outfile=media/libs/three.viewport.min.js',
];

const build = () => {
  try {
    execSync(cmd.join(' '), { stdio: 'inherit' });
  }
  // stdio is inherited, so we shouldn't need to do anything here
  catch (ex) { }
};

if (watch) {
  cmd.push('--watch');
  // fs.watch(PATH_SRC, { recursive: true }, debounce((eventType) => {
  //   if (eventType === 'change') {
  //     console.clear();
  //     build();
  //   }
  // }, 500));
}

console.log('Building @engine...');
build();
