/* Lecture13 p31: planar bicubic Bernstein FFD (all z coordinates are zero). */
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
      const a = this.basis(u),
        b = this.basis(v);
      let x = 0,
        y = 0;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        let p = this.controls[j * 4 + i],
          w = a[i] * b[j];
        x += p.x * w;
        y += p.y * w;
      }
      return {
        x,
        y
      };
    }
    jacobian(u, v) {
      let a = this.basis(u),
        b = this.basis(v),
        da = this.derivative(u),
        db = this.derivative(v),
        xu = 0,
        yu = 0,
        xv = 0,
        yv = 0;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        let p = this.controls[j * 4 + i];
        xu += p.x * da[i] * b[j];
        yu += p.y * da[i] * b[j];
        xv += p.x * a[i] * db[j];
        yv += p.y * a[i] * db[j];
      }
      return (xu * yv - xv * yu) / 90000;
    }
    contour() {
      return Array.from({
        length: 128
      }, (_, i) => {
        let a = i * Math.PI / 64;
        return this.evaluate(.5 + .37 * Math.cos(a), .53 + .34 * Math.sin(a));
      });
    }
    metrics() {
      let points = this.contour(),
        area = points.reduce((s, p, i) => {
          let q = points[(i + 1) % points.length];
          return s + (p.x * q.y - p.y * q.x) / 2;
        }, 0),
        minJacobian = Infinity;
      for (let j = 0; j <= 20; j++) for (let i = 0; i <= 20; i++) minJacobian = Math.min(minJacobian, this.jacobian(i / 20, j / 20));
      return {
        areaRatio: area / (Math.PI * 111 * 102),
        minJacobian
      };
    }
    pose(time) {
      // Artist-authored keyframes: anticipation, takeoff, apex, contact, follow-through.
      const keys = [[0, 1, 0], [.6, 1.25, 0], [.85, .82, -25], [1.45, .93, -85], [2, 1.28, 0], [2.35, .93, -7], [2.8, 1, 0]];
      const t = Math.max(0, Math.min(2.8, time));
      let k = 0;
      while (k < keys.length - 2 && t > keys[k + 1][0]) k++;
      let a = keys[k],
        b = keys[k + 1],
        u = (t - a[0]) / (b[0] - a[0]);
      u = u * u * (3 - 2 * u);
      const scale = a[1] + (b[1] - a[1]) * u,
        dy = a[2] + (b[2] - a[2]) * u;
      this.reset();
      for (let p of this.controls) {
        p.x = 480 + (p.x - 480) * scale;
        p.y = 370 + (p.y - 370) / scale + dy;
      }
      return t < .6 ? '预备挤压' : t < 1.45 ? '起跳与伸展' : t < 2 ? '下落' : t < 2.35 ? '接触挤压' : '跟随回弹';
    }
    preset(name) {
      this.reset();
      for (let p of this.controls) {
        let x = p.x - 480,
          y = p.y - 260;
        if (name === 'squash') {
          p.x = 480 + x * 1.3;
          p.y = 260 + y / 1.3;
        } else if (name === 'bend') {
          p.x += 65 * (y / 150) ** 2;
          p.y += x * .18;
        } else if (name === 'stretch') {
          p.x = 480 + x / 1.3;
          p.y = 260 + y * 1.3;
        }
      }
    }
  }
  if (typeof module !== 'undefined') module.exports = FFD;else root.FFD = FFD;
})(globalThis);
