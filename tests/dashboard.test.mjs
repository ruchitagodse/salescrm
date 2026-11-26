import test from 'node:test';
import assert from 'node:assert/strict';
import {averagePaise,dashboardDerived} from '../src/lib/dashboard-values.ts';

test('dashboard average excludes unknowns, preserves large integers and rounds half up',()=>{
  assert.equal(averagePaise('0','0'),null);
  assert.equal(averagePaise('0','3'),'0');
  assert.equal(averagePaise('5','2'),'3');
  assert.equal(averagePaise('4','3'),'1');
  assert.equal(averagePaise('18014398509481987','2'),'9007199254740994');
  assert.throws(()=>averagePaise('-1','2'),RangeError);
  assert.throws(()=>averagePaise('1','-1'),RangeError);
});
test('dashboard uses decided cohort for won share and ranks positive attributed sources with ties',()=>{
  const base={dealOutcomes:[{key:'won',count:'1'},{key:'lost',count:'2'},{key:'open',count:'50'}]};
  const extra={dealValue:'5',valuedDealCount:'2',sourceCash:[
    {source:'unattributed',amount:'9999'},{source:'website',amount:'100'},
    {source:'instagram',amount:'100'},{source:'referral',amount:'0'}]};
  const before=JSON.stringify(extra);
  const r=dashboardDerived(base,extra);
  assert.equal(r.averageDeal,'3');assert.equal(r.wonShare,'33.33%');
  assert.deepEqual(r.topSources,['instagram','website']);
  assert.equal(JSON.stringify(extra),before);
});
test('empty dashboard does not fabricate an average, win rate or source winner',()=>{
  const r=dashboardDerived({dealOutcomes:[]},{dealValue:'0',valuedDealCount:'0',sourceCash:[]});
  assert.equal(r.averageDeal,null);assert.equal(r.wonShare,'—');assert.deepEqual(r.topSources,[]);
});
