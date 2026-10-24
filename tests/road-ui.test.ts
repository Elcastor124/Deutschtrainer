import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { RoadBoard } from '../src/views/Road.tsx';
import type { RoadView } from '../shared/road.ts';
export const view:RoadView = {code:'ABCD',role:'projector',section:'lesen',paused:false,elapsedMs:0,sectionElapsedMs:0,serverNow:0,locked:{lesen:false,horen:false,diktat:false},released:{lesen:false,horen:false,diktat:false},players:[],listens:{},level:{id:'level-1',version:'1',title:'Die erste Prüfung',disclaimer:'Kein offizieller Goethe-Test.',schedule:[{id:'lesen',title:'Lesen',minutes:50}],maxPoints:50,reading:[{id:'teil-1',title:'Teil 1',instruction:'Lesen Sie.',texts:[{id:'t1',title:'Text',body:'Ein Text.'}],questions:[{id:'l1',number:1,type:'choice',prompt:'Welche Antwort?',options:['Ein Buch','Eine Tasse','Ein Ball']}]}],listening:[],dictation:{title:'Mein Schultag',rubric:[]}}};
const render=(patch:Partial<RoadView>={})=>renderToStaticMarkup(createElement(RoadBoard,{view:{...view,...patch},busy:false,onAction:async()=>true}));
it('projects semantic choices without answer buttons or private teacher controls',()=>{const html=render();expect(html).toContain('data-road-section="lesen"');expect(html).toContain('road-choice-badge');expect(html).toContain('<ol');expect(html).not.toContain('data-road-answer');expect(html).not.toContain('data-road-release');expect(html).not.toContain('role="button"');});
it('renders native player choices and no premature correctness',()=>{const html=render({role:'player',ownAnswers:{l1:'Ein Buch'}});expect(html).toContain('type="radio"');expect(html).toContain('data-road-answer="l1"');expect(html).toContain('checked');expect(html).not.toContain('Richtig ✓');expect(html).not.toContain('Falsch ✗');});
it('renders teacher section controls and private panel separately',()=>{const html=render({role:'teacher'});expect(html).toContain('data-road-section-nav="diktat"');expect(html).toContain('data-road-lock="lesen"');expect(html).toContain('data-road-release="horen"');expect(html).toContain('Panel privado');});
it('never renders original dictation to unreleased players even with accidental solutions',()=>{const html=render({role:'player',section:'diktat',solutions:{dictation:'TOP SECRET'}});expect(html).toContain('data-road-dictation');expect(html).not.toContain('TOP SECRET');});
it('shows only released per-question corrections in the final student review',()=>{const html=render({role:'player',section:'ergebnisse',ownAnswers:{l1:'Ein Ball'},released:{lesen:true,horen:false,diktat:false},solutions:{answers:{l1:'Eine Tasse'},dictation:'NEVER SHOW'}});expect(html).toContain('Falsch ✗');expect(html).toContain('Eine Tasse');expect(html).not.toContain('NEVER SHOW');});
it('summarizes finished learners per activity in the teacher panel',()=>{const html=render({role:'teacher'});expect(html).toContain('data-road-finished="lesen"');expect(html).toContain('data-road-finished="diktat"');expect(html).toContain('data-road-finished="horen"');});
it('offers teacher-only single-listen restoration for a named student and audio',()=>{
 const players=[{id:'p1',name:'Ada',connected:true,progress:{lesen:0,horen:0,diktat:0},submitted:{lesen:false,horen:false,diktat:false},listens:{h1:2}}];
 const level={...view.level,listening:[{audio:{id:'h1',title:'Aufnahme 1'},questions:[]}]};
 expect(render({role:'teacher',players,level})).toContain('data-road-restore="p1:h1"');
 expect(render({role:'player',players,level})).not.toContain('data-road-restore');
 expect(render({role:'projector',players,level})).not.toContain('data-road-restore');
});
it('keeps exhausted but pending attempts recoverable in the player UI',()=>{
 const html=render({role:'player',section:'horen',listens:{h1:2},pendingAudio:{h1:'logical-2'},level:{...view.level,listening:[{audio:{id:'h1',title:'Aufnahme 1'},questions:[]}]}});
 expect(html).toMatch(/data-road-play="h1"(?![^>]*disabled)/);
});
it('shows pending results instead of inventing a total',()=>{expect(render({role:'player',section:'ergebnisse'})).toContain('Pendiente de revisión');});
it('disables sealed answers and submissions even after corrections are hidden',()=>{
 const sealed={lesen:true,horen:true,diktat:true};
 const html=render({role:'player',sealed});
 expect(html).toMatch(/data-road-answer="l1"[^>]*disabled/);
 expect(html).toMatch(/data-road-submit="lesen"[^>]*disabled/);
 expect(render({role:'player',section:'diktat',sealed})).toMatch(/data-road-dictation=""[^>]*disabled/);
 const players=[{id:'p1',name:'Ada',connected:true,progress:{lesen:0,horen:0,diktat:0},submitted:{lesen:true,horen:true,diktat:true}}];
 const teacher=render({role:'teacher',sealed,players});
 expect(teacher).toMatch(/disabled=""[^>]*>Reabrir Leseverstehen/);
 expect(teacher).toContain('El original está sellado');
});
