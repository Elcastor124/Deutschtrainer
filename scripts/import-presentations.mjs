// Importación explícita de las versiones actuales, nunca copias de seguridad.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const source = resolve(root, '..');
const out = join(root, 'public/presentaciones');
mkdirSync(out, { recursive: true });
const rows = [
 ['bruecke-a1','index.html','Brücke A1 · Empieza aquí','Saludos, presentaciones, números, preguntas personales e idiomas.',['Präsens','Vocabulario','Conversación'],'A1'],
 ['akkusativ','akkusativ.html','Mission Stadt · Akkusativ y preposiciones','Akkusativ, Dativ, Wo/Wohin y un combate final de boxeo multijugador.',['Akkusativ','Dativ','Preposiciones'],'A1–A2','Clase - Mission Stadt (Akkusativ y Dativ) - soluciones.pdf'],
 ['nebensaetze-perfekt','nebensatz-perfekt.html','Warum? · Nebensätze y Perfekt','weil, obwohl, deshalb; haben/sein y el verbo al final.',['Nebensätze','Perfekt'],'A1–A2','Clase - weil obwohl deshalb + Perfekt.pdf'],
 ['unterwegs','dativ.html','Unterwegs · Dativ + Perfekt','Artículos, pronombres y preposiciones de Dativ; viajes y frases combinadas.',['Dativ','Perfekt','Nebensätze'],'A1–A2','Clase - Unterwegs (Dativ + Perfekt).pdf'],
 ['bank','bank.html','Auf der Bank','Vocabulario del banco, trato formal y diálogos para situaciones reales.',['Vocabulario','Conversación'],'A2','Clase - Auf der Bank.pdf'],
 ['krankenhaus','krankenhaus.html','Im Krankenhaus · Nebensätze','Cuerpo y salud; weil, obwohl, dass, wenn y deshalb.',['Vocabulario','Nebensätze','Perfekt'],'A1–A2','Clase - Im Krankenhaus (Nebensätze).pdf'],
 ['sprache-in-bewegung','deutsch-trainer-120.html','Sprache in Bewegung','Repaso interactivo de estructuras, ejercicios y diccionario.',['Vocabulario','Dativ','Perfekt','Nebensätze'],'A1–A2'],
 ['krankenhaus-remaster',resolve(process.env.USERPROFILE || 'C:/Users/castr','Downloads/IM_KRANKENHAUS_3D_DATIV_REMASTER.html'),'Krankenhaus · Lectura y repaso 3D','Lectura de Leo, repaso de Dativ y Perfekt, ejercicios y vocabulario médico.',['Leseverstehen','Dativ','Perfekt','Nebensätze','Vocabulario'],'A1–A2'],
];
// Número de Lektion en la ruta del curso (src/course.ts); el catálogo se publica en ese orden.
const UNIT = { 'bruecke-a1':1, bank:2, 'nebensaetze-perfekt':3, krankenhaus:4, 'krankenhaus-remaster':4, unterwegs:5, akkusativ:6, 'sprache-in-bewegung':7 };
const ORDER = Object.keys(UNIT);
rows.sort((a,b)=>ORDER.indexOf(a[0])-ORDER.indexOf(b[0]));
const catalog = rows.map(([id,src,title,description,topics,level,pdf]) => {
 const input = resolve(source,src);
 let html = readFileSync(input,'utf8').replace(/\r\n?/g,'\n');
 // El ejemplo público no necesita el nombre real del profesor.
 html = html.replaceAll('Ich heiße Álvaro Castro.', 'Ich heiße Alex Weber.');
 const localRefs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1]).filter(v=>! /^(?:https?:|data:|#|javascript:|mailto:)/i.test(v));
 if (localRefs.length) throw new Error(`${src}: recursos relativos no empaquetados: ${localRefs.join(', ')}`);
 if (/(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_]{15,}/.test(html)) throw new Error('Posible credencial en '+src);
 writeFileSync(join(out,id+'.html'),html);
 const item={id,unit:UNIT[id],title,description,file:`/presentaciones/${id}.html`,topics,level,source:typeof src==='string'?src.split(/[\\/]/).pop():src,sha256:createHash('sha256').update(html).digest('hex')};
 if (pdf) { const p=join(source,pdf);if(!existsSync(p))throw new Error('Falta PDF '+pdf);copyFileSync(p,join(out,id+'.pdf'));item.pdf=`/presentaciones/${id}.pdf`; }
 return item;
});
writeFileSync(join(out,'catalogo.json'),JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({presentaciones:catalog.length,pdfs:catalog.filter(x=>x.pdf).length,ids:catalog.map(x=>x.id)},null,2));
