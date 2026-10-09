const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const wordListPath = path.join(__dirname, '..', 'word-lists.js');
const source = fs.readFileSync(wordListPath, 'utf8');
const context = {};
vm.runInNewContext(`${source}\nglobalThis.__wordLists = wordLists;`, context);

const guesses = new Set(
    Object.values(context.__wordLists)
        .flatMap(difficulty => Object.values(difficulty).flat())
        .map(word => word.toLowerCase())
        .filter(word => /^[a-z]{5}$/.test(word))
);

process.stdout.write(`word\n${[...guesses].sort().join('\n')}\n`);
