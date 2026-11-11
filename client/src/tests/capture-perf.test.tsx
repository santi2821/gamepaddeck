import { it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '../App';
import { normalizePhysicalGamepad } from '../services/gamepad-api';
import { normalizedToPadReport } from '../services/protocol';
import { pollPhysicalPads } from '../lib/input-polling';
import { gamepadSlotKey } from '../lib/slot-map';

it('measures capture conversion and root render separately', () => {
  const pads = Array.from({ length: 4 }, (_, index) => ({ index, id: `pad ${index}`, connected: true, mapping: 'standard', timestamp: 0, axes: [0.4, -0.5, 0.1, 0.8], buttons: Array.from({length: 17}, () => ({pressed: false, touched: false, value: 0})), vibrationActuator: null } as unknown as Gamepad));
  const map = Object.fromEntries(pads.map((pad, index) => [gamepadSlotKey(pad), index as 0 | 1 | 2 | 3]));
  for (const count of [1,2,3,4]) {
    for(let i=0;i<2000;i++) for(const pad of pads.slice(0,count)) normalizedToPadReport(normalizePhysicalGamepad(pad));
    const t = performance.now();
    for(let i=0;i<20000;i++) for(let p=0;p<count;p++) normalizedToPadReport(normalizePhysicalGamepad(pads[p]));
    console.log(`conversion ${count} pads: ${((performance.now()-t)/20000).toFixed(4)} ms/tick`);
    const active = pads.slice(0, count);
    const start = performance.now();
    for(let i=0;i<20000;i++) pollPhysicalPads(active, map, 0.12, false, () => {});
    console.log(`capture pipeline ${count} pads: ${((performance.now()-start)/20000).toFixed(4)} ms/tick (no browser API or socket)`);
  }
  for(let i=0;i<10;i++) renderToString(<App />);
  const t=performance.now();
  for(let i=0;i<100;i++) renderToString(<App />);
  console.log(`root SSR: ${((performance.now()-t)/100).toFixed(3)} ms/render (server rendering proxy, not browser latency)`);
});

