// DeutschTrainer Klaus — QtPainter-to-Canvas compatibility layer.
// The painting operations below mirror the PySide6 code's geometry, colors and compositing.
// Browser build; no PySide6, external dependencies or network requests needed.
'use strict';
const math = Object.freeze({sin: Math.sin, cos: Math.cos, atan2: Math.atan2,
  hypot: Math.hypot, radians: n => n * Math.PI / 180, pi: Math.PI, tau: Math.PI * 2 });
const max = Math.max, min = Math.min, abs = Math.abs;
const int = x => Math.trunc(Number(x));
const float = x => Number(x);
const bool = x => Boolean(x);
const len = x => x.length ?? Object.keys(x).length;
const str = x => String(x);
const _pymod = (a,b) => ((a%b)+b)%b;
const _pyneg = x => (x instanceof QPointF ? new QPointF(-x.x(),-x.y()) : -x);
const _pyget = (o,k,d=null) => Object.prototype.hasOwnProperty.call(o,k) ? o[k] : d;
const _pysetdefault = (o,k,v) => Object.prototype.hasOwnProperty.call(o,k) ? o[k] : (o[k] = v);
const _pyupdate = (o,v) => Object.assign(o,v);
const _pyin = (k,o) => o instanceof Set ? o.has(k) : Array.isArray(o) || typeof o==='string' ? o.includes(k) : Object.prototype.hasOwnProperty.call(o,k);
function* range(a,b,step=1) { if(b===undefined){b=a;a=0;}if(step===0)throw new RangeError('range step 0'); for(let i=a;step>0?i<b:i>b;i+=step)yield i; }
function* enumerate(xs){let i=0;for(const v of xs)yield [i++,v];}
function* zip(...xs){let i=0;while(xs.every(x=>i<x.length)){const row=xs.map(x=>x[i]);i++;yield row;}}
class QPointF {constructor(x=0,y=0){this._x=x;this._y=y;} x(){return this._x;}y(){return this._y;}}
class QRectF {
  constructor(a=0,b=0,c=0,d=0){
    if(a instanceof QRectF){ this._x=a._x; this._y=a._y;this._w=a._w;this._h=a._h; }
    else if(a instanceof QPointF && b instanceof QPointF){this._x=a.x();this._y=a.y();this._w=b.x()-a.x();this._h=b.y()-a.y();}
    else {this._x=a;this._y=b;this._w=c;this._h=d;}
  }
  left(){return this._x;}right(){return this._x+this._w;}top(){return this._y;}bottom(){return this._y+this._h;}
  width(){return this._w;}height(){return this._h;}
  center(){return new QPointF(this._x+this._w/2,this._y+this._h/2);}
  normalized(){return new QRectF(Math.min(this.left(),this.right()),Math.min(this.top(),this.bottom()),Math.abs(this._w),Math.abs(this._h));}
  adjusted(a,b,c,d){return new QRectF(this._x+a,this._y+b,this._w+c-a,this._h+d-b);}
}
class QColor {
  constructor(r='#000000',g,b,a=255){
    if(r instanceof QColor){this.r=r.r;this.g=r.g;this.b=r.b;this.a=r.a;return;}
    if(typeof r==='number'){this.r=r;this.g=g??0;this.b=b??0;this.a=a??255;return;}
    if(typeof r==='string'){
      const h=r.trim(); const s=h.startsWith('#')?h.slice(1):h;
      if(/^[0-9a-f]{6}$/i.test(s)){this.r=parseInt(s.slice(0,2),16);this.g=parseInt(s.slice(2,4),16);this.b=parseInt(s.slice(4,6),16);this.a=255;return;}
      if(/^[0-9a-f]{8}$/i.test(s)){this.r=parseInt(s.slice(0,2),16);this.g=parseInt(s.slice(2,4),16);this.b=parseInt(s.slice(4,6),16);this.a=parseInt(s.slice(6,8),16);return;}
      if(/^[0-9a-f]{3}$/i.test(s)){this.r=parseInt(s[0]+s[0],16);this.g=parseInt(s[1]+s[1],16);this.b=parseInt(s[2]+s[2],16);this.a=255;return;}
    }
    this.r=0;this.g=0;this.b=0;this.a=255;
  }
  red(){return this.r;}green(){return this.g;}blue(){return this.b;}alpha(){return this.a;}
  setAlpha(a){this.a=Math.max(0,Math.min(255,Math.round(a)));}
  css(){return `rgba(${Math.round(this.r)},${Math.round(this.g)},${Math.round(this.b)},${this.a/255})`;}
}
class QPen {
  constructor(color='#ffffff',width=1){if(color instanceof QPen){this._color=new QColor(color._color);this.width=color.width;this.cap=color.cap;this.join=color.join;return;}
  this._color=new QColor(color);this.width=width;this.cap='round';this.join='round';}
  setCapStyle(cap){this.cap=cap;}setJoinStyle(join){this.join=join;}color(){return this._color;}
}
class QPolygonF extends Array {constructor(pts=[]){super();this.push(...pts);}}
const Qt={BrushStyle:{NoBrush:'NoBrush'},PenStyle:{NoPen:'NoPen'},
  PenCapStyle:{RoundCap:'round',FlatCap:'butt'},PenJoinStyle:{RoundJoin:'round',MiterJoin:'miter'},
  AlignmentFlag:{AlignLeft:1,AlignRight:2,AlignCenter:4,AlignVCenter:8,AlignBottom:16}};

class QPainterPath {
  constructor(){this.ops=[];this._curr=new QPointF(0,0);this._start=new QPointF(0,0);}
  _xy(args){return args[0] instanceof QPointF?[args[0].x(),args[0].y()]:[args[0],args[1]];}
  moveTo(...args){const [x,y]=this._xy(args);this.ops.push(['M',x,y]);this._curr=new QPointF(x,y);this._start=this._curr;}
  lineTo(...args){const [x,y]=this._xy(args);this.ops.push(['L',x,y]);this._curr=new QPointF(x,y);}
  quadTo(...args){let x1,y1,x2,y2;if(args[0] instanceof QPointF){[x1,y1,x2,y2]=[args[0].x(),args[0].y(),args[1].x(),args[1].y()];}else{[x1,y1,x2,y2]=args;}
    this.ops.push(['Q',x1,y1,x2,y2]);this._curr=new QPointF(x2,y2);}
  cubicTo(...args){let x1,y1,x2,y2,x3,y3;if(args[0] instanceof QPointF){[x1,y1,x2,y2,x3,y3]=[args[0].x(),args[0].y(),args[1].x(),args[1].y(),args[2].x(),args[2].y()];}else{[x1,y1,x2,y2,x3,y3]=args;}
    this.ops.push(['C',x1,y1,x2,y2,x3,y3]);this._curr=new QPointF(x3,y3);}
  closeSubpath(){this.ops.push(['Z']);this._curr=this._start;}
  apply(ctx){for(const [op,...a] of this.ops){switch(op){case 'M':ctx.moveTo(...a);break;case 'L':ctx.lineTo(...a);break;case 'Q':ctx.quadraticCurveTo(...a);break;case 'C':ctx.bezierCurveTo(...a);break;case 'Z':ctx.closePath();break;}}}
  pointAtPercent(p){
    let points=[]; let prev=[0,0], start=[0,0];
    for(const [op,...v] of this.ops){
      if(op==='M'){prev=[v[0],v[1]];start=prev;points.push(prev);}
      else if(op==='L'){const end=[v[0],v[1]];points.push(end);prev=end;}
      else if(op==='Q'){const [x0,y0]=prev;for(let i=1;i<=24;i++){let t=i/24,u=1-t;points.push([u*u*x0+2*u*t*v[0]+t*t*v[2],u*u*y0+2*u*t*v[1]+t*t*v[3]]);}prev=[v[2],v[3]];}
      else if(op==='C'){const [x0,y0]=prev;for(let i=1;i<=40;i++){let t=i/40,u=1-t;points.push([u*u*u*x0+3*u*u*t*v[0]+3*u*t*t*v[2]+t*t*t*v[4],u*u*u*y0+3*u*u*t*v[1]+3*u*t*t*v[3]+t*t*t*v[5]]);}prev=[v[4],v[5]];}
      else if(op==='Z'){points.push(start);prev=start;}
    }
    if(!points.length)return new QPointF();if(points.length===1)return new QPointF(...points[0]);
    const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
    let goal=Math.min(1,Math.max(0,p))*lengths[lengths.length-1];
    for(let i=1;i<lengths.length;i++)if(lengths[i]>=goal){const q=(goal-lengths[i-1])/Math.max(1e-9,lengths[i]-lengths[i-1]);return new QPointF(points[i-1][0]*(1-q)+points[i][0]*q,points[i-1][1]*(1-q)+points[i][1]*q);}
    return new QPointF(...points[points.length-1]);
  }
}
class QFont {constructor(other){this.family=other?.family??'Arial';this.size=other?.size??11;this.bold=other?.bold??false;this.italic=other?.italic??false;}
  setFamily(f){this.family=f;}setPointSize(n){this.size=n;}pointSize(){return this.size;}setBold(b){this.bold=b;}setItalic(b){this.italic=b;}
  css(){return `${this.italic?'italic ':''}${this.bold?'bold ':''}${Math.max(3,this.size)*1.3333}px ${JSON.stringify(this.family)}, Arial, sans-serif`;}
}
class QPainter {
  static RenderHint={Antialiasing:'antialias'};
  constructor(context){this.ctx=context;this._pen=new QPen('#ffffff',1);this._brush=null;this._font=new QFont();this.stack=[];}
  save(){this.stack.push([this._pen?new QPen(this._pen):null,this._brush?new QColor(this._brush):null,new QFont(this._font)]);this.ctx.save();}
  restore(){const p=this.stack.pop();if(p){[this._pen,this._brush,this._font]=p;this.ctx.restore();}}
  setRenderHint(){}
  setPen(p){this._pen=(p===Qt.PenStyle.NoPen)?null:(p instanceof QPen?new QPen(p):new QPen(p,1));}
  setBrush(b){this._brush=(b===Qt.BrushStyle.NoBrush)?null:new QColor(b);}
  setFont(f){this._font=new QFont(f);}
  font(){return new QFont(this._font);}
  translate(a,b){if(a instanceof QPointF)this.ctx.translate(a.x(),a.y());else this.ctx.translate(a,b);}
  rotate(deg){this.ctx.rotate(deg*Math.PI/180);}scale(x,y){this.ctx.scale(x,y);}
  resetTransform(){this.ctx.resetTransform();}
  setClipRect(rect){this.ctx.beginPath();this.ctx.rect(rect.left(),rect.top(),rect.width(),rect.height());this.ctx.clip();}
  _paint(){if(this._brush){this.ctx.fillStyle=this._brush.css();this.ctx.fill();}
    if(this._pen){this.ctx.strokeStyle=this._pen.color().css();this.ctx.lineWidth=this._pen.width;this.ctx.lineCap=this._pen.cap;this.ctx.lineJoin=this._pen.join;this.ctx.stroke();}}
  _stroke(){if(this._pen){this.ctx.strokeStyle=this._pen.color().css();this.ctx.lineWidth=this._pen.width;this.ctx.lineCap=this._pen.cap;this.ctx.lineJoin=this._pen.join;this.ctx.stroke();}}
  drawPath(path){this.ctx.beginPath();path.apply(this.ctx);this._paint();}
  drawLine(a,b){this.ctx.beginPath();this.ctx.moveTo(a.x(),a.y());this.ctx.lineTo(b.x(),b.y());this._stroke();}
  drawPolyline(poly){if(poly.length<1)return;this.ctx.beginPath();this.ctx.moveTo(poly[0].x(),poly[0].y());for(let i=1;i<poly.length;i++)this.ctx.lineTo(poly[i].x(),poly[i].y());this._stroke();}
  drawPolygon(poly){if(poly.length<1)return;this.ctx.beginPath();this.ctx.moveTo(poly[0].x(),poly[0].y());for(let i=1;i<poly.length;i++)this.ctx.lineTo(poly[i].x(),poly[i].y());this.ctx.closePath();this._paint();}
  drawEllipse(o,rx,ry){let cx,cy;if(o instanceof QPointF){cx=o.x();cy=o.y();}else{cx=o.left()+o.width()/2;cy=o.top()+o.height()/2;rx=Math.abs(o.width())/2;ry=Math.abs(o.height())/2;}
    if(rx<=0||ry<=0)return;this.ctx.beginPath();this.ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);this._paint();}
  drawRect(rect){this.ctx.beginPath();this.ctx.rect(rect.left(),rect.top(),rect.width(),rect.height());this._paint();}
  drawRoundedRect(rect,rx,ry){this.ctx.beginPath();let r=Math.min(rx,ry,Math.abs(rect.width())/2,Math.abs(rect.height())/2);this.ctx.roundRect(rect.left(),rect.top(),rect.width(),rect.height(),Math.max(0,r));this._paint();}
  drawArc(rect,start,span){const rx=Math.abs(rect.width())/2,ry=Math.abs(rect.height())/2;if(rx<1e-5||ry<1e-5||span===0)return;
    const a=-start/16*Math.PI/180,b=-(start+span)/16*Math.PI/180;this.ctx.beginPath();this.ctx.ellipse(rect.center().x(),rect.center().y(),rx,ry,0,a,b,span>0);this._stroke();}
  fillRect(rect,col){this.ctx.fillStyle=new QColor(col).css();this.ctx.fillRect(rect.left(),rect.top(),rect.width(),rect.height());}
  drawText(rect,alignOrText,text){if(!this._pen)return;let x,y,align;
    if(rect instanceof QPointF){x=rect.x();y=rect.y();align='left';text=alignOrText;}
    else {const flags=alignOrText;
      if(flags&Qt.AlignmentFlag.AlignRight){x=rect.right();align='right';}
      else if(flags&Qt.AlignmentFlag.AlignLeft){x=rect.left();align='left';}
      else{x=rect.center().x();align='center';}
      y=(flags&Qt.AlignmentFlag.AlignBottom)?rect.bottom()-2:rect.center().y();
    }
    const ctx=this.ctx;ctx.font=this._font.css();ctx.textAlign=align;ctx.textBaseline=rect instanceof QPointF?'alphabetic':'middle';ctx.fillStyle=this._pen.color().css();ctx.fillText(String(text),x,y);
  }
  end(){}
}
class KlausSkinStyle {constructor(skin_id,label,line='#F4F4F4',accent='#FF3B30',secondary='#777777',accessory='procedural',glow=false){Object.assign(this,{skin_id,label,line,accent,secondary,accessory,glow});}}
class KlausPose {constructor(){
  for(const key of 'tx ty rotation ear_left ear_right cheek_expand whisker_pulse mouth_bounce sparkle sleep laugh wave anger bored proud blink eye_dx eye_dy'.split(' '))this[key]=0;
  this.scale_x=1;this.scale_y=1;
}get eye_closed(){return this.blink;}}
let SKINS = {["default"]: new KlausSkinStyle("default", "ORIGINAL", undefined, undefined, undefined, "none"), ["neon"]: new KlausSkinStyle("neon", "NEON", "#F7F7FF", "#FF2DAA", "#31D7FF", "neon", true), ["professor"]: new KlausSkinStyle("professor", "PROFESSOR", "#F4F4F4", "#B8B8B8", "#FFFFFF", "professor"), ["nightlife"]: new KlausSkinStyle("nightlife", "NIGHT", "#F7F3FF", "#D946EF", "#22D3EE", "nightlife", true), ["winter"]: new KlausSkinStyle("winter", "WINTER", "#F6FBFF", "#7FB8FF", "#CFE6FF", "winter"), ["cyber"]: new KlausSkinStyle("cyber", "CYBER", "#E9FFE9", "#6CFF6C", "#19A974", "cyber", true), ["royal"]: new KlausSkinStyle("royal", "ROYAL", "#FFF3C4", "#FFD54A", "#177A4A", "procedural", true), ["fire"]: new KlausSkinStyle("fire", "FEUER", "#FFF3E8", "#FF643D", "#FFAA27", "fire", true)};
let _PROCEDURAL_SKINS = new Set(["metro", "graffiti", "skater", "courier", "night_rider", "glyph", "kernel", "crt", "datastream", "null", "redline", "circuit", "berliner", "bavarian", "bahn", "fussball", "alpen", "autobahn", "pilot", "doctor", "engineer", "chef", "detective", "mechanic", "jazz", "techno", "rockstar", "maestro", "vinyl", "noir", "ghost", "glitch", "chrome", "void", "eclipse", "samurai", "astronaut", "agent", "emperor", "analog", "prototype", "monolith", "ubahn_ghost", "fernsehturm"]);
let _sid;
for (_sid of _PROCEDURAL_SKINS) {
  _pysetdefault(SKINS, _sid, new KlausSkinStyle(_sid, _sid.replace("_", " ").toUpperCase(), "#F4F4F4", "#FF3B30", "#777777", "procedural"));
}
_pyupdate(SKINS, {["analog"]: new KlausSkinStyle("analog", "ANALOG", "#E8C85A", "#E8C85A", "#B9B1A0"), ["metro"]: new KlausSkinStyle("metro", "METRO 3_AM", "#F1EFE9", "#8B5A3C", "#4A403A"), ["crt"]: new KlausSkinStyle("crt", "CRT", "#4D9A5F", "#397A4A", "#285237"), ["berliner"]: new KlausSkinStyle("berliner", "OCTERFEST", "#F4F1E8", "#D7A93A", "#315D3A"), ["glyph"]: new KlausSkinStyle("glyph", "GLYPH", "#F4F4F4", "#FFFFFF", "#777777"), ["pilot"]: new KlausSkinStyle("pilot", "PILOT", "#F4F4F4", "#5D96DA", "#254D7C"), ["kernel"]: new KlausSkinStyle("kernel", "KERNEL", "#A8FFB0", "#5AD66F", "#214D2A", "procedural", true), ["skater"]: new KlausSkinStyle("skater", "SKATER", "#F4F4F4", "#8E55B8", "#5B356E"), ["vinyl"]: new KlausSkinStyle("vinyl", "VINYL", "#F4F4F4", "#C99C48", "#5F5041"), ["alpen"]: new KlausSkinStyle("alpen", "ALPEN", "#F4F4F4", "#B94D45", "#6E8DA0"), ["void"]: new KlausSkinStyle("void", "VOID", "#F5F0FA", "#9C28D7", "#551069", "procedural", true), ["monolith"]: new KlausSkinStyle("monolith", "MONOLITH", "#F6F0E5", "#FFE20A", "#79513F", "procedural", true), ["ghost"]: new KlausSkinStyle("ghost", "GHOST", "#EDEAF8", "#9D6BFF", "#5F4A85", "procedural", true), ["glitch"]: new KlausSkinStyle("glitch", "GLITCH", "#FFFFFF", "#FF3FA4", "#2DD7FF", "procedural", true), ["maestro"]: new KlausSkinStyle("maestro", "MAESTRO", "#F4F1E8", "#D7B55A", "#8B7A4D", "procedural", true), ["mechanic"]: new KlausSkinStyle("mechanic", "MECHANIC", "#F2F2F2", "#FF8A2A", "#6E7377", "procedural", true), ["noir"]: new KlausSkinStyle("noir", "NOIR", "#ECEBE8", "#C9B88A", "#46484B", "procedural", true), ["null"]: new KlausSkinStyle("null", "NULL", "#F4F4F4", "#FF334F", "#44474A", "procedural", true), ["rockstar"]: new KlausSkinStyle("rockstar", "ROCKSTAR", "#F6F2ED", "#FF2D55", "#8A5CFF", "procedural", true), ["ubahn_ghost"]: new KlausSkinStyle("ubahn_ghost", "U-BAHN GHOST", "#E8F1F7", "#91A8BC", "#566B7C", "procedural", true), ["astronaut"]: new KlausSkinStyle("astronaut", "ASTRONAUT", "#F7FBFF", "#6DA8FF", "#9D7CFF", "procedural", true), ["chrome"]: new KlausSkinStyle("chrome", "CHROME", "#F7F7F7", "#4285F4", "#EA4335", "procedural", true), ["eclipse"]: new KlausSkinStyle("eclipse", "ECLIPSE", "#FAF7ED", "#F28C28", "#73C7FF", "procedural", true), ["emperor"]: new KlausSkinStyle("emperor", "EMPEROR", "#F6E7BE", "#C79A3B", "#6B2B86", "procedural", true)});
function skin_style(skin_id) { // Python L173
  return _pyget(SKINS, (skin_id || "default").trim().toLowerCase(), SKINS["default"]);
}

function has_specific_visual(skin_id) { // Python L177
  return ((skin_style(skin_id).accessory !== "none"));
}

function skin_visual_mode(skin_id) { // Python L181
  let sid;
  sid = (skin_id || "default").trim().toLowerCase();
  return _pyget({["analog"]: "clock", ["crt"]: "phosphor_crt", ["glyph"]: "dot_klaus", ["graffiti"]: "spray_cloud", ["berliner"]: "octerfest", ["pilot"]: "fighter_pilot", ["monolith"]: "lightning_monoliths", ["void"]: "absorption_vortex", ["skater"]: "urban_skater", ["vinyl"]: "hifi_vinyl", ["alpen"]: "mountaineer"}, sid, "line_art");
}

function _periodic_blink(t) { // Python L235
  let cycle;
  cycle = _pymod(t, 4.9);
  if (((4.1 <= cycle) && (cycle <= 4.34))) {
    return math.sin((((cycle - 4.1) / 0.24) * math.pi));
  }
  return 0.0;
}

function compute_pose(state, t, animations_enabled = true) { // Python L242
  let bounce, jump, pose;
  state = (state || "idle").trim().toLowerCase();
  pose = new KlausPose();
  if (!(animations_enabled)) {
    if (((state === "sleeping"))) {
      pose.blink = 1.0;
      pose.sleep = 1.0;
    }
    else {
      if ((_pyin(state, new Set(["laughing", "celebrating"])))) {
        pose.laugh = 1.0;
      }
      else {
        if (((state === "waving"))) {
          pose.wave = 1.0;
        }
        else {
          if (((state === "angry"))) {
            pose.anger = 1.0;
          }
          else {
            if (((state === "bored"))) {
              pose.bored = 1.0;
            }
            else {
              if (((state === "proud"))) {
                pose.proud = 1.0;
              }
            }
          }
        }
      }
    }
    return pose;
  }
  pose.ty = (math.sin((t * 1.45)) * 0.45);
  pose.scale_y = (1.0 + (math.sin((t * 1.45)) * 0.0035));
  pose.blink = _periodic_blink(t);
  if (((state === "idle"))) {
    pose.eye_dx = (math.sin((t * 0.58)) * 0.35);
    pose.ear_right = ((max(0.0, math.sin(((t * 0.72) - 1.4))) ** 14) * 2.0);
  }
  else {
    if (((state === "happy"))) {
      pose.ty -= (abs(math.sin((t * 3.4))) * 1.4);
      pose.rotation = (math.sin((t * 1.8)) * 0.7);
      pose.cheek_expand = 1.8;
      pose.whisker_pulse = (abs(math.sin((t * 3.0))) * 1.5);
    }
    else {
      if (((state === "celebrating"))) {
        jump = abs(math.sin((t * 4.7)));
        pose.ty -= (jump * 4.0);
        pose.rotation = (math.sin((t * 4.2)) * 2.6);
        pose.sparkle = 1.0;
      }
      else {
        if (((state === "thinking"))) {
          pose.rotation = (_pyneg(2.8) + (math.sin((t * 1.15)) * 0.35));
          pose.eye_dx = 0.9;
          pose.eye_dy = _pyneg(0.7);
        }
        else {
          if (((state === "confused"))) {
            pose.tx = (math.sin((t * 8.5)) * 1.2);
            pose.rotation = (math.sin((t * 6.0)) * 0.8);
            [pose.ear_left, pose.ear_right] = [3.0, _pyneg(3.0)];
          }
          else {
            if (((state === "laughing"))) {
              bounce = abs(math.sin((t * 5.4)));
              pose.ty -= (bounce * 2.2);
              pose.rotation = (math.sin((t * 5.4)) * 1.0);
              pose.blink = 0.88;
              pose.laugh = 1.0;
            }
            else {
              if (((state === "motivating"))) {
                pose.rotation = (_pyneg(0.6) + (abs(math.sin((t * 2.8))) * 1.8));
              }
              else {
                if (((state === "waving"))) {
                  pose.wave = 1.0;
                  pose.rotation = (math.sin((t * 1.6)) * 0.45);
                }
                else {
                  if (((state === "angry"))) {
                    pose.anger = 1.0;
                    pose.tx = (math.sin((t * 11.0)) * 0.75);
                  }
                  else {
                    if (((state === "bored"))) {
                      pose.bored = 1.0;
                      pose.rotation = (_pyneg(1.0) + (math.sin((t * 0.7)) * 0.25));
                      pose.eye_dx = 1.1;
                    }
                    else {
                      if (((state === "proud"))) {
                        pose.proud = 1.0;
                        pose.rotation = _pyneg(0.8);
                        pose.sparkle = 0.45;
                      }
                      else {
                        if (((state === "sleeping"))) {
                          pose.rotation = 3.0;
                          pose.ty += (2.0 + (math.sin(t) * 0.6));
                          pose.blink = 1.0;
                          pose.sleep = 1.0;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return pose;
}

function _fit_signature_rect(target) { // Python L328
  let height, max_h, max_w, ratio, width;
  max_w = (target.width() * 0.85);
  max_h = (target.height() * 0.84);
  ratio = 1.2;
  width = max_w;
  height = (width / ratio);
  if (((height > max_h))) {
    height = max_h;
    width = (height * ratio);
  }
  return new QRectF((target.center().x() - (width / 2)), (target.center().y() - (height / 2)), width, height);
}

function _p(rect, x, y) { // Python L345
  return new QPointF((rect.left() + ((rect.width() * x) / 100.0)), (rect.top() + ((rect.height() * y) / 100.0)));
}

function _rect(rect, x1, y1, x2, y2) { // Python L352
  return new QRectF(_p(rect, x1, y1), _p(rect, x2, y2)).normalized();
}

function _rotate_point(x, y, pivot_x, pivot_y, degrees) { // Python L356
  let a, dx, dy;
  a = math.radians(degrees);
  [dx, dy] = [(x - pivot_x), (y - pivot_y)];
  return [((pivot_x + (dx * math.cos(a))) - (dy * math.sin(a))), ((pivot_y + (dx * math.sin(a))) + (dy * math.cos(a)))];
}

function _ear_points(rect, side, tilt) { // Python L365
  let degrees, mapped, pivot, pts, rx, ry, x, y;
  if (((side === "left"))) {
    [pts, pivot, degrees] = [[[20, 35], [31, 8], [42, 35]], [31, 35], tilt];
  }
  else {
    [pts, pivot, degrees] = [[[58, 35], [69, 8], [80, 35]], [69, 35], _pyneg(tilt)];
  }
  mapped = [];
  for ([x, y] of pts) {
    [rx, ry] = _rotate_point(x, y, pivot[0], pivot[1], degrees);
    mapped.push(_p(rect, rx, ry));
  }
  return new QPolygonF(mapped);
}

function _pen(color, width, alpha = 255, cap = Qt.PenCapStyle.RoundCap) { // Python L383
  let c, p;
  c = new QColor(color);
  c.setAlpha(alpha);
  p = new QPen(c, width);
  p.setCapStyle(cap);
  p.setJoinStyle(Qt.PenJoinStyle.RoundJoin);
  return p;
}

function paint_klaus(painter, target_rect, skin_id = "default", state = "idle", t = 0.0, animations_enabled = true, show_skin_tag = false) { // Python L397
  let center, font, glow, main_pen, pose, rect, stroke, style;
  style = skin_style(skin_id);
  pose = compute_pose(state, t, animations_enabled);
  if ((((style.skin_id === "berliner")) && animations_enabled)) {
    pose.rotation += (math.sin((t * 1.75)) * 2.0);
  }
  painter.save();
  painter.setRenderHint(QPainter.RenderHint.Antialiasing, true);
  rect = _fit_signature_rect(target_rect);
  center = rect.center();
  painter.translate(center);
  painter.translate(pose.tx, pose.ty);
  painter.rotate(pose.rotation);
  painter.scale(pose.scale_x, pose.scale_y);
  painter.translate(_pyneg(center));
  stroke = max(1.45, (rect.width() * 0.0105));
  main_pen = _pen(style.line, stroke);
  _paint_skin_background(painter, rect, style, (animations_enabled ? t : 0.0));
  if ((style.glow && ((!_pyin(style.skin_id, new Set(["eclipse", "samurai", "prototype", "void", "monolith"])))))) {
    glow = new QColor(style.accent);
    glow.setAlpha(65);
    _paint_signature_lines(painter, rect, pose, _pen(glow, (stroke * 3.0)), true);
  }
  if (((style.skin_id === "glyph"))) {
    _paint_dot_klaus(painter, rect, pose, new QColor(style.line), (animations_enabled ? t : 0.0));
  }
  else {
    if (((style.skin_id === "datastream"))) {
      _paint_pixel_klaus(painter, rect, pose, new QColor(style.line), (animations_enabled ? t : 0.0));
    }
    else {
      if (((style.skin_id === "glitch"))) {
        _paint_glitch_klaus(painter, rect, pose, (animations_enabled ? t : 0.0));
      }
      else {
        if (((style.skin_id === "astronaut"))) {
          _paint_astronaut_legendary(painter, rect, pose, (animations_enabled ? t : 0.0));
        }
        else {
          if (((style.skin_id === "chrome"))) {
            _paint_chrome_legendary(painter, rect, pose, (animations_enabled ? t : 0.0));
          }
          else {
            if (((style.skin_id === "eclipse"))) {
              _paint_eclipse_legendary(painter, rect, pose, (animations_enabled ? t : 0.0));
            }
            else {
              if (((style.skin_id === "emperor"))) {
                _paint_emperor_legendary(painter, rect, pose, (animations_enabled ? t : 0.0));
              }
              else {
                if (((style.skin_id === "samurai"))) {
                  _paint_samurai_body_no_ears(painter, rect, pose, main_pen);
                }
                else {
                  if (((style.skin_id === "prototype"))) {
                    _paint_prototype_legendary(painter, rect, pose, (animations_enabled ? t : 0.0));
                  }
                  else {
                    if (((style.skin_id === "monolith"))) {
                      _paint_monolith_mythic_body(painter, rect, pose, (animations_enabled ? t : 0.0));
                    }
                    else {
                      if (((style.skin_id === "void"))) {
                        _paint_void_mythic_body(painter, rect, pose, (animations_enabled ? t : 0.0));
                      }
                      else {
                        _paint_signature_lines(painter, rect, pose, main_pen, false);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  _paint_skin_accessory(painter, rect, style, pose, (animations_enabled ? t : 0.0));
  _paint_behavior_overlay(painter, rect, style, pose, t);
  if (((pose.sparkle > 0))) {
    _paint_celebration_sparks(painter, rect, new QColor(style.accent), new QColor(style.secondary), t);
  }
  if (((pose.sleep > 0))) {
    _paint_sleep_z(painter, rect, new QColor(style.secondary), t, stroke);
  }
  if ((((style.skin_id === "samurai")) && animations_enabled)) {
    _paint_samurai_slash_overlay(painter, rect, t);
  }
  if ((show_skin_tag && ((style.skin_id !== "default")))) {
    painter.resetTransform();
    painter.setPen(new QColor(style.accent));
    font = painter.font();
    font.setFamily("Courier New");
    font.setBold(true);
    font.setPointSize(max(7, font.pointSize()));
    painter.setFont(font);
    painter.drawText(target_rect.adjusted(8, 5, _pyneg(8), _pyneg(5)), (Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignBottom), `K//${style.label}`);
  }
  painter.restore();
}

function _paint_signature_lines(painter, rect, pose, pen, ghost) { // Python L576
  let blink, cheek, ear_pen, laugh, left_head, left_w, mark_y, pulse, right_head, right_w, rr, w;
  painter.setPen(pen);
  painter.setBrush(Qt.BrushStyle.NoBrush);
  ear_pen = new QPen(pen);
  ear_pen.setCapStyle(Qt.PenCapStyle.FlatCap);
  ear_pen.setJoinStyle(Qt.PenJoinStyle.MiterJoin);
  painter.setPen(ear_pen);
  painter.drawPolyline(_ear_points(rect, "left", pose.ear_left));
  painter.drawPolyline(_ear_points(rect, "right", pose.ear_right));
  painter.drawLine(_p(rect, 45.5, 35), _p(rect, 54.5, 35));
  painter.setPen(pen);
  cheek = pose.cheek_expand;
  left_head = new QPainterPath();
  left_head.moveTo(_p(rect, (15 - cheek), 41));
  left_head.quadTo(_p(rect, (4 - cheek), 55), _p(rect, (15 - cheek), 70));
  painter.drawPath(left_head);
  right_head = new QPainterPath();
  right_head.moveTo(_p(rect, (85 + cheek), 41));
  right_head.quadTo(_p(rect, (96 + cheek), 55), _p(rect, (85 + cheek), 70));
  painter.drawPath(right_head);
  blink = max(0.0, min(1.0, pose.blink));
  function eye(cx) { // Python L612
    let height, p, y;
    y = (49.0 + pose.eye_dy);
    if (((pose.anger > 0.5))) {
      if (((cx < 50))) {
        painter.drawLine(_p(rect, ((cx - 4) + pose.eye_dx), (y - 3)), _p(rect, ((cx + 4) + pose.eye_dx), (y + 1.5)));
      }
      else {
        painter.drawLine(_p(rect, ((cx - 4) + pose.eye_dx), (y + 1.5)), _p(rect, ((cx + 4) + pose.eye_dx), (y - 3)));
      }
      return undefined;
    }
    if (((blink >= 0.75))) {
      painter.drawLine(_p(rect, ((cx - 3.2) + pose.eye_dx), y), _p(rect, ((cx + 3.2) + pose.eye_dx), y));
      return undefined;
    }
    height = (6.0 * (1.0 - blink));
    p = new QPainterPath();
    p.moveTo(_p(rect, ((cx - 4) + pose.eye_dx), (y + 1.5)));
    p.lineTo(_p(rect, (cx + pose.eye_dx), (y - height)));
    p.lineTo(_p(rect, ((cx + 4) + pose.eye_dx), (y + 1.5)));
    painter.drawPath(p);
  }
  eye(36.5);
  eye(63.5);
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(pen.color());
  rr = max(1.55, (rect.width() * 0.008));
  painter.drawEllipse(_p(rect, 50, 62.5), rr, rr);
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.setPen(pen);
  pulse = pose.whisker_pulse;
  left_w = new QPainterPath();
  left_w.moveTo(_p(rect, (20 - pulse), 84));
  left_w.lineTo(_p(rect, (31 + (pulse * 0.25)), 91));
  left_w.lineTo(_p(rect, (20 - pulse), 98));
  painter.drawPath(left_w);
  right_w = new QPainterPath();
  right_w.moveTo(_p(rect, (80 + pulse), 84));
  right_w.lineTo(_p(rect, (69 - (pulse * 0.25)), 91));
  right_w.lineTo(_p(rect, (80 + pulse), 98));
  painter.drawPath(right_w);
  mark_y = pose.mouth_bounce;
  w = new QPainterPath();
  w.moveTo(_p(rect, 44, (85 - (mark_y * 0.25))));
  w.lineTo(_p(rect, 47, (100 + mark_y)));
  w.lineTo(_p(rect, 50, (90 - (mark_y * 0.3))));
  w.lineTo(_p(rect, 53, (100 + mark_y)));
  w.lineTo(_p(rect, 56, (85 - (mark_y * 0.25))));
  painter.drawPath(w);
  if ((((pose.laugh > 0.5)) && !(ghost))) {
    laugh = new QPainterPath();
    laugh.moveTo(_p(rect, 46, 99));
    laugh.quadTo(_p(rect, 50, 101), _p(rect, 54, 99));
    painter.drawPath(laugh);
  }
}

function _paint_glitch_klaus(painter, rect, pose, t) { // Python L689
  let active, cyan, cycle, pink, split, strength, thick, white;
  white = new QColor("#FFFFFF");
  pink = new QColor("#FF2E9A");
  cyan = new QColor("#24D9FF");
  thick = max(3.4, (rect.width() * 0.021));
  cycle = _pymod(t, 2.6);
  active = ((cycle < 0.62));
  if (active) {
    strength = (1.0 - (cycle / 0.62));
    painter.save();
    painter.translate((_pyneg(5.5) * strength), (1.2 * strength));
    _paint_signature_lines(painter, rect, pose, _pen(cyan, (thick * 0.92), int((130 + (strength * 120)))), false);
    painter.restore();
    painter.save();
    painter.translate((5.5 * strength), (_pyneg(1.2) * strength));
    _paint_signature_lines(painter, rect, pose, _pen(pink, (thick * 0.92), int((130 + (strength * 120)))), false);
    painter.restore();
    if (((cycle < 0.26))) {
      split = ((0.26 - cycle) / 0.26);
      painter.save();
      painter.setClipRect(new QRectF(rect.left(), (rect.top() + (rect.height() * 0.4)), rect.width(), (rect.height() * 0.18)));
      painter.translate((9.0 * split), 0);
      _paint_signature_lines(painter, rect, pose, _pen(white, thick, 255), false);
      painter.restore();
    }
  }
  _paint_signature_lines(painter, rect, pose, _pen(white, thick, 255), false);
}

function _paint_astronaut_legendary(painter, rect, pose, t) { // Python L787
  let blue, blue_hot, c, col, dark, i, q, refl, rim, rr, shell, silver, suit, suit_body, tw, v, visor, white;
  white = new QColor("#F4F8FB");
  silver = new QColor("#9AA8B3");
  blue = new QColor("#5D9BFF");
  blue_hot = new QColor("#B7D9FF");
  visor = new QColor("#07111D");
  suit = new QColor("#DDE5EA");
  dark = new QColor("#202A31");
  shell = new QPainterPath();
  shell.moveTo(_p(rect, 13, 48));
  shell.cubicTo(_p(rect, 14, 17), _p(rect, 31, 5), _p(rect, 50, 5));
  shell.cubicTo(_p(rect, 69, 5), _p(rect, 86, 17), _p(rect, 87, 48));
  shell.lineTo(_p(rect, 80, 69));
  shell.quadTo(_p(rect, 50, 80), _p(rect, 20, 69));
  shell.closeSubpath();
  painter.setPen(_pen(white, max(1.8, (rect.width() * 0.012)), 245));
  painter.setBrush(new QColor(56, 65, 72, 235));
  painter.drawPath(shell);
  rim = new QColor(blue);
  rim.setAlpha(150);
  painter.setPen(_pen(rim, max(1.0, (rect.width() * 0.006)), rim.alpha()));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawArc(_rect(rect, 13, 5, 87, 76), (5 * 16), (170 * 16));
  v = new QPainterPath();
  v.moveTo(_p(rect, 20, 27));
  v.quadTo(_p(rect, 50, 14), _p(rect, 80, 27));
  v.lineTo(_p(rect, 74, 58));
  v.quadTo(_p(rect, 50, 68), _p(rect, 26, 58));
  v.closeSubpath();
  painter.setPen(_pen(silver, max(1.2, (rect.width() * 0.007)), 220));
  painter.setBrush(visor);
  painter.drawPath(v);
  q = (0.5 + (0.5 * math.sin((t * 0.85))));
  refl = new QColor(blue_hot);
  refl.setAlpha(int((55 + (q * 80))));
  painter.setPen(_pen(refl, max(1.0, (rect.width() * 0.005)), refl.alpha()));
  painter.drawLine(_p(rect, (28 + (q * 10)), 30), _p(rect, (48 + (q * 10)), 41));
  painter.setPen(Qt.PenStyle.NoPen);
  for (i of range(5)) {
    tw = (0.5 + (0.5 * math.sin(((t * 1.5) + i))));
    c = new QColor("#FFFFFF");
    c.setAlpha(int((80 + (tw * 130))));
    painter.setBrush(c);
    rr = max(0.6, (rect.width() * 0.0025));
    painter.drawEllipse(_p(rect, (32 + (i * 8)), (47 - (_pymod(i, 2) * 5))), rr, rr);
  }
  suit_body = new QPainterPath();
  suit_body.moveTo(_p(rect, 27, 70));
  suit_body.lineTo(_p(rect, 36, 82));
  suit_body.lineTo(_p(rect, 39, 102));
  suit_body.lineTo(_p(rect, 61, 102));
  suit_body.lineTo(_p(rect, 64, 82));
  suit_body.lineTo(_p(rect, 73, 70));
  suit_body.closeSubpath();
  painter.setPen(_pen(white, max(1.2, (rect.width() * 0.007)), 225));
  painter.setBrush(new QColor(suit.red(), suit.green(), suit.blue(), 190));
  painter.drawPath(suit_body);
  painter.setPen(_pen(blue, max(1.0, (rect.width() * 0.005)), 190));
  painter.setBrush(dark);
  painter.drawRoundedRect(_rect(rect, 39, 79, 61, 91), 2, 2);
  for ([i, col] of enumerate(["#5D9BFF", "#8EF0C5", "#FFCF5A"])) {
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(new QColor(col));
    rr = max(0.7, (rect.width() * 0.003));
    painter.drawEllipse(_p(rect, (44 + (i * 6)), 84), rr, rr);
  }
  painter.setPen(_pen(silver, max(1.0, (rect.width() * 0.005)), 150));
  painter.setBrush(new QColor(31, 39, 45, 180));
  painter.drawRoundedRect(_rect(rect, 73, 69, 86, 91), 3, 3);
}

function _paint_chrome_legendary(painter, rect, pose, t) { // Python L901
  let accent_w, blue, centre, col, green, i, radius, red, rotation, white, yellow;
  blue = new QColor("#4285F4");
  red = new QColor("#EA4335");
  yellow = new QColor("#FBBC05");
  green = new QColor("#34A853");
  white = new QColor("#FFFFFF");
  _paint_signature_lines(painter, rect, pose, _pen(white, max(2.0, (rect.width() * 0.013)), 255), false);
  accent_w = max(1.2, (rect.width() * 0.0065));
  painter.setPen(_pen(blue, accent_w, 225));
  painter.drawLine(_p(rect, 28, 10), _p(rect, 34, 26));
  painter.setPen(_pen(red, accent_w, 225));
  painter.drawLine(_p(rect, 72, 10), _p(rect, 66, 26));
  painter.setPen(_pen(yellow, accent_w, 220));
  painter.drawLine(_p(rect, 20, 88), _p(rect, 30, 93));
  painter.setPen(_pen(green, accent_w, 220));
  painter.drawLine(_p(rect, 80, 88), _p(rect, 70, 93));
  centre = _p(rect, 50, 22);
  radius = (rect.width() * 0.035);
  rotation = _pymod((t * 28), 360);
  for ([i, col] of enumerate([blue, red, yellow, green])) {
    painter.setPen(_pen(col, max(1.2, (rect.width() * 0.0075)), 230));
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.drawArc(new QRectF((centre.x() - radius), (centre.y() - radius), (radius * 2), (radius * 2)), int(((rotation + (i * 90)) * 16)), (76 * 16));
  }
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor("#E8F0FE"));
  painter.drawEllipse(centre, (radius * 0.22), (radius * 0.22));
}

function _paint_eclipse_legendary(painter, rect, pose, t) { // Python L975
  let blink, lp, lunar, rp, rr, solar, thick, white;
  white = new QColor("#F7F7F5");
  solar = new QColor("#FFB84C");
  lunar = new QColor("#9FE9FF");
  thick = max(1.9, (rect.width() * 0.0105));
  function rotated_ear(side, tilt) { // Python L1001
    let degrees, mapped, pivot, pts, rx, ry, x, y;
    if (((side === "left"))) {
      pts = [[26, 43], [35, 14], [46, 43]];
      pivot = [35, 43];
      degrees = tilt;
    }
    else {
      pts = [[54, 43], [65, 14], [74, 43]];
      pivot = [65, 43];
      degrees = _pyneg(tilt);
    }
    mapped = [];
    for ([x, y] of pts) {
      [rx, ry] = _rotate_point(x, y, pivot[0], pivot[1], degrees);
      mapped.push(_p(rect, rx, ry));
    }
    return new QPolygonF(mapped);
  }
  painter.setPen(_pen(white, thick, 250));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawPolyline(rotated_ear("left", pose.ear_left));
  painter.drawPolyline(rotated_ear("right", pose.ear_right));
  painter.setPen(_pen(solar, max(0.8, (rect.width() * 0.0037)), 145));
  lp = rotated_ear("left", pose.ear_left);
  painter.drawLine(lp[0], lp[1]);
  painter.setPen(_pen(lunar, max(0.8, (rect.width() * 0.0037)), 145));
  rp = rotated_ear("right", pose.ear_right);
  painter.drawLine(rp[1], rp[2]);
  blink = max(0.0, min(1.0, pose.blink));
  painter.setPen(_pen(white, max(1.7, (rect.width() * 0.0085)), 250));
  function eye(cx) { // Python L1045
    let height, p, xoff, y;
    y = (57.0 + pose.eye_dy);
    xoff = pose.eye_dx;
    if (((pose.anger > 0.5))) {
      if (((cx < 50))) {
        painter.drawLine(_p(rect, ((cx - 4) + xoff), (y - 3)), _p(rect, ((cx + 4) + xoff), (y + 1.5)));
      }
      else {
        painter.drawLine(_p(rect, ((cx - 4) + xoff), (y + 1.5)), _p(rect, ((cx + 4) + xoff), (y - 3)));
      }
      return undefined;
    }
    if (((blink >= 0.75))) {
      painter.drawLine(_p(rect, ((cx - 3.2) + xoff), y), _p(rect, ((cx + 3.2) + xoff), y));
      return undefined;
    }
    height = (6.0 * (1.0 - blink));
    p = new QPainterPath();
    p.moveTo(_p(rect, ((cx - 4) + xoff), (y + 1.5)));
    p.lineTo(_p(rect, (cx + xoff), (y - height)));
    p.lineTo(_p(rect, ((cx + 4) + xoff), (y + 1.5)));
    painter.drawPath(p);
  }
  eye(38.0);
  eye(62.0);
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(white);
  rr = max(1.0, (rect.width() * 0.0045));
  painter.drawEllipse(_p(rect, (50 + (pose.eye_dx * 0.18)), (68.0 + (pose.eye_dy * 0.25))), rr, rr);
}

function _paint_emperor_legendary(painter, rect, pose, t) { // Python L1100
  let brow, crimson, gold, ivory, purple;
  ivory = new QColor("#F6E7BE");
  gold = new QColor("#C79A3B");
  purple = new QColor("#6B2B86");
  crimson = new QColor("#8A2635");
  _paint_signature_lines(painter, rect, pose, _pen(ivory, max(2.0, (rect.width() * 0.0135)), 255), false);
  brow = new QPainterPath();
  brow.moveTo(_p(rect, 31, 28));
  brow.lineTo(_p(rect, 38, 20));
  brow.lineTo(_p(rect, 50, 23));
  brow.lineTo(_p(rect, 62, 20));
  brow.lineTo(_p(rect, 69, 28));
  brow.closeSubpath();
  painter.setPen(_pen(gold, max(1.0, (rect.width() * 0.0055)), 220));
  painter.setBrush(new QColor(75, 58, 26, 195));
  painter.drawPath(brow);
  painter.setPen(_pen(gold, max(0.8, (rect.width() * 0.004)), 210));
  painter.setBrush(purple);
  painter.drawEllipse(_p(rect, 50, 25), (rect.width() * 0.018), (rect.height() * 0.024));
}

function _paint_samurai_body_no_ears(painter, rect, pose, pen) { // Python L1145
  let blink, cheek, left_head, left_w, mark_y, pulse, right_head, right_w, rr, w;
  painter.setPen(pen);
  painter.setBrush(Qt.BrushStyle.NoBrush);
  cheek = pose.cheek_expand;
  left_head = new QPainterPath();
  left_head.moveTo(_p(rect, (15 - cheek), 41));
  left_head.quadTo(_p(rect, (4 - cheek), 55), _p(rect, (15 - cheek), 70));
  painter.drawPath(left_head);
  right_head = new QPainterPath();
  right_head.moveTo(_p(rect, (85 + cheek), 41));
  right_head.quadTo(_p(rect, (96 + cheek), 55), _p(rect, (85 + cheek), 70));
  painter.drawPath(right_head);
  blink = max(0.0, min(1.0, pose.blink));
  function eye(cx) { // Python L1176
    let height, p, y;
    y = (49.0 + pose.eye_dy);
    if (((pose.anger > 0.5))) {
      if (((cx < 50))) {
        painter.drawLine(_p(rect, ((cx - 4) + pose.eye_dx), (y - 3)), _p(rect, ((cx + 4) + pose.eye_dx), (y + 1.5)));
      }
      else {
        painter.drawLine(_p(rect, ((cx - 4) + pose.eye_dx), (y + 1.5)), _p(rect, ((cx + 4) + pose.eye_dx), (y - 3)));
      }
      return undefined;
    }
    if (((blink >= 0.75))) {
      painter.drawLine(_p(rect, ((cx - 3.2) + pose.eye_dx), y), _p(rect, ((cx + 3.2) + pose.eye_dx), y));
      return undefined;
    }
    height = (6.0 * (1.0 - blink));
    p = new QPainterPath();
    p.moveTo(_p(rect, ((cx - 4) + pose.eye_dx), (y + 1.5)));
    p.lineTo(_p(rect, (cx + pose.eye_dx), (y - height)));
    p.lineTo(_p(rect, ((cx + 4) + pose.eye_dx), (y + 1.5)));
    painter.drawPath(p);
  }
  eye(36.5);
  eye(63.5);
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(pen.color());
  rr = max(1.55, (rect.width() * 0.008));
  painter.drawEllipse(_p(rect, 50, 62.5), rr, rr);
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.setPen(pen);
  pulse = pose.whisker_pulse;
  left_w = new QPainterPath();
  left_w.moveTo(_p(rect, (20 - pulse), 84));
  left_w.lineTo(_p(rect, (31 + (pulse * 0.25)), 91));
  left_w.lineTo(_p(rect, (20 - pulse), 98));
  painter.drawPath(left_w);
  right_w = new QPainterPath();
  right_w.moveTo(_p(rect, (80 + pulse), 84));
  right_w.lineTo(_p(rect, (69 - (pulse * 0.25)), 91));
  right_w.lineTo(_p(rect, (80 + pulse), 98));
  painter.drawPath(right_w);
  mark_y = pose.mouth_bounce;
  w = new QPainterPath();
  w.moveTo(_p(rect, 44, (85 - (mark_y * 0.25))));
  w.lineTo(_p(rect, 47, (100 + mark_y)));
  w.lineTo(_p(rect, 50, (90 - (mark_y * 0.3))));
  w.lineTo(_p(rect, 53, (100 + mark_y)));
  w.lineTo(_p(rect, 56, (85 - (mark_y * 0.25))));
  painter.drawPath(w);
}

function _paint_prototype_legendary(painter, rect, pose, t) { // Python L1243
  let accent, blink, center, l, left, pen, r, right, rr, soft, stroke, w, white;
  white = new QColor("#F5F3EE");
  accent = new QColor("#FF4A42");
  soft = new QColor("#8A8E92");
  painter.save();
  center = _p(rect, 50, 60);
  painter.translate(center);
  painter.scale(0.67, 0.67);
  painter.translate(_pyneg(center));
  stroke = max(1.8, (rect.width() * 0.0115));
  pen = _pen(white, stroke, 255);
  painter.setPen(pen);
  painter.setBrush(Qt.BrushStyle.NoBrush);
  left = new QPainterPath();
  left.moveTo(_p(rect, 25, 49));
  left.lineTo(_p(rect, 35, (26 + (pose.ear_left * 0.18))));
  left.lineTo(_p(rect, 45, 49));
  painter.drawPath(left);
  right = new QPainterPath();
  right.moveTo(_p(rect, 55, 49));
  right.lineTo(_p(rect, 65, (26 + (pose.ear_right * 0.18))));
  right.lineTo(_p(rect, 75, 49));
  painter.drawPath(right);
  painter.drawLine(_p(rect, 46, 45), _p(rect, 54, 45));
  l = new QPainterPath();
  l.moveTo(_p(rect, 24, 51));
  l.quadTo(_p(rect, 17, 60), _p(rect, 24, 69));
  painter.drawPath(l);
  r = new QPainterPath();
  r.moveTo(_p(rect, 76, 51));
  r.quadTo(_p(rect, 83, 60), _p(rect, 76, 69));
  painter.drawPath(r);
  blink = max(0.0, min(1.0, pose.blink));
  function eye(cx) { // Python L1300
    let h, p, y;
    y = (58 + (pose.eye_dy * 0.35));
    if (((blink > 0.72))) {
      painter.drawLine(_p(rect, (cx - 3), y), _p(rect, (cx + 3), y));
    }
    else {
      h = (4.5 * (1 - blink));
      p = new QPainterPath();
      p.moveTo(_p(rect, (cx - 4), (y + 1.5)));
      p.lineTo(_p(rect, cx, (y - h)));
      p.lineTo(_p(rect, (cx + 4), (y + 1.5)));
      painter.drawPath(p);
    }
  }
  eye(39);
  eye(61);
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(white);
  rr = max(1.1, (rect.width() * 0.0048));
  painter.drawEllipse(_p(rect, 50, 66), rr, rr);
  painter.setPen(pen);
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawLine(_p(rect, 28, 73), _p(rect, 37, 78));
  painter.drawLine(_p(rect, 37, 78), _p(rect, 28, 83));
  painter.drawLine(_p(rect, 72, 73), _p(rect, 63, 78));
  painter.drawLine(_p(rect, 63, 78), _p(rect, 72, 83));
  w = new QPainterPath();
  w.moveTo(_p(rect, 44, 76));
  w.lineTo(_p(rect, 47, 87));
  w.lineTo(_p(rect, 50, 80));
  w.lineTo(_p(rect, 53, 87));
  w.lineTo(_p(rect, 56, 76));
  painter.drawPath(w);
  painter.restore();
  painter.setPen(_pen(soft, max(0.7, (rect.width() * 0.0025)), 55));
  painter.drawLine(_p(rect, 50, 18), _p(rect, 50, 22));
  painter.drawLine(_p(rect, 48, 20), _p(rect, 52, 20));
  painter.setPen(_pen(accent, max(0.8, (rect.width() * 0.003)), 115));
  painter.drawLine(_p(rect, 78, 82), _p(rect, 86, 82));
}

function _paint_monolith_mythic_body(painter, rect, pose, t) { // Python L1351
  let amber, black, black_hi, blink, body, c, cracks, facet, gold, gold_hot, p, pt, pts, pulse, rr;
  black = new QColor("#030304");
  black_hi = new QColor("#0A0A0C");
  gold = new QColor("#E0B84D");
  gold_hot = new QColor("#FFF0A0");
  amber = new QColor("#F7C54A");
  body = new QPainterPath();
  body.moveTo(_p(rect, 15, 41));
  body.lineTo(_p(rect, 27, 11));
  body.lineTo(_p(rect, 39, 34));
  body.lineTo(_p(rect, 61, 34));
  body.lineTo(_p(rect, 73, 11));
  body.lineTo(_p(rect, 85, 41));
  body.cubicTo(_p(rect, 96, 48), _p(rect, 96, 65), _p(rect, 84, 72));
  body.lineTo(_p(rect, 78, 84));
  body.lineTo(_p(rect, 67, 91));
  body.lineTo(_p(rect, 58, 82));
  body.lineTo(_p(rect, 54, 100));
  body.lineTo(_p(rect, 50, 90));
  body.lineTo(_p(rect, 46, 100));
  body.lineTo(_p(rect, 42, 82));
  body.lineTo(_p(rect, 33, 91));
  body.lineTo(_p(rect, 22, 84));
  body.lineTo(_p(rect, 16, 72));
  body.cubicTo(_p(rect, 4, 65), _p(rect, 4, 48), _p(rect, 15, 41));
  body.closeSubpath();
  painter.setPen(_pen(new QColor("#1C1710"), max(0.9, (rect.width() * 0.003)), 150));
  painter.setBrush(black);
  painter.drawPath(body);
  facet = new QPainterPath();
  facet.moveTo(_p(rect, 26, 31));
  facet.lineTo(_p(rect, 50, 19));
  facet.lineTo(_p(rect, 74, 31));
  facet.lineTo(_p(rect, 67, 79));
  facet.lineTo(_p(rect, 50, 87));
  facet.lineTo(_p(rect, 33, 79));
  facet.closeSubpath();
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(black_hi);
  painter.drawPath(facet);
  blink = max(0.0, min(1.0, pose.blink));
  painter.setPen(_pen(gold_hot, max(1.7, (rect.width() * 0.0085)), 245));
  function eye(cx) { // Python L1423
    let h, p, x, y;
    y = (52 + pose.eye_dy);
    x = (cx + pose.eye_dx);
    if (((blink > 0.74))) {
      painter.drawLine(_p(rect, (x - 3.2), y), _p(rect, (x + 3.2), y));
    }
    else {
      h = (6 * (1 - blink));
      p = new QPainterPath();
      p.moveTo(_p(rect, (x - 4), (y + 1.5)));
      p.lineTo(_p(rect, x, (y - h)));
      p.lineTo(_p(rect, (x + 4), (y + 1.5)));
      painter.drawPath(p);
    }
  }
  eye(38);
  eye(62);
  cracks = [[[31, 66], [38, 62], [42, 67], [47, 63]], [[69, 66], [62, 62], [58, 67], [53, 63]], [[46, 78], [49, 73], [52, 79], [55, 75]]];
  pulse = (0.5 + (0.5 * math.sin((t * 1.45))));
  c = new QColor(amber);
  c.setAlpha(int((120 + (pulse * 100))));
  painter.setPen(_pen(c, max(0.8, (rect.width() * 0.0035)), c.alpha()));
  for (pts of cracks) {
    p = new QPainterPath();
    p.moveTo(_p(rect, ...pts[0]));
    for (pt of pts.slice(1)) {
      p.lineTo(_p(rect, ...pt));
    }
    painter.drawPath(p);
  }
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(gold_hot);
  rr = max(1.0, (rect.width() * 0.0048));
  painter.drawEllipse(_p(rect, 50, 64), rr, rr);
}

function _paint_void_mythic_body(painter, rect, pose, t) { // Python L1466
  let arc, black, blink, cyan, cyan_mid, dot, magenta, pulse, rr, violet, white;
  black = new QColor("#000000");
  white = new QColor("#F7FBFF");
  cyan = new QColor("#C8F8FF");
  cyan_mid = new QColor("#55DFFF");
  magenta = new QColor("#FF7CE7");
  violet = new QColor("#B76CFF");
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(black);
  painter.drawEllipse(_p(rect, 50, 55), (rect.width() * 0.335), (rect.height() * 0.285));
  function ear(side, twitch, base_color, lens_color) { // Python L1506
    let degrees, echo, mid_inner_x, mid_inner_y, mid_outer_x, mid_outer_y, p, pivot, pts, root_inner, root_outer, rx, ry, tc, tip, trail, x, y;
    if (((side < 0))) {
      root_outer = [27.0, 43.0];
      tip = [35.0, 19.0];
      root_inner = [45.0, 43.0];
      pivot = [35.0, 43.0];
      degrees = twitch;
    }
    else {
      root_outer = [55.0, 43.0];
      tip = [65.0, 19.0];
      root_inner = [73.0, 43.0];
      pivot = [65.0, 43.0];
      degrees = _pyneg(twitch);
    }
    pts = [];
    for ([x, y] of [root_outer, tip, root_inner]) {
      [rx, ry] = _rotate_point(x, y, pivot[0], pivot[1], degrees);
      pts.push([rx, ry]);
    }
    p = new QPainterPath();
    p.moveTo(_p(rect, ...pts[0]));
    mid_outer_x = (((pts[0][0] + pts[1][0]) / 2) + (side * _pyneg(1.8)));
    mid_outer_y = (((pts[0][1] + pts[1][1]) / 2) - 1.4);
    p.quadTo(_p(rect, mid_outer_x, mid_outer_y), _p(rect, ...pts[1]));
    mid_inner_x = (((pts[1][0] + pts[2][0]) / 2) + (side * 1.4));
    mid_inner_y = (((pts[1][1] + pts[2][1]) / 2) + 1.1);
    p.quadTo(_p(rect, mid_inner_x, mid_inner_y), _p(rect, ...pts[2]));
    painter.setPen(_pen(base_color, max(1.8, (rect.width() * 0.0095)), 245));
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.drawPath(p);
    painter.save();
    painter.translate((side * 1.5), 0);
    echo = new QColor(lens_color);
    echo.setAlpha(130);
    painter.setPen(_pen(echo, max(0.9, (rect.width() * 0.0042)), echo.alpha()));
    painter.drawPath(p);
    painter.restore();
    trail = new QPainterPath();
    trail.moveTo(_p(rect, pts[2][0], pts[2][1]));
    trail.quadTo(_p(rect, (pts[2][0] + (side * 5)), (pts[2][1] + 4)), _p(rect, (pts[2][0] + (side * 8)), (pts[2][1] + 1)));
    tc = new QColor(lens_color);
    tc.setAlpha(65);
    painter.setPen(_pen(tc, max(0.7, (rect.width() * 0.0027)), tc.alpha()));
    painter.drawPath(trail);
  }
  ear(_pyneg(1), pose.ear_left, white, cyan_mid);
  ear(+(1), pose.ear_right, white, magenta);
  blink = max(0.0, min(1.0, pose.blink));
  function warped_eye(cx, color) { // Python L1617
    let c, h, p, x, y;
    y = (55 + (pose.eye_dy * 0.4));
    x = (cx + (pose.eye_dx * 0.35));
    c = new QColor(color);
    c.setAlpha(220);
    painter.setPen(_pen(c, max(1.25, (rect.width() * 0.0062)), c.alpha()));
    if (((blink > 0.74))) {
      painter.drawLine(_p(rect, (x - 3.2), y), _p(rect, (x + 3.2), y));
    }
    else {
      h = (4.4 * (1 - blink));
      p = new QPainterPath();
      p.moveTo(_p(rect, (x - 3.5), (y + 1.1)));
      p.quadTo(_p(rect, x, ((y - h) - 1.3)), _p(rect, (x + 3.5), (y + 1.1)));
      painter.drawPath(p);
    }
  }
  warped_eye(41, cyan);
  warped_eye(59, magenta);
  painter.setPen(Qt.PenStyle.NoPen);
  dot = new QColor(white);
  dot.setAlpha(195);
  painter.setBrush(dot);
  rr = max(0.9, (rect.width() * 0.004));
  painter.drawEllipse(_p(rect, 50, 63.5), rr, rr);
  pulse = (0.5 + (0.5 * math.sin((t * 0.82))));
  arc = new QColor(violet);
  arc.setAlpha(int((35 + (pulse * 55))));
  painter.setPen(_pen(arc, max(0.7, (rect.width() * 0.0028)), arc.alpha()));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawArc(_rect(rect, 33, 21, 67, 46), (18 * 16), (144 * 16));
}

function _paint_dot_klaus(painter, rect, pose, color, t) { // Python L1694
  let breathe, counter, pts, rr, spacing, sweep;
  painter.save();
  painter.setPen(Qt.PenStyle.NoPen);
  spacing = 3.0;
  sweep = (((_pymod(t, 3.4) / 3.4) * 122.0) - 11.0);
  breathe = (0.5 + (0.5 * math.sin((t * 1.25))));
  counter = 0;
  function dot(x, y) { // Python L1711
    let alpha, anchor, c, dist, intensity, radius, rr;
    dist = abs((x - sweep));
    intensity = max(0.0, (1.0 - (dist / 8.5)));
    anchor = ((_pymod(counter, 19) === 0));
    alpha = int(((178 + (breathe * 22)) + (intensity * 55)));
    radius = (rect.width() * ((0.0056 + (intensity * 0.002)) + (anchor ? 0.0005 : 0.0)));
    c = new QColor((((intensity > 0.2)) ? "#FFFFFF" : "#E9E9E9"));
    c.setAlpha(min(255, alpha));
    painter.setBrush(c);
    rr = max(1.0, radius);
    painter.drawEllipse(_p(rect, x, y), rr, rr);
    counter += 1;
  }
  function path(points) { // Python L1729
    let count, d, i, q, x1, x2, y1, y2;
    for ([[x1, y1], [x2, y2]] of zip(points, points.slice(1))) {
      d = math.hypot((x2 - x1), (y2 - y1));
      count = max(1, int((d / spacing)));
      for (i of range((count + 1))) {
        q = (i / count);
        dot((x1 + ((x2 - x1) * q)), (y1 + ((y2 - y1) * q)));
      }
    }
  }
  for (pts of [[[20, 35], [31, 8], [42, 35]], [[58, 35], [69, 8], [80, 35]], [[45.5, 35], [54.5, 35]], [[15, 41], [10, 47], [8, 55], [10, 63], [15, 70]], [[85, 41], [90, 47], [92, 55], [90, 63], [85, 70]], [[32.5, 50.5], [36.5, 44], [40.5, 50.5]], [[59.5, 50.5], [63.5, 44], [67.5, 50.5]], [[20, 84], [31, 91], [20, 98]], [[80, 84], [69, 91], [80, 98]], [[44, 85], [47, 100], [50, 90], [53, 100], [56, 85]]]) {
    path(pts);
  }
  painter.setBrush(new QColor("#FFFFFF"));
  rr = max(1.2, (rect.width() * 0.007));
  painter.drawEllipse(_p(rect, 50, 62.5), rr, rr);
  painter.restore();
}

function _paint_pixel_klaus(painter, rect, pose, color, t) { // Python L1758
  let base, blue, c, counter, cyan, dot_size, i, p, phase, pixel, pts, q, s, scan_x, step, x, y;
  painter.save();
  painter.setPen(Qt.PenStyle.NoPen);
  base = new QColor("#E8F4F6");
  cyan = new QColor("#5FD7E5");
  blue = new QColor("#3D7CA7");
  pixel = max(1.4, (rect.width() * 0.01));
  step = 3.0;
  scan_x = (((_pymod(t, 3.0) / 3.0) * 116.0) - 8.0);
  counter = 0;
  function draw_px(x, y) { // Python L1785
    let c, dist, glow, size;
    dist = abs((x - scan_x));
    glow = max(0.0, (1.0 - (dist / 8.0)));
    c = new QColor((((glow > 0.15)) ? cyan : base));
    c.setAlpha(int((185 + (glow * 70))));
    size = (pixel * (1.0 + (glow * 0.28)));
    painter.setBrush(c);
    painter.drawRect(new QRectF((_p(rect, x, y).x() - (size / 2)), (_p(rect, x, y).y() - (size / 2)), size, size));
    counter += 1;
  }
  function pixel_path(points) { // Python L1807
    let count, d, i, q, x1, x2, y1, y2;
    for ([[x1, y1], [x2, y2]] of zip(points, points.slice(1))) {
      d = math.hypot((x2 - x1), (y2 - y1));
      count = max(1, int((d / step)));
      for (i of range((count + 1))) {
        q = (i / count);
        draw_px((x1 + ((x2 - x1) * q)), (y1 + ((y2 - y1) * q)));
      }
    }
  }
  for (pts of [[[20, 35], [31, 8], [42, 35]], [[58, 35], [69, 8], [80, 35]], [[45.5, 35], [54.5, 35]], [[15, 41], [10, 47], [8, 55], [10, 63], [15, 70]], [[85, 41], [90, 47], [92, 55], [90, 63], [85, 70]], [[32.5, 50.5], [36.5, 44], [40.5, 50.5]], [[59.5, 50.5], [63.5, 44], [67.5, 50.5]], [[20, 84], [31, 91], [20, 98]], [[80, 84], [69, 91], [80, 98]], [[44, 85], [47, 100], [50, 90], [53, 100], [56, 85]]]) {
    pixel_path(pts);
  }
  painter.setBrush(cyan);
  dot_size = max(2.0, (pixel * 1.2));
  p = _p(rect, 50, 62.5);
  painter.drawRect(new QRectF((p.x() - (dot_size / 2)), (p.y() - (dot_size / 2)), dot_size, dot_size));
  for (i of range(7)) {
    phase = _pymod(((t * 0.7) + (i * 0.17)), 1.0);
    x = (88 + (_pymod(i, 2) * 5));
    y = ((28 + (i * 9)) + (phase * 4));
    c = new QColor(blue);
    c.setAlpha(int((45 + ((1.0 - phase) * 80))));
    painter.setBrush(c);
    s = max(1.0, (pixel * 0.55));
    q = _p(rect, x, y);
    painter.drawRect(new QRectF((q.x() - (s / 2)), (q.y() - (s / 2)), s, s));
  }
  painter.restore();
}

let _BACKGROUND_SKINS = new Set(["fire", "cyber", "analog", "graffiti", "crt", "alpen", "doctor", "fussball", "kernel", "night_rider", "nightlife", "agent", "winter", "ghost", "glitch", "maestro", "mechanic", "noir", "null", "rockstar", "astronaut", "chrome", "eclipse", "emperor", "royal", "samurai", "fernsehturm", "void", "monolith", "ubahn_ghost", "night_rider", "autobahn"]);
function _paint_skin_background(painter, rect, style, t) { // Python L1874
  let sid;
  sid = style.skin_id;
  if (((!_pyin(sid, _BACKGROUND_SKINS)))) {
    return undefined;
  }
  painter.save();
  painter.setRenderHint(QPainter.RenderHint.Antialiasing, true);
  if (((sid === "fire"))) {
    _bg_fire(painter, rect, t);
  }
  else {
    if (((sid === "cyber"))) {
      _bg_cyber(painter, rect, t);
    }
    else {
      if (((sid === "analog"))) {
        _bg_analog(painter, rect, t);
      }
      else {
        if (((sid === "graffiti"))) {
          _bg_graffiti(painter, rect, t);
        }
        else {
          if (((sid === "crt"))) {
            _bg_crt(painter, rect, t);
          }
          else {
            if (((sid === "alpen"))) {
              _bg_alpen(painter, rect, t);
            }
            else {
              if (((sid === "doctor"))) {
                _bg_doctor(painter, rect, t);
              }
              else {
                if (((sid === "fussball"))) {
                  _bg_fussball(painter, rect, t);
                }
                else {
                  if (((sid === "kernel"))) {
                    _bg_kernel(painter, rect, t);
                  }
                  else {
                    if (((sid === "night_rider"))) {
                      _bg_night_rider(painter, rect, t);
                    }
                    else {
                      if (((sid === "nightlife"))) {
                        _bg_nightlife(painter, rect, t);
                      }
                      else {
                        if (((sid === "agent"))) {
                          _bg_agent(painter, rect, t);
                        }
                        else {
                          if (((sid === "winter"))) {
                            _bg_winter(painter, rect, t);
                          }
                          else {
                            if (((sid === "ghost"))) {
                              _bg_ghost(painter, rect, t);
                            }
                            else {
                              if (((sid === "glitch"))) {
                                _bg_glitch(painter, rect, t);
                              }
                              else {
                                if (((sid === "maestro"))) {
                                  _bg_maestro(painter, rect, t);
                                }
                                else {
                                  if (((sid === "mechanic"))) {
                                    _bg_mechanic(painter, rect, t);
                                  }
                                  else {
                                    if (((sid === "noir"))) {
                                      _bg_noir(painter, rect, t);
                                    }
                                    else {
                                      if (((sid === "null"))) {
                                        _bg_null(painter, rect, t);
                                      }
                                      else {
                                        if (((sid === "rockstar"))) {
                                          _bg_rockstar(painter, rect, t);
                                        }
                                        else {
                                          if (((sid === "astronaut"))) {
                                            _bg_astronaut(painter, rect, t);
                                          }
                                          else {
                                            if (((sid === "chrome"))) {
                                              _bg_chrome(painter, rect, t);
                                            }
                                            else {
                                              if (((sid === "eclipse"))) {
                                                _bg_eclipse(painter, rect, t);
                                              }
                                              else {
                                                if (((sid === "emperor"))) {
                                                  _bg_emperor(painter, rect, t);
                                                }
                                                else {
                                                  if (((sid === "royal"))) {
                                                    _bg_royal(painter, rect, t);
                                                  }
                                                  else {
                                                    if (((sid === "samurai"))) {
                                                      _bg_samurai(painter, rect, t);
                                                    }
                                                    else {
                                                      if (((sid === "fernsehturm"))) {
                                                        _bg_fernsehturm(painter, rect, t);
                                                      }
                                                      else {
                                                        if (((sid === "void"))) {
                                                          _bg_void(painter, rect, t);
                                                        }
                                                        else {
                                                          if (((sid === "monolith"))) {
                                                            _bg_monolith(painter, rect, t);
                                                          }
                                                          else {
                                                            if (((sid === "ubahn_ghost"))) {
                                                              _bg_ubahn_ghost(painter, rect, t);
                                                            }
                                                            else {
                                                              if (((sid === "autobahn"))) {
                                                                _bg_autobahn(painter, rect, t);
                                                              }
                                                            }
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  painter.restore();
}

function _bg_fire(painter, rect, t) { // Python L1953
  let c, h, i, p, phase, sway, x;
  painter.setPen(Qt.PenStyle.NoPen);
  for (i of range(10)) {
    x = (6 + (i * 9.8));
    phase = ((t * (2.2 + (_pymod(i, 3) * 0.2))) + i);
    sway = (math.sin(phase) * 3);
    h = (30 + (_pymod(i, 4) * 8));
    p = new QPainterPath();
    p.moveTo(_p(rect, (x - 5), 104));
    p.cubicTo(_p(rect, (x - 8), 88), _p(rect, ((x - 3) + sway), (104 - (h * 0.72))), _p(rect, (x + sway), (104 - h)));
    p.cubicTo(_p(rect, ((x + 4) + sway), (104 - (h * 0.65))), _p(rect, (x + 8), 88), _p(rect, (x + 5), 104));
    p.closeSubpath();
    c = new QColor((_pymod(i, 2) ? "#FF4A24" : "#FF8A1F"));
    c.setAlpha(110);
    painter.setBrush(c);
    painter.drawPath(p);
  }
}

function _bg_cyber(painter, rect, t) { // Python L1982
  let c, col, font, glyphs, offset, row, wash, x, y;
  wash = new QColor("#031408");
  wash.setAlpha(105);
  painter.setBrush(wash);
  painter.setPen(Qt.PenStyle.NoPen);
  painter.drawRoundedRect(rect.adjusted(_pyneg(4), _pyneg(2), 4, 2), 7, 7);
  font = painter.font();
  font.setFamily("Courier New");
  font.setBold(true);
  font.setPointSize(max(5, int((rect.height() * 0.042))));
  painter.setFont(font);
  glyphs = "010101100110010101011001";
  for (col of range(12)) {
    x = (4 + (col * (92 / 11)));
    offset = _pymod(((t * (8 + (_pymod(col, 4) * 2.2))) + (col * 13.7)), 120);
    for (row of range(7)) {
      y = (_pymod((((_pyneg(10) + (row * 17)) + offset) + 15), 125) - 10);
      c = new QColor((((row >= 5)) ? "#62FF78" : "#1DB954"));
      c.setAlpha((35 + (row * 18)));
      painter.setPen(c);
      painter.drawText(_p(rect, x, y), glyphs[_pymod(((col * 7) + (row * 3)), len(glyphs))]);
    }
  }
}

function _bg_analog(painter, rect, t) { // Python L2007
  let a, cx, cy, dim, f, gold, i, label, major, numeral_radius, progress, r1, r2, radius, roman, shift, start, white, x, y;
  white = new QColor("#F4F0E5");
  dim = new QColor("#918B80");
  gold = new QColor("#E8C85A");
  [cx, cy] = [50.0, 54.0];
  radius = 51.5;
  numeral_radius = 46.0;
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.setPen(_pen(white, max(1.0, (rect.width() * 0.0055)), 110));
  painter.drawEllipse(_rect(rect, (cx - radius), (cy - radius), (cx + radius), (cy + radius)));
  for (i of range(60)) {
    a = math.radians((_pyneg(90) + (i * 6)));
    major = ((_pymod(i, 5) === 0));
    r1 = (radius - (major ? 5.0 : 2.6));
    r2 = (radius - 0.8);
    painter.setPen(_pen((major ? white : dim), max(1.0, (rect.width() * (major ? 0.0045 : 0.0023))), (major ? 135 : 45)));
    painter.drawLine(_p(rect, (cx + (math.cos(a) * r1)), (cy + (math.sin(a) * r1))), _p(rect, (cx + (math.cos(a) * r2)), (cy + (math.sin(a) * r2))));
  }
  roman = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
  f = painter.font();
  f.setFamily("Times New Roman");
  f.setBold(true);
  f.setPointSize(max(6, int((rect.height() * 0.048))));
  painter.setFont(f);
  for ([i, label] of enumerate(roman)) {
    a = math.radians((_pyneg(90) + (i * 30)));
    x = (cx + (math.cos(a) * numeral_radius));
    y = (cy + (math.sin(a) * numeral_radius));
    painter.setPen(new QColor("#F4F0E5"));
    painter.drawText(_rect(rect, (x - 7), (y - 4), (x + 7), (y + 4)), Qt.AlignmentFlag.AlignCenter, label);
  }
  progress = (_pymod(t, 4.2) / 4.2);
  start = (_pyneg(90) - (progress * 360));
  painter.setPen(_pen(gold, max(1.3, (rect.width() * 0.011)), 240));
  painter.drawArc(_rect(rect, (cx - radius), (cy - radius), (cx + radius), (cy + radius)), int((start * 16)), int((_pyneg(34) * 16)));
  for ([i, y] of enumerate([12, 19, 28, 80, 89, 96])) {
    shift = (math.sin(((t * 1.5) + (i * 1.7))) * 4);
    painter.setPen(_pen((((_pymod(i, 2) === 0)) ? gold : white), max(1.0, (rect.width() * 0.0035)), 55));
    painter.drawLine(_p(rect, (0 + shift), y), _p(rect, (19 + shift), y));
    painter.drawLine(_p(rect, (81 - shift), y), _p(rect, (100 - shift), y));
  }
}

function _bg_graffiti(painter, rect, t) { // Python L2077
  let a, blobs, bright, c, dark, dx, face, i, mid, rr, rx, ry, x, y;
  dark = new QColor("#2B1033");
  mid = new QColor("#682878");
  bright = new QColor("#AF4DC3");
  blobs = [[10, 37, 14, 12], [19, 24, 16, 14], [31, 15, 16, 12], [69, 15, 16, 12], [81, 24, 16, 14], [90, 39, 14, 12], [87, 68, 15, 13], [73, 83, 17, 12], [27, 83, 17, 12], [13, 68, 15, 13]];
  painter.setPen(Qt.PenStyle.NoPen);
  for ([i, [x, y, rx, ry]] of enumerate(blobs)) {
    dx = (math.sin(((t * 0.42) + (i * 0.8))) * 0.8);
    c = new QColor((_pymod(i, 2) ? mid : dark));
    c.setAlpha((_pymod(i, 2) ? 82 : 95));
    painter.setBrush(c);
    painter.drawEllipse(_p(rect, (x + dx), y), ((rect.width() * rx) / 100), ((rect.height() * ry) / 100));
  }
  for (i of range(14)) {
    a = (((i * math.tau) / 14) + (t * 0.08));
    x = (50 + (math.cos(a) * 48));
    y = (54 + (math.sin(a) * 39));
    c = new QColor(bright);
    c.setAlpha((35 + (_pymod(i, 3) * 18)));
    painter.setBrush(c);
    rr = max(0.7, (rect.width() * 0.004));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
  }
  face = new QPainterPath();
  face.moveTo(_p(rect, 18, 38));
  face.cubicTo(_p(rect, 7, 48), _p(rect, 8, 64), _p(rect, 18, 72));
  face.quadTo(_p(rect, 50, 82), _p(rect, 82, 72));
  face.cubicTo(_p(rect, 92, 64), _p(rect, 93, 48), _p(rect, 82, 38));
  face.lineTo(_p(rect, 70, 34));
  face.lineTo(_p(rect, 30, 34));
  face.closeSubpath();
  painter.setBrush(new QColor("#101112"));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.drawPath(face);
}

function _bg_crt(painter, rect, t) { // Python L2124
  let wash, y;
  wash = new QColor("#07140A");
  wash.setAlpha(100);
  painter.setBrush(wash);
  painter.setPen(Qt.PenStyle.NoPen);
  painter.drawRoundedRect(rect, 4, 4);
  for (y of range(8, 101, 5)) {
    painter.setPen(_pen("#397A4A", max(1.0, (rect.width() * 0.0025)), 38));
    painter.drawLine(_p(rect, 4, y), _p(rect, 96, y));
  }
}

function _bg_alpen(painter, rect, t) { // Python L2138
  let face, face_fill, left_big, left_snow, mountain_far, mountain_mid, right_big, right_snow, small_left, small_right, snow, snow_dim;
  mountain_far = new QColor("#2B3237");
  mountain_mid = new QColor("#4B565D");
  snow = new QColor("#EAF1F5");
  snow_dim = new QColor("#BFCBD1");
  face_fill = new QColor("#101112");
  painter.setBrush(Qt.BrushStyle.NoBrush);
  left_big = new QPainterPath();
  left_big.moveTo(_p(rect, _pyneg(18), 76));
  left_big.lineTo(_p(rect, 1, 47));
  left_big.lineTo(_p(rect, 19, 73));
  painter.setPen(_pen(mountain_far, max(1.0, (rect.width() * 0.007)), 155));
  painter.drawPath(left_big);
  left_snow = new QPainterPath();
  left_snow.moveTo(_p(rect, _pyneg(4), 55));
  left_snow.lineTo(_p(rect, 1, 47));
  left_snow.lineTo(_p(rect, 7, 56));
  left_snow.lineTo(_p(rect, 3, 53));
  left_snow.lineTo(_p(rect, 0, 57));
  painter.setPen(_pen(snow, max(1.0, (rect.width() * 0.0045)), 165));
  painter.drawPath(left_snow);
  right_big = new QPainterPath();
  right_big.moveTo(_p(rect, 81, 73));
  right_big.lineTo(_p(rect, 99, 46));
  right_big.lineTo(_p(rect, 118, 76));
  painter.setPen(_pen(mountain_far, max(1.0, (rect.width() * 0.007)), 155));
  painter.drawPath(right_big);
  right_snow = new QPainterPath();
  right_snow.moveTo(_p(rect, 93, 55));
  right_snow.lineTo(_p(rect, 99, 46));
  right_snow.lineTo(_p(rect, 105, 56));
  right_snow.lineTo(_p(rect, 101, 53));
  right_snow.lineTo(_p(rect, 98, 57));
  painter.setPen(_pen(snow, max(1.0, (rect.width() * 0.0045)), 165));
  painter.drawPath(right_snow);
  small_left = new QPainterPath();
  small_left.moveTo(_p(rect, 8, 29));
  small_left.lineTo(_p(rect, 14, 21));
  small_left.lineTo(_p(rect, 20, 29));
  painter.setPen(_pen(mountain_mid, max(1.0, (rect.width() * 0.0035)), 75));
  painter.drawPath(small_left);
  small_right = new QPainterPath();
  small_right.moveTo(_p(rect, 80, 29));
  small_right.lineTo(_p(rect, 86, 21));
  small_right.lineTo(_p(rect, 92, 29));
  painter.setPen(_pen(mountain_mid, max(1.0, (rect.width() * 0.0035)), 75));
  painter.drawPath(small_right);
  painter.setPen(_pen(snow_dim, max(1.0, (rect.width() * 0.0028)), 90));
  painter.drawLine(_p(rect, 12, 24), _p(rect, 14, 21));
  painter.drawLine(_p(rect, 14, 21), _p(rect, 16, 24));
  painter.drawLine(_p(rect, 84, 24), _p(rect, 86, 21));
  painter.drawLine(_p(rect, 86, 21), _p(rect, 88, 24));
  face = new QPainterPath();
  face.moveTo(_p(rect, 16, 39));
  face.cubicTo(_p(rect, 7, 47), _p(rect, 7, 63), _p(rect, 17, 72));
  face.quadTo(_p(rect, 50, 82), _p(rect, 83, 72));
  face.cubicTo(_p(rect, 93, 63), _p(rect, 93, 47), _p(rect, 84, 39));
  face.lineTo(_p(rect, 72, 35));
  face.lineTo(_p(rect, 28, 35));
  face.closeSubpath();
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(face_fill);
  painter.drawPath(face);
}

function _bg_doctor(painter, rect, t) { // Python L2246
  let c, crosses, dark_red, i, pulse, red, scale, size, width, x, y;
  red = new QColor("#D94242");
  dark_red = new QColor("#6E2424");
  crosses = [[7, 18, 0.8], [90, 17, 1.1], [6, 45, 0.9], [93, 48, 0.7], [10, 78, 1.0], [89, 82, 0.85], [24, 5, 0.6], [77, 6, 0.7]];
  for ([i, [x, y, scale]] of enumerate(crosses)) {
    pulse = (0.5 + (0.5 * math.sin(((t * 0.9) + (i * 0.75)))));
    c = new QColor((((_pymod(i, 2) === 0)) ? red : dark_red));
    c.setAlpha(int((34 + (pulse * 44))));
    width = max(1.0, ((rect.width() * 0.0045) * scale));
    painter.setPen(_pen(c, width, c.alpha()));
    size = (3.2 * scale);
    painter.drawLine(_p(rect, (x - size), y), _p(rect, (x + size), y));
    painter.drawLine(_p(rect, x, (y - size)), _p(rect, x, (y + size)));
  }
}

function _bg_fussball(painter, rect, t) { // Python L2278
  let red, yellow;
  red = new QColor("#C61F2D");
  yellow = new QColor("#F1C84A");
  painter.setPen(_pen(red, max(1.0, (rect.width() * 0.006)), 55));
  painter.drawLine(_p(rect, _pyneg(1), 14), _p(rect, 12, 7));
  painter.drawLine(_p(rect, 88, 99), _p(rect, 101, 92));
  painter.setPen(_pen(yellow, max(1.0, (rect.width() * 0.0028)), 60));
  painter.drawLine(_p(rect, 1, 16), _p(rect, 14, 9));
  painter.drawLine(_p(rect, 86, 97), _p(rect, 99, 90));
}

function _bg_kernel(painter, rect, t) { // Python L2294
  let c, col, dim, f, green, offset, row, side, strings, x, xs, y;
  green = new QColor("#5AD66F");
  dim = new QColor("#194D24");
  f = painter.font();
  f.setFamily("Courier New");
  f.setBold(true);
  f.setPointSize(max(4, int((rect.height() * 0.026))));
  painter.setFont(f);
  strings = ["sudo", "root", "/dev", "tty", "0x", "proc"];
  for ([side, xs] of [["left", [1, 8, 15]], ["right", [83, 90, 97]]]) {
    for ([col, x] of enumerate(xs)) {
      offset = _pymod(((t * (5 + col)) + (col * 11)), 100);
      for (row of range(5)) {
        y = (_pymod((((row * 22) + offset) + 10), 105) - 5);
        c = new QColor((((row >= 3)) ? green : dim));
        c.setAlpha((28 + (row * 18)));
        painter.setPen(c);
        painter.drawText(_p(rect, x, y), strings[_pymod((col + row), len(strings))]);
      }
    }
  }
}

function _bg_night_rider(painter, rect, t) { // Python L2325
  let angle, c, cx, cy, end_r, i, length, phase, red, start_r, white, x1, x2, y1, y2;
  white = new QColor("#D2D5D7");
  red = new QColor("#8E1E25");
  [cx, cy] = [50.0, 56.0];
  for (i of range(12)) {
    angle = (((i * math.tau) / 12) + (math.sin(((t * 0.3) + i)) * 0.035));
    phase = _pymod(((t * 1.35) + (i * 0.19)), 1.0);
    start_r = (45 + (phase * 12));
    length = (7 + ((1.0 - phase) * 12));
    end_r = (start_r + length);
    x1 = (cx + (math.cos(angle) * start_r));
    y1 = (cy + ((math.sin(angle) * start_r) * 0.82));
    x2 = (cx + (math.cos(angle) * end_r));
    y2 = (cy + ((math.sin(angle) * end_r) * 0.82));
    if ((((18 < x1) && (x1 < 82)) && ((26 < y1) && (y1 < 93)))) {
      continue;
    }
    c = new QColor((((_pymod(i, 4) === 0)) ? red : white));
    c.setAlpha(int((38 + ((1.0 - phase) * 65))));
    painter.setPen(_pen(c, max(1.0, (rect.width() * 0.0045)), c.alpha()));
    painter.drawLine(_p(rect, x1, y1), _p(rect, x2, y2));
  }
}

function _bg_nightlife(painter, rect, t) { // Python L2387
  let beams, c, colour, cyan, i, lights, magenta, pulse, rr, sway, violet, white, x, x1, x2, y, y1, y2;
  magenta = new QColor("#E536FF");
  cyan = new QColor("#38D9FF");
  violet = new QColor("#8C3BFF");
  white = new QColor("#F4F4F4");
  beams = [[_pyneg(8), _pyneg(2), 28, 68, magenta], [18, _pyneg(4), 42, 70, violet], [82, _pyneg(4), 58, 70, cyan], [108, _pyneg(2), 72, 68, magenta]];
  for ([i, [x1, y1, x2, y2, colour]] of enumerate(beams)) {
    sway = (math.sin(((t * 0.75) + (i * 1.35))) * 7.0);
    c = new QColor(colour);
    c.setAlpha((42 + (i * 7)));
    painter.setPen(_pen(c, max(1.0, (rect.width() * 0.012)), c.alpha()));
    painter.drawLine(_p(rect, (x1 + sway), y1), _p(rect, (x2 - (sway * 0.25)), y2));
  }
  lights = [[7, 24, magenta], [93, 26, cyan], [4, 70, violet], [96, 74, magenta], [17, 9, cyan], [83, 8, white]];
  for ([i, [x, y, colour]] of enumerate(lights)) {
    pulse = (0.5 + (0.5 * math.sin(((t * 2.3) + i))));
    c = new QColor(colour);
    c.setAlpha(int((70 + (pulse * 110))));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(1.0, (rect.width() * (0.0045 + (pulse * 0.0015))));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
  }
}

function _bg_agent(painter, rect, t) { // Python L2454
  let _, base_alpha, box, c, f, f2, global_pulse, glow_alpha, glow_font, gold, grey, halo, i, old_font, pale_gold, phase_offset, positions, strength, text_color, wave, white, x, y;
  grey = new QColor("#575A5E");
  white = new QColor("#F1F1F1");
  gold = new QColor("#C8A45D");
  pale_gold = new QColor("#F5DF9A");
  f = painter.font();
  f.setFamily("Arial");
  f.setBold(true);
  f.setPointSize(max(5, int((rect.height() * 0.032))));
  painter.setFont(f);
  positions = [[2, 12, 0.0], [34, 6, 0.8], [69, 12, 1.6], [7, 36, 2.2], [78, 37, 2.8], [4, 67, 3.3], [81, 67, 4.0], [18, 94, 4.7], [66, 95, 5.2]];
  for ([i, [x, y, phase_offset]] of enumerate(positions)) {
    wave = (0.5 + (0.5 * math.sin(((t * 1.25) + phase_offset))));
    base_alpha = (28 + (_pymod(i, 3) * 10));
    glow_alpha = int((base_alpha + (wave * 82)));
    text_color = new QColor((((_pymod(i, 3) === 0)) ? gold : grey));
    text_color.setAlpha(min(145, glow_alpha));
    box = _rect(rect, x, y, (x + 22), (y + 9));
    halo = new QColor((((_pymod(i, 3) === 0)) ? pale_gold : white));
    halo.setAlpha(int((8 + (wave * 28))));
    old_font = painter.font();
    glow_font = painter.font();
    glow_font.setPointSize(max(5, int((rect.height() * (0.034 + (wave * 0.003))))));
    painter.setFont(glow_font);
    painter.setPen(halo);
    painter.drawText(box.adjusted(_pyneg(1), _pyneg(1), 1, 1), Qt.AlignmentFlag.AlignCenter, "007");
    painter.setFont(old_font);
    painter.setPen(text_color);
    painter.drawText(box, Qt.AlignmentFlag.AlignCenter, "007");
  }
  global_pulse = (0.5 + (0.5 * math.sin((t * 0.55))));
  if (((global_pulse > 0.78))) {
    strength = ((global_pulse - 0.78) / 0.22);
    f2 = painter.font();
    f2.setFamily("Arial");
    f2.setBold(true);
    f2.setPointSize(max(6, int((rect.height() * 0.036))));
    painter.setFont(f2);
    c = new QColor("#F4E3A6");
    c.setAlpha(int((12 + (strength * 42))));
    painter.setPen(c);
    for ([x, y, _] of positions) {
      painter.drawText(_rect(rect, (x - 1), (y - 1), (x + 23), (y + 10)), Qt.AlignmentFlag.AlignCenter, "007");
    }
  }
}

function _bg_winter(painter, rect, t) { // Python L2602
  let c, drift, flakes, i, rr, size, snow, snow_blue, speed, x, y, y0;
  snow = new QColor("#EAF4FF");
  snow_blue = new QColor("#9FC5E8");
  flakes = [[5, 8, 0.7, 1.0], [14, 26, 0.45, 0.8], [24, 3, 0.62, 0.7], [36, 18, 0.52, 0.9], [47, 1, 0.76, 0.6], [60, 12, 0.48, 0.8], [72, 4, 0.65, 0.7], [84, 20, 0.55, 0.9], [95, 6, 0.72, 0.7], [9, 58, 0.6, 0.8], [91, 62, 0.5, 0.9], [3, 83, 0.68, 0.6], [97, 87, 0.58, 0.7]];
  for ([i, [x, y0, speed, size]] of enumerate(flakes)) {
    y = (_pymod(((y0 + ((t * 14) * speed)) + (i * 3.5)), 108) - 4);
    drift = (math.sin(((t * 0.8) + (i * 1.3))) * 2.2);
    c = new QColor((_pymod(i, 3) ? snow : snow_blue));
    c.setAlpha((70 + (_pymod(i, 4) * 25)));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(0.7, ((rect.width() * 0.0038) * size));
    painter.drawEllipse(_p(rect, (x + drift), y), rr, rr);
  }
}

function _bg_ghost(painter, rect, t) { // Python L2653
  let a, c, drift, halo_inner, halo_outer, i, mist, phase, puff, pulse, rise, rr, rx, ry, violet, violet_core, violet_hot, wisps, x, y;
  violet = new QColor("#6D39C7");
  violet_hot = new QColor("#B88CFF");
  violet_core = new QColor("#D8C2FF");
  mist = new QColor("#E9E1FF");
  painter.setBrush(Qt.BrushStyle.NoBrush);
  pulse = (0.5 + (0.5 * math.sin((t * 1.15))));
  halo_outer = new QColor(violet_hot);
  halo_outer.setAlpha(int((45 + (pulse * 70))));
  halo_inner = new QColor(violet_core);
  halo_inner.setAlpha(int((25 + (pulse * 55))));
  painter.setPen(_pen(halo_outer, max(1.4, (rect.width() * 0.012)), halo_outer.alpha()));
  painter.drawEllipse(_rect(rect, (10 - (pulse * 2)), (5 - (pulse * 2)), (90 + (pulse * 2)), (96 + (pulse * 2))));
  painter.setPen(_pen(halo_inner, max(1.0, (rect.width() * 0.005)), halo_inner.alpha()));
  painter.drawEllipse(_rect(rect, 16, 12, 84, 90));
  wisps = [[4, 22, 0.0], [96, 24, 1.0], [1, 56, 2.0], [99, 60, 3.0], [12, 91, 4.0], [88, 94, 5.0]];
  for ([i, [x, y, phase]] of enumerate(wisps)) {
    drift = (math.sin(((t * 0.9) + phase)) * 5.0);
    rise = _pymod(((t * 7) + (i * 9)), 22);
    c = new QColor((((_pymod(i, 2) === 0)) ? violet_hot : mist));
    c.setAlpha(int((55 + ((1 - (rise / 22)) * 95))));
    painter.setPen(_pen(c, max(1.0, (rect.width() * 0.005)), c.alpha()));
    puff = new QPainterPath();
    puff.moveTo(_p(rect, (x + drift), (y - rise)));
    puff.cubicTo(_p(rect, ((x - 4) + drift), ((y - rise) - 4)), _p(rect, ((x + 5) + drift), ((y - rise) - 8)), _p(rect, (x + drift), ((y - rise) - 13)));
    painter.drawPath(puff);
  }
  for (i of range(26)) {
    a = ((t * 0.42) + ((i * math.tau) / 26));
    rx = (47 + (_pymod(i, 4) * 2.4));
    ry = (40 + (_pymod(i, 3) * 2.8));
    x = (50 + (math.cos(a) * rx));
    y = (54 + (math.sin(a) * ry));
    if ((((17 < x) && (x < 83)) && ((26 < y) && (y < 92)))) {
      continue;
    }
    c = new QColor((_pymod(i, 3) ? violet : violet_hot));
    c.setAlpha((55 + (_pymod(i, 5) * 22)));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(0.8, (rect.width() * (0.0035 + (_pymod(i, 3) * 0.0008))));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
  }
}

function _bg_glitch(painter, rect, t) { // Python L2776
  let c, col, cyan, cycle, i, pink, shift, slices, strength, white, x1, x2, y;
  pink = new QColor("#FF2E9A");
  cyan = new QColor("#24D9FF");
  white = new QColor("#FFFFFF");
  cycle = _pymod(t, 2.6);
  if (((cycle >= 0.62))) {
    return undefined;
  }
  strength = (1.0 - (cycle / 0.62));
  slices = [[2, 17, 31], [68, 25, 103], [_pyneg(4), 38, 20], [82, 47, 106], [0, 66, 26], [73, 75, 104], [5, 91, 38], [60, 98, 99]];
  for ([i, [x1, y, x2]] of enumerate(slices)) {
    col = (((_pymod(i, 2) === 0)) ? pink : cyan);
    c = new QColor(col);
    c.setAlpha(int((95 + (strength * 155))));
    shift = ((math.sin(((t * 42) + (i * 1.7))) * 5.0) * strength);
    painter.setPen(_pen(c, max(1.2, (rect.width() * 0.009)), c.alpha()));
    painter.drawLine(_p(rect, (x1 + shift), y), _p(rect, (x2 + shift), y));
  }
  c = new QColor(white);
  c.setAlpha(int((65 + (strength * 120))));
  painter.setPen(_pen(c, max(1.0, (rect.width() * 0.005)), c.alpha()));
  painter.drawLine(_p(rect, _pyneg(3), 52), _p(rect, (22 + (strength * 10)), 52));
  painter.drawLine(_p(rect, (77 - (strength * 10)), 59), _p(rect, 104, 59));
}

function _bg_maestro(painter, rect, t) { // Python L2845
  let a, c, gold, gold_hot, i, inner, outer, pulse, rr, warm, white, x, y;
  gold = new QColor("#D7B55A");
  gold_hot = new QColor("#F6DE8C");
  warm = new QColor("#9A6E2E");
  white = new QColor("#FFF6DF");
  painter.setBrush(Qt.BrushStyle.NoBrush);
  pulse = (0.5 + (0.5 * math.sin((t * 1.15))));
  outer = new QColor(gold);
  outer.setAlpha(int((95 + (pulse * 110))));
  inner = new QColor(gold_hot);
  inner.setAlpha(int((55 + (pulse * 95))));
  painter.setPen(_pen(outer, max(1.6, (rect.width() * 0.014)), outer.alpha()));
  painter.drawArc(_rect(rect, (_pyneg(3) - (pulse * 1.5)), (_pyneg(8) - (pulse * 1.5)), (103 + (pulse * 1.5)), (92 + (pulse * 1.5))), (15 * 16), (150 * 16));
  painter.setPen(_pen(inner, max(1.0, (rect.width() * 0.006)), inner.alpha()));
  painter.drawArc(_rect(rect, 4, _pyneg(1), 96, 84), (20 * 16), (140 * 16));
  for (i of range(14)) {
    a = ((t * 0.28) + ((i * math.tau) / 14));
    x = (50 + (math.cos(a) * 49));
    y = (52 + (math.sin(a) * 40));
    if ((((16 < x) && (x < 84)) && ((28 < y) && (y < 90)))) {
      continue;
    }
    c = new QColor((((_pymod(i, 3) === 0)) ? gold_hot : (((_pymod(i, 2) === 0)) ? white : warm)));
    c.setAlpha((60 + (_pymod(i, 4) * 28)));
    painter.setPen(_pen(c, max(1.0, (rect.width() * 0.004)), c.alpha()));
    painter.drawLine(_p(rect, x, y), _p(rect, x, (y - 5)));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(0.8, (rect.width() * (0.0035 + (_pymod(i, 2) * 0.001))));
    painter.drawEllipse(_p(rect, (x - 1.7), (y + 1)), rr, rr);
  }
}

function _bg_mechanic(painter, rect, t) { // Python L2952
  let amber, c, dark, glow, i, length, orange, phase, q, side, steel, x, y;
  orange = new QColor("#FF8A2A");
  amber = new QColor("#FFC15A");
  steel = new QColor("#6E7377");
  dark = new QColor("#17191B");
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.setPen(_pen(steel, max(1.0, (rect.width() * 0.004)), 50));
  painter.drawLine(_p(rect, 2, 18), _p(rect, 2, 92));
  painter.drawLine(_p(rect, 98, 18), _p(rect, 98, 92));
  for (i of range(18)) {
    phase = _pymod(((t * 1.7) + (i * 0.31)), 1.0);
    side = (((_pymod(i, 2) === 0)) ? _pyneg(1) : 1);
    x = (50 + (side * (42 + (_pymod(i, 3) * 4))));
    y = (22 + _pymod(((i * 11) + (phase * 22)), 70));
    length = (2.5 + (_pymod(i, 4) * 0.9));
    c = new QColor((((_pymod(i, 3) === 0)) ? amber : orange));
    c.setAlpha(int((35 + ((1 - phase) * 120))));
    painter.setPen(_pen(c, max(1.0, (rect.width() * 0.004)), c.alpha()));
    painter.drawLine(_p(rect, x, y), _p(rect, (x + (side * length)), (y + (length * 0.7))));
  }
  q = (0.5 + (0.5 * math.sin((t * 0.8))));
  glow = new QColor(orange);
  glow.setAlpha(int((25 + (q * 45))));
  painter.setPen(_pen(glow, max(1.0, (rect.width() * 0.009)), glow.alpha()));
  painter.drawArc(_rect(rect, 21, 5, 79, 43), int(((25 + (q * 60)) * 16)), (65 * 16));
}

function _bg_noir(painter, rect, t) { // Python L2998
  let c, drift, grey, i, ivory, phase, smoke, smoke_path, x, y;
  ivory = new QColor("#D8D3C8");
  grey = new QColor("#55595C");
  smoke = new QColor("#99948A");
  painter.setBrush(Qt.BrushStyle.NoBrush);
  for (i of range(6)) {
    y = (8 + (i * 16));
    c = new QColor(ivory);
    c.setAlpha((24 + (i * 4)));
    painter.setPen(_pen(c, max(1.0, (rect.width() * 0.004)), c.alpha()));
    painter.drawLine(_p(rect, _pyneg(8), y), _p(rect, 108, (y + 8)));
  }
  for (i of range(14)) {
    phase = _pymod(((t * 1.2) + (i * 0.17)), 1.0);
    x = (2 + _pymod((i * 17), 98));
    if (((20 < x) && (x < 80))) {
      x = (((_pymod(i, 2) === 0)) ? 4 : 96);
    }
    y = (_pyneg(5) + (phase * 115));
    c = new QColor(grey);
    c.setAlpha((55 + (_pymod(i, 4) * 15)));
    painter.setPen(_pen(c, max(1.0, (rect.width() * 0.003)), c.alpha()));
    painter.drawLine(_p(rect, x, y), _p(rect, (x - 2), (y + 8)));
  }
  drift = (math.sin((t * 0.65)) * 2.5);
  painter.setPen(_pen(smoke, max(1.0, (rect.width() * 0.004)), 55));
  smoke_path = new QPainterPath();
  smoke_path.moveTo(_p(rect, (7 + drift), 30));
  smoke_path.cubicTo(_p(rect, (1 + drift), 23), _p(rect, (13 + drift), 17), _p(rect, (7 + drift), 10));
  painter.drawPath(smoke_path);
}

function _bg_null(painter, rect, t) { // Python L3043
  let a, black, c, cx, cy, f, grey, h, i, outer, pulse, red, red_hot, rx, ry, span, start, w, white, x, y;
  red = new QColor("#FF334F");
  red_hot = new QColor("#FF7184");
  grey = new QColor("#666A6D");
  white = new QColor("#F4F4F4");
  black = new QColor("#050607");
  painter.setBrush(Qt.BrushStyle.NoBrush);
  pulse = (0.5 + (0.5 * math.sin((t * 1.18))));
  [cx, cy] = [50, 55];
  outer = new QColor(red);
  outer.setAlpha(int((45 + (pulse * 95))));
  painter.setPen(_pen(outer, max(1.2, (rect.width() * 0.008)), outer.alpha()));
  painter.drawEllipse(_rect(rect, (12 - (pulse * 2)), (13 - (pulse * 2)), (88 + (pulse * 2)), (96 + (pulse * 2))));
  for (i of range(5)) {
    start = ((30 + (i * 71)) + (math.sin(((t * 0.7) + i)) * 8));
    span = (22 + (_pymod(i, 2) * 12));
    c = new QColor((((_pymod(i, 2) === 0)) ? red_hot : grey));
    c.setAlpha((55 + (i * 14)));
    painter.setPen(_pen(c, max(1.0, (rect.width() * 0.0045)), c.alpha()));
    painter.drawArc(_rect(rect, (5 + (i * 0.7)), (7 + (i * 0.7)), (95 - (i * 0.7)), (101 - (i * 0.7))), int((start * 16)), int((span * 16)));
  }
  for (i of range(12)) {
    a = ((t * 0.55) + ((i * math.tau) / 12));
    rx = (48 + (_pymod(i, 3) * 2.5));
    ry = (41 + (_pymod(i, 4) * 2.0));
    x = (cx + (math.cos(a) * rx));
    y = (cy + (math.sin(a) * ry));
    if ((((17 < x) && (x < 83)) && ((25 < y) && (y < 94)))) {
      continue;
    }
    c = new QColor((((_pymod(i, 3) === 0)) ? red : white));
    c.setAlpha((60 + (_pymod(i, 4) * 22)));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    w = (1.5 + (_pymod(i, 3) * 1.3));
    h = (0.8 + (_pymod(i, 2) * 0.8));
    painter.drawRect(_rect(rect, (x - w), (y - h), (x + w), (y + h)));
  }
  painter.setPen(_pen(grey, max(1.0, (rect.width() * 0.0035)), 70));
  painter.drawLine(_p(rect, 1, 22), _p(rect, 1, 7));
  painter.drawLine(_p(rect, 1, 7), _p(rect, 14, 7));
  painter.drawLine(_p(rect, 99, 78), _p(rect, 99, 95));
  painter.drawLine(_p(rect, 99, 95), _p(rect, 86, 95));
  f = painter.font();
  f.setFamily("Courier New");
  f.setBold(true);
  f.setPointSize(max(5, int((rect.height() * 0.026))));
  painter.setFont(f);
  c = new QColor(white);
  c.setAlpha(65);
  painter.setPen(c);
  painter.drawText(_rect(rect, 1, 1, 25, 10), Qt.AlignmentFlag.AlignCenter, "∅");
  painter.drawText(_rect(rect, 73, 96, 101, 105), Qt.AlignmentFlag.AlignCenter, "NULL");
}

function _bg_rockstar(painter, rect, t) { // Python L3175
  let beams, black_fill, c, col, cyan, head, i, magenta, pulse, rr, sway, torso, violet, white, x, x1, x2, y, y1, y2;
  magenta = new QColor("#FF2D55");
  violet = new QColor("#8A5CFF");
  cyan = new QColor("#47D9FF");
  white = new QColor("#F5F2ED");
  black_fill = new QColor("#101112");
  painter.setBrush(Qt.BrushStyle.NoBrush);
  beams = [[_pyneg(8), _pyneg(4), 28, 73, magenta], [18, _pyneg(5), 42, 72, violet], [82, _pyneg(5), 58, 72, cyan], [108, _pyneg(4), 72, 73, magenta]];
  for ([i, [x1, y1, x2, y2, col]] of enumerate(beams)) {
    sway = (math.sin(((t * 1.1) + (i * 1.25))) * 10.0);
    c = new QColor(col);
    c.setAlpha((45 + (i * 7)));
    painter.setPen(_pen(c, max(1.0, (rect.width() * 0.014)), c.alpha()));
    painter.drawLine(_p(rect, (x1 + sway), y1), _p(rect, (x2 - (sway * 0.28)), y2));
  }
  for (i of range(5)) {
    y = ((17 + (i * 16)) + (math.sin(((t * 1.7) + i)) * 2.0));
    c = new QColor((((_pymod(i, 2) === 0)) ? magenta : violet));
    c.setAlpha(55);
    painter.setPen(_pen(c, max(1.0, (rect.width() * 0.004)), c.alpha()));
    painter.drawLine(_p(rect, _pyneg(5), y), _p(rect, 12, (y - 5)));
    painter.drawLine(_p(rect, 105, (y + 2)), _p(rect, 88, (y - 3)));
  }
  for (i of range(14)) {
    x = (2 + (i * 7.7));
    y = (99 - (_pymod(i, 4) * 2.5));
    pulse = (0.5 + (0.5 * math.sin(((t * 3.2) + (i * 0.68)))));
    c = new QColor((_pymod(i, 3) ? white : (_pymod(i, 2) ? magenta : cyan)));
    c.setAlpha(int((35 + (pulse * 115))));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(0.7, (rect.width() * (0.0035 + (pulse * 0.0017))));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
  }
  head = new QPainterPath();
  head.moveTo(_p(rect, 17, 38));
  head.cubicTo(_p(rect, 7, 47), _p(rect, 8, 65), _p(rect, 18, 73));
  head.quadTo(_p(rect, 50, 82), _p(rect, 82, 73));
  head.cubicTo(_p(rect, 92, 65), _p(rect, 93, 47), _p(rect, 83, 38));
  head.lineTo(_p(rect, 72, 34));
  head.lineTo(_p(rect, 28, 34));
  head.closeSubpath();
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(black_fill);
  painter.drawPath(head);
  torso = new QPainterPath();
  torso.moveTo(_p(rect, 28, 73));
  torso.lineTo(_p(rect, 39, 83));
  torso.lineTo(_p(rect, 43, 102));
  torso.lineTo(_p(rect, 57, 102));
  torso.lineTo(_p(rect, 61, 83));
  torso.lineTo(_p(rect, 72, 73));
  torso.closeSubpath();
  painter.drawPath(torso);
}

function _bg_astronaut(painter, rect, t) { // Python L3316
  let a, a2, alpha, blue, c, col, cyan, flare, i, layer, orange, px, px2, py, py2, rare, ray, rr, size, twinkle, twinkle_speed, violet, white, x, y;
  white = new QColor("#FAFDFF");
  blue = new QColor("#79AFFF");
  cyan = new QColor("#8DEBFF");
  violet = new QColor("#9D7CFF");
  orange = new QColor("#E8A25A");
  for (i of range(96)) {
    x = (_pymod(((i * 37.73) + (_pymod(i, 7) * 11.1)), 106) - 3);
    y = (_pymod(((i * 53.17) + (_pymod(i, 11) * 7.9)), 107) - 3);
    layer = _pymod(i, 3);
    x = (_pymod(((x + (t * (0.2 + (layer * 0.13)))) + 3), 106) - 3);
    rare = ((_pymod(i, 8) === 0));
    twinkle_speed = (1.0 + (_pymod(i, 5) * 0.23));
    twinkle = (0.5 + (0.5 * math.sin(((t * twinkle_speed) + (i * 1.73)))));
    if (rare) {
      alpha = int((80 + (twinkle * 175)));
      size = (0.0028 + (twinkle * 0.0022));
    }
    else {
      alpha = int((32 + (twinkle * 75)));
      size = (0.0017 + (_pymod(i, 3) * 0.00055));
    }
    col = white;
    if (((_pymod(i, 13) === 0))) {
      col = cyan;
    }
    else {
      if (((_pymod(i, 17) === 0))) {
        col = blue;
      }
    }
    c = new QColor(col);
    c.setAlpha(min(255, alpha));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(0.45, (rect.width() * size));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
    if ((rare && ((twinkle > 0.92)))) {
      flare = new QColor(col);
      flare.setAlpha(int((((twinkle - 0.92) / 0.08) * 150)));
      painter.setPen(_pen(flare, max(0.7, (rect.width() * 0.0025)), flare.alpha()));
      ray = (2.3 + (twinkle * 2.2));
      painter.drawLine(_p(rect, (x - ray), y), _p(rect, (x + ray), y));
      painter.drawLine(_p(rect, x, (y - ray)), _p(rect, x, (y + ray)));
    }
  }
  a = (t * 0.18);
  px = (84 + (math.cos(a) * 6));
  py = (21 + (math.sin(a) * 3.5));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor(58, 45, 91, 205));
  painter.drawEllipse(_p(rect, px, py), (rect.width() * 0.047), (rect.width() * 0.047));
  painter.setPen(_pen(violet, max(0.9, (rect.width() * 0.0037)), 135));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawArc(_rect(rect, (px - 7), (py - 2.5), (px + 7), (py + 2.5)), (_pyneg(15) * 16), (205 * 16));
  a2 = ((_pyneg(t) * 0.13) + 1.2);
  px2 = (12 + (math.cos(a2) * 4.5));
  py2 = (85 + (math.sin(a2) * 3.5));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor(orange.red(), orange.green(), orange.blue(), 170));
  painter.drawEllipse(_p(rect, px2, py2), (rect.width() * 0.027), (rect.width() * 0.027));
}

function _bg_chrome(painter, rect, t) { // Python L3417
  let blue, c, col, cols, f, green, grey, i, light, pulse, red, rr, x, y, yellow;
  blue = new QColor("#4285F4");
  red = new QColor("#EA4335");
  yellow = new QColor("#FBBC05");
  green = new QColor("#34A853");
  grey = new QColor("#5F6368");
  light = new QColor("#DADCE0");
  painter.setPen(_pen(grey, max(0.8, (rect.width() * 0.0035)), 120));
  painter.setBrush(new QColor(33, 35, 38, 235));
  painter.drawRoundedRect(_rect(rect, 3, 1, 97, 17), 4, 4);
  painter.setPen(_pen(grey, max(0.7, (rect.width() * 0.003)), 95));
  painter.setBrush(new QColor(47, 49, 52, 240));
  painter.drawRoundedRect(_rect(rect, 8, 3.5, 38, 11.5), 3, 3);
  cols = [blue, red, yellow, green];
  for ([i, col] of enumerate(cols)) {
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(col);
    rr = max(0.65, (rect.width() * 0.0027));
    painter.drawEllipse(_p(rect, (11 + (i * 1.3)), 7.5), rr, rr);
  }
  f = painter.font();
  f.setFamily("Arial");
  f.setPointSize(max(4, int((rect.height() * 0.018))));
  painter.setFont(f);
  painter.setPen(light);
  painter.drawText(_rect(rect, 17, 4, 36, 11), (Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft), "Klaus");
  painter.setPen(_pen(grey, max(0.7, (rect.width() * 0.003)), 90));
  painter.setBrush(new QColor(24, 26, 28, 245));
  painter.drawRoundedRect(_rect(rect, 41, 4, 91, 12), 4, 4);
  painter.setPen(_pen(blue, max(0.75, (rect.width() * 0.0034)), 180));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawEllipse(_p(rect, 46, 8), (rect.width() * 0.01), (rect.width() * 0.01));
  painter.drawLine(_p(rect, 47, 9), _p(rect, 49, 11));
  f.setPointSize(max(4, int((rect.height() * 0.016))));
  painter.setFont(f);
  painter.setPen(new QColor("#AEB3B7"));
  painter.drawText(_rect(rect, 51, 4.5, 88, 11.5), (Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft), "Search");
  for ([i, [x, y, col]] of enumerate([[5, 35, blue], [95, 35, red], [5, 88, yellow], [95, 88, green]])) {
    pulse = (0.5 + (0.5 * math.sin(((t * 1.25) + (i * 1.4)))));
    c = new QColor(col);
    c.setAlpha(int((35 + (pulse * 55))));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = (rect.width() * (0.016 + (pulse * 0.004)));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
  }
}

function _bg_eclipse(painter, rect, t) { // Python L3510
  let c, cx, cy, cyan, eclipse, i, lunar, lunar_dark, lunar_hot, orange, pulse, rim, rx, ry, solar, solar_dark, solar_hot, w;
  solar = new QColor("#FF7A16");
  solar_hot = new QColor("#FFC25A");
  solar_dark = new QColor("#7D2B08");
  lunar = new QColor("#35C8EE");
  lunar_hot = new QColor("#B7EDFF");
  lunar_dark = new QColor("#0F526D");
  eclipse = new QColor("#030407");
  rim = new QColor("#D8D9DE");
  [cx, cy] = [50.0, 57.0];
  [rx, ry] = [34.0, 28.0];
  function fluid_blob(side, idx, base, hot, dark) { // Python L3532
    let bend, blob, c, crest, d, depth, drift, end_x, end_y, h, outer, phase, swell, sx, sy, thickness, y_base;
    phase = ((idx * 0.93) + (((side < 0)) ? 0.0 : 2.1));
    y_base = (13 + (idx * 21));
    drift = (math.sin(((t * 0.48) + phase)) * 5.5);
    swell = (math.cos(((t * 0.37) + (phase * 0.7))) * 4.0);
    if (((side < 0))) {
      sx = _pyneg(16);
      outer = (8 + (idx * 1.8));
      bend = (24 + (idx * 2.1));
      end_x = ((cx - rx) + 5);
    }
    else {
      sx = 116;
      outer = (92 - (idx * 1.8));
      bend = (76 - (idx * 2.1));
      end_x = ((cx + rx) - 5);
    }
    sy = (y_base + drift);
    end_y = (cy + (math.sin(((t * 0.62) + phase)) * (20 - (idx * 2.0))));
    thickness = (12 + (idx * 1.7));
    blob = new QPainterPath();
    blob.moveTo(_p(rect, sx, (sy - (thickness * 0.55))));
    blob.cubicTo(_p(rect, outer, ((sy - 14) + swell)), _p(rect, bend, ((end_y - 17) - (drift * 0.25))), _p(rect, end_x, (end_y - (thickness * 0.25))));
    blob.cubicTo(_p(rect, (end_x - (side * 4)), (end_y - (thickness * 0.04))), _p(rect, (end_x - (side * 4)), (end_y + (thickness * 0.04))), _p(rect, end_x, (end_y + (thickness * 0.25))));
    blob.cubicTo(_p(rect, bend, ((end_y + 18) + (drift * 0.25))), _p(rect, outer, ((sy + 14) - swell)), _p(rect, sx, (sy + (thickness * 0.55))));
    blob.closeSubpath();
    c = new QColor(base);
    c.setAlpha((88 - (idx * 5)));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    painter.drawPath(blob);
    depth = new QPainterPath();
    depth.moveTo(_p(rect, sx, (sy + (thickness * 0.05))));
    depth.cubicTo(_p(rect, outer, (sy + 8)), _p(rect, bend, (end_y + 11)), _p(rect, end_x, (end_y + (thickness * 0.08))));
    depth.cubicTo(_p(rect, bend, (end_y + 18)), _p(rect, outer, (sy + 15)), _p(rect, sx, (sy + (thickness * 0.35))));
    depth.closeSubpath();
    d = new QColor(dark);
    d.setAlpha(46);
    painter.setBrush(d);
    painter.drawPath(depth);
    crest = new QPainterPath();
    crest.moveTo(_p(rect, sx, (sy - (thickness * 0.23))));
    crest.cubicTo(_p(rect, outer, ((sy - 8) + (swell * 0.5))), _p(rect, bend, (end_y - 10)), _p(rect, end_x, (end_y - (thickness * 0.12))));
    h = new QColor(hot);
    h.setAlpha(120);
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.setPen(_pen(h, max(1.0, (rect.width() * 0.0048)), h.alpha()));
    painter.drawPath(crest);
  }
  for (i of range(4)) {
    fluid_blob(_pyneg(1), i, solar, solar_hot, solar_dark);
    fluid_blob(+(1), i, lunar, lunar_hot, lunar_dark);
  }
  for (i of range(3)) {
    w = (4 + (i * 3.5));
    orange = new QColor(solar_hot);
    orange.setAlpha((70 - (i * 13)));
    painter.setPen(_pen(orange, max(0.9, (rect.width() * 0.0037)), orange.alpha()));
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.drawArc(_rect(rect, ((cx - rx) - w), ((cy - ry) - w), ((cx + rx) + w), ((cy + ry) + w)), int((((132 + (t * 8)) + (i * 10)) * 16)), (72 * 16));
    cyan = new QColor(lunar_hot);
    cyan.setAlpha((70 - (i * 13)));
    painter.setPen(_pen(cyan, max(0.9, (rect.width() * 0.0037)), cyan.alpha()));
    painter.drawArc(_rect(rect, ((cx - rx) - w), ((cy - ry) - w), ((cx + rx) + w), ((cy + ry) + w)), int((((_pyneg(48) + (t * 8)) + (i * 10)) * 16)), (72 * 16));
  }
  painter.setPen(_pen(rim, max(1.0, (rect.width() * 0.004)), 125));
  painter.setBrush(eclipse);
  painter.drawEllipse(_p(rect, cx, cy), ((rect.width() * rx) / 100), ((rect.height() * ry) / 100));
  pulse = (0.5 + (0.5 * math.sin((t * 0.9))));
  c = new QColor(solar_hot);
  c.setAlpha(int((115 + (pulse * 75))));
  painter.setPen(_pen(c, max(1.25, (rect.width() * 0.0065)), c.alpha()));
  painter.drawArc(_rect(rect, (cx - rx), (cy - ry), (cx + rx), (cy + ry)), (90 * 16), (180 * 16));
  c = new QColor(lunar_hot);
  c.setAlpha(int((115 + ((1 - pulse) * 75))));
  painter.setPen(_pen(c, max(1.25, (rect.width() * 0.0065)), c.alpha()));
  painter.drawArc(_rect(rect, (cx - rx), (cy - ry), (cx + rx), (cy + ry)), (_pyneg(90) * 16), (180 * 16));
}

function _bg_emperor(painter, rect, t) { // Python L3696
  let a, anchor_x, arch, banner, black, c, eagle, eagle_y, fold, gold, gold_hot, head, highlight, i, inner_low, inner_mid, inner_top, phase, pulse, purple, purple_dark, purple_high, r, rr, side, wave_low, wave_mid, wave_top, x, y;
  gold = new QColor("#C79A3B");
  gold_hot = new QColor("#F1D887");
  purple = new QColor("#6B2B86");
  purple_dark = new QColor("#32113F");
  purple_high = new QColor("#8E43A8");
  black = new QColor("#101112");
  for ([side, phase] of [[_pyneg(1), 0.0], [1, 1.7]]) {
    anchor_x = (((side < 0)) ? 7 : 93);
    wave_top = (math.sin(((t * 1.05) + phase)) * 2.0);
    wave_mid = (math.sin((((t * 1.28) + phase) + 0.8)) * 4.0);
    wave_low = (math.sin((((t * 0.92) + phase) + 1.6)) * 3.0);
    inner_top = (anchor_x + (side * (13 + wave_top)));
    inner_mid = (anchor_x + (side * (16 + wave_mid)));
    inner_low = (anchor_x + (side * (12 + wave_low)));
    banner = new QPainterPath();
    banner.moveTo(_p(rect, anchor_x, 20));
    banner.cubicTo(_p(rect, (anchor_x + (side * 5)), 21), _p(rect, inner_top, 23), _p(rect, inner_top, 30));
    banner.cubicTo(_p(rect, inner_mid, 47), _p(rect, inner_mid, 72), _p(rect, inner_low, 91));
    banner.lineTo(_p(rect, (anchor_x + (side * 6)), 103));
    banner.lineTo(_p(rect, anchor_x, 92));
    banner.closeSubpath();
    painter.setPen(_pen(gold_hot, max(1.0, (rect.width() * 0.0048)), 230));
    painter.setBrush(purple);
    painter.drawPath(banner);
    fold = new QPainterPath();
    fold.moveTo(_p(rect, (anchor_x + (side * 3)), 25));
    fold.cubicTo(_p(rect, (anchor_x + (side * (7 + (wave_top * 0.5)))), 42), _p(rect, (anchor_x + (side * (9 + (wave_mid * 0.6)))), 67), _p(rect, (anchor_x + (side * (6 + (wave_low * 0.5)))), 93));
    painter.setPen(_pen(purple_dark, max(0.9, (rect.width() * 0.0036)), 210));
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.drawPath(fold);
    highlight = new QPainterPath();
    highlight.moveTo(_p(rect, (anchor_x + (side * 1.5)), 28));
    highlight.cubicTo(_p(rect, (anchor_x + (side * (4 + (wave_top * 0.25)))), 46), _p(rect, (anchor_x + (side * (5 + (wave_mid * 0.25)))), 66), _p(rect, (anchor_x + (side * (4 + (wave_low * 0.25)))), 84));
    painter.setPen(_pen(purple_high, max(0.8, (rect.width() * 0.0028)), 165));
    painter.drawPath(highlight);
    painter.setPen(_pen(gold, max(1.0, (rect.width() * 0.0045)), 215));
    painter.drawLine(_p(rect, anchor_x, 17), _p(rect, anchor_x, 104));
    eagle_y = 15;
    eagle = new QPainterPath();
    eagle.moveTo(_p(rect, anchor_x, eagle_y));
    eagle.lineTo(_p(rect, (anchor_x + (side * 7)), (eagle_y - 5)));
    eagle.lineTo(_p(rect, (anchor_x + (side * 3)), (eagle_y + 1)));
    eagle.lineTo(_p(rect, (anchor_x + (side * 8)), (eagle_y + 4)));
    eagle.lineTo(_p(rect, anchor_x, (eagle_y + 2)));
    eagle.closeSubpath();
    painter.setPen(_pen(gold_hot, max(0.8, (rect.width() * 0.0033)), 220));
    painter.setBrush(new QColor(gold.red(), gold.green(), gold.blue(), 180));
    painter.drawPath(eagle);
  }
  pulse = (0.5 + (0.5 * math.sin((t * 0.65))));
  arch = new QColor(gold);
  arch.setAlpha(int((70 + (pulse * 75))));
  painter.setPen(_pen(arch, max(1.1, (rect.width() * 0.0058)), arch.alpha()));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawArc(_rect(rect, 4, _pyneg(5), 96, 91), (15 * 16), (150 * 16));
  for (i of range(24)) {
    a = ((t * 0.16) + ((i * math.tau) / 24));
    r = (46 + (_pymod(i, 4) * 2));
    x = (50 + (math.cos(a) * r));
    y = (56 + (math.sin(a) * (38 + (_pymod(i, 3) * 2))));
    if ((((18 < x) && (x < 82)) && ((27 < y) && (y < 94)))) {
      continue;
    }
    c = new QColor((((_pymod(i, 4) === 0)) ? gold_hot : gold));
    c.setAlpha((48 + (_pymod(i, 5) * 20)));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(0.6, (rect.width() * (0.0023 + (_pymod(i, 3) * 0.0007))));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
  }
  head = new QPainterPath();
  head.moveTo(_p(rect, 17, 38));
  head.cubicTo(_p(rect, 7, 47), _p(rect, 8, 65), _p(rect, 18, 73));
  head.quadTo(_p(rect, 50, 82), _p(rect, 82, 73));
  head.cubicTo(_p(rect, 92, 65), _p(rect, 93, 47), _p(rect, 83, 38));
  head.lineTo(_p(rect, 72, 34));
  head.lineTo(_p(rect, 28, 34));
  head.closeSubpath();
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(black);
  painter.drawPath(head);
}

function _bg_royal(painter, rect, t) { // Python L3854
  let angle, black, bob, c, cream, f, gold, gold_hot, green, green_dark, h, head, i, notes, p, phase, spin, w, x, y;
  gold = new QColor("#FFD54A");
  gold_hot = new QColor("#FFF0A3");
  green = new QColor("#177A4A");
  green_dark = new QColor("#0A2B1D");
  cream = new QColor("#FFF3C4");
  black = new QColor("#101112");
  painter.setPen(_pen(green, max(1.0, (rect.width() * 0.005)), 70));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawArc(_rect(rect, _pyneg(7), 2, 107, 101), (20 * 16), (140 * 16));
  painter.drawArc(_rect(rect, _pyneg(2), 8, 102, 96), (20 * 16), (140 * 16));
  for (i of range(22)) {
    phase = _pymod(((t * 0.38) + (i * 0.073)), 1.0);
    x = (_pymod(((i * 23.7) + 5), 104) - 2);
    y = (_pyneg(6) + (phase * 116));
    if ((((19 < x) && (x < 81)) && ((27 < y) && (y < 91)) && _pymod(i, 3))) {
      continue;
    }
    spin = (0.25 + (0.75 * abs(math.sin(((t * 2.0) + i)))));
    c = new QColor((_pymod(i, 3) ? gold : gold_hot));
    c.setAlpha((65 + (_pymod(i, 4) * 20)));
    painter.setPen(_pen(c, max(0.7, (rect.width() * 0.0028)), c.alpha()));
    painter.setBrush(new QColor(gold.red(), gold.green(), gold.blue(), 35));
    painter.drawEllipse(_p(rect, x, y), ((rect.width() * 0.012) * spin), (rect.height() * 0.018));
  }
  notes = [[3, 35, _pyneg(8), 0.0], [86, 28, 9, 0.9], [1, 77, 8, 1.7], [86, 79, _pyneg(7), 2.4]];
  f = painter.font();
  f.setFamily("Courier New");
  f.setBold(true);
  f.setPointSize(max(4, int((rect.height() * 0.018))));
  painter.setFont(f);
  for ([i, [x, y, angle, phase]] of enumerate(notes)) {
    bob = (math.sin(((t * 0.75) + phase)) * 3);
    painter.save();
    p = _p(rect, x, (y + bob));
    painter.translate(p);
    painter.rotate((angle + (math.sin(((t * 0.5) + phase)) * 4)));
    w = (rect.width() * 0.12);
    h = (rect.height() * 0.055);
    painter.setPen(_pen(gold, max(0.7, (rect.width() * 0.0028)), 145));
    painter.setBrush(new QColor(16, 82, 50, 180));
    painter.drawRoundedRect(new QRectF((_pyneg(w) / 2), (_pyneg(h) / 2), w, h), 2, 2);
    painter.setPen(cream);
    painter.drawText(new QRectF((_pyneg(w) / 2), (_pyneg(h) / 2), w, h), Qt.AlignmentFlag.AlignCenter, "XP");
    painter.restore();
  }
  head = new QPainterPath();
  head.moveTo(_p(rect, 17, 38));
  head.cubicTo(_p(rect, 7, 47), _p(rect, 8, 65), _p(rect, 18, 73));
  head.quadTo(_p(rect, 50, 82), _p(rect, 82, 73));
  head.cubicTo(_p(rect, 92, 65), _p(rect, 93, 47), _p(rect, 83, 38));
  head.lineTo(_p(rect, 72, 34));
  head.lineTo(_p(rect, 28, 34));
  head.closeSubpath();
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor(black.red(), black.green(), black.blue(), 225));
  painter.drawPath(head);
}

function _bg_samurai(painter, rect, t) { // Python L3945
  let black, c, col, crimson, head, i, ink, j, lane, lane_idx, lanes, moon, mx, p, path, petal, petal_count, ph, pw, sakura, sakura_hot, sakura_light, slash_blue, slash_white, speed, u, x, x0, x1, y, y0, y1;
  sakura = new QColor("#F06BB4");
  sakura_light = new QColor("#FFD0EA");
  sakura_hot = new QColor("#FF78C8");
  crimson = new QColor("#B11D2B");
  ink = new QColor("#5D6268");
  moon = new QColor("#E8E2D2");
  black = new QColor("#101112");
  slash_white = new QColor("#FFFFFF");
  slash_blue = new QColor("#CDEBFF");
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor(moon.red(), moon.green(), moon.blue(), 26));
  painter.drawEllipse(_p(rect, 18, 22), (rect.width() * 0.18), (rect.height() * 0.22));
  lanes = [[[23, _pyneg(8)], [15, 18], [5, 32], [13, 50], [4, 67], [14, 88]], [[38, _pyneg(10)], [31, 12], [23, 28], [29, 45], [20, 62], [27, 88]], [[49, _pyneg(12)], [43, 7], [38, 22], [43, 38], [35, 56], [42, 82]], [[61, _pyneg(10)], [68, 10], [77, 24], [70, 43], [80, 62], [73, 88]], [[77, _pyneg(9)], [84, 13], [95, 30], [87, 48], [97, 66], [88, 88]], [[52, _pyneg(14)], [57, 5], [63, 18], [58, 34], [66, 52], [61, 78]]];
  function lane_point(points, u) { // Python L3983
    let local, pos, s, seg, seg_count, x0, x1, y0, y1;
    seg_count = (len(points) - 1);
    pos = (u * seg_count);
    seg = min((seg_count - 1), int(pos));
    local = (pos - seg);
    s = ((local * local) * (3 - (2 * local)));
    [x0, y0] = points[seg];
    [x1, y1] = points[(seg + 1)];
    return [(x0 + ((x1 - x0) * s)), (y0 + ((y1 - y0) * s))];
  }
  for ([lane_idx, lane] of enumerate(lanes)) {
    path = new QPainterPath();
    path.moveTo(_p(rect, ...lane[0]));
    for (j of range(1, len(lane))) {
      [x0, y0] = lane[(j - 1)];
      [x1, y1] = lane[j];
      mx = ((x0 + x1) / 2);
      path.cubicTo(_p(rect, mx, y0), _p(rect, mx, y1), _p(rect, x1, y1));
    }
    c = new QColor(ink);
    c.setAlpha((_pymod(lane_idx, 2) ? 28 : 36));
    painter.setPen(_pen(c, max(0.7, (rect.width() * 0.0024)), c.alpha()));
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.drawPath(path);
  }
  petal_count = 30;
  for (i of range(petal_count)) {
    lane_idx = _pymod(i, len(lanes));
    lane = lanes[lane_idx];
    speed = (0.09 + (_pymod(i, 5) * 0.008));
    u = _pymod(((t * speed) + (i * 0.109)), 1.0);
    [x, y] = lane_point(lane, u);
    x += (math.sin(((t * 1.2) + (i * 0.83))) * 2.6);
    y += (math.cos(((t * 0.9) + (i * 0.57))) * 1.0);
    col = (((_pymod(i, 5) === 0)) ? sakura_light : (((_pymod(i, 3) === 0)) ? sakura_hot : sakura));
    c = new QColor(col);
    c.setAlpha((150 + (_pymod(i, 4) * 22)));
    painter.save();
    p = _p(rect, x, y);
    painter.translate(p);
    painter.rotate(_pymod(((t * 70) + (i * 41)), 360));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    pw = max(2.0, (rect.width() * (0.0095 + (_pymod(i, 3) * 0.0017))));
    ph = max(1.3, (rect.height() * (0.0062 + (_pymod(i, 2) * 0.0015))));
    petal = new QPainterPath();
    petal.moveTo(new QPointF(_pyneg(pw), 0));
    petal.quadTo(new QPointF(0, (_pyneg(ph) * 2.0)), new QPointF(pw, 0));
    petal.quadTo(new QPointF(0, (ph * 1.35)), new QPointF(_pyneg(pw), 0));
    petal.closeSubpath();
    painter.drawPath(petal);
    painter.restore();
  }
  head = new QPainterPath();
  head.moveTo(_p(rect, 17, 38));
  head.cubicTo(_p(rect, 7, 47), _p(rect, 8, 65), _p(rect, 18, 73));
  head.quadTo(_p(rect, 50, 82), _p(rect, 82, 73));
  head.cubicTo(_p(rect, 92, 65), _p(rect, 93, 47), _p(rect, 83, 38));
  head.lineTo(_p(rect, 72, 34));
  head.lineTo(_p(rect, 28, 34));
  head.closeSubpath();
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(black);
  painter.drawPath(head);
}

function _bg_fernsehturm(painter, rect, t) { // Python L4093
  let amber, black, c, cyan, cyan_hot, head, i, phase, red, red_hot, rr, side, steel, steel_dark, sx, target_x, target_y, x, y;
  red = new QColor("#E33A35");
  red_hot = new QColor("#FF655E");
  steel = new QColor("#8D98A3");
  steel_dark = new QColor("#4B555E");
  cyan = new QColor("#3CC7F0");
  cyan_hot = new QColor("#B8F1FF");
  amber = new QColor("#FFC857");
  black = new QColor("#101112");
  painter.setBrush(Qt.BrushStyle.NoBrush);
  function tower(cx, phase, lean = 0.0) { // Python L4111
    let base_y, c, f1, f2, h1, h2, half_base, half_top, p, row, rr, top_y, y1, y2;
    top_y = 28.0;
    base_y = 98.0;
    half_top = 2.2;
    half_base = 6.8;
    painter.setPen(_pen(red_hot, max(0.95, (rect.width() * 0.0037)), 225));
    painter.drawLine(_p(rect, (cx - half_base), base_y), _p(rect, ((cx - half_top) + lean), top_y));
    painter.drawLine(_p(rect, (cx + half_base), base_y), _p(rect, ((cx + half_top) + lean), top_y));
    painter.setPen(_pen(red, max(0.7, (rect.width() * 0.0027)), 190));
    for (row of range(5)) {
      y1 = (37 + (row * 11));
      y2 = (y1 + 11);
      f1 = ((y1 - top_y) / (base_y - top_y));
      f2 = ((y2 - top_y) / (base_y - top_y));
      h1 = (half_top + ((half_base - half_top) * f1));
      h2 = (half_top + ((half_base - half_top) * f2));
      painter.drawLine(_p(rect, (cx - h1), y1), _p(rect, (cx + h2), y2));
      painter.drawLine(_p(rect, (cx + h1), y1), _p(rect, (cx - h2), y2));
    }
    painter.setPen(_pen(steel, max(0.75, (rect.width() * 0.0026)), 190));
    painter.drawLine(_p(rect, (cx + lean), top_y), _p(rect, (cx + lean), 18));
    painter.setPen(_pen(steel, max(0.8, (rect.width() * 0.0028)), 200));
    painter.setBrush(new QColor(25, 29, 32, 235));
    painter.drawEllipse(_p(rect, (cx + lean), 16), (rect.width() * 0.024), (rect.height() * 0.029));
    p = (0.5 + (0.5 * math.sin(((t * 2.0) + phase))));
    c = new QColor(cyan_hot);
    c.setAlpha(int((55 + (p * 130))));
    painter.setPen(_pen(c, max(0.75, (rect.width() * 0.0028)), c.alpha()));
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.drawEllipse(_p(rect, (cx + lean), 16), (rect.width() * (0.035 + (p * 0.006))), (rect.height() * (0.041 + (p * 0.007))));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(amber);
    rr = max(0.65, (rect.width() * 0.0024));
    painter.drawEllipse(_p(rect, (cx + lean), 16), rr, rr);
  }
  tower(13.0, 0.0, _pyneg(0.6));
  tower(87.0, 1.7, 0.6);
  [target_x, target_y] = [50.0, 22.0];
  function signal_stream(source_x, phase) { // Python L4187
    let c, i, q, radius, x, y;
    for (i of range(5)) {
      q = _pymod((((t * 0.55) + (i * 0.15)) + phase), 1.0);
      x = (source_x + ((target_x - source_x) * q));
      y = ((20 + ((target_y - 20) * q)) + (math.sin((q * math.pi)) * _pyneg(7.0)));
      radius = ((3.5 + (i * 2.0)) + (q * 2.0));
      c = new QColor((((i === 0)) ? cyan_hot : cyan));
      c.setAlpha(int(((125 * (1 - q)) + 20)));
      painter.setPen(_pen(c, max(0.7, (rect.width() * 0.0025)), c.alpha()));
      if (((source_x < 50))) {
        painter.drawArc(_rect(rect, (x - radius), (y - radius), (x + radius), (y + radius)), (_pyneg(60) * 16), (120 * 16));
      }
      else {
        painter.drawArc(_rect(rect, (x - radius), (y - radius), (x + radius), (y + radius)), (120 * 16), (120 * 16));
      }
    }
  }
  signal_stream(13.0, 0.0);
  signal_stream(87.0, 0.35);
  for (i of range(4)) {
    rr = ((14 + (i * 7)) + (math.sin(((t * 0.5) + i)) * 1.2));
    c = new QColor(cyan);
    c.setAlpha((42 - (i * 6)));
    painter.setPen(_pen(c, max(0.8, (rect.width() * 0.0027)), c.alpha()));
    painter.drawArc(_rect(rect, (50 - rr), (18 - (rr * 0.6)), (50 + rr), (18 + (rr * 0.6))), (205 * 16), (130 * 16));
  }
  for (i of range(12)) {
    side = (((_pymod(i, 2) === 0)) ? _pyneg(1) : 1);
    phase = _pymod(((t * 0.48) + (i * 0.11)), 1.0);
    sx = (((side < 0)) ? 16 : 84);
    x = (sx + ((50 - sx) * phase));
    y = ((24 + (math.sin((phase * math.pi)) * _pyneg(8))) + (_pymod(i, 3) * 1.4));
    c = new QColor((((_pymod(i, 4) === 0)) ? amber : cyan));
    c.setAlpha(int(((90 * (1 - phase)) + 22)));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(0.5, (rect.width() * 0.0019));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
  }
  head = new QPainterPath();
  head.moveTo(_p(rect, 17, 38));
  head.cubicTo(_p(rect, 7, 47), _p(rect, 8, 65), _p(rect, 18, 73));
  head.quadTo(_p(rect, 50, 82), _p(rect, 82, 73));
  head.cubicTo(_p(rect, 92, 65), _p(rect, 93, 47), _p(rect, 83, 38));
  head.lineTo(_p(rect, 72, 34));
  head.lineTo(_p(rect, 28, 34));
  head.closeSubpath();
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(black);
  painter.drawPath(head);
}

function _bg_void(painter, rect, t) { // Python L4276
  let a, alpha, angle, blue, boost, c, c2, col, core, count, cx, cy, cyan, cyan_hot, dist, drift, dx, dy, frac, i, influence, layer, lower, magenta, mid_a, mx, my, off, orange, p, phase, photon_rx, photon_ry, pink, q, quadrant, r0, r1, radius, ring, rot, rr, rx, ry, seed, span, start, strength, tw, upper, violet, violet_dark, violet_hot, warped_dist, white, width, x, x0, x1, y, y0, y1, yellow;
  core = new QColor("#000000");
  violet_dark = new QColor("#210027");
  violet = new QColor("#7421AF");
  violet_hot = new QColor("#C64AFF");
  magenta = new QColor("#FF3DD6");
  pink = new QColor("#FF8CEC");
  blue = new QColor("#375AFF");
  cyan = new QColor("#49DAFF");
  cyan_hot = new QColor("#C8F8FF");
  orange = new QColor("#FF8C2A");
  yellow = new QColor("#FFD85A");
  white = new QColor("#FFFFFF");
  [cx, cy] = [50.0, 55.0];
  for (layer of range(4)) {
    count = (34 + (layer * 20));
    drift = [0.012, 0.025, 0.042, 0.065][layer];
    for (i of range(count)) {
      seed = (i + (layer * 127));
      x = (_pymod((((seed * 37.173) + 11) + ((t * drift) * 12)), 112) - 6);
      y = (_pymod((((seed * 53.911) + 17) + ((t * drift) * 6)), 112) - 6);
      dx = (x - cx);
      dy = (y - cy);
      dist = max(1.0, math.hypot(dx, dy));
      if (((dist < 52))) {
        influence = ((52 - dist) / 52);
        angle = math.atan2(dy, dx);
        angle += (((_pymod(seed, 2) ? _pyneg(1) : 1) * influence) * 0.62);
        warped_dist = (dist * (1.0 + (influence * 0.2)));
        x = (cx + (math.cos(angle) * warped_dist));
        y = (cy + ((math.sin(angle) * warped_dist) * 0.86));
      }
      tw = (0.5 + (0.5 * math.sin(((t * (0.68 + (layer * 0.2))) + (seed * 0.91)))));
      col = white;
      if (((_pymod(seed, 13) === 0))) {
        col = cyan;
      }
      else {
        if (((_pymod(seed, 17) === 0))) {
          col = violet_hot;
        }
        else {
          if (((_pymod(seed, 19) === 0))) {
            col = magenta;
          }
        }
      }
      c = new QColor(col);
      c.setAlpha(int(((14 + (layer * 10)) + (tw * (30 + (layer * 12))))));
      painter.setPen(Qt.PenStyle.NoPen);
      painter.setBrush(c);
      rr = max(0.4, (rect.width() * ((0.0012 + (layer * 0.00042)) + (_pymod(seed, 3) * 0.00028))));
      painter.drawEllipse(_p(rect, x, y), rr, rr);
    }
  }
  painter.setBrush(Qt.BrushStyle.NoBrush);
  for (ring of range(11)) {
    rx = (49 - (ring * 2.7));
    ry = (38 - (ring * 1.85));
    col = (((_pymod(ring, 3) === 0)) ? cyan : (((_pymod(ring, 3) === 1)) ? violet : magenta));
    c = new QColor(col);
    c.setAlpha(max(8, (46 - (ring * 3))));
    painter.setPen(_pen(c, max(0.55, (rect.width() * 0.0019)), c.alpha()));
    off = _pymod(((t * 3) + (ring * 17)), 360);
    for (quadrant of range(4)) {
      painter.drawArc(_rect(rect, (cx - rx), (cy - ry), (cx + rx), (cy + ry)), int((((off + (quadrant * 90)) + 8) * 16)), int((54 * 16)));
    }
  }
  for (i of range(22)) {
    a = (((i * math.tau) / 22) + (math.sin(((t * 0.12) + i)) * 0.03));
    r0 = 31;
    r1 = 57;
    x0 = (cx + (math.cos(a) * r0));
    y0 = (cy + ((math.sin(a) * r0) * 0.82));
    mid_a = (a + (0.22 * math.sin(((a * 2) + (t * 0.18)))));
    mx = (cx + (math.cos(mid_a) * 43));
    my = (cy + ((math.sin(mid_a) * 43) * 0.82));
    x1 = (cx + (math.cos(a) * r1));
    y1 = (cy + ((math.sin(a) * r1) * 0.82));
    p = new QPainterPath();
    p.moveTo(_p(rect, x0, y0));
    p.quadTo(_p(rect, mx, my), _p(rect, x1, y1));
    c = new QColor((((_pymod(i, 2) === 0)) ? cyan : violet_hot));
    c.setAlpha((18 + (_pymod(i, 4) * 7)));
    painter.setPen(_pen(c, max(0.55, (rect.width() * 0.0018)), c.alpha()));
    painter.drawPath(p);
  }
  rot = _pymod((t * 8.5), 360);
  function arc(rx, ry, start, span, col, width, alpha, offset = 0) { // Python L4398
    let c;
    c = new QColor(col);
    c.setAlpha(alpha);
    painter.setPen(_pen(c, max(0.7, (rect.width() * width)), c.alpha()));
    painter.drawArc(_rect(rect, (cx - rx), (cy - ry), (cx + rx), (cy + ry)), int(((start + offset) * 16)), int((span * 16)));
  }
  for (i of range(24)) {
    frac = (i / 23);
    rx = (50 - (frac * 16));
    ry = (27 - (frac * 8));
    if (((frac < 0.18))) {
      col = violet_dark;
    }
    else {
      if (((frac < 0.38))) {
        col = violet;
      }
      else {
        if (((frac < 0.58))) {
          col = magenta;
        }
        else {
          if (((frac < 0.78))) {
            col = orange;
          }
          else {
            col = yellow;
          }
        }
      }
    }
    arc(rx, ry, (191 + (i * 0.7)), (154 - (i * 1.2)), col, (0.0074 + (i * 0.0002)), (22 + (i * 4)), (rot * (0.07 + (i * 0.004))));
  }
  for (i of range(38)) {
    frac = (i / 37);
    rx = (51 - (frac * 22));
    ry = (28 - (frac * 12));
    start = (178 + _pymod((i * 17), 91));
    span = (38 + (_pymod(i, 7) * 10));
    if (((_pymod(i, 9) === 0))) {
      col = cyan_hot;
    }
    else {
      if (((_pymod(i, 7) === 0))) {
        col = white;
      }
      else {
        if (((_pymod(i, 5) === 0))) {
          col = pink;
        }
        else {
          if (((_pymod(i, 3) === 0))) {
            col = orange;
          }
          else {
            if (((_pymod(i, 2) === 0))) {
              col = magenta;
            }
            else {
              col = violet_hot;
            }
          }
        }
      }
    }
    alpha = min(205, (48 + (_pymod(i, 8) * 20)));
    width = (0.0023 + (_pymod(i, 5) * 0.00082));
    arc(rx, ry, start, span, col, width, alpha, (rot * (0.3 + (_pymod(i, 5) * 0.05))));
    arc(rx, ry, (start + 180), (span * 0.7), col, (width * 0.72), max(24, int((alpha * 0.6))), (_pyneg(rot) * (0.17 + (_pymod(i, 4) * 0.04))));
  }
  photon_rx = 34.0;
  photon_ry = 28.8;
  c = new QColor("#FFF9EC");
  c.setAlpha(235);
  painter.setPen(_pen(c, max(1.6, (rect.width() * 0.0075)), c.alpha()));
  painter.drawEllipse(_p(rect, cx, cy), ((rect.width() * photon_rx) / 100), ((rect.height() * photon_ry) / 100));
  c = new QColor(cyan_hot);
  c.setAlpha(105);
  painter.setPen(_pen(c, max(0.9, (rect.width() * 0.0034)), c.alpha()));
  painter.drawArc(_rect(rect, ((cx - photon_rx) - 1), ((cy - photon_ry) - 1), ((cx + photon_rx) + 1), ((cy + photon_ry) + 1)), (_pyneg(70) * 16), (145 * 16));
  c = new QColor(magenta);
  c.setAlpha(105);
  painter.setPen(_pen(c, max(0.9, (rect.width() * 0.0034)), c.alpha()));
  painter.drawArc(_rect(rect, ((cx - photon_rx) - 1), ((cy - photon_ry) - 1), ((cx + photon_rx) + 1), ((cy + photon_ry) + 1)), (110 * 16), (145 * 16));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(core);
  painter.drawEllipse(_p(rect, cx, cy), (rect.width() * 0.315), (rect.height() * 0.265));
  painter.setBrush(new QColor(0, 0, 0, 255));
  painter.drawEllipse(_p(rect, cx, cy), (rect.width() * 0.275), (rect.height() * 0.23));
  boost = (0.5 + (0.5 * math.sin((t * 0.3))));
  for (i of range(8)) {
    rx = (48 - (i * 1.6));
    ry = (25 - (i * 0.85));
    c = new QColor((((i < 4)) ? cyan_hot : white));
    c.setAlpha(int(((90 + (boost * 80)) - (i * 7))));
    painter.setPen(_pen(c, max(0.8, (rect.width() * (0.0048 - (i * 0.0003)))), c.alpha()));
    painter.drawArc(_rect(rect, (cx - rx), (cy - ry), (cx + rx), (cy + ry)), int((((338 + (rot * 0.14)) + (i * 3)) * 16)), int(((82 - (i * 5)) * 16)));
  }
  strength = (0.35 + (0.65 * (0.5 + (0.5 * math.sin((t * 0.72))))));
  upper = new QPainterPath();
  upper.moveTo(_p(rect, 48.8, 38));
  upper.cubicTo(_p(rect, 47, 26), _p(rect, 43, 10), _p(rect, 39, _pyneg(10)));
  c = new QColor(cyan_hot);
  c.setAlpha(int((40 + (strength * 92))));
  painter.setPen(_pen(c, max(2.3, (rect.width() * 0.0115)), c.alpha()));
  painter.drawPath(upper);
  c = new QColor(white);
  c.setAlpha(int((75 + (strength * 110))));
  painter.setPen(_pen(c, max(0.8, (rect.width() * 0.0035)), c.alpha()));
  painter.drawPath(upper);
  lower = new QPainterPath();
  lower.moveTo(_p(rect, 51.2, 72));
  lower.cubicTo(_p(rect, 53, 83), _p(rect, 58, 98), _p(rect, 63, 114));
  c = new QColor(violet_hot);
  c.setAlpha(int((28 + (strength * 72))));
  painter.setPen(_pen(c, max(1.9, (rect.width() * 0.0095)), c.alpha()));
  painter.drawPath(lower);
  for (i of range(46)) {
    a = ((t * (0.29 + (_pymod(i, 5) * 0.026))) + ((i * math.tau) / 46));
    rx = (37 + (_pymod(i, 7) * 1.9));
    ry = (19 + (_pymod(i, 5) * 1.15));
    x = (cx + (math.cos(a) * rx));
    y = (cy + (math.sin(a) * ry));
    col = (((_pymod(i, 7) === 0)) ? yellow : (((_pymod(i, 5) === 0)) ? orange : (((_pymod(i, 3) === 0)) ? magenta : violet_hot)));
    c = new QColor(col);
    c.setAlpha((62 + (_pymod(i, 5) * 24)));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(0.55, (rect.width() * (0.0021 + (_pymod(i, 4) * 0.00065))));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
  }
  phase = _pymod(t, 6.8);
  if (((phase < 0.85))) {
    q = (phase / 0.85);
    radius = (18 + (q * 38));
    c = new QColor(cyan_hot);
    c.setAlpha(int(((1 - q) * 155)));
    painter.setPen(_pen(c, max(0.8, (rect.width() * 0.003)), c.alpha()));
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.drawEllipse(_p(rect, cx, cy), ((rect.width() * radius) / 100), (((rect.height() * radius) * 0.78) / 100));
    c2 = new QColor(violet_hot);
    c2.setAlpha(int(((1 - q) * 90)));
    painter.setPen(_pen(c2, max(0.7, (rect.width() * 0.0024)), c2.alpha()));
    painter.drawEllipse(_p(rect, cx, cy), ((rect.width() * (radius + 5)) / 100), (((rect.height() * (radius + 5)) * 0.78) / 100));
  }
}

function _bg_monolith(painter, rect, t) { // Python L4615
  let a, amber, awaken, black, body, bolt, branch, branches, c, col, crack, cx, cy, f, facet, glow, gold, gold_hot, guardians, h, i, idx, j, lean, lev, obsidian, obsidian_hi, off, p, phase, poly, pt, pts, pulse, q, radius, ring, rot_bias, runes, rust, rust_hot, rx, ry, strength, sway, sx, sy, w, white, x, x1, x2, y, y1, y2, yy;
  obsidian = new QColor("#09090B");
  obsidian_hi = new QColor("#17171B");
  rust = new QColor("#6D3224");
  rust_hot = new QColor("#A65337");
  gold = new QColor("#E0B84D");
  gold_hot = new QColor("#FFF0A0");
  amber = new QColor("#F7C54A");
  white = new QColor("#FFFDF3");
  black = new QColor("#050505");
  [cx, cy] = [50.0, 56.0];
  for ([i, x] of enumerate([5, 15, 27, 73, 85, 95])) {
    sway = (math.sin(((t * 0.12) + i)) * 1.2);
    c = new QColor((((_pymod(i, 2) === 0)) ? rust : gold));
    c.setAlpha((22 + (_pymod(i, 3) * 9)));
    painter.setPen(_pen(c, max(0.7, (rect.width() * 0.0023)), c.alpha()));
    painter.drawLine(_p(rect, (x + sway), _pyneg(5)), _p(rect, (x - sway), 108));
  }
  for (i of range(11)) {
    y = (71 + (i * 3.8));
    c = new QColor(gold);
    c.setAlpha(max(7, (31 - (i * 2))));
    painter.setPen(_pen(c, max(0.55, (rect.width() * 0.0018)), c.alpha()));
    painter.drawLine(_p(rect, (50 - ((i + 1) * 7)), y), _p(rect, (50 + ((i + 1) * 7)), y));
  }
  for (i of range(10)) {
    x = (1 + (i * 11));
    c = new QColor(rust);
    c.setAlpha(18);
    painter.setPen(_pen(c, max(0.55, (rect.width() * 0.0016)), c.alpha()));
    painter.drawLine(_p(rect, 50, 70), _p(rect, x, 108));
  }
  runes = ["I", "V", "X", "Λ", "∆", "○", "◇", "⟂", "·"];
  f = painter.font();
  f.setFamily("Courier New");
  f.setPointSize(max(4, int((rect.height() * 0.017))));
  painter.setFont(f);
  for (i of range(42)) {
    phase = _pymod(((t * 0.055) + (i * 0.067)), 1);
    x = (_pymod(((i * 29.7) + 7), 102) - 1);
    y = (_pyneg(8) + (phase * 120));
    if ((((23 < x) && (x < 77)) && ((19 < y) && (y < 96)) && _pymod(i, 3))) {
      continue;
    }
    c = new QColor((((_pymod(i, 7) === 0)) ? gold_hot : gold));
    c.setAlpha((20 + (_pymod(i, 5) * 10)));
    painter.setPen(c);
    painter.drawText(_rect(rect, (x - 2), (y - 2), (x + 2), (y + 2)), Qt.AlignmentFlag.AlignCenter, runes[_pymod(i, len(runes))]);
  }
  guardians = [[7, 34, 15, 98, _pyneg(4.0)], [19, 24, 27, 94, _pyneg(2.0)], [73, 24, 81, 94, 2.0], [85, 34, 93, 98, 4.0]];
  for ([idx, [x1, y1, x2, y2, lean]] of enumerate(guardians)) {
    lev = (math.sin(((t * 0.31) + (idx * 1.1))) * 1.6);
    poly = new QPolygonF([_p(rect, (x1 + lean), (y1 + lev)), _p(rect, (x2 + lean), ((y1 - 3) + lev)), _p(rect, x2, (y2 + lev)), _p(rect, x1, (y2 + lev))]);
    painter.setPen(_pen(rust_hot, max(0.8, (rect.width() * 0.0029)), 105));
    painter.setBrush(new QColor(obsidian_hi.red(), obsidian_hi.green(), obsidian_hi.blue(), 235));
    painter.drawPolygon(poly);
    sx = ((x1 + x2) / 2);
    c = new QColor(gold);
    c.setAlpha((62 + (idx * 13)));
    painter.setPen(_pen(c, max(0.65, (rect.width() * 0.0022)), c.alpha()));
    painter.drawLine(_p(rect, sx, ((y1 + 8) + lev)), _p(rect, sx, ((y2 - 8) + lev)));
    for (j of range(3)) {
      yy = (((y1 + 18) + (j * 14)) + lev);
      painter.setPen(new QColor(210, 172, 74, 72));
      painter.drawText(_rect(rect, (sx - 2), (yy - 2), (sx + 2), (yy + 2)), Qt.AlignmentFlag.AlignCenter, runes[_pymod((idx + j), len(runes))]);
    }
  }
  lev = (math.sin((t * 0.42)) * 2.4);
  rot_bias = (math.sin((t * 0.19)) * 1.1);
  painter.save();
  painter.translate(_p(rect, cx, (cy + lev)));
  painter.rotate(rot_bias);
  sx = (rect.width() / 100);
  sy = (rect.height() / 100);
  body = new QPainterPath();
  body.moveTo(new QPointF((_pyneg(15) * sx), (_pyneg(34) * sy)));
  body.lineTo(new QPointF((12 * sx), (_pyneg(37) * sy)));
  body.lineTo(new QPointF((17 * sx), (29 * sy)));
  body.lineTo(new QPointF((_pyneg(14) * sx), (34 * sy)));
  body.closeSubpath();
  painter.setPen(_pen(gold, max(1.1, (rect.width() * 0.0043)), 160));
  painter.setBrush(obsidian);
  painter.drawPath(body);
  facet = new QPainterPath();
  facet.moveTo(new QPointF((12 * sx), (_pyneg(37) * sy)));
  facet.lineTo(new QPointF((17 * sx), (29 * sy)));
  facet.lineTo(new QPointF((9 * sx), (25 * sy)));
  facet.lineTo(new QPointF((7 * sx), (_pyneg(30) * sy)));
  facet.closeSubpath();
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor(29, 29, 34, 235));
  painter.drawPath(facet);
  crack = new QPainterPath();
  crack.moveTo(new QPointF((_pyneg(2) * sx), (_pyneg(27) * sy)));
  crack.lineTo(new QPointF((2 * sx), (_pyneg(18) * sy)));
  crack.lineTo(new QPointF((_pyneg(1) * sx), (_pyneg(8) * sy)));
  crack.lineTo(new QPointF((3 * sx), (2 * sy)));
  crack.lineTo(new QPointF((_pyneg(2) * sx), (14 * sy)));
  crack.lineTo(new QPointF((2 * sx), (26 * sy)));
  pulse = (0.5 + (0.5 * math.sin((t * 1.5))));
  glow = new QColor(amber);
  glow.setAlpha(int((38 + (pulse * 58))));
  painter.setPen(_pen(glow, max(4.0, (rect.width() * 0.018)), glow.alpha()));
  painter.drawPath(crack);
  c = new QColor(gold_hot);
  c.setAlpha(int((155 + (pulse * 100))));
  painter.setPen(_pen(c, max(1.1, (rect.width() * 0.0048)), c.alpha()));
  painter.drawPath(crack);
  f = painter.font();
  f.setFamily("Times New Roman");
  f.setBold(true);
  f.setPointSize(max(8, int((rect.height() * 0.05))));
  painter.setFont(f);
  painter.setPen(new QColor(gold_hot.red(), gold_hot.green(), gold_hot.blue(), 210));
  painter.drawText(new QRectF((_pyneg(8) * sx), (_pyneg(7) * sy), (16 * sx), (14 * sy)), Qt.AlignmentFlag.AlignCenter, "I");
  painter.restore();
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor(0, 0, 0, 78));
  painter.drawEllipse(_p(rect, 50, 96), (rect.width() * 0.2), (rect.height() * 0.046));
  c = new QColor(gold);
  c.setAlpha(28);
  painter.setPen(_pen(c, max(0.65, (rect.width() * 0.002)), c.alpha()));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawEllipse(_p(rect, 50, 96), (rect.width() * 0.23), (rect.height() * 0.056));
  for (ring of range(6)) {
    rx = (23 + (ring * 5));
    ry = (18 + (ring * 3.1));
    col = (((ring === 0)) ? gold_hot : (((_pymod(ring, 2) === 0)) ? gold : rust_hot));
    c = new QColor(col);
    c.setAlpha(max(16, (74 - (ring * 9))));
    painter.setPen(_pen(c, max(0.7, (rect.width() * 0.0024)), c.alpha()));
    off = _pymod(((t * (13 - (ring * 1.7))) + (ring * 41)), 360);
    painter.drawArc(_rect(rect, (cx - rx), (cy - ry), (cx + rx), (cy + ry)), int((off * 16)), int(((62 + (ring * 8)) * 16)));
    painter.drawArc(_rect(rect, (cx - rx), (cy - ry), (cx + rx), (cy + ry)), int(((off + 180) * 16)), int(((62 + (ring * 8)) * 16)));
  }
  for (i of range(26)) {
    a = ((t * (0.15 + (_pymod(i, 3) * 0.02))) + ((i * math.tau) / 26));
    rx = (33 + (_pymod(i, 5) * 2.0));
    ry = (25 + (_pymod(i, 4) * 1.6));
    x = (cx + (math.cos(a) * rx));
    y = (cy + (math.sin(a) * ry));
    c = new QColor((((_pymod(i, 6) === 0)) ? gold_hot : rust_hot));
    c.setAlpha((58 + (_pymod(i, 5) * 17)));
    painter.save();
    painter.translate(_p(rect, x, y));
    painter.rotate((((a * 180) / math.pi) + (i * 13)));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    w = max(0.9, (rect.width() * 0.0036));
    h = max(0.45, (rect.height() * 0.0019));
    painter.drawPolygon(new QPolygonF([new QPointF(_pyneg(w), 0), new QPointF(0, _pyneg(h)), new QPointF(w, 0), new QPointF(0, h)]));
    painter.restore();
  }
  phase = _pymod(t, 7.0);
  if (((phase < 1.15))) {
    if (((phase < 0.25))) {
      strength = (phase / 0.25);
    }
    else {
      if (((phase < 0.55))) {
        strength = 1.0;
      }
      else {
        strength = max(0, (1 - ((phase - 0.55) / 0.6)));
      }
    }
    pts = [[58, _pyneg(8)], [54, 7], [60, 18], [52, 30], [56, 42], [50, 55]];
    bolt = new QPainterPath();
    bolt.moveTo(_p(rect, ...pts[0]));
    for (pt of pts.slice(1)) {
      bolt.lineTo(_p(rect, ...pt));
    }
    c = new QColor(gold_hot);
    c.setAlpha(int((70 + (strength * 105))));
    painter.setPen(_pen(c, max(5.2, (rect.width() * 0.024)), c.alpha()));
    painter.drawPath(bolt);
    c = new QColor(white);
    c.setAlpha(int((150 + (strength * 105))));
    painter.setPen(_pen(c, max(1.5, (rect.width() * 0.007)), c.alpha()));
    painter.drawPath(bolt);
    branches = [[[54, 7], [43, 11], [38, 18]], [[60, 18], [72, 20], [78, 27]], [[52, 30], [42, 36], [37, 44]]];
    for (branch of branches) {
      p = new QPainterPath();
      p.moveTo(_p(rect, ...branch[0]));
      p.lineTo(_p(rect, ...branch[1]));
      p.lineTo(_p(rect, ...branch[2]));
      c = new QColor(gold_hot);
      c.setAlpha(int((80 + (strength * 90))));
      painter.setPen(_pen(c, max(0.8, (rect.width() * 0.0032)), c.alpha()));
      painter.drawPath(p);
    }
  }
  awaken = _pymod(t, 9.5);
  if (((awaken < 1.0))) {
    q = awaken;
    radius = (12 + (q * 42));
    c = new QColor(gold_hot);
    c.setAlpha(int(((1 - q) * 145)));
    painter.setPen(_pen(c, max(0.8, (rect.width() * 0.003)), c.alpha()));
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.drawEllipse(_p(rect, cx, cy), ((rect.width() * radius) / 100), (((rect.height() * radius) * 0.68) / 100));
  }
}

function _bg_ubahn_ghost(painter, rect, t) { // Python L4964
  let a, black, blobs, breathe, c, col, dx, dy, gas_dark, gas_hot, gas_light, gas_mid, head, i, phase, r, rr, rx, ry, sx, sy, torso, x, y;
  gas_dark = new QColor("#445462");
  gas_mid = new QColor("#71889A");
  gas_light = new QColor("#C8D7E2");
  gas_hot = new QColor("#ECF7FF");
  black = new QColor("#101112");
  blobs = [[18, 25, 13, 9, 0.0], [31, 20, 15, 10, 0.5], [48, 23, 18, 11, 1.0], [66, 20, 15, 10, 1.5], [81, 26, 13, 9, 2.0], [12, 43, 15, 13, 2.5], [27, 39, 18, 14, 3.0], [48, 41, 21, 15, 3.5], [70, 40, 18, 14, 4.0], [88, 44, 15, 13, 4.5], [11, 61, 15, 13, 5.0], [27, 58, 19, 15, 5.5], [49, 60, 22, 16, 6.0], [72, 59, 19, 15, 6.5], [89, 62, 15, 13, 7.0], [12, 81, 15, 12, 7.5], [28, 78, 18, 14, 8.0], [48, 81, 22, 15, 8.5], [70, 79, 18, 14, 9.0], [89, 82, 15, 12, 9.5], [20, 96, 14, 10, 10.0], [38, 94, 17, 11, 10.5], [55, 96, 19, 12, 11.0], [74, 94, 16, 11, 11.5], [90, 97, 13, 9, 12.0]];
  for ([i, [x, y, rx, ry, phase]] of enumerate(blobs)) {
    dx = (math.sin(((t * 0.58) + phase)) * (2.0 + (_pymod(i, 3) * 0.7)));
    dy = (math.cos(((t * 0.41) + (phase * 0.72))) * (1.5 + (_pymod(i, 2) * 0.8)));
    breathe = (0.5 + (0.5 * math.sin(((t * 0.82) + phase))));
    col = [gas_dark, gas_mid, gas_light][_pymod(i, 3)];
    c = new QColor(col);
    c.setAlpha(int(((20 + (breathe * 35)) + (_pymod(i, 3) * 7))));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    painter.drawEllipse(_p(rect, (x + dx), (y + dy)), (rect.width() * ((rx + (breathe * 1.8)) / 100)), (rect.height() * ((ry + (breathe * 1.2)) / 100)));
  }
  for (i of range(12)) {
    a = ((t * 0.34) + ((i * math.tau) / 12));
    rx = (50 + (_pymod(i, 3) * 2));
    ry = (43 + (_pymod(i, 4) * 2));
    x = (50 + (math.cos(a) * rx));
    y = (57 + (math.sin(a) * ry));
    c = new QColor((((_pymod(i, 3) === 0)) ? gas_light : gas_mid));
    c.setAlpha((25 + (_pymod(i, 4) * 10)));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    sx = (rect.width() * (0.018 + (_pymod(i, 3) * 0.006)));
    sy = (rect.height() * (0.014 + (_pymod(i, 2) * 0.006)));
    painter.drawEllipse(_p(rect, x, y), sx, sy);
  }
  for (i of range(38)) {
    a = ((t * 0.63) + ((i * math.tau) / 38));
    r = (42 + (_pymod(i, 6) * 2.1));
    x = (50 + (math.cos(a) * r));
    y = (56 + (math.sin(a) * (36 + (_pymod(i, 5) * 1.7))));
    if ((((28 < x) && (x < 72)) && ((38 < y) && (y < 72)) && _pymod(i, 5))) {
      continue;
    }
    c = new QColor((((_pymod(i, 5) === 0)) ? gas_hot : gas_light));
    c.setAlpha((38 + (_pymod(i, 5) * 18)));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(0.65, (rect.width() * (0.0024 + (_pymod(i, 4) * 0.0007))));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
  }
  head = new QPainterPath();
  head.moveTo(_p(rect, 17, 38));
  head.cubicTo(_p(rect, 7, 47), _p(rect, 8, 65), _p(rect, 18, 73));
  head.quadTo(_p(rect, 50, 82), _p(rect, 82, 73));
  head.cubicTo(_p(rect, 92, 65), _p(rect, 93, 47), _p(rect, 83, 38));
  head.lineTo(_p(rect, 72, 34));
  head.lineTo(_p(rect, 28, 34));
  head.closeSubpath();
  torso = new QPainterPath();
  torso.moveTo(_p(rect, 27, 73));
  torso.lineTo(_p(rect, 39, 83));
  torso.lineTo(_p(rect, 43, 103));
  torso.lineTo(_p(rect, 57, 103));
  torso.lineTo(_p(rect, 61, 83));
  torso.lineTo(_p(rect, 73, 73));
  torso.closeSubpath();
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor(black.red(), black.green(), black.blue(), 205));
  painter.drawPath(head);
  painter.drawPath(torso);
}

function _fg_ubahn_ghost(painter, rect, t, thin, medium) { // Python L5108
  let blue, c, cc, col, cold, dx, dy, f, i, phase, puffs, q, rx, ry, steel, visor, x, y;
  cold = new QColor("#E5F2FA");
  blue = new QColor("#8AA4B8");
  steel = new QColor("#667A8A");
  visor = new QPainterPath();
  visor.moveTo(_p(rect, 27, 31));
  visor.quadTo(_p(rect, 50, 24), _p(rect, 73, 31));
  visor.lineTo(_p(rect, 68, 43));
  visor.quadTo(_p(rect, 50, 47), _p(rect, 32, 43));
  visor.closeSubpath();
  painter.setPen(_pen(steel, (thin * 0.8), 185));
  painter.setBrush(new QColor(13, 17, 20, 235));
  painter.drawPath(visor);
  q = (0.5 + (0.5 * math.sin((t * 1.15))));
  c = new QColor(cold);
  c.setAlpha(int((70 + (q * 95))));
  painter.setPen(_pen(c, (thin * 0.65), c.alpha()));
  painter.drawLine(_p(rect, (31 + (q * 13)), 33), _p(rect, (45 + (q * 13)), 40));
  for (x of [39, 61]) {
    c = new QColor(cold);
    c.setAlpha(int((65 + (q * 85))));
    painter.setPen(_pen(c, (thin * 0.65), c.alpha()));
    painter.setBrush(new QColor(6, 9, 11, 180));
    painter.drawEllipse(_p(rect, x, 52), (rect.width() * 0.022), (rect.height() * 0.031));
  }
  puffs = [[14, 70, 8, 5, 0.0], [86, 69, 9, 6, 0.8], [19, 88, 10, 6, 1.5], [80, 88, 11, 7, 2.2], [34, 101, 11, 6, 2.8], [64, 101, 11, 6, 3.5]];
  for ([i, [x, y, rx, ry, phase]] of enumerate(puffs)) {
    dx = (math.sin(((t * 0.7) + phase)) * 2.5);
    dy = (math.cos(((t * 0.5) + phase)) * 1.5);
    col = (((_pymod(i, 2) === 0)) ? cold : blue);
    cc = new QColor(col);
    cc.setAlpha((35 + (_pymod(i, 3) * 15)));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(cc);
    painter.drawEllipse(_p(rect, (x + dx), (y + dy)), ((rect.width() * rx) / 100), ((rect.height() * ry) / 100));
  }
  f = painter.font();
  f.setFamily("Courier New");
  f.setBold(true);
  f.setPointSize(max(4, int((rect.height() * 0.024))));
  painter.setFont(f);
  cc = new QColor(cold);
  cc.setAlpha(115);
  painter.setPen(cc);
  painter.drawText(_rect(rect, 83, 72, 102, 81), Qt.AlignmentFlag.AlignCenter, "U3");
}

function _bg_night_rider(painter, rect, t) { // Python L5195
  let dash, i, y;
  painter.setPen(_pen("#55595C", max(1.0, (rect.width() * 0.005)), 75));
  painter.drawLine(_p(rect, 4, 101), _p(rect, 43, 72));
  painter.drawLine(_p(rect, 96, 101), _p(rect, 57, 72));
  dash = _pymod((t * 12), 12);
  for (i of range(4)) {
    y = ((80 + (i * 7)) + dash);
    painter.drawLine(_p(rect, 49, y), _p(rect, 51, (y + 3)));
  }
}

function _bg_autobahn(painter, rect, t) { // Python L5206
  _bg_night_rider(painter, rect, t);
}

function _paint_skin_accessory(painter, rect, style, pose, t) { // Python L5215
  let medium, sid, thin;
  if (((style.accessory === "none"))) {
    return undefined;
  }
  painter.save();
  painter.setRenderHint(QPainter.RenderHint.Antialiasing, true);
  thin = max(1.0, (rect.width() * 0.006));
  medium = max(1.2, (rect.width() * 0.008));
  sid = style.skin_id;
  if (((sid === "neon"))) {
    _fg_neon(painter, rect, t, thin, medium);
  }
  else {
    if (((sid === "professor"))) {
      _fg_professor(painter, rect, t, thin, medium);
    }
    else {
      if (((sid === "nightlife"))) {
        _fg_nightlife(painter, rect, t, thin, medium);
      }
      else {
        if (((sid === "winter"))) {
          _fg_winter(painter, rect, t, thin, medium);
        }
        else {
          if (((sid === "cyber"))) {
            _fg_cyber(painter, rect, t, thin, medium);
          }
          else {
            if (((sid === "royal"))) {
              _fg_royal(painter, rect, t, thin, medium);
            }
            else {
              if (((sid === "fire"))) {
                _fg_fire(painter, rect, t, thin, medium);
              }
              else {
                if (((sid === "berliner"))) {
                  _fg_octoberfest(painter, rect, t, thin, medium);
                }
                else {
                  if (((sid === "bahn"))) {
                    _fg_bahn(painter, rect, t, thin, medium);
                  }
                  else {
                    if (((sid === "graffiti"))) {
                      _fg_graffiti(painter, rect, t, thin, medium);
                    }
                    else {
                      if (((sid === "chef"))) {
                        _fg_chef(painter, rect, t, thin, medium);
                      }
                      else {
                        if (((sid === "courier"))) {
                          _fg_courier(painter, rect, t, thin, medium);
                        }
                        else {
                          if (((sid === "metro"))) {
                            _fg_metro_3am(painter, rect, t, thin, medium);
                          }
                          else {
                            if (((sid === "pilot"))) {
                              _fg_pilot(painter, rect, t, thin, medium);
                            }
                            else {
                              if (((sid === "skater"))) {
                                _fg_skater(painter, rect, t, thin, medium);
                              }
                              else {
                                if (((sid === "vinyl"))) {
                                  _fg_vinyl(painter, rect, t, thin, medium);
                                }
                                else {
                                  if (((sid === "alpen"))) {
                                    _fg_alpen(painter, rect, t, thin, medium);
                                  }
                                  else {
                                    if (((sid === "bavarian"))) {
                                      _fg_bavarian(painter, rect, t, thin, medium);
                                    }
                                    else {
                                      if (((sid === "datastream"))) {
                                        _fg_datastream(painter, rect, t, thin, medium);
                                      }
                                      else {
                                        if (((sid === "detective"))) {
                                          _fg_detective(painter, rect, t, thin, medium);
                                        }
                                        else {
                                          if (((sid === "doctor"))) {
                                            _fg_doctor(painter, rect, t, thin, medium);
                                          }
                                          else {
                                            if (((sid === "engineer"))) {
                                              _fg_engineer(painter, rect, t, thin, medium);
                                            }
                                            else {
                                              if (((sid === "fussball"))) {
                                                _fg_fussball(painter, rect, t, thin, medium);
                                              }
                                              else {
                                                if (((sid === "jazz"))) {
                                                  _fg_jazz(painter, rect, t, thin, medium);
                                                }
                                                else {
                                                  if (((sid === "kernel"))) {
                                                    _fg_kernel(painter, rect, t, thin, medium);
                                                  }
                                                  else {
                                                    if (((sid === "night_rider"))) {
                                                      _fg_night_rider(painter, rect, t, thin, medium);
                                                    }
                                                    else {
                                                      if (((sid === "redline"))) {
                                                        _fg_redline(painter, rect, t, thin, medium);
                                                      }
                                                      else {
                                                        if (((sid === "techno"))) {
                                                          _fg_techno_v2(painter, rect, t, thin, medium);
                                                        }
                                                        else {
                                                          if (((sid === "agent"))) {
                                                            _fg_agent(painter, rect, t, thin, medium);
                                                          }
                                                          else {
                                                            if (((sid === "autobahn"))) {
                                                              _fg_autobahn_v2(painter, rect, t, thin, medium);
                                                            }
                                                            else {
                                                              if (((sid === "circuit"))) {
                                                                _fg_circuit(painter, rect, t, thin, medium);
                                                              }
                                                              else {
                                                                if (((sid === "ghost"))) {
                                                                  _fg_ghost(painter, rect, t, thin, medium);
                                                                }
                                                                else {
                                                                  if (((sid === "glitch"))) {
                                                                    _fg_glitch(painter, rect, t, thin, medium);
                                                                  }
                                                                  else {
                                                                    if (((sid === "maestro"))) {
                                                                      _fg_maestro_v2(painter, rect, t, thin, medium);
                                                                    }
                                                                    else {
                                                                      if (((sid === "mechanic"))) {
                                                                        _fg_mechanic_v2(painter, rect, t, thin, medium);
                                                                      }
                                                                      else {
                                                                        if (((sid === "noir"))) {
                                                                          _fg_noir(painter, rect, t, thin, medium);
                                                                        }
                                                                        else {
                                                                          if (((sid === "null"))) {
                                                                            _fg_null(painter, rect, t, thin, medium);
                                                                          }
                                                                          else {
                                                                            if (((sid === "rockstar"))) {
                                                                              _fg_rockstar_v2(painter, rect, t, thin, medium);
                                                                            }
                                                                            else {
                                                                              if (((sid === "ubahn_ghost"))) {
                                                                                _fg_ubahn_ghost(painter, rect, t, thin, medium);
                                                                              }
                                                                              else {
                                                                                if (((sid === "astronaut"))) {
                                                                                  _fg_astronaut_v2(painter, rect, t, thin, medium);
                                                                                }
                                                                                else {
                                                                                  if (((sid === "chrome"))) {
                                                                                    _fg_chrome_v2(painter, rect, t, thin, medium);
                                                                                  }
                                                                                  else {
                                                                                    if (((sid === "eclipse"))) {
                                                                                      _fg_eclipse(painter, rect, t, thin, medium);
                                                                                    }
                                                                                    else {
                                                                                      if (((sid === "emperor"))) {
                                                                                        _fg_emperor(painter, rect, t, thin, medium);
                                                                                      }
                                                                                      else {
                                                                                        if (((sid === "samurai"))) {
                                                                                          _fg_samurai_legendary(painter, rect, t, thin, medium);
                                                                                        }
                                                                                        else {
                                                                                          if (((sid === "fernsehturm"))) {
                                                                                            _fg_fernsehturm(painter, rect, t, thin, medium);
                                                                                          }
                                                                                          else {
                                                                                            if (((sid === "prototype"))) {
                                                                                              _fg_prototype(painter, rect, t, thin, medium);
                                                                                            }
                                                                                            else {
                                                                                              if (((sid === "void"))) {
                                                                                                _fg_void_mythic(painter, rect, t, thin, medium);
                                                                                              }
                                                                                              else {
                                                                                                if (((sid === "monolith"))) {
                                                                                                  _fg_monolith_mythic(painter, rect, t, thin, medium);
                                                                                                }
                                                                                                else {
                                                                                                  if (((sid === "crt"))) {
                                                                                                    _fg_crt(painter, rect, t, thin, medium);
                                                                                                  }
                                                                                                  else {
                                                                                                    if ((_pyin(sid, new Set(["glyph", "analog"])))) {
                                                                                                      ;
                                                                                                    }
                                                                                                    else {
                                                                                                      _fg_extra_polished(painter, rect, sid, style, t, thin, medium);
                                                                                                    }
                                                                                                  }
                                                                                                }
                                                                                              }
                                                                                            }
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                            }
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  painter.restore();
}

function _fg_octoberfest(painter, rect, t, thin, medium) { // Python L5340
  let a, bird, brim, crown, cx, cy, depth, feather, foam_shift, gold, green, green_mid, grey, i, mug, mug_angle, p, rx, ry, sx, sy, white, x, y;
  green = new QColor("#254B31");
  green_mid = new QColor("#537D59");
  gold = new QColor("#D7A52A");
  white = new QColor("#F5F1E8");
  grey = new QColor("#9E988A");
  crown = new QPainterPath();
  crown.moveTo(_p(rect, 31, 30));
  crown.lineTo(_p(rect, 36, 17));
  crown.quadTo(_p(rect, 50, 11), _p(rect, 64, 17));
  crown.lineTo(_p(rect, 69, 30));
  crown.closeSubpath();
  painter.setPen(_pen(green_mid, medium, 240));
  painter.setBrush(green);
  painter.drawPath(crown);
  brim = new QPainterPath();
  brim.moveTo(_p(rect, 28, 29));
  brim.quadTo(_p(rect, 50, 33), _p(rect, 72, 29));
  painter.setPen(_pen(green_mid, (medium * 1.15), 245));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawPath(brim);
  painter.setPen(_pen(gold, (thin * 1.1), 210));
  painter.drawLine(_p(rect, 35, 25), _p(rect, 65, 25));
  feather = new QPainterPath();
  feather.moveTo(_p(rect, 64, 20));
  feather.cubicTo(_p(rect, 70, 12), _p(rect, 76, 11), _p(rect, 72, 22));
  painter.setPen(_pen(grey, (thin * 0.75), 150));
  painter.drawPath(feather);
  mug_angle = (math.sin(((t * 0.9) + 0.6)) * 1.2);
  painter.save();
  painter.translate(_p(rect, 16, 77));
  painter.rotate(mug_angle);
  [sx, sy] = [(rect.width() / 100), (rect.height() / 100)];
  mug = new QRectF((_pyneg(8) * sx), (_pyneg(12.5) * sy), (16 * sx), (23 * sy));
  painter.setPen(_pen(white, thin, 240));
  painter.setBrush(new QColor(215, 165, 42, 115));
  painter.drawRoundedRect(mug, 2.5, 2.5);
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor(224, 174, 50, 210));
  painter.drawRoundedRect(new QRectF((_pyneg(7) * sx), (_pyneg(6) * sy), (14 * sx), (15.5 * sy)), 1.5, 1.5);
  painter.setPen(_pen(white, thin, 220));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawArc(new QRectF((5.8 * sx), (_pyneg(6.8) * sy), (9 * sx), (12.5 * sy)), (_pyneg(90) * 16), (180 * 16));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(white);
  foam_shift = ((math.sin((t * 1.05)) * 0.35) * sy);
  for ([x, y, rx, ry] of [[_pyneg(4.4), _pyneg(12.4), 3.2, 1.8], [0, _pyneg(13.4), 3.8, 2.1], [4, _pyneg(12.2), 3.1, 1.7]]) {
    painter.drawEllipse(new QPointF((x * sx), ((y * sy) + foam_shift)), max(1, (rx * sx)), max(1, (ry * sy)));
  }
  painter.restore();
  [cx, cy, rx, ry] = [50, 8.5, 23, 5];
  painter.setPen(_pen(grey, max(1.0, (thin * 0.5)), 55));
  painter.drawEllipse(_rect(rect, (cx - rx), (cy - ry), (cx + rx), (cy + ry)));
  for (i of range(3)) {
    a = ((t * 0.95) + ((i * math.tau) / 3));
    x = (cx + (math.cos(a) * rx));
    y = (cy + (math.sin(a) * ry));
    depth = ((math.sin(a) + 1) / 2);
    p = _pen(grey, max(1.0, (thin * (0.65 + (depth * 0.22)))), int((75 + (depth * 85))));
    painter.setPen(p);
    bird = new QPainterPath();
    bird.moveTo(_p(rect, (x - 3), y));
    bird.quadTo(_p(rect, (x - 1.5), (y - 1.6)), _p(rect, x, y));
    bird.quadTo(_p(rect, (x + 1.5), (y - 1.6)), _p(rect, (x + 3), y));
    painter.drawPath(bird);
  }
}

function _fg_bahn(painter, rect, t, thin, medium) { // Python L5422
  let card, crown, f, green, yellow;
  green = new QColor("#315D3A");
  yellow = new QColor("#E8C85A");
  crown = new QPainterPath();
  crown.moveTo(_p(rect, 34, 29));
  crown.quadTo(_p(rect, 50, 15), _p(rect, 66, 29));
  crown.closeSubpath();
  painter.setPen(_pen("#6C9B70", thin, 220));
  painter.setBrush(new QColor(25, 50, 31, 230));
  painter.drawPath(crown);
  painter.setPen(_pen(green, medium, 240));
  painter.drawLine(_p(rect, 33, 29), _p(rect, 67, 29));
  painter.save();
  painter.translate(_p(rect, 79, 83));
  painter.rotate(_pyneg(12));
  painter.setPen(_pen(yellow, thin, 250));
  painter.setBrush(yellow);
  card = new QRectF((_pyneg(rect.width()) * 0.1), (_pyneg(rect.height()) * 0.07), (rect.width() * 0.2), (rect.height() * 0.14));
  painter.drawRoundedRect(card, 2, 2);
  f = painter.font();
  f.setBold(true);
  f.setPointSize(max(5, int((rect.height() * 0.05))));
  painter.setFont(f);
  painter.setPen(new QColor("#22251F"));
  painter.drawText(card, Qt.AlignmentFlag.AlignCenter, "BAHN");
  painter.restore();
}

function _fg_graffiti(painter, rect, t, thin, medium) { // Python L5454
  let c, crown, dx, i, magenta, metal, purple, q, rr, shake, sx, sy, visor, x, y;
  purple = new QColor("#843A98");
  magenta = new QColor("#C255CF");
  metal = new QColor("#CDD0D2");
  crown = new QPainterPath();
  crown.moveTo(_p(rect, 29, 27));
  crown.quadTo(_p(rect, 38, 12), _p(rect, 57, 13));
  crown.quadTo(_p(rect, 68, 15), _p(rect, 70, 28));
  crown.closeSubpath();
  painter.setPen(_pen(metal, medium, 230));
  painter.setBrush(new QColor("#171219"));
  painter.drawPath(crown);
  visor = new QPainterPath();
  visor.moveTo(_p(rect, 31, 24));
  visor.quadTo(_p(rect, 18, 25), _p(rect, 10, 30));
  visor.quadTo(_p(rect, 22, 32), _p(rect, 36, 28));
  visor.closeSubpath();
  painter.setBrush(new QColor("#201923"));
  painter.drawPath(visor);
  painter.setPen(_pen(purple, thin, 190));
  painter.drawLine(_p(rect, 13, 29), _p(rect, 31, 27));
  shake = (math.sin((t * 7.5)) * 3.4);
  dx = (math.sin((t * 10.5)) * 0.7);
  painter.save();
  painter.translate(_p(rect, (87.5 + dx), 76));
  painter.rotate(shake);
  [sx, sy] = [(rect.width() / 100), (rect.height() / 100)];
  painter.setPen(_pen(metal, thin, 230));
  painter.setBrush(new QColor("#202126"));
  painter.drawRoundedRect(new QRectF((_pyneg(5.8) * sx), (_pyneg(13.5) * sy), (11.6 * sx), (27 * sy)), 2.5, 2.5);
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor(194, 85, 207, 185));
  painter.drawRoundedRect(new QRectF((_pyneg(4.4) * sx), (_pyneg(3.8) * sy), (8.8 * sx), (7.4 * sy)), 1.2, 1.2);
  painter.setPen(_pen(metal, (thin * 0.8), 220));
  painter.setBrush(new QColor("#35363B"));
  painter.drawRoundedRect(new QRectF((_pyneg(2.9) * sx), (_pyneg(17.4) * sy), (5.8 * sx), (4 * sy)), 1, 1);
  painter.setBrush(new QColor("#17181B"));
  painter.drawRoundedRect(new QRectF((_pyneg(2.1) * sx), (_pyneg(19.8) * sy), (4.2 * sx), (2.5 * sy)), 0.8, 0.8);
  painter.restore();
  for (i of range(8)) {
    q = ((i + 1) / 8);
    x = (82 - (q * 18));
    y = ((58 + (math.sin(((t * 2) + (i * 1.6))) * 1.2)) + (((_pymod(i, 3) - 1) * q) * 4));
    c = new QColor(magenta);
    c.setAlpha(int((145 * (1 - (q * 0.6)))));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(0.7, (rect.width() * (0.0035 + (q * 0.002))));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
  }
}

function _fg_chef(painter, rect, t, thin, medium) { // Python L5513
  let i, p, pan_center, phase, shadow, sign, steam, toque, white, xoff;
  white = new QColor("#F7F5EF");
  shadow = new QColor("#B9B8B3");
  toque = new QPainterPath();
  toque.moveTo(_p(rect, 31, 31));
  toque.cubicTo(_p(rect, 29, 24), _p(rect, 34, 17), _p(rect, 40, 19));
  toque.cubicTo(_p(rect, 40, 11), _p(rect, 48, 9), _p(rect, 51, 17));
  toque.cubicTo(_p(rect, 55, 10), _p(rect, 64, 12), _p(rect, 62, 20));
  toque.cubicTo(_p(rect, 68, 19), _p(rect, 71, 25), _p(rect, 68, 31));
  toque.closeSubpath();
  painter.setPen(_pen(shadow, thin, 200));
  painter.setBrush(new QColor("#151617"));
  painter.drawPath(toque);
  painter.setPen(_pen(white, (medium * 1.1), 250));
  painter.drawLine(_p(rect, 31, 31), _p(rect, 68, 31));
  for (sign of [_pyneg(1), 1]) {
    p = new QPainterPath();
    p.moveTo(_p(rect, (50 + (sign * 0.8)), 67));
    p.cubicTo(_p(rect, (50 + (sign * 5)), 64), _p(rect, (50 + (sign * 11)), 64), _p(rect, (50 + (sign * 14)), 68));
    p.cubicTo(_p(rect, (50 + (sign * 10)), 67), _p(rect, (50 + (sign * 7)), 71), _p(rect, (50 + (sign * 0.8)), 68.4));
    p.closeSubpath();
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(white);
    painter.drawPath(p);
  }
  pan_center = _p(rect, 88, 78);
  painter.setPen(_pen("#B8BBBD", thin, 220));
  painter.setBrush(new QColor("#242629"));
  painter.drawEllipse(pan_center, (rect.width() * 0.067), (rect.height() * 0.06));
  painter.setPen(_pen("#B8BBBD", medium, 230));
  painter.drawLine(_p(rect, 92, 74), _p(rect, 100, 63));
  for ([i, xoff] of enumerate([_pyneg(2.4), 2.4])) {
    phase = math.sin(((t * 1.6) + i));
    steam = new QPainterPath();
    steam.moveTo(_p(rect, (88 + xoff), 69));
    steam.cubicTo(_p(rect, (87 + xoff), 66), _p(rect, ((89 + xoff) + (phase * 0.6)), 64), _p(rect, ((88 + xoff) + (phase * 0.8)), 61));
    painter.setPen(_pen("#CACACA", max(1.0, (thin * 0.65)), 75));
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.drawPath(steam);
  }
}

function _fg_courier(painter, rect, t, thin, medium) { // Python L5572
  let bounce, box, cap, f, label, parcel, red;
  red = new QColor("#FF3B30");
  parcel = new QColor("#C89A4B");
  cap = new QPainterPath();
  cap.moveTo(_p(rect, 32, 30));
  cap.cubicTo(_p(rect, 35, 22), _p(rect, 46, 19), _p(rect, 57, 21));
  cap.cubicTo(_p(rect, 62, 22), _p(rect, 66, 25), _p(rect, 67, 29));
  cap.closeSubpath();
  painter.setPen(_pen(red, thin, 235));
  painter.setBrush(new QColor("#261211"));
  painter.drawPath(cap);
  painter.setPen(_pen(red, medium, 240));
  painter.drawLine(_p(rect, 61, 29), _p(rect, 72, 31));
  painter.setPen(_pen("#777B7D", (thin * 0.75), 105));
  painter.drawLine(_p(rect, 31, 76), _p(rect, 63, 94));
  bounce = (math.sin((t * 3)) * 1.2);
  painter.setPen(_pen("#E6C47C", (thin * 0.8), 230));
  painter.setBrush(parcel);
  box = _rect(rect, 82, (70 + bounce), 98, (88 + bounce));
  painter.drawRoundedRect(box, 2, 2);
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor("#EEEAE0"));
  label = _rect(rect, 84.5, (73 + bounce), 92, (79 + bounce));
  painter.drawRoundedRect(label, 1, 1);
  f = painter.font();
  f.setFamily("Courier New");
  f.setBold(true);
  f.setPointSize(max(4, int((rect.height() * 0.027))));
  painter.setFont(f);
  painter.setPen(new QColor("#18191A"));
  painter.drawText(label, Qt.AlignmentFlag.AlignCenter, "DE");
}

function _fg_metro_3am(painter, rect, t, thin, medium) { // Python L5607
  let brim, brown, c, cap, dx, grey, i, lens, p, phase, pulse, rr, smoke, sy, y;
  brown = new QColor("#8B5A3C");
  grey = new QColor("#8C9194");
  lens = new QColor("#151719");
  cap = new QPainterPath();
  cap.moveTo(_p(rect, 31, 29));
  cap.quadTo(_p(rect, 38, 18), _p(rect, 52, 18));
  cap.quadTo(_p(rect, 63, 18), _p(rect, 68, 28));
  cap.closeSubpath();
  painter.setPen(_pen(brown, thin, 225));
  painter.setBrush(new QColor("#2C1F1A"));
  painter.drawPath(cap);
  brim = new QPainterPath();
  brim.moveTo(_p(rect, 57, 27));
  brim.quadTo(_p(rect, 70, 27), _p(rect, 77, 31));
  brim.quadTo(_p(rect, 66, 32), _p(rect, 55, 29));
  brim.closeSubpath();
  painter.setBrush(new QColor("#3A2922"));
  painter.drawPath(brim);
  painter.setPen(_pen(grey, medium, 230));
  painter.setBrush(new QColor(lens.red(), lens.green(), lens.blue(), 240));
  painter.drawRoundedRect(_rect(rect, 27.5, 43, 47.5, 56), 2, 2);
  painter.drawRoundedRect(_rect(rect, 52.5, 43, 72.5, 56), 2, 2);
  painter.drawLine(_p(rect, 47.5, 48.5), _p(rect, 52.5, 48.5));
  y = 67;
  painter.setPen(_pen("#EEEAE2", (medium * 0.9), 235));
  painter.drawLine(_p(rect, 78, y), _p(rect, 91, (y + 2)));
  painter.setPen(_pen(brown, (medium * 0.95), 235));
  painter.drawLine(_p(rect, 78, y), _p(rect, 82, (y + 0.6)));
  pulse = (0.5 + (0.5 * math.sin((t * 4.2))));
  c = new QColor("#FF633D");
  c.setAlpha(int((155 + (pulse * 100))));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(c);
  rr = max(1.0, (rect.width() * (0.005 + (pulse * 0.0015))));
  painter.drawEllipse(_p(rect, 91.3, (y + 2.1)), rr, rr);
  for (i of range(3)) {
    phase = _pymod(((t * 0.55) + (i * 0.33)), 1);
    sy = ((y - 6) - (phase * 18));
    dx = ((math.sin(((t * 1.3) + (i * 2.1))) * 2) + (phase * 2.5));
    smoke = new QColor("#A5A5A5");
    smoke.setAlpha(int((75 * (1 - phase))));
    painter.setPen(_pen(smoke, max(1.0, (thin * 0.65)), smoke.alpha()));
    p = new QPainterPath();
    p.moveTo(_p(rect, (91.5 + dx), (sy + 5)));
    p.cubicTo(_p(rect, (89.5 + dx), (sy + 2)), _p(rect, (94.5 + dx), sy), _p(rect, (91.5 + dx), (sy - 3)));
    painter.drawPath(p);
  }
}

function _fg_pilot(painter, rect, t, thin, medium) { // Python L5662
  let hud, left, mask, mask_edge, r, red, right, shell, shell_edge, shell_fill, tx, ty, v, visor, visor_edge;
  shell_edge = new QColor("#7FB1EA");
  shell_fill = new QColor("#204B78");
  visor = new QColor("#0F1215");
  visor_edge = new QColor("#AFC7DF");
  mask_edge = new QColor("#6E8FA8");
  hud = new QColor("#63A86F");
  red = new QColor("#FF3B30");
  shell = new QPainterPath();
  shell.moveTo(_p(rect, 2, 60));
  shell.cubicTo(_p(rect, 0, 26), _p(rect, 20, 1), _p(rect, 50, 0));
  shell.cubicTo(_p(rect, 80, 1), _p(rect, 100, 26), _p(rect, 98, 60));
  shell.cubicTo(_p(rect, 90, 69), _p(rect, 72, 75), _p(rect, 59, 76));
  shell.lineTo(_p(rect, 41, 76));
  shell.cubicTo(_p(rect, 28, 75), _p(rect, 10, 69), _p(rect, 2, 60));
  shell.closeSubpath();
  painter.setPen(_pen(shell_edge, (medium * 1.25), 245));
  painter.setBrush(new QColor(shell_fill.red(), shell_fill.green(), shell_fill.blue(), 225));
  painter.drawPath(shell);
  painter.setPen(_pen("#507AA4", (thin * 0.7), 100));
  painter.drawLine(_p(rect, 21, 9), _p(rect, 30, 32));
  painter.drawLine(_p(rect, 79, 9), _p(rect, 70, 32));
  v = new QPainterPath();
  v.moveTo(_p(rect, 12, 31));
  v.quadTo(_p(rect, 50, 17), _p(rect, 88, 31));
  v.lineTo(_p(rect, 80, 63));
  v.quadTo(_p(rect, 50, 70), _p(rect, 20, 63));
  v.closeSubpath();
  painter.setPen(_pen(visor_edge, (thin * 1.15), 225));
  painter.setBrush(new QColor(visor.red(), visor.green(), visor.blue(), 248));
  painter.drawPath(v);
  mask = new QPainterPath();
  mask.moveTo(_p(rect, 39, 61));
  mask.quadTo(_p(rect, 50, 55), _p(rect, 61, 61));
  mask.lineTo(_p(rect, 58, 77));
  mask.quadTo(_p(rect, 50, 82), _p(rect, 42, 77));
  mask.closeSubpath();
  painter.setPen(_pen(mask_edge, thin, 230));
  painter.setBrush(new QColor("#26333D"));
  painter.drawPath(mask);
  painter.setPen(_pen(hud, (thin * 0.7), 180));
  painter.drawLine(_p(rect, 46, 67), _p(rect, 54, 67));
  painter.setPen(_pen(shell_edge, (medium * 1.05), 235));
  left = new QPainterPath();
  left.moveTo(_p(rect, 42, 75));
  left.cubicTo(_p(rect, 31, 74), _p(rect, 17, 69), _p(rect, 2, 60));
  right = new QPainterPath();
  right.moveTo(_p(rect, 58, 75));
  right.cubicTo(_p(rect, 69, 74), _p(rect, 83, 69), _p(rect, 98, 60));
  painter.drawPath(left);
  painter.drawPath(right);
  painter.setPen(_pen(red, (thin * 0.85), 220));
  painter.drawLine(_p(rect, 43, 13), _p(rect, 57, 13));
  painter.drawLine(_p(rect, 47, 17), _p(rect, 50, 14));
  painter.drawLine(_p(rect, 50, 14), _p(rect, 53, 17));
  tx = ((91 + (math.sin((t * 0.72)) * 4.5)) + (math.sin((t * 1.31)) * 0.8));
  ty = (68 + (math.sin(((t * 0.47) + 1.1)) * 4.0));
  painter.setPen(_pen(hud, max(1.0, (thin * 0.65)), 165));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  r = (rect.width() * 0.032);
  painter.drawEllipse(_p(rect, tx, ty), r, r);
  painter.drawLine(_p(rect, (tx - 6), ty), _p(rect, (tx - 3), ty));
  painter.drawLine(_p(rect, (tx + 3), ty), _p(rect, (tx + 6), ty));
  painter.drawLine(_p(rect, tx, (ty - 6)), _p(rect, tx, (ty - 3)));
  painter.drawLine(_p(rect, tx, (ty + 3)), _p(rect, tx, (ty + 6)));
}

function _fg_skater(painter, rect, t, thin, medium) { // Python L5745
  let angle, b, board, dark, light, purple, sx, sy, wr, wx, wy, x;
  purple = new QColor("#8D52B5");
  light = new QColor("#BF86DC");
  dark = new QColor("#31203A");
  b = new QPainterPath();
  b.moveTo(_p(rect, 27, 31));
  b.cubicTo(_p(rect, 29, 17), _p(rect, 39, 8), _p(rect, 50, 8));
  b.cubicTo(_p(rect, 61, 8), _p(rect, 71, 17), _p(rect, 73, 31));
  b.closeSubpath();
  painter.setPen(_pen(light, thin, 230));
  painter.setBrush(dark);
  painter.drawPath(b);
  painter.setPen(_pen(purple, medium, 240));
  painter.drawLine(_p(rect, 28, 28), _p(rect, 72, 28));
  painter.setPen(_pen(light, (thin * 0.5), 95));
  for (x of [36, 43, 50, 57, 64]) {
    painter.drawLine(_p(rect, x, 13), _p(rect, (x - 1.5), 24));
  }
  painter.setPen(_pen("#67686D", thin, 150));
  painter.drawLine(_p(rect, 33, 76), _p(rect, 44, 85));
  painter.drawLine(_p(rect, 67, 76), _p(rect, 56, 85));
  angle = (math.sin((t * 1.35)) * 5.5);
  painter.save();
  painter.translate(_p(rect, 12.5, 69));
  painter.rotate(angle);
  [sx, sy] = [(rect.width() / 100), (rect.height() / 100)];
  board = new QPainterPath();
  board.moveTo(new QPointF((_pyneg(4.4) * sx), (_pyneg(20) * sy)));
  board.quadTo(new QPointF(0, (_pyneg(24) * sy)), new QPointF((4.4 * sx), (_pyneg(20) * sy)));
  board.lineTo(new QPointF((4.4 * sx), (20 * sy)));
  board.quadTo(new QPointF(0, (24 * sy)), new QPointF((_pyneg(4.4) * sx), (20 * sy)));
  board.closeSubpath();
  painter.setPen(_pen("#D0D1D2", thin, 230));
  painter.setBrush(new QColor("#202124"));
  painter.drawPath(board);
  painter.setPen(_pen(purple, thin, 220));
  painter.drawLine(new QPointF(0, (_pyneg(16) * sy)), new QPointF(0, (16 * sy)));
  painter.setPen(_pen("#898C90", (thin * 0.65), 200));
  painter.drawLine(new QPointF((_pyneg(5.5) * sx), (_pyneg(12) * sy)), new QPointF((5.5 * sx), (_pyneg(12) * sy)));
  painter.drawLine(new QPointF((_pyneg(5.5) * sx), (12 * sy)), new QPointF((5.5 * sx), (12 * sy)));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(purple);
  wr = max(1.0, (rect.width() * 0.006));
  for ([wx, wy] of [[_pyneg(6), _pyneg(12)], [6, _pyneg(12)], [_pyneg(6), 12], [6, 12]]) {
    painter.drawEllipse(new QPointF((wx * sx), (wy * sy)), wr, wr);
  }
  painter.restore();
}

function _fg_vinyl(painter, rect, t, thin, medium) { // Python L5797
  let a, band, brass, brass_dark, brass_light, c, centre, horn, hx, hy, i, inner, neck, pulse, radius, red, rr, steel, steel_dark, vinyl_black, wood, x;
  brass = new QColor("#C99C48");
  brass_light = new QColor("#E7C878");
  brass_dark = new QColor("#6B4E28");
  steel = new QColor("#B8BDC1");
  steel_dark = new QColor("#454A4E");
  wood = new QColor("#4C3024");
  vinyl_black = new QColor("#101113");
  red = new QColor("#FF3B30");
  painter.setBrush(Qt.BrushStyle.NoBrush);
  band = new QPainterPath();
  band.moveTo(_p(rect, 18, 52));
  band.cubicTo(_p(rect, 18, 25), _p(rect, 32, 14), _p(rect, 50, 14));
  band.cubicTo(_p(rect, 68, 14), _p(rect, 82, 25), _p(rect, 82, 52));
  painter.setPen(_pen(steel, (medium * 1.15), 235));
  painter.drawPath(band);
  painter.setPen(_pen(steel_dark, (thin * 0.75), 150));
  inner = new QPainterPath();
  inner.moveTo(_p(rect, 22, 49));
  inner.cubicTo(_p(rect, 23, 31), _p(rect, 35, 20), _p(rect, 50, 20));
  inner.cubicTo(_p(rect, 65, 20), _p(rect, 77, 31), _p(rect, 78, 49));
  painter.drawPath(inner);
  for (x of [17, 83]) {
    painter.setPen(_pen(steel, thin, 225));
    painter.setBrush(new QColor("#2E3134"));
    painter.drawRoundedRect(_rect(rect, (x - 5), 43, (x + 5), 62), 3, 3);
    painter.setPen(_pen(brass, (thin * 0.65), 190));
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.drawEllipse(_p(rect, x, 52.5), (rect.width() * 0.027), (rect.height() * 0.035));
  }
  painter.setPen(_pen(brass_dark, (thin * 0.7), 220));
  painter.setBrush(wood);
  painter.drawRoundedRect(_rect(rect, 78, 80, 97, 93), 2, 2);
  centre = _p(rect, 87.5, 77.5);
  painter.setPen(_pen("#666A6D", (thin * 0.55), 180));
  painter.setBrush(vinyl_black);
  radius = (rect.width() * 0.041);
  painter.drawEllipse(centre, radius, radius);
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.setPen(_pen("#45484A", (thin * 0.4), 120));
  painter.drawEllipse(centre, (radius * 0.72), (radius * 0.72));
  a = (t * 2.5);
  hx = (87.5 + (math.cos(a) * 2.7));
  hy = (77.5 + (math.sin(a) * 2.7));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(red);
  rr = max(0.7, (rect.width() * 0.004));
  painter.drawEllipse(_p(rect, hx, hy), rr, rr);
  neck = new QPainterPath();
  neck.moveTo(_p(rect, 89, 76));
  neck.cubicTo(_p(rect, 94, 68), _p(rect, 90, 60), _p(rect, 84, 58));
  painter.setPen(_pen(brass_dark, (medium * 0.8), 230));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawPath(neck);
  horn = new QPainterPath();
  horn.moveTo(_p(rect, 84, 58));
  horn.cubicTo(_p(rect, 76, 54), _p(rect, 71, 47), _p(rect, 69, 40));
  horn.cubicTo(_p(rect, 80, 42), _p(rect, 91, 47), _p(rect, 96, 54));
  horn.cubicTo(_p(rect, 91, 58), _p(rect, 87, 59), _p(rect, 84, 58));
  horn.closeSubpath();
  painter.setPen(_pen(brass_light, thin, 235));
  painter.setBrush(new QColor(brass.red(), brass.green(), brass.blue(), 205));
  painter.drawPath(horn);
  pulse = (0.5 + (0.5 * math.sin((t * 1.7))));
  for (i of range(2)) {
    c = new QColor(brass_light);
    c.setAlpha(int(((48 + (pulse * 45)) - (i * 12))));
    painter.setPen(_pen(c, max(1.0, (thin * 0.5)), c.alpha()));
    painter.drawArc(_rect(rect, (93 + (i * 4)), (42 - (i * 2)), (106 + (i * 5)), (66 + (i * 2))), (_pyneg(70) * 16), (130 * 16));
  }
}

function _fg_alpen(painter, rect, t, thin, medium) { // Python L5946
  let beanie, red, red_dark, white, x;
  red = new QColor("#A8463F");
  red_dark = new QColor("#4C2827");
  white = new QColor("#EAEFF2");
  beanie = new QPainterPath();
  beanie.moveTo(_p(rect, 30, 29));
  beanie.cubicTo(_p(rect, 33, 16), _p(rect, 41, 10), _p(rect, 50, 10));
  beanie.cubicTo(_p(rect, 59, 10), _p(rect, 67, 16), _p(rect, 70, 29));
  beanie.closeSubpath();
  painter.setPen(_pen(red, thin, 225));
  painter.setBrush(red_dark);
  painter.drawPath(beanie);
  painter.setPen(_pen(red, medium, 235));
  painter.drawLine(_p(rect, 31, 27), _p(rect, 69, 27));
  painter.setPen(_pen(white, (thin * 0.5), 90));
  for (x of [42, 50, 58]) {
    painter.drawLine(_p(rect, (x - 1.8), 18), _p(rect, (x + 1.8), 22));
    painter.drawLine(_p(rect, (x + 1.8), 18), _p(rect, (x - 1.8), 22));
  }
}

function _fg_bavarian(painter, rect, t, thin, medium) { // Python L5986
  let crown, feather, felt_dark, gold, green, green_light, plume, pulse;
  green = new QColor("#2E5A37");
  green_light = new QColor("#5B8A61");
  felt_dark = new QColor("#1E3323");
  feather = new QColor("#ECE5D8");
  gold = new QColor("#D6A33D");
  crown = new QPainterPath();
  crown.moveTo(_p(rect, 29, 29));
  crown.quadTo(_p(rect, 38, 15), _p(rect, 52, 15));
  crown.quadTo(_p(rect, 64, 16), _p(rect, 69, 29));
  crown.closeSubpath();
  painter.setPen(_pen(green_light, thin, 230));
  painter.setBrush(felt_dark);
  painter.drawPath(crown);
  painter.setPen(_pen(green, (medium * 1.1), 240));
  painter.drawLine(_p(rect, 26, 29), _p(rect, 72, 29));
  plume = new QPainterPath();
  plume.moveTo(_p(rect, 63, 22));
  plume.cubicTo(_p(rect, 70, 10), _p(rect, 77, 10), _p(rect, 72, 25));
  painter.setPen(_pen(feather, (thin * 0.8), 185));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawPath(plume);
  painter.setPen(_pen(gold, (medium * 0.9), 220));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawEllipse(_p(rect, 89, 78), (rect.width() * 0.042), (rect.height() * 0.05));
  painter.drawEllipse(_p(rect, 95, 78), (rect.width() * 0.042), (rect.height() * 0.05));
  painter.drawLine(_p(rect, 86, 75), _p(rect, 98, 84));
  painter.drawLine(_p(rect, 98, 75), _p(rect, 86, 84));
  pulse = (math.sin((t * 1.3)) * 1.0);
  painter.setPen(_pen("#F1D58B", (thin * 0.45), 70));
  painter.drawArc(_rect(rect, 82, (70 + pulse), 101, (89 + pulse)), (20 * 16), (100 * 16));
}

function _fg_datastream(painter, rect, t, thin, medium) { // Python L6052
  let blue, c, cyan, i, length, phase, side, x;
  cyan = new QColor("#5FD7E5");
  blue = new QColor("#3E7AA8");
  for ([side, x] of [["left", 4], ["right", 90]]) {
    for (i of range(4)) {
      phase = _pymod(((t * 1.3) + (i * 0.4)), 1.0);
      length = (3 + (phase * 6));
      c = new QColor((((_pymod(i, 2) === 0)) ? cyan : blue));
      c.setAlpha((55 + (i * 20)));
      painter.setPen(_pen(c, (thin * 0.5), c.alpha()));
      if (((side === "left"))) {
        painter.drawLine(_p(rect, x, (35 + (i * 11))), _p(rect, (x + length), (35 + (i * 11))));
      }
      else {
        painter.drawLine(_p(rect, x, (35 + (i * 11))), _p(rect, (x + length), (35 + (i * 11))));
      }
    }
  }
}

function _fg_detective(painter, rect, t, thin, medium) { // Python L6085
  let brass, c, cx, cy, glass, hat, hat_dark, hat_edge, hat_mid, i, phase, pipe, pipe_wood, puff, smoke, wobble, x, y;
  hat_dark = new QColor("#2C2927");
  hat_mid = new QColor("#625A52");
  hat_edge = new QColor("#B4ABA2");
  brass = new QColor("#C99C48");
  glass = new QColor("#9EC3D8");
  pipe_wood = new QColor("#7C4A2E");
  smoke = new QColor("#A8A8A8");
  hat = new QPainterPath();
  hat.moveTo(_p(rect, 31, 29));
  hat.quadTo(_p(rect, 37, 16), _p(rect, 49, 15));
  hat.quadTo(_p(rect, 61, 16), _p(rect, 67, 29));
  hat.closeSubpath();
  painter.setPen(_pen(hat_edge, thin, 210));
  painter.setBrush(hat_dark);
  painter.drawPath(hat);
  painter.setPen(_pen(hat_mid, medium, 225));
  painter.drawLine(_p(rect, 24, 29), _p(rect, 75, 29));
  painter.setPen(_pen(brass, (thin * 0.7), 145));
  painter.drawLine(_p(rect, 35, 24), _p(rect, 64, 24));
  wobble = (math.sin((t * 1.15)) * 1.5);
  [cx, cy] = [(94 + wobble), 70];
  painter.setPen(_pen(hat_edge, medium, 220));
  painter.setBrush(new QColor(glass.red(), glass.green(), glass.blue(), 30));
  painter.drawEllipse(_p(rect, cx, cy), (rect.width() * 0.052), (rect.height() * 0.067));
  painter.drawLine(_p(rect, (cx - 3), (cy + 5)), _p(rect, (cx - 10), (cy + 16)));
  pipe = new QPainterPath();
  pipe.moveTo(_p(rect, 57, 68));
  pipe.cubicTo(_p(rect, 66, 70), _p(rect, 72, 72), _p(rect, 78, 75));
  painter.setPen(_pen(pipe_wood, (medium * 0.85), 225));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawPath(pipe);
  painter.setPen(_pen(pipe_wood, thin, 225));
  painter.setBrush(new QColor("#3A2419"));
  painter.drawRoundedRect(_rect(rect, 76, 70, 84, 78), 2, 2);
  for (i of range(2)) {
    phase = _pymod(((t * 0.45) + (i * 0.5)), 1.0);
    x = (82 + (math.sin((t + i)) * 1.2));
    y = (68 - (phase * 13));
    c = new QColor(smoke);
    c.setAlpha(int((65 * (1 - phase))));
    painter.setPen(_pen(c, (thin * 0.55), c.alpha()));
    puff = new QPainterPath();
    puff.moveTo(_p(rect, x, (y + 4)));
    puff.cubicTo(_p(rect, (x - 1.5), (y + 1)), _p(rect, (x + 2), y), _p(rect, x, (y - 3)));
    painter.drawPath(puff);
  }
}

function _fg_doctor(painter, rect, t, thin, medium) { // Python L6167
  let c, glint, rr, steel, white;
  white = new QColor("#ECEEEF");
  steel = new QColor("#AEB4B8");
  painter.setPen(_pen(steel, thin, 210));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawArc(_rect(rect, 32, 13, 68, 31), 0, (180 * 16));
  painter.setPen(_pen(white, thin, 235));
  painter.setBrush(new QColor(37, 42, 45, 185));
  painter.drawEllipse(_p(rect, 50, 17), (rect.width() * 0.039), (rect.width() * 0.039));
  glint = (0.5 + (0.5 * math.sin((t * 1.8))));
  c = new QColor("#FFFFFF");
  c.setAlpha(int((65 + (glint * 105))));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(c);
  rr = max(0.7, (rect.width() * 0.003));
  painter.drawEllipse(_p(rect, (48.8 + (glint * 0.5)), 15.8), rr, rr);
}

function _fg_engineer(painter, rect, t, thin, medium) { // Python L6204
  let armor_gold, armor_gold_light, armor_red, armor_red_dark, body, cyan, cyan_hot, drone_eye, eye_c, faceplate, helmet, orbit_x, orbit_y, pulse, reactor_r, rr, thruster;
  armor_red = new QColor("#A91F24");
  armor_red_dark = new QColor("#521418");
  armor_gold = new QColor("#D6A33D");
  armor_gold_light = new QColor("#F1C96A");
  cyan = new QColor("#79E7FF");
  cyan_hot = new QColor("#D9FAFF");
  helmet = new QPainterPath();
  helmet.moveTo(_p(rect, 21, 38));
  helmet.lineTo(_p(rect, 30, 17));
  helmet.quadTo(_p(rect, 50, 8), _p(rect, 70, 17));
  helmet.lineTo(_p(rect, 79, 38));
  helmet.lineTo(_p(rect, 72, 62));
  helmet.quadTo(_p(rect, 50, 70), _p(rect, 28, 62));
  helmet.closeSubpath();
  painter.setPen(_pen(armor_gold, thin, 235));
  painter.setBrush(new QColor(armor_red_dark.red(), armor_red_dark.green(), armor_red_dark.blue(), 225));
  painter.drawPath(helmet);
  faceplate = new QPainterPath();
  faceplate.moveTo(_p(rect, 31, 31));
  faceplate.quadTo(_p(rect, 50, 21), _p(rect, 69, 31));
  faceplate.lineTo(_p(rect, 64, 56));
  faceplate.quadTo(_p(rect, 50, 62), _p(rect, 36, 56));
  faceplate.closeSubpath();
  painter.setPen(_pen(armor_gold_light, (thin * 0.8), 225));
  painter.setBrush(new QColor(120, 80, 20, 145));
  painter.drawPath(faceplate);
  painter.setPen(_pen(armor_red, medium, 240));
  painter.drawLine(_p(rect, 31, 29), _p(rect, 42, 19));
  painter.drawLine(_p(rect, 69, 29), _p(rect, 58, 19));
  pulse = (0.5 + (0.5 * math.sin((t * 2.8))));
  eye_c = new QColor(cyan);
  eye_c.setAlpha(int((170 + (pulse * 80))));
  painter.setPen(_pen(eye_c, (medium * 0.9), eye_c.alpha()));
  painter.drawLine(_p(rect, 31, 47), _p(rect, 43, 45));
  painter.drawLine(_p(rect, 57, 45), _p(rect, 69, 47));
  painter.setPen(_pen(armor_red, thin, 200));
  painter.drawLine(_p(rect, 35, 76), _p(rect, 44, 84));
  painter.drawLine(_p(rect, 65, 76), _p(rect, 56, 84));
  reactor_r = (rect.width() * (0.035 + (pulse * 0.004)));
  painter.setPen(_pen(cyan_hot, thin, int((150 + (pulse * 100)))));
  painter.setBrush(new QColor(121, 231, 255, 45));
  painter.drawEllipse(_p(rect, 50, 82), reactor_r, reactor_r);
  painter.setPen(_pen(cyan, (thin * 0.65), 190));
  painter.drawEllipse(_p(rect, 50, 82), (reactor_r * 0.45), (reactor_r * 0.45));
  orbit_x = (91 + (math.sin((t * 1.05)) * 3.5));
  orbit_y = (39 + (math.sin(((t * 0.73) + 0.8)) * 4.0));
  body = _rect(rect, (orbit_x - 5.5), (orbit_y - 3), (orbit_x + 5.5), (orbit_y + 3));
  painter.setPen(_pen(armor_gold, (thin * 0.7), 215));
  painter.setBrush(new QColor("#2A3035"));
  painter.drawRoundedRect(body, 2, 2);
  painter.setPen(Qt.PenStyle.NoPen);
  drone_eye = new QColor(cyan_hot);
  drone_eye.setAlpha(int((155 + (pulse * 100))));
  painter.setBrush(drone_eye);
  rr = max(0.8, (rect.width() * 0.004));
  painter.drawEllipse(_p(rect, orbit_x, orbit_y), rr, rr);
  painter.setPen(_pen(armor_red, thin, 210));
  painter.drawLine(_p(rect, (orbit_x - 5), orbit_y), _p(rect, (orbit_x - 10), (orbit_y - 3)));
  painter.drawLine(_p(rect, (orbit_x + 5), orbit_y), _p(rect, (orbit_x + 10), (orbit_y - 3)));
  thruster = new QColor(cyan);
  thruster.setAlpha(110);
  painter.setPen(_pen(thruster, (thin * 0.6), thruster.alpha()));
  painter.drawLine(_p(rect, (orbit_x - 3), (orbit_y + 3)), _p(rect, (orbit_x - 4), (orbit_y + 7)));
  painter.drawLine(_p(rect, (orbit_x + 3), (orbit_y + 3)), _p(rect, (orbit_x + 4), (orbit_y + 7)));
}

function _fg_fussball(painter, rect, t, thin, medium) { // Python L6333
  let col, curl, direction, hair_dark, hair_high, hair_mid, i, lower, p, phase, red, root, shield, side, sway, top, x, yellow;
  red = new QColor("#C9202E");
  yellow = new QColor("#F2C94C");
  hair_dark = new QColor("#25150F");
  hair_mid = new QColor("#44281C");
  hair_high = new QColor("#65412D");
  painter.setBrush(Qt.BrushStyle.NoBrush);
  top = new QPainterPath();
  top.moveTo(_p(rect, 16, 35));
  top.cubicTo(_p(rect, 24, 21), _p(rect, 38, 16), _p(rect, 50, 16));
  top.cubicTo(_p(rect, 63, 16), _p(rect, 76, 21), _p(rect, 84, 35));
  painter.setPen(_pen(hair_mid, (medium * 1.25), 235));
  painter.drawPath(top);
  for (side of [_pyneg(1), 1]) {
    root = (((side < 0)) ? 15 : 85);
    for (i of range(4)) {
      phase = math.sin((((t * 0.72) + (i * 0.82)) + (((side < 0)) ? 0.0 : 1.45)));
      sway = (phase * 1.8);
      p = new QPainterPath();
      p.moveTo(_p(rect, (root + ((side * i) * 1.6)), (29 + (i * 4))));
      p.cubicTo(_p(rect, (root + (side * (9 + sway))), (43 + (i * 3))), _p(rect, (root + (side * (4 - sway))), (63 + (i * 3))), _p(rect, (root + (side * (9 + sway))), (92 - (i * 2))));
      col = [hair_dark, hair_mid, hair_high, hair_mid][i];
      painter.setPen(_pen(col, (medium * (1.12 - (i * 0.07))), (230 - (i * 14))));
      painter.drawPath(p);
    }
  }
  for ([x, direction] of [[17, _pyneg(1)], [83, 1]]) {
    curl = new QPainterPath();
    curl.moveTo(_p(rect, x, 44));
    curl.cubicTo(_p(rect, (x + (direction * 8)), 47), _p(rect, (x + (direction * 8)), 58), _p(rect, x, 63));
    painter.setPen(_pen(hair_mid, (medium * 0.9), 195));
    painter.drawPath(curl);
  }
  for ([x, direction] of [[14, _pyneg(1)], [86, 1]]) {
    lower = new QPainterPath();
    lower.moveTo(_p(rect, x, 67));
    lower.cubicTo(_p(rect, (x + (direction * 5)), 73), _p(rect, (x + (direction * 5)), 82), _p(rect, (x + (direction * 1)), 88));
    painter.setPen(_pen(hair_dark, (medium * 0.8), 180));
    painter.drawPath(lower);
  }
  shield = new QPainterPath();
  shield.moveTo(_p(rect, 85, 78));
  shield.lineTo(_p(rect, 96, 78));
  shield.lineTo(_p(rect, 95, 88));
  shield.quadTo(_p(rect, 90.5, 93), _p(rect, 86, 88));
  shield.closeSubpath();
  painter.setPen(_pen(yellow, (thin * 0.75), 230));
  painter.setBrush(red);
  painter.drawPath(shield);
  painter.setPen(_pen(yellow, (medium * 0.7), 225));
  painter.drawLine(_p(rect, 87, 82), _p(rect, 94, 82));
  function draw_star(cx, cy, r) { // Python L6454
    let a, idx, pts, rr;
    pts = [];
    for (idx of range(10)) {
      a = ((_pyneg(math.pi) / 2) + ((idx * math.pi) / 5));
      rr = (((_pymod(idx, 2) === 0)) ? r : (r * 0.42));
      pts.push(_p(rect, (cx + (math.cos(a) * rr)), (cy + (math.sin(a) * rr))));
    }
    painter.drawPolygon(new QPolygonF(pts));
  }
  painter.setPen(_pen(yellow, (thin * 0.45), 215));
  painter.setBrush(new QColor(242, 201, 76, 115));
  draw_star(88.2, 74.2, 2.0);
  draw_star(92.8, 74.2, 2.0);
}

function _fg_jazz(painter, rect, t, thin, medium) { // Python L6477
  let bell, bell_y, black, bob, brass, crook, direction, h, hat, hat_edge, i, rr, silver, silver_dim, top, x, yy;
  hat_edge = new QColor("#B8B1A8");
  hat = new QColor("#292623");
  brass = new QColor("#C69B4C");
  silver = new QColor("#D2D7DA");
  silver_dim = new QColor("#8E969B");
  black = new QColor("#111214");
  h = new QPainterPath();
  h.moveTo(_p(rect, 34, 28));
  h.quadTo(_p(rect, 41, 17), _p(rect, 61, 19));
  h.lineTo(_p(rect, 66, 28));
  h.closeSubpath();
  painter.setPen(_pen(hat_edge, thin, 220));
  painter.setBrush(hat);
  painter.drawPath(h);
  painter.setPen(_pen(hat_edge, medium, 225));
  painter.drawLine(_p(rect, 29, 28), _p(rect, 71, 28));
  painter.setPen(_pen(brass, (thin * 0.6), 145));
  painter.drawLine(_p(rect, 37, 24), _p(rect, 63, 24));
  x = 89.0;
  top = 37.0;
  bell_y = 90.0;
  crook = new QPainterPath();
  crook.moveTo(_p(rect, (x - 2), (top + 5)));
  crook.cubicTo(_p(rect, (x + 5), (top - 3)), _p(rect, (x + 8), (top + 3)), _p(rect, (x + 4), (top + 9)));
  painter.setPen(_pen(silver, (medium * 0.75), 230));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawPath(crook);
  painter.setPen(_pen(black, (medium * 0.85), 250));
  painter.drawLine(_p(rect, (x - 3.5), (top + 4)), _p(rect, (x - 7.5), (top + 1)));
  painter.setPen(_pen(black, (medium * 1.35), 255));
  painter.drawLine(_p(rect, (x + 3), (top + 9)), _p(rect, (x + 3), (bell_y - 11)));
  painter.setPen(_pen(silver_dim, (thin * 0.55), 175));
  painter.drawLine(_p(rect, (x + 1), (top + 12)), _p(rect, (x + 1), (bell_y - 13)));
  painter.setPen(_pen(silver, (thin * 0.48), 190));
  for ([i, yy] of enumerate([52, 58, 64, 70, 76])) {
    direction = (((_pymod(i, 2) === 0)) ? _pyneg(1) : 1);
    painter.drawLine(_p(rect, (x + 1), yy), _p(rect, ((x + 1) + (direction * 5.5)), (yy + 1.5)));
    rr = max(0.6, (rect.width() * 0.0028));
    painter.setBrush(silver);
    painter.setPen(Qt.PenStyle.NoPen);
    painter.drawEllipse(_p(rect, ((x + 1) + (direction * 5.5)), (yy + 1.5)), rr, rr);
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.setPen(_pen(silver, (thin * 0.48), 190));
  }
  bell = new QPainterPath();
  bell.moveTo(_p(rect, (x - 2), (bell_y - 12)));
  bell.lineTo(_p(rect, (x + 8), (bell_y - 12)));
  bell.cubicTo(_p(rect, (x + 10), (bell_y - 5)), _p(rect, (x + 10), (bell_y - 2)), _p(rect, (x + 4), bell_y));
  bell.cubicTo(_p(rect, (x - 5), (bell_y - 2)), _p(rect, (x - 5), (bell_y - 5)), _p(rect, (x - 2), (bell_y - 12)));
  painter.setPen(_pen(silver, (thin * 0.7), 220));
  painter.setBrush(new QColor(110, 116, 120, 120));
  painter.drawPath(bell);
  painter.setPen(_pen(silver_dim, (thin * 0.7), 185));
  painter.drawLine(_p(rect, (x + 3), bell_y), _p(rect, (x + 3), 101));
  bob = (math.sin((t * 1.4)) * 1.2);
  painter.setPen(_pen(brass, (thin * 0.65), 100));
  painter.drawLine(_p(rect, 98, (52 + bob)), _p(rect, 98, (45 + bob)));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(brass);
  rr = max(0.7, (rect.width() * 0.0038));
  painter.drawEllipse(_p(rect, 96.5, (53 + bob)), rr, rr);
}

function _fg_kernel(painter, rect, t, thin, medium) { // Python L6606
  let blink, cx, cy, dark, er, f, green, green_dim, green_hot, module, pulse, visor, white, yellow;
  green = new QColor("#5AD66F");
  green_hot = new QColor("#A8FFB0");
  green_dim = new QColor("#1E642D");
  dark = new QColor("#071109");
  white = new QColor("#E5E5E5");
  yellow = new QColor("#D9A93A");
  visor = _rect(rect, 27, 31, 73, 40);
  painter.setPen(_pen(green, (thin * 0.7), 180));
  painter.setBrush(new QColor(4, 16, 7, 210));
  painter.drawRoundedRect(visor, 2, 2);
  f = painter.font();
  f.setFamily("Courier New");
  f.setBold(true);
  f.setPointSize(max(4, int((rect.height() * 0.027))));
  painter.setFont(f);
  blink = (((_pymod(int((t * 2)), 2) === 0)) ? "_" : " ");
  painter.setPen(green_hot);
  painter.drawText(visor, Qt.AlignmentFlag.AlignCenter, `root@klaus:~$ ${blink}`);
  [cx, cy] = [90, 78];
  painter.setPen(_pen(white, (thin * 0.55), 150));
  painter.setBrush(new QColor("#101214"));
  painter.drawEllipse(_p(rect, cx, cy), (rect.width() * 0.052), (rect.height() * 0.072));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor("#D9D9D9"));
  painter.drawEllipse(_p(rect, cx, (cy + 2)), (rect.width() * 0.028), (rect.height() * 0.042));
  painter.setBrush(white);
  er = max(0.7, (rect.width() * 0.0033));
  painter.drawEllipse(_p(rect, (cx - 2), (cy - 4)), er, er);
  painter.drawEllipse(_p(rect, (cx + 2), (cy - 4)), er, er);
  painter.setBrush(yellow);
  painter.drawPolygon(new QPolygonF([_p(rect, (cx - 2), cy), _p(rect, (cx + 2), cy), _p(rect, cx, (cy + 2.5))]));
  painter.drawLine(_p(rect, (cx - 4), (cy + 7)), _p(rect, (cx - 1), (cy + 7)));
  painter.drawLine(_p(rect, (cx + 1), (cy + 7)), _p(rect, (cx + 4), (cy + 7)));
  module = _rect(rect, 4, 73, 18, 86);
  painter.setPen(_pen(green_dim, (thin * 0.55), 135));
  painter.setBrush(new QColor(3, 13, 5, 175));
  painter.drawRoundedRect(module, 2, 2);
  painter.setPen(green);
  f.setPointSize(max(4, int((rect.height() * 0.022))));
  painter.setFont(f);
  painter.drawText(module, Qt.AlignmentFlag.AlignCenter, ".ko");
  pulse = (0.5 + (0.5 * math.sin((t * 1.8))));
  painter.setPen(_pen(green, (thin * 0.55), int((45 + (pulse * 85)))));
  painter.drawLine(_p(rect, 1, 80), _p(rect, 4, 80));
}

function _fg_night_rider(painter, rect, t, thin, medium) { // Python L6709
  let black, red, red_dark, scan, shell, steel, sx, visor, x;
  red = new QColor("#FF2E2E");
  red_dark = new QColor("#75161B");
  steel = new QColor("#6A7278");
  black = new QColor("#090B0D");
  shell = new QPainterPath();
  shell.moveTo(_p(rect, 24, 41));
  shell.quadTo(_p(rect, 31, 25), _p(rect, 50, 24));
  shell.quadTo(_p(rect, 69, 25), _p(rect, 76, 41));
  painter.setPen(_pen(steel, (thin * 0.7), 150));
  painter.setBrush(new QColor(10, 12, 14, 205));
  painter.drawPath(shell);
  visor = new QPainterPath();
  visor.moveTo(_p(rect, 28, 42));
  visor.quadTo(_p(rect, 50, 38), _p(rect, 72, 42));
  visor.lineTo(_p(rect, 69, 52));
  visor.quadTo(_p(rect, 50, 55), _p(rect, 31, 52));
  visor.closeSubpath();
  painter.setPen(_pen(steel, (thin * 0.55), 145));
  painter.setBrush(new QColor(5, 7, 8, 240));
  painter.drawPath(visor);
  scan = (0.5 + (0.5 * math.sin((t * 1.85))));
  sx = (33 + (scan * 34));
  painter.setPen(_pen(red, (medium * 0.8), 235));
  painter.drawLine(_p(rect, sx, 43), _p(rect, sx, 51));
  for (x of [20, 80]) {
    painter.setPen(_pen(steel, (thin * 0.55), 120));
    painter.setBrush(new QColor("#17191C"));
    painter.drawRoundedRect(_rect(rect, (x - 3.2), 55, (x + 3.2), 64), 2, 2);
  }
  painter.setPen(_pen(red_dark, (thin * 0.7), 110));
  painter.drawLine(_p(rect, 76, 69), _p(rect, 84, 67));
}

function _fg_redline(painter, rect, t, thin, medium) { // Python L6807
  let a, band_h, black, c, cell_h, cell_w, col, cols, cx, cy, f, ferrari_yellow, green, grey, horse, i, needle_a, q, radius, red, row, rows, shield, white, x0, x1, y0;
  red = new QColor("#E1251B");
  ferrari_yellow = new QColor("#FFD21F");
  white = new QColor("#F2F2F2");
  black = new QColor("#0A0B0C");
  grey = new QColor("#686D71");
  green = new QColor("#159447");
  x0 = _pyneg(13.0);
  x1 = 113.0;
  y0 = 1.5;
  band_h = 8.5;
  cols = 16;
  rows = 2;
  cell_w = ((x1 - x0) / cols);
  cell_h = (band_h / rows);
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor(10, 11, 12, 220));
  painter.drawRect(_rect(rect, x0, (y0 - 1), x1, ((y0 + band_h) + 1)));
  for (row of range(rows)) {
    for (col of range(cols)) {
      painter.setBrush((((_pymod((row + col), 2) === 0)) ? white : black));
      painter.drawRect(_rect(rect, (x0 + (col * cell_w)), (y0 + (row * cell_h)), (x0 + ((col + 1) * cell_w)), (y0 + ((row + 1) * cell_h))));
    }
  }
  painter.setPen(_pen(red, max(1.0, (thin * 0.75)), 185));
  painter.drawLine(_p(rect, x0, ((y0 + band_h) + 1.2)), _p(rect, x1, ((y0 + band_h) + 1.2)));
  [cx, cy] = [9.0, 83.0];
  radius = 12.5;
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.setPen(_pen(grey, (thin * 0.65), 110));
  painter.drawArc(_rect(rect, (cx - radius), (cy - radius), (cx + radius), (cy + radius)), (130 * 16), (160 * 16));
  q = (0.5 + (0.5 * math.sin((t * 2.35))));
  painter.setPen(_pen(red, (medium * 0.75), 225));
  painter.drawArc(_rect(rect, (cx - radius), (cy - radius), (cx + radius), (cy + radius)), (130 * 16), int(((60 + (q * 90)) * 16)));
  for (i of range(7)) {
    a = math.radians((140 + (i * 20)));
    c = new QColor((((i >= 5)) ? red : white));
    c.setAlpha(135);
    painter.setPen(_pen(c, (thin * 0.4), c.alpha()));
    painter.drawLine(_p(rect, (cx + (math.cos(a) * (radius - 2))), (cy + (math.sin(a) * (radius - 2)))), _p(rect, (cx + (math.cos(a) * radius)), (cy + (math.sin(a) * radius))));
  }
  needle_a = math.radians((210 + (q * 120)));
  painter.setPen(_pen(red, (thin * 0.8), 220));
  painter.drawLine(_p(rect, cx, cy), _p(rect, (cx + (math.cos(needle_a) * 4.2)), (cy + (math.sin(needle_a) * 4.2))));
  f = painter.font();
  f.setFamily("Courier New");
  f.setBold(true);
  f.setPointSize(max(4, int((rect.height() * 0.022))));
  painter.setFont(f);
  painter.setPen(new QColor("#DADADA"));
  painter.drawText(_rect(rect, _pyneg(4), 91, 22, 97), Qt.AlignmentFlag.AlignCenter, "RPM");
  shield = new QPainterPath();
  shield.moveTo(_p(rect, 82, 76));
  shield.lineTo(_p(rect, 98, 76));
  shield.lineTo(_p(rect, 97, 88));
  shield.quadTo(_p(rect, 90, 96), _p(rect, 83, 88));
  shield.closeSubpath();
  painter.setPen(_pen(red, (thin * 0.8), 235));
  painter.setBrush(ferrari_yellow);
  painter.drawPath(shield);
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(green);
  painter.drawRect(_rect(rect, 84, 77.2, 88.5, 79.4));
  painter.setBrush(white);
  painter.drawRect(_rect(rect, 88.5, 77.2, 93, 79.4));
  painter.setBrush(red);
  painter.drawRect(_rect(rect, 93, 77.2, 97, 79.4));
  horse = new QPainterPath();
  horse.moveTo(_p(rect, 88.5, 89));
  horse.cubicTo(_p(rect, 87.5, 85), _p(rect, 89, 82.5), _p(rect, 91, 83.5));
  horse.cubicTo(_p(rect, 94, 84.5), _p(rect, 94, 87), _p(rect, 92, 88));
  horse.lineTo(_p(rect, 94.5, 91));
  horse.moveTo(_p(rect, 90, 86));
  horse.lineTo(_p(rect, 87, 91));
  horse.moveTo(_p(rect, 91.5, 85));
  horse.lineTo(_p(rect, 95, 83));
  painter.setPen(_pen(black, (medium * 0.75), 235));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawPath(horse);
  f = painter.font();
  f.setFamily("Times New Roman");
  f.setBold(true);
  f.setPointSize(max(4, int((rect.height() * 0.024))));
  painter.setFont(f);
  painter.setPen(black);
  painter.drawText(_rect(rect, 86, 90, 95, 94), Qt.AlignmentFlag.AlignCenter, "SF");
}

function _fg_techno_v2(painter, rect, t, thin, medium) { // Python L7016
  let band, c, col, cyan, dark, glow, h, i, magenta, pulse, rr, white, x;
  cyan = new QColor("#52D7E8");
  magenta = new QColor("#D24BD4");
  white = new QColor("#E8E8E8");
  dark = new QColor("#121316");
  band = new QPainterPath();
  band.moveTo(_p(rect, 18, 49));
  band.cubicTo(_p(rect, 20, 24), _p(rect, 34, 16), _p(rect, 50, 16));
  band.cubicTo(_p(rect, 66, 16), _p(rect, 80, 24), _p(rect, 82, 49));
  painter.setPen(_pen(cyan, (medium * 0.95), 210));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawPath(band);
  for ([i, x] of enumerate([17, 83])) {
    col = (((i === 0)) ? cyan : magenta);
    painter.setPen(_pen(col, thin, 220));
    painter.setBrush(new QColor(dark.red(), dark.green(), dark.blue(), 235));
    painter.drawRoundedRect(_rect(rect, (x - 4.5), 44, (x + 4.5), 61), 3, 3);
    pulse = (0.5 + (0.5 * math.sin(((t * 2.8) + (i * 1.7)))));
    c = new QColor(col);
    c.setAlpha(int((105 + (pulse * 125))));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(0.9, (rect.width() * 0.0045));
    painter.drawEllipse(_p(rect, x, 52), rr, rr);
  }
  for (i of range(5)) {
    x = (87 + (i * 2.5));
    h = (3 + (abs(math.sin(((t * 3.7) + (i * 0.85)))) * 12));
    col = (((_pymod(i, 2) === 0)) ? cyan : magenta);
    c = new QColor(col);
    c.setAlpha((95 + (i * 20)));
    painter.setPen(_pen(c, (thin * 0.62), c.alpha()));
    painter.drawLine(_p(rect, x, 91), _p(rect, x, (91 - h)));
  }
  pulse = (0.5 + (0.5 * math.sin((t * 2.1))));
  glow = new QColor(magenta);
  glow.setAlpha(int((35 + (pulse * 45))));
  painter.setPen(_pen(glow, (medium * 0.7), glow.alpha()));
  painter.drawArc(_rect(rect, 35, 98, 65, 106), 0, (180 * 16));
}

function _fg_agent(painter, rect, t, thin, medium) { // Python L7113
  let black, gun, led, pulse, red, rr, silver;
  black = new QColor("#0B0C0D");
  silver = new QColor("#A9ADB0");
  red = new QColor("#C62828");
  painter.setPen(_pen(silver, (thin * 0.6), 135));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawArc(_rect(rect, 82, 47, 89, 57), (_pyneg(70) * 16), (210 * 16));
  pulse = (0.5 + (0.5 * math.sin((t * 1.7))));
  led = new QColor(red);
  led.setAlpha(int((60 + (pulse * 95))));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(led);
  rr = max(0.7, (rect.width() * 0.0034));
  painter.drawEllipse(_p(rect, 87.5, 53), rr, rr);
  painter.setPen(_pen(silver, (thin * 0.65), 190));
  painter.setBrush(new QColor(18, 19, 20, 238));
  gun = new QPainterPath();
  gun.moveTo(_p(rect, 80, 78));
  gun.lineTo(_p(rect, 93, 78));
  gun.lineTo(_p(rect, 93, 82));
  gun.lineTo(_p(rect, 88, 82));
  gun.lineTo(_p(rect, 86, 91));
  gun.lineTo(_p(rect, 82, 91));
  gun.lineTo(_p(rect, 83, 82));
  gun.lineTo(_p(rect, 80, 82));
  gun.closeSubpath();
  painter.drawPath(gun);
  painter.setPen(_pen(black, (medium * 0.95), 235));
  painter.drawLine(_p(rect, 93, 80), _p(rect, 103, 80));
}

function _fg_autobahn_v2(painter, rect, t, thin, medium) { // Python L7245
  let blue, c, cx, cy, dark, f, grey, i, phase, red, sign_r, white, x, x0, x1, y0, y1;
  red = new QColor("#D62828");
  white = new QColor("#F2F2F2");
  grey = new QColor("#777D81");
  dark = new QColor("#111315");
  blue = new QColor("#2D5D9B");
  x0 = _pyneg(13.0);
  x1 = 113.0;
  y0 = 1.5;
  y1 = 10.5;
  painter.setPen(_pen(white, (thin * 0.55), 155));
  painter.setBrush(new QColor(20, 24, 28, 215));
  painter.drawRect(_rect(rect, x0, y0, x1, y1));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor(45, 93, 155, 170));
  painter.drawRect(_rect(rect, x0, y0, x1, (y0 + 2.1)));
  f = painter.font();
  f.setFamily("Courier New");
  f.setBold(true);
  f.setPointSize(max(5, int((rect.height() * 0.032))));
  painter.setFont(f);
  painter.setPen(white);
  painter.drawText(_rect(rect, x0, y0, x1, y1), Qt.AlignmentFlag.AlignCenter, "AUTOBAHN // ∞");
  [cx, cy] = [98.0, 27.0];
  sign_r = 9.2;
  painter.setPen(_pen(red, (medium * 1.15), 240));
  painter.setBrush(white);
  painter.drawEllipse(_p(rect, cx, cy), (rect.width() * 0.092), (rect.width() * 0.092));
  f = painter.font();
  f.setFamily("Arial");
  f.setBold(true);
  f.setPointSize(max(10, int((rect.height() * 0.085))));
  painter.setFont(f);
  painter.setPen(new QColor("#151515"));
  painter.drawText(_rect(rect, (cx - sign_r), (cy - sign_r), (cx + sign_r), (cy + sign_r)), Qt.AlignmentFlag.AlignCenter, "∞");
  painter.setPen(_pen(grey, (thin * 0.7), 125));
  painter.drawLine(_p(rect, cx, (cy + 9)), _p(rect, cx, (cy + 23)));
  phase = (0.5 + (0.5 * math.sin((t * 2.1))));
  for (i of range(3)) {
    x = ((_pyneg(8) + (i * 5.5)) + (phase * 1.8));
    c = new QColor((((i < 2)) ? grey : red));
    c.setAlpha((85 + (i * 42)));
    painter.setPen(_pen(c, (thin * 0.75), c.alpha()));
    painter.drawLine(_p(rect, x, 85), _p(rect, (x + 5), 80));
    painter.drawLine(_p(rect, (x + 5), 80), _p(rect, x, 75));
  }
  painter.setPen(_pen(grey, (thin * 0.5), 55));
  painter.drawLine(_p(rect, _pyneg(7), 94), _p(rect, 5, 87));
  painter.drawLine(_p(rect, _pyneg(2), 96), _p(rect, 10, 89));
}

function _fg_circuit(painter, rect, t, thin, medium) { // Python L7363
  let arc_specs, bolt, c, cyan, cyan_hot, dark, electric_blue, glow, i, pcb, phase, pulse, rr, spark, x, x1, x2, y, y1, y2, yellow;
  cyan = new QColor("#59E7FF");
  cyan_hot = new QColor("#D8FBFF");
  electric_blue = new QColor("#3D8CFF");
  yellow = new QColor("#FFD43B");
  pcb = new QColor("#236C55");
  dark = new QColor("#0C1414");
  pulse = (0.5 + (0.5 * math.sin((t * 4.5))));
  arc_specs = [[8, 34, 17, 28], [82, 28, 94, 36], [5, 75, 18, 80], [81, 82, 96, 75]];
  for ([i, [x1, y1, x2, y2]] of enumerate(arc_specs)) {
    phase = (math.sin(((t * 5.0) + (i * 1.7))) * 2.0);
    spark = new QPainterPath();
    spark.moveTo(_p(rect, x1, y1));
    spark.lineTo(_p(rect, (((x1 + x2) / 2) - 2), (((y1 + y2) / 2) + phase)));
    spark.lineTo(_p(rect, (((x1 + x2) / 2) + 2), (((y1 + y2) / 2) - phase)));
    spark.lineTo(_p(rect, x2, y2));
    c = new QColor((((_pymod(i, 2) === 0)) ? cyan : electric_blue));
    c.setAlpha(int((125 + (pulse * 100))));
    painter.setPen(_pen(c, (medium * 0.7), c.alpha()));
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.drawPath(spark);
  }
  for ([x, y] of [[20, 18], [78, 18], [13, 62], [87, 62]]) {
    painter.setPen(_pen(pcb, (thin * 0.55), 120));
    painter.setBrush(new QColor(dark.red(), dark.green(), dark.blue(), 160));
    painter.drawRoundedRect(_rect(rect, (x - 3), (y - 2), (x + 3), (y + 2)), 1, 1);
    painter.setPen(_pen(cyan, (thin * 0.45), 100));
    painter.drawLine(_p(rect, (x - 5), y), _p(rect, (x - 3), y));
    painter.drawLine(_p(rect, (x + 3), y), _p(rect, (x + 5), y));
  }
  bolt = new QPainterPath();
  bolt.moveTo(_p(rect, 88, 42));
  bolt.lineTo(_p(rect, 82, 54));
  bolt.lineTo(_p(rect, 88, 54));
  bolt.lineTo(_p(rect, 83, 67));
  bolt.lineTo(_p(rect, 96, 50));
  bolt.lineTo(_p(rect, 90, 50));
  bolt.lineTo(_p(rect, 95, 42));
  bolt.closeSubpath();
  painter.setPen(_pen(yellow, (thin * 0.7), 210));
  painter.setBrush(new QColor(255, 212, 59, 70));
  painter.drawPath(bolt);
  glow = new QColor(cyan_hot);
  glow.setAlpha(int((80 + (pulse * 130))));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(glow);
  rr = max(0.7, (rect.width() * 0.004));
  painter.drawEllipse(_p(rect, 96, 46), rr, rr);
}

function _fg_ghost(painter, rect, t, thin, medium) { // Python L7484
  let c, cc, dark, eye_rx, eye_ry, eye_y, fade, glow, i, mouth, pale, phase, rr, violet, violet_hot, x, y;
  violet = new QColor("#A66FFF");
  violet_hot = new QColor("#D8C2FF");
  pale = new QColor("#F2EEFF");
  dark = new QColor("#24162F");
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor("#101112"));
  painter.drawEllipse(_p(rect, 50, 55), (rect.width() * 0.25), (rect.height() * 0.19));
  eye_y = 50;
  eye_rx = (rect.width() * 0.036);
  eye_ry = (rect.height() * 0.05);
  for (x of [31, 69]) {
    painter.setPen(_pen(pale, (thin * 0.9), 220));
    painter.setBrush(new QColor(dark.red(), dark.green(), dark.blue(), 230));
    painter.drawEllipse(_p(rect, x, eye_y), eye_rx, eye_ry);
    glow = (0.5 + (0.5 * math.sin(((t * 1.8) + x))));
    c = new QColor(violet_hot);
    c.setAlpha(int((80 + (glow * 120))));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(1.0, (rect.width() * (0.005 + (glow * 0.0015))));
    painter.drawEllipse(_p(rect, x, eye_y), rr, rr);
  }
  painter.setPen(_pen(violet, (thin * 0.85), 210));
  mouth = new QPainterPath();
  mouth.moveTo(_p(rect, 43, 65));
  mouth.cubicTo(_p(rect, 46, 70), _p(rect, 54, 70), _p(rect, 57, 65));
  painter.drawPath(mouth);
  fade = (0.5 + (0.5 * math.sin((t * 1.35))));
  c = new QColor(violet);
  c.setAlpha(int((75 + (fade * 120))));
  painter.setPen(_pen(c, (medium * 0.95), c.alpha()));
  painter.drawArc(_rect(rect, 0, 33, 22, 75), (90 * 16), (145 * 16));
  painter.drawArc(_rect(rect, 78, 33, 100, 75), (_pyneg(55) * 16), (145 * 16));
  for (i of range(9)) {
    phase = _pymod(((t * 0.55) + (i * 0.13)), 1.0);
    x = (34 + (i * 4.0));
    y = (91 + (phase * 14));
    cc = new QColor((_pymod(i, 2) ? violet_hot : violet));
    cc.setAlpha(int((110 * (1 - phase))));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(cc);
    rr = max(0.7, (rect.width() * (0.0035 + (_pymod(i, 3) * 0.0007))));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
  }
}

function _fg_glitch(painter, rect, t, thin, medium) { // Python L7604
  let blocks, c, col, cyan, cycle, pink, strength, white, x, y;
  pink = new QColor("#FF2E9A");
  cyan = new QColor("#24D9FF");
  white = new QColor("#FFFFFF");
  cycle = _pymod(t, 2.6);
  if (((cycle >= 0.62))) {
    return undefined;
  }
  strength = (1.0 - (cycle / 0.62));
  blocks = [[5, 28, cyan], [91, 37, pink], [8, 72, pink], [89, 82, cyan]];
  for ([x, y, col] of blocks) {
    c = new QColor(col);
    c.setAlpha(int((120 + (strength * 130))));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    painter.drawRect(_rect(rect, ((x - 3) - (strength * 3)), (y - 1.5), ((x + 3) + (strength * 3)), (y + 1.5)));
  }
  if (((cycle < 0.2))) {
    c = new QColor(white);
    c.setAlpha(220);
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    painter.drawRect(_rect(rect, 35, 58, 66, 60.5));
  }
}

function _fg_maestro_v2(painter, rect, t, thin, medium) { // Python L7661
  let angle, black, bob, gold, gold_hot, ivory, left, pivot, podium, pulse, right, rr, sx, sy;
  gold = new QColor("#D7B55A");
  gold_hot = new QColor("#F8DF8D");
  ivory = new QColor("#F4F1E8");
  black = new QColor("#111214");
  painter.setPen(_pen(ivory, (thin * 0.8), 165));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  left = new QPainterPath();
  left.moveTo(_p(rect, 33, 77));
  left.lineTo(_p(rect, 44, 84));
  left.lineTo(_p(rect, 39, 97));
  painter.drawPath(left);
  right = new QPainterPath();
  right.moveTo(_p(rect, 67, 77));
  right.lineTo(_p(rect, 56, 84));
  right.lineTo(_p(rect, 61, 97));
  painter.drawPath(right);
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor("#242526"));
  painter.drawPolygon(new QPolygonF([_p(rect, 43, 80), _p(rect, 49, 83), _p(rect, 43, 86)]));
  painter.drawPolygon(new QPolygonF([_p(rect, 57, 80), _p(rect, 51, 83), _p(rect, 57, 86)]));
  angle = (math.sin((t * 2.1)) * 25.0);
  painter.save();
  pivot = _p(rect, 81, 84);
  painter.translate(pivot);
  painter.rotate(angle);
  sx = (rect.width() / 100.0);
  sy = (rect.height() / 100.0);
  painter.setPen(_pen(gold_hot, (medium * 1.6), 70));
  painter.drawLine(new QPointF(0, 0), new QPointF((17 * sx), (_pyneg(30) * sy)));
  painter.setPen(_pen(ivory, (medium * 0.85), 245));
  painter.drawLine(new QPointF(0, 0), new QPointF((17 * sx), (_pyneg(30) * sy)));
  painter.setPen(_pen(gold, (medium * 1.2), 245));
  painter.drawLine(new QPointF((_pyneg(1) * sx), (1 * sy)), new QPointF((4 * sx), (_pyneg(4) * sy)));
  painter.restore();
  pulse = (0.5 + (0.5 * math.sin((t * 1.4))));
  podium = new QColor(gold);
  podium.setAlpha(int((115 + (pulse * 70))));
  painter.setPen(_pen(gold_hot, (thin * 0.8), 180));
  painter.setBrush(new QColor(80, 58, 18, int((100 + (pulse * 35)))));
  painter.drawRoundedRect(_rect(rect, 34, 99, 66, 106), 2, 2);
  bob = (math.sin((t * 1.7)) * 2.0);
  painter.setPen(_pen(gold_hot, (thin * 0.75), 165));
  painter.drawLine(_p(rect, 8, (67 + bob)), _p(rect, 8, (55 + bob)));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(gold_hot);
  rr = max(1.0, (rect.width() * 0.0048));
  painter.drawEllipse(_p(rect, 6.3, (68 + bob)), rr, rr);
}

function _fg_mechanic_v2(painter, rect, t, thin, medium) { // Python L7824
  let a, amber, c, cc, dark, glow, head, i, length, orange, pivot, rr, steel, sx, sy;
  orange = new QColor("#FF8A2A");
  amber = new QColor("#FFC15A");
  steel = new QColor("#B7BDC1");
  dark = new QColor("#17191B");
  painter.setPen(_pen(steel, (thin * 0.8), 220));
  painter.setBrush(new QColor(dark.red(), dark.green(), dark.blue(), 225));
  painter.drawRoundedRect(_rect(rect, 29, 30, 47, 40), 2, 2);
  painter.drawRoundedRect(_rect(rect, 53, 30, 71, 40), 2, 2);
  painter.drawLine(_p(rect, 47, 35), _p(rect, 53, 35));
  glow = (0.5 + (0.5 * math.sin((t * 2.2))));
  c = new QColor(orange);
  c.setAlpha(int((50 + (glow * 90))));
  painter.setPen(_pen(c, (thin * 0.55), c.alpha()));
  painter.drawLine(_p(rect, 31, 32), _p(rect, 43, 38));
  painter.drawLine(_p(rect, 55, 32), _p(rect, 67, 38));
  painter.save();
  pivot = _p(rect, 88, 79);
  painter.translate(pivot);
  painter.rotate((math.sin((t * 0.8)) * 4.0));
  sx = (rect.width() / 100);
  sy = (rect.height() / 100);
  painter.setPen(_pen(steel, (medium * 1.05), 235));
  painter.drawLine(new QPointF(0, 0), new QPointF((6 * sx), (_pyneg(20) * sy)));
  head = new QPainterPath();
  head.moveTo(new QPointF((3 * sx), (_pyneg(20) * sy)));
  head.lineTo(new QPointF((7 * sx), (_pyneg(25) * sy)));
  head.lineTo(new QPointF((10 * sx), (_pyneg(21) * sy)));
  head.lineTo(new QPointF((8 * sx), (_pyneg(16) * sy)));
  painter.drawPath(head);
  painter.restore();
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(amber);
  rr = max(1.0, (rect.width() * 0.0045));
  painter.drawEllipse(_p(rect, 12, 84), rr, rr);
  for (i of range(5)) {
    a = ((_pyneg(1.2) + (i * 0.38)) + (math.sin(((t * 5) + i)) * 0.06));
    length = (6 + (_pymod(i, 2) * 3));
    cc = new QColor((_pymod(i, 2) ? orange : amber));
    cc.setAlpha(150);
    painter.setPen(_pen(cc, (thin * 0.7), cc.alpha()));
    painter.drawLine(_p(rect, 12, 84), _p(rect, (12 + (math.cos(a) * length)), (84 + (math.sin(a) * length))));
  }
}

function _fg_noir(painter, rect, t, thin, medium) { // Python L7888
  let black, c, ember, grey, hat, ivory, pulse, rr, smoke;
  ivory = new QColor("#E7E1D5");
  grey = new QColor("#777A7D");
  black = new QColor("#111214");
  ember = new QColor("#D77A3D");
  hat = new QPainterPath();
  hat.moveTo(_p(rect, 29, 30));
  hat.quadTo(_p(rect, 37, 16), _p(rect, 50, 16));
  hat.quadTo(_p(rect, 63, 16), _p(rect, 70, 30));
  hat.closeSubpath();
  painter.setPen(_pen(grey, (thin * 0.8), 210));
  painter.setBrush(new QColor(20, 20, 21, 225));
  painter.drawPath(hat);
  painter.setPen(_pen(ivory, (medium * 0.85), 190));
  painter.drawLine(_p(rect, 22, 30), _p(rect, 77, 30));
  painter.setPen(_pen(grey, (thin * 0.55), 75));
  painter.drawLine(_p(rect, 25, 45), _p(rect, 74, 45));
  painter.setPen(_pen(ivory, (medium * 0.75), 215));
  painter.drawLine(_p(rect, 75, 68), _p(rect, 89, 71));
  pulse = (0.5 + (0.5 * math.sin((t * 4.0))));
  c = new QColor(ember);
  c.setAlpha(int((120 + (pulse * 120))));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(c);
  rr = max(0.8, (rect.width() * (0.0045 + (pulse * 0.001))));
  painter.drawEllipse(_p(rect, 89.5, 71.2), rr, rr);
  painter.setPen(_pen(grey, (thin * 0.55), 65));
  smoke = new QPainterPath();
  smoke.moveTo(_p(rect, 90, 69));
  smoke.cubicTo(_p(rect, 86, 64), _p(rect, 94, 59), _p(rect, 90, 54));
  painter.drawPath(smoke);
}

function _fg_null(painter, rect, t, thin, medium) { // Python L7935
  let black, c, f, glyph, i, phase, pulse, q, red, red_hot, white;
  red = new QColor("#FF334F");
  red_hot = new QColor("#FF7184");
  white = new QColor("#F4F4F4");
  black = new QColor("#101112");
  q = (0.5 + (0.5 * math.sin((t * 1.35))));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(black);
  painter.drawRect(_rect(rect, 6, (43 + (q * 7)), 29, (50 + (q * 7))));
  painter.drawRect(_rect(rect, 70, (78 - (q * 7)), 102, (86 - (q * 7))));
  painter.drawRect(_rect(rect, (38 + (q * 4)), 30, (57 + (q * 4)), 34));
  painter.setPen(_pen(red, (medium * 0.95), 210));
  painter.drawLine(_p(rect, 3, 36), _p(rect, 3, 20));
  painter.drawLine(_p(rect, 3, 20), _p(rect, 14, 20));
  painter.drawLine(_p(rect, 97, 65), _p(rect, 97, 82));
  painter.drawLine(_p(rect, 97, 82), _p(rect, 86, 82));
  f = painter.font();
  f.setFamily("Courier New");
  f.setBold(true);
  f.setPointSize(max(9, int((rect.height() * 0.07))));
  painter.setFont(f);
  glyph = new QColor(white);
  glyph.setAlpha(int((150 + (q * 75))));
  painter.setPen(glyph);
  painter.drawText(_rect(rect, 77, 9, 101, 27), Qt.AlignmentFlag.AlignCenter, "∅");
  pulse = new QPainterPath();
  pulse.moveTo(_p(rect, 25, 103));
  pulse.lineTo(_p(rect, 38, 103));
  pulse.lineTo(_p(rect, 43, 96));
  pulse.lineTo(_p(rect, 49, 109));
  pulse.lineTo(_p(rect, 55, 99));
  pulse.lineTo(_p(rect, 61, 103));
  pulse.lineTo(_p(rect, 76, 103));
  c = new QColor(red_hot);
  c.setAlpha(int((100 + (q * 145))));
  painter.setPen(_pen(c, (medium * 0.78), c.alpha()));
  painter.drawPath(pulse);
  painter.setPen(Qt.PenStyle.NoPen);
  for (i of range(7)) {
    phase = _pymod(((t * 0.8) + (i * 0.19)), 1.0);
    c = new QColor(red);
    c.setAlpha(int((100 * (1 - phase))));
    painter.setBrush(c);
    painter.drawRect(_rect(rect, (9 + (i * 2.1)), (56 + (phase * 6)), (10.4 + (i * 2.1)), (57.4 + (phase * 6))));
  }
}

function _fg_rockstar_v2(painter, rect, t, thin, medium) { // Python L8062
  let black, body, c1, c2, cyan, left, magenta, mic_x, mic_y, pivot, pulse, right, silver, spark, sx, sy, violet, white;
  magenta = new QColor("#FF2D55");
  violet = new QColor("#8A5CFF");
  cyan = new QColor("#47D9FF");
  silver = new QColor("#C6C8CA");
  black = new QColor("#101112");
  white = new QColor("#F4F1EB");
  painter.setPen(_pen(silver, (thin * 0.85), 225));
  painter.setBrush(new QColor(10, 11, 12, 240));
  left = new QPolygonF([_p(rect, 25, 42), _p(rect, 46, 41), _p(rect, 43, 55), _p(rect, 30, 54)]);
  right = new QPolygonF([_p(rect, 54, 41), _p(rect, 75, 42), _p(rect, 70, 54), _p(rect, 57, 55)]);
  painter.drawPolygon(left);
  painter.drawPolygon(right);
  painter.drawLine(_p(rect, 46, 47), _p(rect, 54, 47));
  pulse = (0.5 + (0.5 * math.sin((t * 2.4))));
  c1 = new QColor(magenta);
  c1.setAlpha(int((125 + (pulse * 100))));
  painter.setPen(_pen(c1, (thin * 0.75), c1.alpha()));
  painter.drawLine(_p(rect, 29, 44), _p(rect, 42, 50));
  c2 = new QColor(cyan);
  c2.setAlpha(int((125 + ((1 - pulse) * 100))));
  painter.setPen(_pen(c2, (thin * 0.75), c2.alpha()));
  painter.drawLine(_p(rect, 58, 44), _p(rect, 71, 50));
  painter.save();
  pivot = _p(rect, 88, 83);
  painter.translate(pivot);
  painter.rotate((_pyneg(13) + (math.sin((t * 0.95)) * 4)));
  sx = (rect.width() / 100);
  sy = (rect.height() / 100);
  painter.setPen(_pen(silver, (medium * 0.9), 230));
  painter.drawLine(new QPointF(0, 0), new QPointF((7 * sx), (_pyneg(31) * sy)));
  painter.setPen(_pen(violet, (thin * 0.75), 225));
  painter.drawLine(new QPointF((7 * sx), (_pyneg(31) * sy)), new QPointF((10 * sx), (_pyneg(35) * sy)));
  body = new QPainterPath();
  body.moveTo(new QPointF((_pyneg(8) * sx), (3 * sy)));
  body.cubicTo(new QPointF((_pyneg(12) * sx), (_pyneg(4) * sy)), new QPointF((_pyneg(8) * sx), (_pyneg(12) * sy)), new QPointF((_pyneg(2) * sx), (_pyneg(9) * sy)));
  body.cubicTo(new QPointF((2 * sx), (_pyneg(15) * sy)), new QPointF((10 * sx), (_pyneg(9) * sy)), new QPointF((8 * sx), (_pyneg(1) * sy)));
  body.cubicTo(new QPointF((13 * sx), (6 * sy)), new QPointF((5 * sx), (12 * sy)), new QPointF((_pyneg(3) * sx), (8 * sy)));
  body.closeSubpath();
  painter.setPen(_pen(magenta, (thin * 1.0), 240));
  painter.setBrush(new QColor(84, 15, 61, 225));
  painter.drawPath(body);
  painter.setPen(_pen(white, (thin * 0.45), 155));
  painter.drawLine(new QPointF((_pyneg(2) * sx), (_pyneg(3) * sy)), new QPointF((5 * sx), (1 * sy)));
  painter.restore();
  mic_x = 10;
  mic_y = (77 + (math.sin((t * 0.8)) * 1.5));
  painter.setPen(_pen(silver, (thin * 0.75), 205));
  painter.drawLine(_p(rect, mic_x, mic_y), _p(rect, (mic_x - 1), 98));
  painter.setBrush(new QColor(35, 36, 38, 240));
  painter.drawEllipse(_p(rect, mic_x, (mic_y - 4)), (rect.width() * 0.028), (rect.height() * 0.035));
  spark = new QPainterPath();
  spark.moveTo(_p(rect, 17, 20));
  spark.lineTo(_p(rect, 12, 31));
  spark.lineTo(_p(rect, 17, 29));
  spark.lineTo(_p(rect, 12, 42));
  painter.setPen(_pen(violet, (medium * 0.75), 150));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawPath(spark);
}

function _fg_ubahn_ghost(painter, rect, t, thin, medium) { // Python L8208
  let blue, c, cold, f, i, phase, q, reflection, steel, trail, visor, x, y;
  cold = new QColor("#D7E6F2");
  blue = new QColor("#7E9DB8");
  steel = new QColor("#6E7F8F");
  visor = new QPainterPath();
  visor.moveTo(_p(rect, 27, 31));
  visor.quadTo(_p(rect, 50, 24), _p(rect, 73, 31));
  visor.lineTo(_p(rect, 68, 43));
  visor.quadTo(_p(rect, 50, 47), _p(rect, 32, 43));
  visor.closeSubpath();
  painter.setPen(_pen(steel, (thin * 0.75), 180));
  painter.setBrush(new QColor(15, 18, 21, 235));
  painter.drawPath(visor);
  q = (0.5 + (0.5 * math.sin((t * 1.1))));
  reflection = new QColor(cold);
  reflection.setAlpha(int((60 + (q * 85))));
  painter.setPen(_pen(reflection, (thin * 0.6), reflection.alpha()));
  painter.drawLine(_p(rect, (34 + (q * 8)), 34), _p(rect, (45 + (q * 8)), 40));
  for (x of [39, 61]) {
    c = new QColor(cold);
    c.setAlpha(int((60 + (q * 80))));
    painter.setPen(_pen(c, (thin * 0.6), c.alpha()));
    painter.setBrush(new QColor(7, 10, 12, 180));
    painter.drawEllipse(_p(rect, x, 52), (rect.width() * 0.02), (rect.height() * 0.029));
  }
  for (i of range(6)) {
    phase = _pymod(((t * 0.52) + (i * 0.17)), 1.0);
    c = new QColor((((_pymod(i, 2) === 0)) ? cold : blue));
    c.setAlpha(int((95 * (1 - phase))));
    painter.setPen(_pen(c, (thin * 0.7), c.alpha()));
    x = (32 + (i * 7.5));
    y = (88 + (phase * 13));
    trail = new QPainterPath();
    trail.moveTo(_p(rect, x, y));
    trail.cubicTo(_p(rect, (x - 3), (y + 3)), _p(rect, (x + 4), (y + 7)), _p(rect, x, (y + 11)));
    painter.drawPath(trail);
  }
  f = painter.font();
  f.setFamily("Courier New");
  f.setBold(true);
  f.setPointSize(max(4, int((rect.height() * 0.023))));
  painter.setFont(f);
  c = new QColor(cold);
  c.setAlpha(105);
  painter.setPen(c);
  painter.drawText(_rect(rect, 82, 72, 102, 80), Qt.AlignmentFlag.AlignCenter, "U3");
}

function _fg_astronaut_v2(painter, rect, t, thin, medium) { // Python L8287
  let blue, c, cyan, pulse, rr, tether, white;
  white = new QColor("#F7FBFF");
  blue = new QColor("#6DA8FF");
  cyan = new QColor("#8FE9FF");
  painter.setPen(_pen(white, (thin * 0.75), 200));
  painter.drawLine(_p(rect, 79, 18), _p(rect, 88, 8));
  pulse = (0.5 + (0.5 * math.sin((t * 2.0))));
  c = new QColor(cyan);
  c.setAlpha(int((100 + (pulse * 130))));
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(c);
  rr = max(0.8, (rect.width() * 0.004));
  painter.drawEllipse(_p(rect, 88, 8), rr, rr);
  painter.setPen(_pen(blue, (thin * 0.55), 100));
  tether = new QPainterPath();
  tether.moveTo(_p(rect, 79, 76));
  tether.cubicTo(_p(rect, 94, 74), _p(rect, 92, 93), _p(rect, 104, 93));
  painter.drawPath(tether);
}

function _fg_chrome_v2(painter, rect, t, thin, medium) { // Python L8319
  let a, blue, c, col, cols, green, i, red, rr, x, y, yellow;
  blue = new QColor("#4285F4");
  red = new QColor("#EA4335");
  yellow = new QColor("#FBBC05");
  green = new QColor("#34A853");
  cols = [blue, red, yellow, green];
  for ([i, col] of enumerate(cols)) {
    a = ((t * 0.6) + ((i * math.tau) / 4));
    x = (50 + (math.cos(a) * 45));
    y = (58 + (math.sin(a) * 34));
    c = new QColor(col);
    c.setAlpha(155);
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(0.75, (rect.width() * 0.0035));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
  }
}

function _fg_eclipse(painter, rect, t, thin, medium) { // Python L8353
  return undefined;
}

function _fg_emperor(painter, rect, t, thin, medium) { // Python L8365
  let a, eagle, f, gold, gold_hot, i, ivory, left, p, purple, purple_dark, right, side, x, y;
  gold = new QColor("#C79A3B");
  gold_hot = new QColor("#F1D887");
  purple = new QColor("#6B2B86");
  purple_dark = new QColor("#2A1235");
  ivory = new QColor("#F6E7BE");
  for (side of [_pyneg(1), 1]) {
    for (i of range(6)) {
      a = (((side < 0)) ? math.radians((205 + (i * 16))) : math.radians((_pyneg(25) - (i * 16))));
      x = (50 + (math.cos(a) * 24));
      y = (31 + (math.sin(a) * 14));
      painter.save();
      p = _p(rect, x, y);
      painter.translate(p);
      painter.rotate((((side < 0)) ? (_pyneg(35) + (i * 9)) : (35 - (i * 9))));
      painter.setPen(_pen(gold_hot, (thin * 0.5), 185));
      painter.setBrush(new QColor(gold.red(), gold.green(), gold.blue(), 75));
      painter.drawEllipse(new QRectF((_pyneg(rect.width()) * 0.008), (_pyneg(rect.height()) * 0.016), (rect.width() * 0.016), (rect.height() * 0.032)));
      painter.restore();
    }
  }
  painter.setPen(_pen(gold, (thin * 0.7), 150));
  painter.setBrush(new QColor(purple.red(), purple.green(), purple.blue(), 145));
  left = new QPainterPath();
  left.moveTo(_p(rect, 22, 72));
  left.lineTo(_p(rect, 40, 80));
  left.lineTo(_p(rect, 36, 102));
  left.lineTo(_p(rect, 16, 96));
  left.closeSubpath();
  painter.drawPath(left);
  right = new QPainterPath();
  right.moveTo(_p(rect, 78, 72));
  right.lineTo(_p(rect, 60, 80));
  right.lineTo(_p(rect, 64, 102));
  right.lineTo(_p(rect, 84, 96));
  right.closeSubpath();
  painter.drawPath(right);
  painter.setPen(_pen(gold_hot, (medium * 0.85), 235));
  painter.drawLine(_p(rect, 91, 96), _p(rect, 87, 55));
  eagle = new QPainterPath();
  eagle.moveTo(_p(rect, 87, 52));
  eagle.lineTo(_p(rect, 78, 46));
  eagle.lineTo(_p(rect, 84, 54));
  eagle.lineTo(_p(rect, 87, 58));
  eagle.lineTo(_p(rect, 90, 54));
  eagle.lineTo(_p(rect, 96, 46));
  eagle.closeSubpath();
  painter.setPen(_pen(gold_hot, (thin * 0.7), 220));
  painter.setBrush(new QColor(gold.red(), gold.green(), gold.blue(), 90));
  painter.drawPath(eagle);
  f = painter.font();
  f.setFamily("Times New Roman");
  f.setBold(true);
  f.setPointSize(max(4, int((rect.height() * 0.02))));
  painter.setFont(f);
  painter.setPen(gold_hot);
  painter.drawText(_rect(rect, 1, 88, 27, 96), Qt.AlignmentFlag.AlignCenter, "IMPERIUM");
}

function _fg_samurai_legendary(painter, rect, t, thin, medium) { // Python L8460
  let active, angle, base_angle, black, blade_white, brim, c, col, crimson, crimson_hot, cycle, dome, front, gold, gold_hot, helmet_black, hp, i, inner, ivory, k, mask, outer, pivot, row, rr, shoulder, side, slash_angle, slash_progress, steel, strength, sx, sy, x, yy;
  crimson = new QColor("#8F1D28");
  crimson_hot = new QColor("#D43B45");
  gold = new QColor("#B9954D");
  gold_hot = new QColor("#E1C173");
  steel = new QColor("#B9BEC1");
  blade_white = new QColor("#F7F8F8");
  black = new QColor("#101112");
  helmet_black = new QColor("#1A1B1C");
  ivory = new QColor("#F2EEE8");
  dome = new QPainterPath();
  dome.moveTo(_p(rect, 21, 40));
  dome.quadTo(_p(rect, 26, 13), _p(rect, 50, 12));
  dome.quadTo(_p(rect, 74, 13), _p(rect, 79, 40));
  dome.lineTo(_p(rect, 72, 46));
  dome.lineTo(_p(rect, 28, 46));
  dome.closeSubpath();
  painter.setPen(_pen(gold, max(1.0, (rect.width() * 0.0048)), 215));
  painter.setBrush(helmet_black);
  painter.drawPath(dome);
  painter.setPen(_pen(steel, max(0.75, (rect.width() * 0.0028)), 72));
  for (x of [31, 37, 43, 50, 57, 63, 69]) {
    painter.drawLine(_p(rect, x, 18), _p(rect, x, 42));
  }
  brim = new QPainterPath();
  brim.moveTo(_p(rect, 21, 40));
  brim.quadTo(_p(rect, 50, 50), _p(rect, 79, 40));
  brim.lineTo(_p(rect, 75, 48));
  brim.quadTo(_p(rect, 50, 56), _p(rect, 25, 48));
  brim.closeSubpath();
  painter.setPen(_pen(gold, max(1.0, (rect.width() * 0.0045)), 190));
  painter.setBrush(new QColor(23, 24, 25, 245));
  painter.drawPath(brim);
  function horn(side) { // Python L8509
    let outer_x, p, root_x, tip_x;
    root_x = (((side < 0)) ? 36 : 64);
    outer_x = (((side < 0)) ? 8 : 92);
    tip_x = (((side < 0)) ? 4 : 96);
    p = new QPainterPath();
    p.moveTo(_p(rect, root_x, 31));
    p.cubicTo(_p(rect, (root_x + (side * 8)), 22), _p(rect, outer_x, 12), _p(rect, tip_x, 2));
    p.cubicTo(_p(rect, (tip_x - (side * 3)), 10), _p(rect, (outer_x - (side * 3)), 19), _p(rect, (root_x + (side * 3)), 38));
    p.closeSubpath();
    return p;
  }
  for (side of [_pyneg(1), 1]) {
    hp = horn(side);
    painter.setPen(_pen(gold_hot, max(1.15, (rect.width() * 0.0055)), 240));
    painter.setBrush(new QColor(112, 82, 30, 235));
    painter.drawPath(hp);
    painter.setPen(_pen(new QColor("#F4DEA1"), max(0.8, (rect.width() * 0.0032)), 160));
    if (((side < 0))) {
      inner = new QPainterPath();
      inner.moveTo(_p(rect, 34, 30));
      inner.cubicTo(_p(rect, 25, 22), _p(rect, 15, 13), _p(rect, 8, 6));
    }
    else {
      inner = new QPainterPath();
      inner.moveTo(_p(rect, 66, 30));
      inner.cubicTo(_p(rect, 75, 22), _p(rect, 85, 13), _p(rect, 92, 6));
    }
    painter.drawPath(inner);
  }
  front = new QPainterPath();
  front.moveTo(_p(rect, 31, 35));
  front.quadTo(_p(rect, 50, 28), _p(rect, 69, 35));
  front.lineTo(_p(rect, 64, 45));
  front.quadTo(_p(rect, 50, 49), _p(rect, 36, 45));
  front.closeSubpath();
  painter.setPen(_pen(gold_hot, max(0.9, (rect.width() * 0.0042)), 215));
  painter.setBrush(new QColor(80, 59, 26, 225));
  painter.drawPath(front);
  for (i of range(5)) {
    x = (38 + (i * 6));
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(new QColor("#D8BA72"));
    rr = max(0.65, (rect.width() * 0.0027));
    painter.drawEllipse(_p(rect, x, 39), rr, rr);
  }
  painter.setPen(_pen(gold_hot, (thin * 0.5), 180));
  painter.setBrush(crimson);
  painter.drawEllipse(_p(rect, 50, 37), (rect.width() * 0.015), (rect.height() * 0.02));
  mask = new QPainterPath();
  mask.moveTo(_p(rect, 31, 51));
  mask.quadTo(_p(rect, 50, 47), _p(rect, 69, 51));
  mask.lineTo(_p(rect, 65, 65));
  mask.quadTo(_p(rect, 50, 72), _p(rect, 35, 65));
  mask.closeSubpath();
  painter.setPen(_pen(steel, (thin * 0.65), 155));
  painter.setBrush(new QColor(10, 11, 12, 240));
  painter.drawPath(mask);
  painter.setPen(_pen(crimson_hot, (thin * 0.7), 200));
  painter.drawLine(_p(rect, 35, 56), _p(rect, 43, 57));
  painter.drawLine(_p(rect, 65, 56), _p(rect, 57, 57));
  for (side of [_pyneg(1), 1]) {
    outer = (((side < 0)) ? 12 : 88);
    inner = (((side < 0)) ? 37 : 63);
    shoulder = new QPainterPath();
    shoulder.moveTo(_p(rect, outer, 68));
    shoulder.lineTo(_p(rect, inner, 77));
    shoulder.lineTo(_p(rect, (inner - (side * 2)), 103));
    shoulder.lineTo(_p(rect, (outer - (side * 5)), 98));
    shoulder.closeSubpath();
    painter.setPen(_pen(gold, (thin * 0.8), 185));
    painter.setBrush(new QColor(crimson.red(), crimson.green(), crimson.blue(), 205));
    painter.drawPath(shoulder);
    for (row of range(4)) {
      yy = (76 + (row * 6));
      painter.setPen(_pen(gold_hot, (thin * 0.38), 95));
      painter.drawLine(_p(rect, (outer + (side * 2)), yy), _p(rect, (inner - (side * 1.5)), (yy + 5)));
      for (col of range(3)) {
        x = (outer + (side * (6 + (col * 5))));
        painter.setPen(Qt.PenStyle.NoPen);
        painter.setBrush(new QColor(195, 154, 77, 105));
        rr = max(0.5, (rect.width() * 0.002));
        painter.drawEllipse(_p(rect, x, (yy + 2)), rr, rr);
      }
    }
  }
  cycle = _pymod(t, 5.2);
  active = ((cycle < 0.95));
  if (((cycle < 0.52))) {
    slash_progress = (cycle / 0.52);
  }
  else {
    if (((cycle < 0.95))) {
      slash_progress = 1.0;
    }
    else {
      slash_progress = 0.0;
    }
  }
  base_angle = _pyneg(11);
  slash_angle = _pyneg(24);
  angle = (((base_angle * (1 - slash_progress)) + (slash_angle * slash_progress)) + (math.sin((t * 0.7)) * 1.3));
  painter.save();
  pivot = _p(rect, 90, 95);
  painter.translate(pivot);
  painter.rotate(angle);
  sx = (rect.width() / 100);
  sy = (rect.height() / 100);
  painter.setPen(_pen(crimson, max(2.0, (medium * 1.15)), 230));
  painter.drawLine(new QPointF((_pyneg(4) * sx), (5 * sy)), new QPointF((1 * sx), (_pyneg(28) * sy)));
  painter.setPen(_pen(new QColor("#241317"), max(0.9, (thin * 0.8)), 180));
  painter.drawLine(new QPointF((_pyneg(3) * sx), (3 * sy)), new QPointF((1 * sx), (_pyneg(27) * sy)));
  painter.setPen(_pen(blade_white, max(1.4, (medium * 0.82)), 255));
  painter.drawLine(new QPointF((2 * sx), (_pyneg(1) * sy)), new QPointF((13 * sx), (_pyneg(38) * sy)));
  painter.setPen(_pen(new QColor("#7D858A"), max(0.7, (thin * 0.55)), 170));
  painter.drawLine(new QPointF((3.2 * sx), (_pyneg(2) * sy)), new QPointF((13.5 * sx), (_pyneg(37) * sy)));
  painter.setPen(_pen(gold_hot, max(1.6, (medium * 1.05)), 245));
  painter.drawLine(new QPointF((_pyneg(2) * sx), (_pyneg(3) * sy)), new QPointF((6 * sx), (_pyneg(1.5) * sy)));
  painter.setPen(_pen(new QColor("#ECE4D2"), max(1.2, (medium * 0.75)), 235));
  painter.drawLine(new QPointF((_pyneg(2) * sx), (_pyneg(2) * sy)), new QPointF((_pyneg(6) * sx), (9 * sy)));
  painter.setPen(_pen(crimson_hot, max(0.8, (thin * 0.55)), 190));
  for (k of range(3)) {
    yy = ((1 + (k * 3)) * sy);
    painter.drawLine(new QPointF((_pyneg(6) * sx), yy), new QPointF((_pyneg(2) * sx), (yy + (2 * sy))));
  }
  painter.restore();
  if (active) {
    if (((cycle < 0.52))) {
      strength = min(1.0, (cycle / 0.2));
    }
    else {
      strength = max(0.0, (1 - ((cycle - 0.52) / 0.43)));
    }
    c = new QColor(crimson_hot);
    c.setAlpha(int((90 + (strength * 165))));
    painter.setPen(_pen(c, (thin * 0.95), c.alpha()));
    painter.drawLine(_p(rect, 36, 56), _p(rect, 43, 56));
    painter.drawLine(_p(rect, 57, 56), _p(rect, 64, 56));
  }
}

function _fg_fernsehturm(painter, rect, t, thin, medium) { // Python L8733
  let amber, c, col, cyan, cyan_hot, h, i, pulse, q, red, rr, steel, x;
  steel = new QColor("#BBC4CB");
  cyan = new QColor("#4AD7FF");
  cyan_hot = new QColor("#D1F6FF");
  red = new QColor("#E33A35");
  amber = new QColor("#FFC857");
  painter.setPen(_pen(steel, (medium * 0.85), 230));
  painter.drawLine(_p(rect, 50, 32), _p(rect, 50, 19));
  painter.drawLine(_p(rect, 50, 22), _p(rect, 45, 18));
  painter.drawLine(_p(rect, 50, 22), _p(rect, 55, 18));
  painter.setPen(_pen(cyan_hot, (thin * 0.7), 225));
  painter.setBrush(new QColor(14, 31, 38, 235));
  painter.drawEllipse(_p(rect, 50, 17), (rect.width() * 0.027), (rect.height() * 0.032));
  pulse = (0.5 + (0.5 * math.sin((t * 2.25))));
  c = new QColor(cyan);
  c.setAlpha(int((90 + (pulse * 145))));
  painter.setPen(_pen(c, (thin * 0.7), c.alpha()));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawEllipse(_p(rect, 50, 17), (rect.width() * (0.039 + (pulse * 0.006))), (rect.height() * (0.045 + (pulse * 0.007))));
  painter.setPen(_pen(steel, (thin * 0.5), 105));
  painter.drawRoundedRect(_rect(rect, 43, 29, 57, 34), 2, 2);
  for ([i, h] of enumerate([1.8, 3.0, 4.3])) {
    q = (0.5 + (0.5 * math.sin(((t * 2.0) + (i * 0.55)))));
    col = new QColor((((i < 2)) ? cyan : amber));
    col.setAlpha(int((80 + (q * 140))));
    painter.setPen(_pen(col, max(0.8, (thin * 0.45)), col.alpha()));
    x = (46 + (i * 4));
    painter.drawLine(_p(rect, x, 33), _p(rect, x, (33 - h)));
  }
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(red);
  rr = max(0.55, (rect.width() * 0.0022));
  painter.drawEllipse(_p(rect, 55, 31), rr, rr);
}

function _fg_prototype(painter, rect, t, thin, medium) { // Python L8803
  let c, f, title;
  f = painter.font();
  f.setFamily("Times New Roman");
  f.setItalic(true);
  f.setBold(false);
  f.setPointSize(max(7, int((rect.height() * 0.045))));
  painter.setFont(f);
  title = new QColor("#E9E6DF");
  title.setAlpha(220);
  painter.setPen(title);
  painter.drawText(_rect(rect, 17, 3, 83, 14), Qt.AlignmentFlag.AlignCenter, "Model [001]");
  c = new QColor("#FF4A42");
  c.setAlpha(100);
  painter.setPen(_pen(c, max(0.7, (thin * 0.45)), c.alpha()));
  painter.drawLine(_p(rect, 36, 15), _p(rect, 64, 15));
}

function _fg_void_mythic(painter, rect, t, thin, medium) { // Python L8831
  let a, alpha, bands, c, col, cx, cy, cyan, cyan_hot, i, length, magenta, orange, phase, q, radius, rot, rx, ry, spread, tangent, violet, white, width, x, y, yellow;
  white = new QColor("#FFFFFF");
  yellow = new QColor("#FFD85A");
  orange = new QColor("#FF8C2A");
  magenta = new QColor("#FF3DD6");
  violet = new QColor("#C64AFF");
  cyan = new QColor("#49DAFF");
  cyan_hot = new QColor("#C8F8FF");
  [cx, cy] = [50.0, 55.0];
  rot = _pymod((t * 8.5), 360);
  painter.setBrush(Qt.BrushStyle.NoBrush);
  bands = [[50, 27, white, 0.0115, 240], [48, 26, yellow, 0.0095, 230], [46, 25, orange, 0.0082, 220], [44, 24, magenta, 0.0072, 205], [42, 23, violet, 0.006, 185]];
  for ([i, [rx, ry, col, width, alpha]] of enumerate(bands)) {
    c = new QColor(col);
    c.setAlpha(alpha);
    painter.setPen(_pen(c, max(1.0, (rect.width() * width)), c.alpha()));
    painter.drawArc(_rect(rect, (cx - rx), (cy - ry), (cx + rx), (cy + ry)), int((((4 + (rot * 0.16)) + (i * 2)) * 16)), int(((174 - (i * 6)) * 16)));
  }
  for (i of range(7)) {
    spread = (23 + (i * 5));
    y = (26 + (i * 2.7));
    c = new QColor((((_pymod(i, 2) === 0)) ? cyan : violet));
    c.setAlpha(max(12, (66 - (i * 7))));
    painter.setPen(_pen(c, max(0.7, (rect.width() * 0.0025)), c.alpha()));
    painter.drawArc(_rect(rect, (cx - spread), (y - 6), (cx + spread), (y + 6)), (180 * 16), (180 * 16));
  }
  for (i of range(18)) {
    a = ((t * 0.22) + ((i * math.tau) / 18));
    rx = (44 + (_pymod(i, 4) * 2.5));
    ry = (31 + (_pymod(i, 3) * 1.5));
    x = (cx + (math.cos(a) * rx));
    y = (cy + (math.sin(a) * ry));
    tangent = (a + (math.pi / 2));
    length = (3 + (_pymod(i, 4) * 1.4));
    c = new QColor((((_pymod(i, 3) === 0)) ? cyan_hot : magenta));
    c.setAlpha((52 + (_pymod(i, 4) * 18)));
    painter.setPen(_pen(c, max(0.7, (rect.width() * 0.0024)), c.alpha()));
    painter.drawLine(_p(rect, (x - (math.cos(tangent) * length)), (y - (math.sin(tangent) * length))), _p(rect, (x + (math.cos(tangent) * length)), (y + (math.sin(tangent) * length))));
  }
  phase = _pymod(t, 6.5);
  if (((phase < 0.55))) {
    q = (phase / 0.55);
    radius = (15 + (q * 31));
    c = new QColor(cyan_hot);
    c.setAlpha(int(((1 - q) * 185)));
    painter.setPen(_pen(c, max(0.8, (rect.width() * 0.0032)), c.alpha()));
    painter.drawEllipse(_p(rect, cx, cy), ((rect.width() * radius) / 100), (((rect.height() * radius) * 0.82) / 100));
  }
}

function _fg_monolith_mythic(painter, rect, t, thin, medium) { // Python L8921
  let a, amber, black, c, f, gold, gold_hot, head, i, idx, left, p, phase, pt, pts, pulse, q, right, rr, rune, runes, rust, veins, white, x, y;
  gold = new QColor("#E0B84D");
  gold_hot = new QColor("#FFF0A0");
  amber = new QColor("#F7C54A");
  rust = new QColor("#8A432D");
  white = new QColor("#FFFFFF");
  black = new QColor("#050505");
  head = new QPainterPath();
  head.moveTo(_p(rect, 17, 38));
  head.cubicTo(_p(rect, 7, 47), _p(rect, 8, 65), _p(rect, 18, 73));
  head.quadTo(_p(rect, 50, 82), _p(rect, 82, 73));
  head.cubicTo(_p(rect, 92, 65), _p(rect, 93, 47), _p(rect, 83, 38));
  head.lineTo(_p(rect, 72, 34));
  head.lineTo(_p(rect, 28, 34));
  head.closeSubpath();
  painter.setPen(Qt.PenStyle.NoPen);
  painter.setBrush(new QColor(5, 5, 5, 248));
  painter.drawPath(head);
  pulse = (0.5 + (0.5 * math.sin((t * 1.3))));
  painter.setPen(_pen(gold_hot, max(1.8, (rect.width() * 0.009)), 245));
  left = new QPainterPath();
  left.moveTo(_p(rect, 35, 54));
  left.lineTo(_p(rect, 40, 47));
  left.lineTo(_p(rect, 45, 54));
  painter.drawPath(left);
  right = new QPainterPath();
  right.moveTo(_p(rect, 55, 54));
  right.lineTo(_p(rect, 60, 47));
  right.lineTo(_p(rect, 65, 54));
  painter.drawPath(right);
  painter.setPen(Qt.PenStyle.NoPen);
  c = new QColor(amber);
  c.setAlpha(int((185 + (pulse * 70))));
  painter.setBrush(c);
  rr = max(1.1, (rect.width() * (0.005 + (pulse * 0.001))));
  painter.drawEllipse(_p(rect, 50, 64), rr, rr);
  veins = [[[22, 67], [29, 62], [34, 66], [39, 61]], [[78, 67], [71, 62], [66, 66], [61, 61]], [[33, 76], [40, 72], [45, 77]], [[67, 76], [60, 72], [55, 77]]];
  for ([idx, pts] of enumerate(veins)) {
    p = new QPainterPath();
    p.moveTo(_p(rect, ...pts[0]));
    for (pt of pts.slice(1)) {
      p.lineTo(_p(rect, ...pt));
    }
    c = new QColor((((_pymod(idx, 2) === 0)) ? gold : rust));
    c.setAlpha((92 + (idx * 18)));
    painter.setPen(_pen(c, max(0.75, (rect.width() * 0.003)), c.alpha()));
    painter.drawPath(p);
  }
  f = painter.font();
  f.setFamily("Courier New");
  f.setBold(true);
  f.setPointSize(max(5, int((rect.height() * 0.026))));
  painter.setFont(f);
  runes = ["I", "V", "X", "∆", "◇", "Λ"];
  for ([i, rune] of enumerate(runes)) {
    a = ((t * 0.22) + ((i * math.tau) / len(runes)));
    x = (50 + (math.cos(a) * 31));
    y = (29 + (math.sin(a) * 9));
    c = new QColor(gold_hot);
    c.setAlpha((70 + (_pymod(i, 3) * 32)));
    painter.setPen(c);
    painter.drawText(_rect(rect, (x - 3), (y - 3), (x + 3), (y + 3)), Qt.AlignmentFlag.AlignCenter, rune);
  }
  phase = _pymod(t, 9.5);
  if (((phase < 0.18))) {
    q = (1 - (phase / 0.18));
    painter.fillRect(rect, new QColor(255, 240, 160, int((q * 52))));
  }
  painter.setPen(_pen(gold, max(0.7, (rect.width() * 0.0025)), 95));
  painter.setBrush(new QColor(9, 9, 10, 220));
  painter.drawRoundedRect(_rect(rect, 26, 91, 74, 99), 2, 2);
  f = painter.font();
  f.setFamily("Courier New");
  f.setBold(true);
  f.setPointSize(max(4, int((rect.height() * 0.018))));
  painter.setFont(f);
  painter.setPen(new QColor(224, 184, 77, 150));
  painter.drawText(_rect(rect, 28, 92, 72, 98), Qt.AlignmentFlag.AlignCenter, "MONOLITH // AWAKENED");
}

function _fg_crt(painter, rect, t, thin, medium) { // Python L9036
  let shift;
  painter.setPen(_pen("#285237", thin, 90));
  shift = (math.sin((t * 6)) * 2);
  painter.drawLine(_p(rect, (19 + shift), 40), _p(rect, (25 + shift), 38));
  painter.drawLine(_p(rect, (75 - shift), 65), _p(rect, (82 - shift), 63));
}

function _fg_neon(painter, rect, t, thin, medium) { // Python L9044
  let cyan, h, i, pink, x;
  pink = new QColor("#FF2DAA");
  cyan = new QColor("#31D7FF");
  painter.setPen(_pen(pink, medium, 180));
  painter.drawLine(_p(rect, 24, 31), _p(rect, 29, 16));
  painter.setPen(_pen(cyan, medium, 180));
  painter.drawLine(_p(rect, 76, 31), _p(rect, 71, 16));
  for ([i, x] of enumerate([35, 40, 45, 55, 60, 65])) {
    h = (2.2 + (abs(math.sin(((t * 4) + (i * 0.8)))) * 4.5));
    painter.setPen(_pen((((_pymod(i, 2) === 0)) ? pink : cyan), thin, 130));
    painter.drawLine(_p(rect, x, 102), _p(rect, x, (102 - h)));
  }
}

function _fg_professor(painter, rect, t, thin, medium) { // Python L9056
  let cap, ink;
  ink = new QColor("#D8D8D8");
  painter.setPen(_pen(ink, thin, 235));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.drawRoundedRect(_rect(rect, 29.5, 43, 47, 57), 3, 3);
  painter.drawRoundedRect(_rect(rect, 53, 43, 70.5, 57), 3, 3);
  painter.drawLine(_p(rect, 47, 49.5), _p(rect, 53, 49.5));
  cap = new QPolygonF([_p(rect, 42, 23), _p(rect, 50, 18), _p(rect, 58, 23), _p(rect, 50, 28), _p(rect, 42, 23)]);
  painter.drawPolyline(cap);
}

function _fg_nightlife(painter, rect, t, thin, medium) { // Python L9068
  let band, pink;
  pink = new QColor("#D946EF");
  painter.setPen(_pen(pink, medium, 220));
  band = new QPainterPath();
  band.moveTo(_p(rect, 17, 45));
  band.cubicTo(_p(rect, 20, 20), _p(rect, 80, 20), _p(rect, 83, 45));
  painter.drawPath(band);
  painter.drawRoundedRect(_rect(rect, 10, 48, 17, 61), 3, 3);
  painter.drawRoundedRect(_rect(rect, 83, 48, 90, 61), 3, 3);
}

function _fg_winter(painter, rect, t, thin, medium) { // Python L9077
  let blue, cap;
  blue = new QColor("#7FB8FF");
  painter.setPen(_pen(blue, thin, 220));
  cap = new QPainterPath();
  cap.moveTo(_p(rect, 39, 31));
  cap.quadTo(_p(rect, 50, 16), _p(rect, 61, 31));
  painter.drawPath(cap);
  painter.setPen(_pen("#CFE6FF", medium, 230));
  painter.drawLine(_p(rect, 39, 31), _p(rect, 61, 31));
}

function _fg_cyber(painter, rect, t, thin, medium) { // Python L9085
  let green, lens, pulse;
  green = new QColor("#72FF72");
  lens = new QPainterPath();
  lens.moveTo(_p(rect, 52.5, 40.5));
  lens.lineTo(_p(rect, 70.5, 40.5));
  lens.lineTo(_p(rect, 74, 47.5));
  lens.lineTo(_p(rect, 70, 57));
  lens.lineTo(_p(rect, 53, 57));
  lens.closeSubpath();
  painter.setPen(_pen(green, medium, 230));
  painter.setBrush(new QColor(28, 255, 105, 50));
  painter.drawPath(lens);
  pulse = (0.5 + (0.5 * math.sin((t * 4))));
  painter.setBrush(Qt.BrushStyle.NoBrush);
  painter.setPen(_pen(green, thin, int((125 + (pulse * 95)))));
  painter.drawEllipse(_p(rect, 63.5, 49), (rect.width() * 0.052), (rect.height() * 0.075));
}

function _fg_royal(painter, rect, t, thin, medium) { // Python L9097
  let c, col, cream, crown, f, gold, gold_hot, green, green_dark, green_high, left, left_inner, pulse, right, right_inner, rr, x;
  gold = new QColor("#FFD54A");
  gold_hot = new QColor("#FFF0A3");
  green = new QColor("#177A4A");
  green_dark = new QColor("#0A2B1D");
  green_high = new QColor("#2DAA68");
  cream = new QColor("#FFF3C4");
  crown = new QPainterPath();
  crown.moveTo(_p(rect, 25, 29));
  crown.lineTo(_p(rect, 29, 12));
  crown.lineTo(_p(rect, 40, 22));
  crown.lineTo(_p(rect, 50, 7));
  crown.lineTo(_p(rect, 60, 22));
  crown.lineTo(_p(rect, 71, 12));
  crown.lineTo(_p(rect, 75, 29));
  crown.closeSubpath();
  painter.setPen(_pen(gold_hot, (medium * 1.05), 245));
  painter.setBrush(new QColor(96, 69, 12, 235));
  painter.drawPath(crown);
  painter.setPen(_pen(gold, medium, 240));
  painter.drawLine(_p(rect, 26, 29), _p(rect, 74, 29));
  for ([x, col] of [[37, "#36D47A"], [50, "#F2C14E"], [63, "#36D47A"]]) {
    painter.setPen(_pen(gold_hot, (thin * 0.45), 180));
    painter.setBrush(new QColor(col));
    rr = max(0.9, (rect.width() * 0.0043));
    painter.drawEllipse(_p(rect, x, 25), rr, rr);
  }
  left = new QPainterPath();
  left.moveTo(_p(rect, 28, 74));
  left.lineTo(_p(rect, 43, 82));
  left.lineTo(_p(rect, 40, 100));
  left.lineTo(_p(rect, 24, 94));
  left.lineTo(_p(rect, 18, 84));
  left.closeSubpath();
  right = new QPainterPath();
  right.moveTo(_p(rect, 72, 74));
  right.lineTo(_p(rect, 57, 82));
  right.lineTo(_p(rect, 60, 100));
  right.lineTo(_p(rect, 76, 94));
  right.lineTo(_p(rect, 82, 84));
  right.closeSubpath();
  painter.setPen(_pen(gold_hot, (thin * 0.85), 235));
  painter.setBrush(green_dark);
  painter.drawPath(left);
  painter.drawPath(right);
  left_inner = new QPainterPath();
  left_inner.moveTo(_p(rect, 28, 78));
  left_inner.lineTo(_p(rect, 40, 84));
  left_inner.lineTo(_p(rect, 37, 95));
  left_inner.lineTo(_p(rect, 26, 91));
  left_inner.closeSubpath();
  right_inner = new QPainterPath();
  right_inner.moveTo(_p(rect, 72, 78));
  right_inner.lineTo(_p(rect, 60, 84));
  right_inner.lineTo(_p(rect, 63, 95));
  right_inner.lineTo(_p(rect, 74, 91));
  right_inner.closeSubpath();
  painter.setPen(_pen(green_high, (thin * 0.45), 150));
  painter.setBrush(green);
  painter.drawPath(left_inner);
  painter.drawPath(right_inner);
  painter.setPen(_pen(gold, (thin * 0.7), 210));
  painter.drawLine(_p(rect, 28, 78), _p(rect, 37, 95));
  painter.drawLine(_p(rect, 72, 78), _p(rect, 63, 95));
  pulse = (0.5 + (0.5 * math.sin((t * 1.5))));
  painter.setPen(_pen(gold_hot, (thin * 0.7), 230));
  painter.setBrush(gold);
  painter.drawEllipse(_p(rect, 50, 89), (rect.width() * 0.034), (rect.height() * 0.042));
  f = painter.font();
  f.setFamily("Courier New");
  f.setBold(true);
  f.setPointSize(max(4, int((rect.height() * 0.02))));
  painter.setFont(f);
  painter.setPen(new QColor("#3B2B06"));
  painter.drawText(_rect(rect, 46.5, 86.5, 53.5, 92), Qt.AlignmentFlag.AlignCenter, "XP");
  if (((pulse > 0.86))) {
    c = new QColor(cream);
    c.setAlpha(int((((pulse - 0.86) / 0.14) * 170)));
    painter.setPen(_pen(c, (thin * 0.5), c.alpha()));
    painter.drawLine(_p(rect, 48, 86), _p(rect, 52, 92));
  }
}

function _fg_fire(painter, rect, t, thin, medium) { // Python L9223
  let a, c, i, rr, x, y;
  for (i of range(8)) {
    a = ((t * (0.85 + (i * 0.025))) + (i * 0.71));
    x = (50 + (math.cos(a) * (40 + (_pymod(i, 3) * 3))));
    y = (55 + (math.sin((a * 1.35)) * 35));
    c = new QColor((((_pymod(i, 2) === 0)) ? "#FF643D" : "#FFAA27"));
    c.setAlpha(110);
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    rr = max(0.8, (rect.width() * 0.0045));
    painter.drawEllipse(_p(rect, x, y), rr, rr);
  }
}

function _fg_extra_polished(painter, rect, sid, style, t, thin, medium) { // Python L9240
  let accent, cap, h, hat, helmet, i, rr, secondary, st, variant, x;
  accent = new QColor(style.accent);
  secondary = new QColor(style.secondary);
  if (((sid === "doctor"))) {
    painter.setPen(_pen("#D7D9DA", thin, 220));
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.drawArc(_rect(rect, 35, 13, 65, 31), 0, (180 * 16));
    painter.drawEllipse(_p(rect, 50, 17), (rect.width() * 0.035), (rect.width() * 0.035));
    st = new QPainterPath();
    st.moveTo(_p(rect, 42, 75));
    st.cubicTo(_p(rect, 39, 88), _p(rect, 46, 93), _p(rect, 50, 93));
    st.cubicTo(_p(rect, 54, 93), _p(rect, 61, 88), _p(rect, 58, 75));
    painter.drawPath(st);
  }
  else {
    if (((sid === "engineer"))) {
      helmet = new QPainterPath();
      helmet.moveTo(_p(rect, 31, 29));
      helmet.quadTo(_p(rect, 50, 12), _p(rect, 69, 29));
      painter.setPen(_pen("#E5B93F", medium, 225));
      painter.drawPath(helmet);
      painter.drawLine(_p(rect, 30, 29), _p(rect, 70, 29));
      painter.setPen(_pen("#8A8F92", thin, 120));
      painter.drawRect(_rect(rect, 82, 75, 95, 89));
    }
    else {
      if (((sid === "detective"))) {
        painter.setPen(_pen("#B7B0A7", medium, 220));
        painter.setBrush(new QColor("#2B2927"));
        hat = new QPainterPath();
        hat.moveTo(_p(rect, 32, 29));
        hat.quadTo(_p(rect, 40, 15), _p(rect, 58, 18));
        hat.lineTo(_p(rect, 67, 29));
        hat.closeSubpath();
        painter.drawPath(hat);
        painter.drawLine(_p(rect, 25, 29), _p(rect, 74, 29));
        painter.setBrush(Qt.BrushStyle.NoBrush);
        painter.drawEllipse(_p(rect, 88, 76), (rect.width() * 0.052), (rect.width() * 0.052));
        painter.drawLine(_p(rect, 84, 81), _p(rect, 78, 89));
      }
      else {
        if (((sid === "mechanic"))) {
          painter.setPen(_pen("#9EA2A5", thin, 220));
          painter.setBrush(new QColor("#242628"));
          painter.drawRoundedRect(_rect(rect, 34, 20, 48, 29), 2, 2);
          painter.drawRoundedRect(_rect(rect, 52, 20, 66, 29), 2, 2);
          painter.drawLine(_p(rect, 48, 24.5), _p(rect, 52, 24.5));
          painter.setPen(_pen("#B9BDC0", medium, 220));
          painter.drawLine(_p(rect, 88, 72), _p(rect, 80, 91));
        }
        else {
          if (((sid === "jazz"))) {
            painter.setPen(_pen("#B6B6B6", thin, 210));
            painter.setBrush(new QColor("#171719"));
            hat = new QPainterPath();
            hat.moveTo(_p(rect, 34, 28));
            hat.quadTo(_p(rect, 41, 17), _p(rect, 61, 19));
            hat.lineTo(_p(rect, 66, 28));
            hat.closeSubpath();
            painter.drawPath(hat);
            painter.drawLine(_p(rect, 29, 28), _p(rect, 71, 28));
            painter.setPen(_pen("#C79A48", medium, 220));
            painter.drawLine(_p(rect, 84, 25), _p(rect, 84, 15));
            painter.drawEllipse(_p(rect, 80.5, 27), (rect.width() * 0.02), (rect.width() * 0.02));
          }
          else {
            if (((sid === "techno"))) {
              painter.setPen(_pen("#FF3B30", medium, 210));
              painter.drawLine(_p(rect, 29, 47), _p(rect, 71, 47));
              for ([i, x] of enumerate([78, 82, 86, 90])) {
                h = (3 + (abs(math.sin(((t * 4) + i))) * 7));
                painter.setPen(_pen("#777777", thin, 120));
                painter.drawLine(_p(rect, x, 87), _p(rect, x, (87 - h)));
              }
            }
            else {
              if (((sid === "rockstar"))) {
                painter.setPen(_pen("#D6D6D6", thin, 220));
                painter.setBrush(Qt.BrushStyle.NoBrush);
                painter.drawEllipse(_p(rect, 36, 49), (rect.width() * 0.065), (rect.width() * 0.05));
                painter.drawEllipse(_p(rect, 64, 49), (rect.width() * 0.065), (rect.width() * 0.05));
                painter.drawLine(_p(rect, 42, 49), _p(rect, 58, 49));
                painter.setPen(_pen("#FF3B30", medium, 220));
                painter.drawLine(_p(rect, 89, 72), _p(rect, 82, 91));
              }
              else {
                if (((sid === "maestro"))) {
                  painter.setPen(_pen("#D7D7D7", thin, 190));
                  painter.drawLine(_p(rect, 37, 76), _p(rect, 45, 84));
                  painter.drawLine(_p(rect, 63, 76), _p(rect, 55, 84));
                  painter.setPen(_pen("#E0C15A", thin, 220));
                  painter.drawLine(_p(rect, 87, 72), _p(rect, 98, 55));
                }
                else {
                  if (((sid === "astronaut"))) {
                    painter.setPen(_pen("#C9D8E2", medium, 220));
                    painter.setBrush(new QColor(17, 24, 29, 110));
                    painter.drawRoundedRect(_rect(rect, 28, 7, 72, 43), 12, 12);
                    painter.setPen(_pen("#7FB8FF", thin, 180));
                    painter.drawLine(_p(rect, 68, 12), _p(rect, 76, 3));
                    painter.setPen(Qt.PenStyle.NoPen);
                    painter.setBrush(new QColor("#FF3B30"));
                    rr = max(0.8, (rect.width() * 0.004));
                    painter.drawEllipse(_p(rect, 76, 3), rr, rr);
                  }
                  else {
                    if (((sid === "samurai"))) {
                      painter.setPen(_pen("#D8D0C4", medium, 210));
                      painter.setBrush(Qt.BrushStyle.NoBrush);
                      painter.drawArc(_rect(rect, 29, 14, 71, 34), 0, (180 * 16));
                      painter.drawLine(_p(rect, 34, 20), _p(rect, 25, 10));
                      painter.drawLine(_p(rect, 66, 20), _p(rect, 75, 10));
                    }
                    else {
                      if (((sid === "chrome"))) {
                        painter.setPen(_pen("#BFC4C8", medium, 210));
                        painter.drawLine(_p(rect, 18, 37), _p(rect, 18, 70));
                        painter.drawLine(_p(rect, 82, 37), _p(rect, 82, 70));
                        painter.setPen(_pen("#FFFFFF", (thin * 0.55), 85));
                        painter.drawLine(_p(rect, 20, 40), _p(rect, 20, 57));
                      }
                      else {
                        if (((sid === "eclipse"))) {
                          painter.setPen(_pen("#D6D6D6", thin, 180));
                          painter.setBrush(new QColor("#111214"));
                          painter.drawEllipse(_p(rect, 50, 18), (rect.width() * 0.09), (rect.width() * 0.09));
                          painter.setPen(_pen("#FFB347", thin, 125));
                          painter.drawArc(_rect(rect, 40, 8, 60, 28), (25 * 16), (150 * 16));
                        }
                        else {
                          if (((sid === "fussball"))) {
                            painter.setPen(_pen("#E8E8E8", thin, 180));
                            painter.drawLine(_p(rect, 32, 28), _p(rect, 68, 28));
                            painter.setBrush(Qt.BrushStyle.NoBrush);
                            painter.drawEllipse(_p(rect, 87, 82), (rect.width() * 0.045), (rect.width() * 0.045));
                          }
                          else {
                            if (((sid === "bavarian"))) {
                              painter.setPen(_pen("#4B6C4B", medium, 220));
                              painter.setBrush(new QColor("#243C28"));
                              cap = new QPainterPath();
                              cap.moveTo(_p(rect, 33, 29));
                              cap.quadTo(_p(rect, 50, 15), _p(rect, 67, 29));
                              cap.closeSubpath();
                              painter.drawPath(cap);
                            }
                            else {
                              if (((sid === "fernsehturm"))) {
                                painter.setPen(_pen("#C5C7C9", medium, 210));
                                painter.drawLine(_p(rect, 50, 7), _p(rect, 50, 30));
                                painter.setBrush(Qt.BrushStyle.NoBrush);
                                painter.drawEllipse(_p(rect, 50, 18), (rect.width() * 0.045), (rect.width() * 0.045));
                              }
                              else {
                                if (((sid === "ubahn_ghost"))) {
                                  painter.setPen(_pen("#A6B4C2", medium, 180));
                                  painter.setBrush(new QColor(120, 150, 170, 35));
                                  painter.drawRoundedRect(_rect(rect, 31, 10, 69, 38), 10, 10);
                                }
                                else {
                                  variant = _pymod(int.from_bytes(hashlib.sha1(sid.encode()).digest().slice(0, 2), "big"), 3);
                                  painter.setPen(_pen(accent, thin, 150));
                                  if (((variant === 0))) {
                                    painter.drawLine(_p(rect, 24, 18), _p(rect, 24, 26));
                                    painter.drawLine(_p(rect, 76, 18), _p(rect, 76, 26));
                                  }
                                  else {
                                    if (((variant === 1))) {
                                      painter.drawArc(_rect(rect, 39, 15, 61, 30), 0, (180 * 16));
                                    }
                                    else {
                                      painter.drawLine(_p(rect, 82, 80), _p(rect, 92, 72));
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

function _paint_samurai_slash_overlay(painter, rect, t) { // Python L9363
  let a, after, alpha, arc2, c, cx, cy, cycle, draw_end, fade, fade_end, hold_end, i, inner, main, orb, orb_prog, outer, p, p2_prog, prefix, prefix2, prefix3, progress, pts, pts2, pts3, raw, samples, strength, vis2, vis3, visible;
  cycle = _pymod(t, 5.2);
  draw_end = 0.64;
  hold_end = 0.86;
  fade_end = 1.24;
  if (((cycle >= fade_end))) {
    return undefined;
  }
  if (((cycle < draw_end))) {
    raw = (cycle / draw_end);
    progress = ((raw * raw) * (3.0 - (2.0 * raw)));
    alpha = 255;
  }
  else {
    if (((cycle < hold_end))) {
      progress = 1.0;
      alpha = 255;
    }
    else {
      progress = 1.0;
      fade = (1.0 - ((cycle - hold_end) / (fade_end - hold_end)));
      alpha = int((255 * max(0.0, min(1.0, fade))));
    }
  }
  painter.save();
  painter.setBrush(Qt.BrushStyle.NoBrush);
  main = new QPainterPath();
  main.moveTo(_p(rect, _pyneg(10), 95));
  main.cubicTo(_p(rect, 18, 76), _p(rect, 66, 36), _p(rect, 110, 7));
  samples = 56;
  pts = Array.from(range(samples), i => main.pointAtPercent((i / (samples - 1))));
  visible = max(2, int((1 + (progress * (samples - 1)))));
  prefix = new QPainterPath();
  prefix.moveTo(pts[0]);
  for (p of pts.slice(1, visible)) {
    prefix.lineTo(p);
  }
  c = new QColor("#9EDCFF");
  c.setAlpha(int((alpha * 0.3)));
  painter.setPen(_pen(c, max(11.0, (rect.width() * 0.05)), c.alpha()));
  painter.drawPath(prefix);
  c = new QColor("#D9F4FF");
  c.setAlpha(int((alpha * 0.72)));
  painter.setPen(_pen(c, max(6.5, (rect.width() * 0.031)), c.alpha()));
  painter.drawPath(prefix);
  c = new QColor("#FFFFFF");
  c.setAlpha(alpha);
  painter.setPen(_pen(c, max(3.7, (rect.width() * 0.018)), c.alpha()));
  painter.drawPath(prefix);
  c = new QColor("#FFFFFF");
  c.setAlpha(alpha);
  painter.setPen(_pen(c, max(1.5, (rect.width() * 0.0075)), c.alpha()));
  painter.drawPath(prefix);
  if (((progress > 0.42))) {
    p2_prog = min(1.0, ((progress - 0.42) / 0.58));
    arc2 = new QPainterPath();
    arc2.moveTo(_p(rect, 5, 67));
    arc2.cubicTo(_p(rect, 23, 19), _p(rect, 71, 88), _p(rect, 102, 38));
    pts2 = Array.from(range(samples), i => arc2.pointAtPercent((i / (samples - 1))));
    vis2 = max(2, int((1 + (p2_prog * (samples - 1)))));
    prefix2 = new QPainterPath();
    prefix2.moveTo(pts2[0]);
    for (p of pts2.slice(1, vis2)) {
      prefix2.lineTo(p);
    }
    c = new QColor("#E6F7FF");
    c.setAlpha(int((alpha * 0.42)));
    painter.setPen(_pen(c, max(6.0, (rect.width() * 0.026)), c.alpha()));
    painter.drawPath(prefix2);
    c = new QColor("#FFFFFF");
    c.setAlpha(int((alpha * 0.92)));
    painter.setPen(_pen(c, max(2.5, (rect.width() * 0.012)), c.alpha()));
    painter.drawPath(prefix2);
  }
  if (((progress > 0.62))) {
    orb_prog = min(1.0, ((progress - 0.62) / 0.38));
    orb = new QPainterPath();
    orb.moveTo(_p(rect, 4, 58));
    orb.cubicTo(_p(rect, 10, 26), _p(rect, 86, 19), _p(rect, 98, 52));
    orb.cubicTo(_p(rect, 90, 81), _p(rect, 20, 88), _p(rect, 4, 58));
    pts3 = Array.from(range(samples), i => orb.pointAtPercent((i / (samples - 1))));
    vis3 = max(2, int((1 + (orb_prog * (samples - 1)))));
    prefix3 = new QPainterPath();
    prefix3.moveTo(pts3[0]);
    for (p of pts3.slice(1, vis3)) {
      prefix3.lineTo(p);
    }
    c = new QColor("#FFFFFF");
    c.setAlpha(int((alpha * 0.68)));
    painter.setPen(_pen(c, max(2.2, (rect.width() * 0.01)), c.alpha()));
    painter.drawPath(prefix3);
  }
  if (((progress > 0.78))) {
    strength = ((progress - 0.78) / 0.22);
    [cx, cy] = [53, 48];
    for ([i, a] of enumerate([0, 0.45, 1.0, 1.55, 2.1, 2.7, 3.15, 3.8, 4.45, 5.2])) {
      inner = (8 + (_pymod(i, 3) * 2));
      outer = ((14 + (strength * 10)) + (_pymod(i, 4) * 2));
      c = new QColor((((_pymod(i, 2) === 0)) ? "#FFFFFF" : "#BDEBFF"));
      c.setAlpha(int((alpha * (0.45 + (0.05 * _pymod(i, 4))))));
      painter.setPen(_pen(c, max(0.8, (rect.width() * 0.0035)), c.alpha()));
      painter.drawLine(_p(rect, (cx + (math.cos(a) * inner)), (cy + (math.sin(a) * inner))), _p(rect, (cx + (math.cos(a) * outer)), (cy + (math.sin(a) * outer))));
    }
  }
  if (((progress > 0.5))) {
    c = new QColor("#D92738");
    c.setAlpha(int((alpha * 0.45)));
    painter.setPen(_pen(c, max(1.1, (rect.width() * 0.0048)), c.alpha()));
    after = new QPainterPath();
    after.moveTo(_p(rect, _pyneg(8), 99));
    after.cubicTo(_p(rect, 21, 80), _p(rect, 70, 39), _p(rect, 111, 12));
    painter.drawPath(after);
  }
  painter.restore();
}

function _paint_behavior_overlay(painter, rect, style, pose, t) { // Python L9550
  let angle, arc_rect, arm_pen, c, i, left_arm, length, line, motion, offset, pad, paw, paw_center_y, paw_fill, pivot, right_arm, rot, rr, rx, ry, stroke, swing, sx, sy, toe_specs, x, y, yoff;
  painter.save();
  stroke = max(1.2, (rect.width() * 0.0075));
  line = new QColor(style.line);
  if (((pose.wave > 0.5))) {
    // Pata (Deutschtrainer Plus): nace justo bajo la mejilla derecha, sin hueco con la cara y con el mismo trazo.
    // Unidad isótropa (u = 1 % del ancho) para que la pata no se deforme con la proporción 1.2 del retrato.
    const u = (rect.width() / 100);
    const P = (px, py) => new QPointF((px * u), (py * u));
    swing = math.sin((t * 4.6));
    angle = (24 + (swing * 8));
    painter.save();
    painter.translate(_p(rect, 90.5, 73.5));
    painter.rotate(angle);
    paw_fill = new QColor("#101112");
    paw_fill.setAlpha(250);
    const pen_main = _pen(line, max(stroke, (rect.width() * 0.0088)), 255, Qt.PenCapStyle.RoundCap);
    // Manopla: brazo y palma en un solo contorno, relleno del color del fondo para que se lea delante de la mejilla.
    paw = new QPainterPath();
    paw.moveTo(P(-2.3, 0));
    paw.cubicTo(P(-2.5, -4.5), P(-2.7, -9.0), P(-3.2, -13.2));
    paw.cubicTo(P(-6.4, -14.6), P(-7.2, -19.6), P(-4.6, -22.2));
    paw.cubicTo(P(-2.4, -24.4), P(2.4, -24.4), P(4.6, -22.2));
    paw.cubicTo(P(7.2, -19.6), P(6.4, -14.6), P(3.2, -13.2));
    paw.cubicTo(P(2.7, -9.0), P(2.5, -4.5), P(2.3, 0));
    const body = new QPainterPath();
    body.moveTo(P(-2.3, 0));
    body.cubicTo(P(-2.5, -4.5), P(-2.7, -9.0), P(-3.2, -13.2));
    body.cubicTo(P(-6.4, -14.6), P(-7.2, -19.6), P(-4.6, -22.2));
    body.cubicTo(P(-2.4, -24.4), P(2.4, -24.4), P(4.6, -22.2));
    body.cubicTo(P(7.2, -19.6), P(6.4, -14.6), P(3.2, -13.2));
    body.cubicTo(P(2.7, -9.0), P(2.5, -4.5), P(2.3, 0));
    body.closeSubpath();
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(paw_fill);
    painter.drawPath(body);
    painter.setPen(pen_main);
    painter.setBrush(Qt.BrushStyle.NoBrush);
    painter.drawPath(paw);
    // Almohadillas macizas, del mismo blanco que la nariz: cuatro dedos y la central.
    c = new QColor(style.line);
    c.setAlpha(240);
    painter.setPen(Qt.PenStyle.NoPen);
    painter.setBrush(c);
    for ([x, y, rx, ry] of [[-4.0, -19.4, 0.82, 1.02], [-1.4, -21.3, 0.86, 1.08], [1.4, -21.3, 0.86, 1.08], [4.0, -19.4, 0.82, 1.02]]) {
      painter.drawEllipse(P(x, y), (rx * u), (ry * u));
    }
    pad = new QPainterPath();
    pad.moveTo(P(0, -18.3));
    pad.cubicTo(P(1.2, -19.2), P(2.9, -18.5), P(2.6, -16.8));
    pad.cubicTo(P(2.4, -15.5), P(1.1, -15.1), P(0, -15.1));
    pad.cubicTo(P(-1.1, -15.1), P(-2.4, -15.5), P(-2.6, -16.8));
    pad.cubicTo(P(-2.9, -18.5), P(-1.2, -19.2), P(0, -18.3));
    pad.closeSubpath();
    painter.drawPath(pad);
    // Estela del saludo, solo hacia el lado al que va la pata.
    motion = new QColor(style.secondary);
    motion.setAlpha(120);
    painter.setPen(_pen(motion, max(0.7, (stroke * 0.5)), motion.alpha(), Qt.PenCapStyle.RoundCap));
    painter.setBrush(Qt.BrushStyle.NoBrush);
    for (i of range(2)) {
      rr = (9.2 + (i * 2.8));
      arc_rect = new QRectF((_pyneg(rr) * u), ((-18.6 - rr) * u), ((2 * rr) * u), ((2 * rr) * u));
      painter.drawArc(arc_rect, (((swing >= 0)) ? (_pyneg(22) * 16) : (150 * 16)), (48 * 16));
    }
    painter.restore();
  }
  if (((pose.anger > 0.5))) {
    painter.setPen(_pen("#FF3B30", stroke, 220));
    painter.drawLine(_p(rect, 83, 26), _p(rect, 87, 29));
    painter.drawLine(_p(rect, 87, 29), _p(rect, 91, 26));
  }
  if (((pose.bored > 0.5))) {
    painter.setPen(Qt.PenStyle.NoPen);
    for (i of range(3)) {
      c = new QColor(style.secondary);
      c.setAlpha(130);
      painter.setBrush(c);
      rr = max(1.0, (rect.width() * 0.005));
      painter.drawEllipse(_p(rect, (82 + (i * 5)), 82), rr, rr);
    }
  }
  painter.restore();
}

function _paint_celebration_sparks(painter, rect, accent, secondary, t) { // Python L9778
  let a, i, size, x, y;
  painter.save();
  for (i of range(6)) {
    a = ((t * 1.4) + ((i * math.tau) / 6));
    x = (50 + (math.cos(a) * 46));
    y = (48 + (math.sin(a) * 35));
    size = (2.3 + (abs(math.sin(((t * 3) + i))) * 1.5));
    painter.setPen(_pen((((_pymod(i, 2) === 0)) ? accent : secondary), max(1.0, (rect.width() * 0.005)), 200));
    painter.drawLine(_p(rect, (x - size), y), _p(rect, (x + size), y));
    painter.drawLine(_p(rect, x, (y - size)), _p(rect, x, (y + size)));
  }
  painter.restore();
}

function _paint_sleep_z(painter, rect, color, t, stroke) { // Python L9791
  let drift, i, x, y, z;
  painter.save();
  painter.setPen(_pen(color, max(1.0, (stroke * 0.7)), 180));
  for (i of range(3)) {
    drift = _pymod(((t * 5) + (i * 7)), 17);
    [x, y] = [(74 + (i * 5)), (34 - drift)];
    z = new QPainterPath();
    z.moveTo(_p(rect, x, y));
    z.lineTo(_p(rect, (x + 4), y));
    z.lineTo(_p(rect, x, (y + 4)));
    z.lineTo(_p(rect, (x + 4), (y + 4)));
    painter.drawPath(z);
  }
  painter.restore();
}


// Browser-facing interface. All 52 original skins remain registered above.
(function exposeKlausToBrowser(){
  const validStates = ['idle','happy','celebrating','thinking','confused','laughing','motivating','waving','angry','bored','proud','sleeping'];
  // Positionally match the Python paint_klaus signature (skin, state, t, animate, label).
  function render(canvas,opts={}) {
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const bounds=canvas.getBoundingClientRect();
    const w=Math.max(1,bounds.width || Number(canvas.getAttribute('width')) || 320);
    const h=Math.max(1,bounds.height || Number(canvas.getAttribute('height')) || 280);
    const ratio=Math.min(window.devicePixelRatio||1,2);
    const pw=Math.round(w*ratio),ph=Math.round(h*ratio);
    if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
    ctx.clearRect(0,0,pw,ph);ctx.save();ctx.setTransform(ratio,0,0,ratio,0,0);
    try {
      let painter=new QPainter(ctx);
      let inset=opts.padding??6;
      let r=new QRectF(inset,inset,Math.max(1,w-2*inset),Math.max(1,h-2*inset));
      if((opts.state||'idle')==='waving')r=r.adjusted(8,4,-8,-6);
      paint_klaus(painter,r,SKINS[opts.skin] ? opts.skin : 'default',opts.state||'idle',opts.time||0,opts.animate!==false,!!opts.tag);
    } finally {ctx.restore();}
  }
  class KlausWebCanvas {
    constructor(canvas,options={}){
      if(!(canvas instanceof HTMLCanvasElement))throw new TypeError('El primer argumento debe ser un elemento <canvas>');
      this.canvas=canvas;this.skin=options.skin||'default';this.state=options.state||'idle';
      this.fps=options.fps??30;this.paused=options.paused===true;
      this.animations=options.animations!==false;this.showTag=options.showTag===true;
      this._start=performance.now();this._last=-1;this._frame=0;this._onscreen=true;this._disposed=false;
      this._baseState=this.state;this._overrideUntil=null;
      this._reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
      this._onMotion=()=>this.draw();this._reducedMotion.addEventListener?.('change',this._onMotion);
      this._resize=new ResizeObserver(()=>this.draw());this._resize.observe(canvas);
      if(window.IntersectionObserver){this._observer=new IntersectionObserver(entries=>{this._onscreen=entries[0]?.isIntersecting??true; if(this._onscreen)this.draw();});this._observer.observe(canvas);}
      this._tick=this._tick.bind(this);this.draw();this._frame=requestAnimationFrame(this._tick);
    }
    _tick(now){if(this._disposed)return;
      if(this._overrideUntil!==null && now>=this._overrideUntil) this.clearStateOverride();
      if(!this.paused&&this.animations&&!this._reducedMotion.matches&&!document.hidden&&this._onscreen&&now-this._last>=1000/this.fps){
        this._last=now;this.draw();
      }
      this._frame=requestAnimationFrame(this._tick);
    }
    draw(){if(this._disposed)return;render(this.canvas,{
      skin:this.skin,state:this.state,time:(performance.now()-this._start)/1000,
      animate:this.animations&&!this.paused&&!this._reducedMotion.matches,tag:this.showTag});}
    setSkin(s){this.skin=SKINS[s]?s:'default';this.draw();return this;}
    setState(s){this._baseState=validStates.includes(s)?s:'idle';if(this._overrideUntil===null)this.state=this._baseState;this.draw();return this;}
    playState(s,durationMs=3500){this.state=validStates.includes(s)?s:'idle';this._overrideUntil=durationMs===null?Infinity:performance.now()+Math.max(0,durationMs);this.draw();return this;}
    clearStateOverride(){this._overrideUntil=null;this.state=this._baseState;this.draw();return this;}
    setPaused(p){this.paused=!!p;this.draw();return this;}
    setAnimationsEnabled(v){this.animations=!!v;this.draw();return this;}
    destroy(){this._disposed=true;cancelAnimationFrame(this._frame);this._resize.disconnect();this._observer?.disconnect();this._reducedMotion.removeEventListener?.('change',this._onMotion);}
  }
  window.KlausWeb=Object.freeze({
    create:(canvas,opts)=>new KlausWebCanvas(canvas,opts),
    render,
    skins:()=>Object.values(SKINS).map(s=>({id:s.skin_id,label:s.label,accent:s.accent,glow:s.glow})),
    states:()=>[...validStates],
    skinExists:s=>!!SKINS[s]
  });
})();
