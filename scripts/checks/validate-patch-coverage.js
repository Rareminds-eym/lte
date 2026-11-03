import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import ts from 'typescript';

const baseline=process.argv[2];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const changed=new Map();
const names=git('diff','--name-only','--diff-filter=ACMRT',baseline||'HEAD','--','src','functions').split('\n');
if(!baseline)names.push(...git('ls-files','--others','--exclude-standard','--','src','functions').split('\n'));
for(const file of new Set(names.filter(file=>/\.(ts|tsx)$/.test(file)&&!/\.d\.ts$|\/(?:__tests__)\/|\.(?:test|spec)\.tsx?$/.test(file)))){
  const tracked=git('ls-files','--',file)!=='';
  if(!tracked){changed.set(file,null);continue;}
  const lines=new Set();
  const diff=git('diff',baseline||'HEAD','--unified=0','--',file);
  for(const match of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)){
    const start=Number(match[1]),length=match[2]===undefined?1:Number(match[2]);
    for(let line=start;line<start+length;line++)lines.add(line);
  }
  changed.set(file,lines);
}
let current='',covered=0,total=0;
const seen=new Set();
for(const line of readFileSync('coverage/lcov.info','utf8').split('\n')){
  if(line.startsWith('SF:')){current=relative(process.cwd(),resolve(line.slice(3)));if(changed.has(current))seen.add(current);}
  if(!line.startsWith('DA:')||!changed.has(current))continue;
  const [number,hits]=line.slice(3).split(',').map(Number);
  const lines=changed.get(current);
  if(lines===null||lines.has(number)){total++;if(hits>0)covered++;}
}
for(const file of changed.keys()){
  if(seen.has(file))continue;
  const output=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  if(output.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'').replace(/export\s*\{\s*\};?/g,'').trim()){
    console.error(`Changed executable file is absent from coverage: ${file}`);process.exitCode=1;
  }
}
const percentage=total?100*covered/total:100;
console.log(`Changed executable lines: ${covered}/${total} (${percentage.toFixed(2)}%; required 80%).`);
if(percentage<80)process.exitCode=1;
