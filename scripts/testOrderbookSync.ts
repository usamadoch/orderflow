/**
 * testOrderbookSync.ts
 *
 * Comprehensive tests for OrderbookManager Section 4 compliance:
 * 1. Pre-snapshot buffering and stale diff discard.
 * 2. First diff bridge validation: U <= lastUpdateId + 1 <= u.
 * 3. Rolling sequence check: U === rollingU + 1 across subsequent diffs.
 * 4. Automatic sequence gap detection and clean state reset.
 * 5. Out-of-order drop simulation triggering resync.
 */

import { OrderbookManager, OrderbookSnapshot } from '../lib/liquidity/orderbook';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runTests() {
  console.log('--- Starting Orderbook Sync Section 4 Tests ---');

  // Test 1: Pre-snapshot buffering and valid first bridging event
  {
    console.log('Test 1: Pre-snapshot buffering and first event bridge validation');
    const ob = new OrderbookManager();

    // Buffer incoming diffs before snapshot
    ob.applyUpdate({
      U: 995,
      u: 999,
      b: [['50000', '1.0']],
      a: [['50010', '1.0']],
    });
    ob.applyUpdate({
      U: 1000,
      u: 1005, // covers lastUpdateId + 1 = 1001
      b: [['50000', '2.0']],
      a: [['50010', '2.0']],
    });
    ob.applyUpdate({
      U: 1006,
      u: 1010,
      b: [['50000', '3.0']],
      a: [['50010', '3.0']],
    });

    assert(!ob.isReady(), 'Orderbook should not be ready before snapshot');

    // Snapshot arrives with lastUpdateId = 1000
    const snapshot: OrderbookSnapshot = {
      lastUpdateId: 1000,
      bids: [['50000', '1.5']],
      asks: [['50010', '1.5']],
    };

    const success = ob.initFromSnapshot(snapshot);
    assert(success, 'initFromSnapshot should succeed with valid bridging buffer');
    assert(ob.isReady(), 'Orderbook should be ready after valid snapshot and buffer drain');
    assert(ob.getRollingU() === 1010, `rollingU should advance to 1010, got ${ob.getRollingU()}`);
    assert(ob.getTopBids(1)[0][1] === 3.0, 'Bids should reflect the latest buffered update');
    console.log('  -> Passed');
  }

  // Test 2: First event fails bridge check (gap between snapshot and buffer)
  {
    console.log('Test 2: Gap between snapshot and first buffered update');
    const ob = new OrderbookManager();
    let gapTriggered = false;
    ob.onGapDetected = () => {
      gapTriggered = true;
    };

    // Buffer diff starting at 1005 (skipping 1001..1004)
    ob.applyUpdate({
      U: 1005,
      u: 1010,
      b: [['50000', '1.0']],
      a: [['50010', '1.0']],
    });

    const snapshot: OrderbookSnapshot = {
      lastUpdateId: 1000,
      bids: [['50000', '1.0']],
      asks: [['50010', '1.0']],
    };

    const success = ob.initFromSnapshot(snapshot);
    assert(!success, 'initFromSnapshot should fail when buffer has gap');
    assert(gapTriggered, 'onGapDetected should fire');
    assert(ob.getResyncCount() === 1, 'resyncCount should increment');
    assert(!ob.isReady(), 'Orderbook should be reset and not ready');
    console.log('  -> Passed');
  }

  // Test 3: Rolling sequence check and gap detection on subsequent live updates
  {
    console.log('Test 3: Rolling sequence validation and sequence gap detection');
    const ob = new OrderbookManager();
    let gapTriggered = false;
    ob.onGapDetected = () => {
      gapTriggered = true;
    };

    ob.initFromSnapshot({
      lastUpdateId: 2000,
      bids: [['50000', '1.0']],
      asks: [['50010', '1.0']],
    });

    // First live event arrives bridging 2001
    const ok1 = ob.applyUpdate({
      U: 2000,
      u: 2005,
      b: [['50000', '1.2']],
      a: [['50010', '1.2']],
    });
    assert(ok1, 'First bridging event should succeed');
    assert(ob.isReady(), 'Orderbook should now be ready');
    assert(ob.getRollingU() === 2005, 'rollingU should be 2005');

    // Next event in exact sequence: U === rollingU + 1 === 2006
    const ok2 = ob.applyUpdate({
      U: 2006,
      u: 2010,
      b: [['50000', '1.5']],
      a: [['50010', '1.5']],
    });
    assert(ok2, 'Sequential event should succeed');
    assert(ob.getRollingU() === 2010, 'rollingU should be 2010');

    // Out-of-order event arrives: U === 2015 (skipping 2011..2014)
    const ok3 = ob.applyUpdate({
      U: 2015,
      u: 2020,
      b: [['50000', '2.0']],
      a: [['50010', '2.0']],
    });
    assert(!ok3, 'Out of order event must be rejected');
    assert(gapTriggered, 'Sequence gap should trigger onGapDetected');
    assert(ob.getResyncCount() === 1, 'resyncCount should be 1');
    assert(!ob.isReady(), 'Orderbook state should be discarded after sequence gap');
    console.log('  -> Passed');
  }

  // Test 4: Simulate gap test helper
  {
    console.log('Test 4: simulateGap triggers resync cleanly');
    const ob = new OrderbookManager();
    let resynced = false;
    ob.onGapDetected = () => {
      resynced = true;
    };

    ob.initFromSnapshot({
      lastUpdateId: 3000,
      bids: [['50000', '1.0']],
      asks: [['50010', '1.0']],
    });
    ob.applyUpdate({
      U: 3001,
      u: 3005,
      b: [['50000', '1.0']],
      a: [['50010', '1.0']],
    });
    assert(ob.isReady(), 'ob is ready');

    ob.simulateGap();
    assert(resynced, 'simulateGap should trigger resync');
    assert(!ob.isReady(), 'ob should reset after simulateGap');
    assert(ob.getResyncCount() === 1, 'resyncCount should be 1');
    console.log('  -> Passed');
  }

  // Test 6: Futures pu-mode — buffered events bridge snapshot via pu
  {
    console.log('Test 6: Futures pu-mode — buffered events bridge snapshot');
    const ob = new OrderbookManager();

    // Buffer Futures events before snapshot (note: pu field present)
    ob.applyUpdate({ U: 5000000, u: 5000050, pu: 4999990, b: [['50000', '1.0']], a: [['50010', '1.0']] });
    ob.applyUpdate({ U: 5000051, u: 5000099, pu: 5000050, b: [['50000', '2.0']], a: [['50010', '2.0']] });

    assert(!ob.isReady(), 'Futures ob should not be ready before snapshot');

    // Snapshot arrives with lastUpdateId = 5000040 (covered by first buffered event's range)
    const success = ob.initFromSnapshot({
      lastUpdateId: 5000040,
      bids: [['50000', '1.5']],
      asks: [['50010', '1.5']],
    });
    assert(success, 'Futures initFromSnapshot should succeed');
    assert(ob.isReady(), 'Futures ob should be ready after valid bridge');
    assert(ob.getRollingU() === 5000099, `Futures rollingU should be 5000099, got ${ob.getRollingU()}`);
    console.log('  -> Passed');
  }

  // Test 7: Futures pu-mode — live pu continuity check
  {
    console.log('Test 7: Futures pu-mode — live pu continuity');
    const ob = new OrderbookManager();

    ob.initFromSnapshot({
      lastUpdateId: 100000,
      bids: [['50000', '1.0']],
      asks: [['50010', '1.0']],
    });

    // First live bridging event: pu <= snapId AND snapId <= u
    const ok1 = ob.applyUpdate({ U: 99990, u: 100100, pu: 99980, b: [['50000', '1.1']], a: [] });
    assert(ok1, 'Futures first bridging event should apply');
    assert(ob.isReady(), 'Futures ob should be initialized after bridging event');
    assert(ob.getRollingU() === 100100, `rollingU should be 100100, got ${ob.getRollingU()}`);

    // Subsequent events must have pu === rollingU
    const ok2 = ob.applyUpdate({ U: 100101, u: 100200, pu: 100100, b: [['50005', '5.0']], a: [] });
    assert(ok2, 'Futures subsequent pu-valid event should apply');
    assert(ob.getRollingU() === 100200, `rollingU should be 100200, got ${ob.getRollingU()}`);

    // Gap: pu does NOT match rollingU
    let gapTriggered = false;
    ob.onResync = () => { gapTriggered = true; };
    const ok3 = ob.applyUpdate({ U: 100250, u: 100300, pu: 100201, b: [], a: [] }); // pu != 100200
    assert(!ok3, 'Futures pu gap should be rejected');
    assert(gapTriggered, 'Futures pu gap should trigger resync');
    console.log('  -> Passed');
  }

  // Test 8: Spot mode still works correctly after dual-mode refactor
  {
    console.log('Test 8: Spot mode regression — U+1 sequence validation still correct');
    const ob = new OrderbookManager();

    ob.initFromSnapshot({
      lastUpdateId: 2000,
      bids: [['50000', '1.0']],
      asks: [['50010', '1.0']],
    });

    // Spot bridging (no pu field)
    const ok1 = ob.applyUpdate({ U: 2001, u: 2005, b: [['50000', '2.0']], a: [] });
    assert(ok1, 'Spot bridging event should apply');
    assert(ob.isReady(), 'Spot ob should be ready');

    const ok2 = ob.applyUpdate({ U: 2006, u: 2010, b: [['50000', '3.0']], a: [] });
    assert(ok2, 'Spot subsequent event should apply');
    assert(ob.getRollingU() === 2010, `Spot rollingU should be 2010, got ${ob.getRollingU()}`);

    let gapHit = false;
    ob.onResync = () => { gapHit = true; };
    const ok3 = ob.applyUpdate({ U: 2015, u: 2020, b: [], a: [] }); // skip U=2011
    assert(!ok3, 'Spot gap (U=2015, expected 2011) should be rejected');
    assert(gapHit, 'Spot gap should trigger resync');
    console.log('  -> Passed');
  }

  console.log('✅ All Orderbook Section 4 + Futures pu tests PASSED successfully.');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
