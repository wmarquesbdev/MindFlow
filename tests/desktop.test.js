const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { FocusClock } = require('../focus-clock');
const { createUpdater, FEED_URL } = require('../desktop-updates');
test('focus uses a deadline, including after a suspended renderer, and completes once', () => {
  const clock = new FocusClock(); clock.configure(2); clock.start(1000);
  assert.equal(clock.snapshot(31500).seconds, 90);
  const completed = clock.snapshot(200000);
  assert.equal(completed.seconds, 0); assert.equal(completed.running, false); assert.ok(completed.completedId);
  assert.equal(clock.snapshot(210000).completedId, completed.completedId);
  clock.start(220000); assert.equal(clock.snapshot(220000).seconds, 120);
  assert.notEqual(clock.snapshot(400000).completedId, completed.completedId);
});
test('focus pause, resume, reset and validation preserve duration and mode', () => {
  const clock = new FocusClock(); clock.configure(1, 'break'); clock.start(1000); clock.pause(11000);
  assert.equal(clock.snapshot(50000).seconds, 50);
  clock.start(50000); assert.equal(clock.snapshot(60000).seconds, 40);
  assert.equal(clock.reset().seconds, 60); assert.equal(clock.snapshot().mode, 'break');
  for (const invalid of [0, -1, 181, 1.5, NaN, 'invalid']) assert.throws(() => clock.configure(invalid));
});
function mockUpdater() {
  const updater = new EventEmitter(); updater.checks = 0; updater.installs = 0;
  updater.setFeedURL = value => { updater.feed = value; };
  updater.checkForUpdates = () => { updater.checks++; };
  updater.quitAndInstall = () => { updater.installs++; };
  return updater;
}
test('updater downloads once, installs only when ready and blocks active focus', () => {
  const updater = mockUpdater(); let safe = false;
  const controller = createUpdater({ updater, version: '2.8.0', installed: true, canInstall: () => safe });
  assert.equal(updater.feed.url, FEED_URL); assert.equal(controller.install(), false);
  controller.check(); controller.check(); assert.equal(updater.checks, 1);
  updater.emit('update-available'); assert.equal(controller.snapshot().status, 'downloading');
  updater.emit('update-downloaded'); assert.equal(controller.snapshot().status, 'ready');
  assert.equal(controller.install(), false); safe = true; assert.equal(controller.install(), true); assert.equal(updater.installs, 1);
});
test('updater failures can retry and development builds never contact the feed', () => {
  const updater = mockUpdater(); const dev = createUpdater({ updater, version: '2.8.0', installed: false });
  dev.check(); assert.equal(updater.checks, 0); assert.equal(updater.feed, undefined); assert.equal(dev.install(), false);
  const installed = createUpdater({ updater, version: '2.8.0', installed: true });
  installed.check(); updater.emit('error', new Error('offline')); assert.equal(installed.snapshot().status, 'error');
  installed.check(); assert.equal(updater.checks, 2); updater.emit('update-not-available'); assert.equal(installed.snapshot().status, 'current');
});
