/* Planar bicubic Bernstein FFD; control points and artwork share the mapping. */
(function (root) {
  class FFD {
    constructor() {
      this.reset();
    }

    reset() {
      this.controls = Array.from({
        length: 16
      }, (_, k) => ({
        x: 330 + k % 4 * 100,
        y: 110 + Math.floor(k / 4) * 100
      }));
    }

    basis(t) {
      return [(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3];
    }

    derivative(t) {
      return [-3 * (1 - t) ** 2, 3 * (1 - t) ** 2 - 6 * t * (1 - t), 6 * t * (1 - t) - 3 * t * t, 3 * t * t];
    }

    evaluate(u, v) {
      const basisU = this.basis(u);
      const basisV = this.basis(v);
      let x = 0;
      let y = 0;
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const control = this.controls[j * 4 + i];
          const weight = basisU[i] * basisV[j];
          x += control.x * weight;
          y += control.y * weight;
        }
      }
      return {
        x,
        y
      };
    }

    jacobian(u, v) {
      const basisU = this.basis(u);
      const basisV = this.basis(v);
      const derivativeU = this.derivative(u);
      const derivativeV = this.derivative(v);
      let xu = 0;
      let yu = 0;
      let xv = 0;
      let yv = 0;
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const control = this.controls[j * 4 + i];
          xu += control.x * derivativeU[i] * basisV[j];
          yu += control.y * derivativeU[i] * basisV[j];
          xv += control.x * basisU[i] * derivativeV[j];
          yv += control.y * basisU[i] * derivativeV[j];
        }
      }
      return (xu * yv - xv * yu) / 90000;
    }

    contour() {
      return Array.from({
        length: 128
      }, (_, i) => {
        const a = i * Math.PI / 64;
        return this.evaluate(0.5 + 0.37 * Math.cos(a), 0.53 + 0.34 * Math.sin(a));
      });
    }

    metrics() {
      const points = this.contour();
      const area = points.reduce((s, p, i) => {
        const q = points[(i + 1) % points.length];
        return s + (p.x * q.y - p.y * q.x) / 2;
      }, 0);
      let minJacobian = Infinity;
      for (let j = 0; j <= 20; j++) {
        for (let i = 0; i <= 20; i++) {
          minJacobian = Math.min(minJacobian, this.jacobian(i / 20, j / 20));
        }
      }
      return {
        areaRatio: area / (Math.PI * 111 * 102),
        minJacobian
      };
    }

    pose(time) {
      // Artist-authored keyframes: anticipation, takeoff, apex, contact, follow-through.
      const keys = [[0, 1, 0], [0.6, 1.25, 0], [0.85, 0.82, -25], [1.45, 0.93, -85], [2, 1.28, 0], [2.35, 0.93, -7], [2.8, 1, 0]];
      const t = Math.max(0, Math.min(2.8, time));
      let keyIndex = 0;
      while (keyIndex < keys.length - 2 && t > keys[keyIndex + 1][0]) {
        keyIndex++;
      }
      const previousKey = keys[keyIndex];
      const nextKey = keys[keyIndex + 1];
      let blend = (t - previousKey[0]) / (nextKey[0] - previousKey[0]);
      blend = blend * blend * (3 - 2 * blend);
      const scale = previousKey[1] + (nextKey[1] - previousKey[1]) * blend;
      const dy = previousKey[2] + (nextKey[2] - previousKey[2]) * blend;
      this.reset();
      for (const control of this.controls) {
        control.x = 480 + (control.x - 480) * scale;
        control.y = 370 + (control.y - 370) / scale + dy;
      }
      return t < 0.6 ? "预备挤压" : t < 1.45 ? "起跳与伸展" : t < 2 ? "下落" : t < 2.35 ? "接触挤压" : "跟随回弹";
    }

    preset(name) {
      this.reset();
      for (const control of this.controls) {
        const x = control.x - 480;
        const y = control.y - 260;
        if (name === "squash") {
          control.x = 480 + x * 1.3;
          control.y = 260 + y / 1.3;
        } else if (name === "bend") {
          control.x += 65 * (y / 150) ** 2;
          control.y += x * 0.18;
        } else if (name === "stretch") {
          control.x = 480 + x / 1.3;
          control.y = 260 + y * 1.3;
        }
      }
    }
  }
  if (typeof module !== "undefined") {
    module.exports = FFD;
  } else {
    root.FFD = FFD;
  }
})(globalThis);
