import assert from 'node:assert/strict';
import worker,{ephemeris} from '../dist/server/index.mjs';
const r=await worker.fetch(new Request('http://local/'));assert.equal(r.status,200);assert.match(await r.text(),/Lunar Landing Site Navigator/);
const im=await worker.fetch(new Request('http://local/moon.jpg'));assert.equal(im.headers.get('Content-Type'),'image/jpeg');assert.ok((await im.arrayBuffer()).byteLength>100000);
const bad=await worker.fetch(new Request('http://local/api/horizons?body=301&lat=99'));assert.equal(bad.status,400);
const live=await worker.fetch(new Request('http://local/api/horizons?body=301&lat=0.674&lon=23.473&date=2026-11-13T00:00'));const data=await live.json();assert.equal(live.status,200,JSON.stringify(data));assert.ok(data.sun.elevation<0);assert.ok(data.earth.rangeAU>0);console.log(JSON.stringify({checks:'passed',sun:data.sun.elevation,earth:data.earth.elevation,rangeAU:data.earth.rangeAU}));
