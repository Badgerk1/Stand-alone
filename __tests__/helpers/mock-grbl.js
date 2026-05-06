/**
 * Mock GRBL Controller
 * Simulates GRBL responses for testing
 */

class MockGRBL {
  constructor() {
    this.state = 'Idle';
    this.position = { x: 0, y: 0, z: 0 };
    this.machinePosition = { x: 0, y: 0, z: 0 };
    this.wco = { x: 0, y: 0, z: 0 };
    this.probeTriggered = false;
    this.homed = true;
    this.inAlarm = false;
    this.feedOverride = 100;
    this.rapidOverride = 100;
    this.spindleOverride = 100;
  }

  /**
   * Generate a status report response
   * Example: <Idle|MPos:0.000,0.000,0.000|WPos:0.000,0.000,0.000|Pn:P>
   */
  getStatusReport() {
    const state = this.inAlarm ? 'Alarm' : this.state;
    const mpos = `${this.machinePosition.x.toFixed(3)},${this.machinePosition.y.toFixed(3)},${this.machinePosition.z.toFixed(3)}`;
    const wpos = `${this.position.x.toFixed(3)},${this.position.y.toFixed(3)},${this.position.z.toFixed(3)}`;

    let report = `<${state}|MPos:${mpos}|WPos:${wpos}`;

    if (this.probeTriggered) {
      report += '|Pn:P';
    }

    if (this.feedOverride !== 100) {
      report += `|Ov:${this.feedOverride},${this.rapidOverride},${this.spindleOverride}`;
    }

    report += '>';

    return report;
  }

  /**
   * Simulate a probe operation
   * Returns PRB coordinates
   */
  probe(maxPlunge) {
    const probeDepth = Math.random() * maxPlunge * 0.8; // Random contact within 80% of max
    const contactZ = this.position.z - probeDepth;

    this.position.z = contactZ;
    this.machinePosition.z = contactZ + this.wco.z;

    return `[PRB:${this.position.x.toFixed(3)},${this.position.y.toFixed(3)},${contactZ.toFixed(3)}:1]`;
  }

  /**
   * Move to position
   */
  moveTo(x, y, z) {
    if (x !== null && x !== undefined) {
      this.position.x = x;
      this.machinePosition.x = x + this.wco.x;
    }
    if (y !== null && y !== undefined) {
      this.position.y = y;
      this.machinePosition.y = y + this.wco.y;
    }
    if (z !== null && z !== undefined) {
      this.position.z = z;
      this.machinePosition.z = z + this.wco.z;
    }
  }

  /**
   * Set work coordinate offset
   */
  setWCO(x, y, z) {
    this.wco = { x, y, z };
    // Update machine position
    this.machinePosition.x = this.position.x + x;
    this.machinePosition.y = this.position.y + y;
    this.machinePosition.z = this.position.z + z;
  }

  /**
   * Trigger ALARM state
   */
  triggerAlarm() {
    this.inAlarm = true;
    this.state = 'Alarm';
  }

  /**
   * Clear ALARM state
   */
  clearAlarm() {
    this.inAlarm = false;
    this.state = 'Idle';
  }

  /**
   * Set probe trigger state
   */
  setProbeTriggered(triggered) {
    this.probeTriggered = triggered;
  }

  /**
   * Process G-code command and return response
   */
  processCommand(gcode) {
    const cmd = gcode.trim().toUpperCase();

    // Handle common commands
    if (cmd === '$X') {
      this.clearAlarm();
      return 'ok';
    }

    if (cmd === '?') {
      return this.getStatusReport();
    }

    if (cmd.startsWith('G38.2')) {
      // Probe command
      const match = cmd.match(/Z(-?[\d.]+)/);
      const maxPlunge = match ? Math.abs(parseFloat(match[1])) : 10;
      const probeResponse = this.probe(maxPlunge);
      return probeResponse + '\nok';
    }

    if (cmd.startsWith('G') || cmd.startsWith('M')) {
      // Generic move or command
      this.state = 'Run';
      setTimeout(() => {
        this.state = 'Idle';
      }, 10);
      return 'ok';
    }

    return 'ok';
  }
}

module.exports = MockGRBL;
