(function (root) {
  class FocusClock {
    constructor() { this.configure(25, 'focus'); this.configured = false; }
    configure(minutes, mode = 'focus') {
      const value = Number(minutes);
      if (!Number.isInteger(value) || value < 1 || value > 180) throw new Error('Use de 1 a 180 minutos.');
      this.configured = true; this.minutes = value; this.mode = mode === 'break' ? 'break' : 'focus';
      this.seconds = value * 60; this.running = false; this.deadline = 0; this.completedId = ''; this.sessionId = '';
      return this.snapshot();
    }
    start(now = Date.now()) {
      if (this.running) return this.snapshot(now);
      if (this.seconds <= 0) { this.seconds = this.minutes * 60; this.completedId = ''; this.sessionId = ''; }
      if (!this.sessionId) this.sessionId = 'focus-' + now + '-' + Math.random().toString(16).slice(2);
      this.deadline = now + this.seconds * 1000; this.running = true;
      return this.snapshot(now);
    }
    pause(now = Date.now()) { this.snapshot(now); this.running = false; this.deadline = 0; return this.snapshot(now); }
    reset() { return this.configure(this.minutes, this.mode); }
    snapshot(now = Date.now()) {
      if (this.running) {
        this.seconds = Math.max(0, Math.ceil((this.deadline - now) / 1000));
        if (!this.seconds) { this.running = false; this.completedId = this.sessionId; }
      }
      return { minutes: this.minutes, seconds: this.seconds, mode: this.mode, running: this.running, deadline: this.deadline, completedId: this.completedId, configured: this.configured };
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { FocusClock };
  else root.FocusClock = FocusClock;
})(typeof globalThis !== 'undefined' ? globalThis : this);
