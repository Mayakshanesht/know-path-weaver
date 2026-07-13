import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync('.env','utf8').split('\n')) {
  const m=/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');
}
const APPLY = process.argv.includes('--apply');
const db = createClient(process.env.V2_SUPABASE_URL, process.env.V2_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const { data: mods } = await db.from('learning_paths').select('id,title');
const { data: caps } = await db.from('capsules').select('id,title,description,learning_path_id');
const { data: cc } = await db.from('capsule_content').select('capsule_id,title,content_type');
const modTitle = new Map(mods.map(m=>[m.id,m.title]));

function describe(cap) {
  const t = cap.title;
  const mod = modTitle.get(cap.learning_path_id) ?? 'this module';
  const items = cc.filter(i=>i.capsule_id===cap.id);
  const kinds = new Set(items.map(i=>i.content_type));
  const titled = items.filter(i=>i.title && i.title.trim());
  if (/^what this module covers/i.test(t)) return 'Start here.';
  if (/alternate clip/i.test(t)) return 'An alternate recording of the same lecture — take whichever suits you.';
  if (/lecture slides?|^slides|— slides|slide$/i.test(t)) return `Reference deck for ${mod}.`;
  if (/lecture notes/i.test(t)) return `Written notes for ${mod}.`;
  if (/mind ?map/i.test(t)) return `A visual map of how ${mod} fits together.`;
  if (/summary video/i.test(t)) return 'A condensed run-through of the lecture.';
  if (/project video|explanation video|explaination|explaining project/i.test(t)) return 'A walkthrough of the project implementation.';
  if (/lecture video|lecture$|full lecture|— lecture/i.test(t)) return `The full lecture for ${mod}.`;
  if (/^project \d|^capstone|project \d+ *[-–—:]/i.test(t)) {
    if (kinds.has('colab')) return 'Hands-on project. Runs in Colab.';
    if (kinds.has('github')) return 'Hands-on project. Clone the repo and run it locally.';
    if (kinds.has('weblink')) return 'Hands-on project.';
    return 'Hands-on project.';
  }
  if (/assignment/i.test(t)) return 'Assignment — attempt it before reading the solution.';
  if (/^primer for/i.test(t)) return 'A runnable primer. Skim it if you already know this.';
  if (/logic info|project info|additional info|miscelleneous|misc/i.test(t)) return 'Supporting material.';
  if (/practice/i.test(t)) return 'Practice material. Work through it yourself.';
  if (/installed|install/i.test(t)) return 'Setup. Do this before the projects.';
  if (/manual/i.test(t)) return 'How the lab is set up, and why.';
  if (/introduction|^intro/i.test(t)) return 'Orientation for the course.';
  if (kinds.size===1 && kinds.has('colab')) return 'Runs in Colab.';
  if (kinds.size===1 && kinds.has('github')) return 'Clone the repo and work through it locally.';
  if (kinds.size===1 && kinds.has('youtube')) return 'Video lesson.';
  if (kinds.size===1 && kinds.has('weblink')) return 'An external resource — opens in a new tab.';
  if (items.length>1) return `${items.length} resources for this lesson.`;
  if (titled.length===1) return titled[0].title.trim();
  if (kinds.has('google_drive')) return `Material for ${mod}.`;
  return null;
}

let set=0;
for (const c of caps) {
  if (c.description && c.description.trim()) continue;
  const d = describe(c);
  if (!d) continue;
  if (APPLY) await db.from('capsules').update({ description: d }).eq('id', c.id);
  set++;
}
const { data: after } = await db.from('capsules').select('id,description');
const without = after.filter(c=>!c.description || !c.description.trim()).length;
console.log(`${APPLY?'Set':'Would set'} ${set} descriptions.`);
console.log(`Lessons still without one: ${without} of ${after.length}`);
