/**
 * «Побег» на PixiJS v8: вид сбоку на космическую станцию.
 * Три слоя параллакса (космос за окнами — медленно, стены — средне, пол — быстро),
 * робот с электрическими дугами, светящимися глазами и огнём, бегуны с пылью под ногами.
 */
import { Application, Container, Graphics, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import type { Avatar, EscapeRunner, EscapeState } from '@viktorina/shared';
import { avatarSvgString } from '../../components/avatar/Avatar';
import { serverNow } from '../../lib/time';

const CELL = 200;
const START_X = 300;
const O = 0x1a1033;
/** Сцена рисуется в «дизайн-единицах» высотой 600 и масштабируется под контейнер */
const DESIGN_H = 600;
/** Скорость «бега» — с ней прокручивается станция (в единицах сцены в секунду) */
const RUN_SPEED = 240;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  kind: 'dust' | 'fire' | 'spark' | 'flash' | 'streak';
  color: number;
}

interface RunnerView {
  id: string;
  root: Container;
  body: Container;
  legs: Graphics;
  shadow: Graphics;
  sprite: Sprite | null;
  label: Text;
  bubble: Text;
  x: number;
  targetX: number;
  fromX: number;
  moveT: number;
  moveDur: number;
  detour: boolean;
  laneY: number;
  phase: number;
  status: EscapeRunner['status'];
  dying: number;
  avatarKey: string;
  bubbleT: number;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

const textureCache = new Map<string, Promise<Texture>>();
function avatarTexture(a: Avatar): Promise<Texture> {
  const key = JSON.stringify(a);
  let p = textureCache.get(key);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(Texture.from(img));
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSvgString(a, 160));
    });
    textureCache.set(key, p);
  }
  return p;
}

export class EscapeWorld {
  private app = new Application();
  private root = new Container();
  private resizeObs: ResizeObserver | null = null;
  private ready = false;
  private destroyed = false;
  private state: EscapeState | null = null;
  private stateAt = 0;
  private reduced: boolean;

  private far!: TilingSprite;
  private planets!: Container;
  private wall!: TilingSprite;
  private floor!: TilingSprite;
  private world!: Container;
  private obstacles!: Container;
  private door!: Container;
  private runnersLayer!: Container;
  private robot!: Container;
  private robotArcs!: Graphics;
  private robotEyes!: Graphics;
  private fx!: Graphics;
  private particles: Particle[] = [];
  private runners = new Map<string, RunnerView>();
  private camX = 0;
  private robotX = START_X - 300;
  private time = 0;
  /** «Беговая дорожка»: сколько сцена уже прокрутилась, пока все бегут */
  private scroll = 0;
  private scrollSpeed = 0;
  private level = 0;
  private moveRev = -1;
  private obstacleKey = '';
  private quality = 1;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private arcTimer = 0;
  private floorY = 380;
  private scale = 1;

  constructor(
    private readonly container: HTMLElement,
    reduced: boolean,
  ) {
    this.reduced = reduced;
    void this.init();
  }

  private async init(): Promise<void> {
    await this.app.init({
      width: Math.max(10, this.container.clientWidth),
      height: Math.max(10, this.container.clientHeight),
      background: 0x0b0620,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    try {
      await document.fonts?.load('900 16px Nunito');
    } catch {
      /* шрифт не обязателен */
    }
    this.container.appendChild(this.app.canvas);
    // Контейнер меняет размер (полоса ↔ весь экран) — подгоняем холст
    this.resizeObs = new ResizeObserver(() => {
      if (this.destroyed) return;
      this.app.renderer.resize(Math.max(10, this.container.clientWidth), Math.max(10, this.container.clientHeight));
    });
    this.resizeObs.observe(this.container);
    this.build();
    this.ready = true;
    if (this.state) this.apply(this.state, true);
    this.app.ticker.add((t) => this.tick(t.deltaMS / 1000));
  }

  // ───────────── Построение сцены ─────────────

  private makeTexture(draw: (g: Graphics) => void): Texture {
    const g = new Graphics();
    draw(g);
    const tex = this.app.renderer.generateTexture({ target: g, resolution: 1 });
    g.destroy();
    return tex;
  }

  private build(): void {
    this.app.stage.addChild(this.root);
    const stage = this.root;

    // Слой 1: космос со звёздами (виден в окнах)
    const starTex = this.makeTexture((g) => {
      g.rect(0, 0, 512, 512).fill({ color: 0x0d0726 });
      for (let i = 0; i < 70; i++) {
        const x = (i * 197) % 512;
        const y = (i * 331) % 512;
        g.circle(x, y, (i % 3) * 0.6 + 0.7).fill({ color: 0xffffff, alpha: 0.4 + ((i * 7) % 6) / 10 });
      }
    });
    this.far = new TilingSprite({ texture: starTex, width: 100, height: 100 });
    stage.addChild(this.far);

    this.planets = new Container();
    const planet = (x: number, y: number, r: number, color: number, ring: boolean) => {
      const g = new Graphics();
      if (ring) g.ellipse(0, 0, r * 1.9, r * 0.38).stroke({ width: 8, color: 0xc9e9f7 });
      g.circle(0, 0, r).fill({ color }).stroke({ width: 5, color: O });
      g.circle(-r * 0.3, -r * 0.25, r * 0.22).fill({ color: 0xffffff, alpha: 0.18 });
      g.position.set(x, y);
      this.planets.addChild(g);
    };
    // Две одинаковые копии — слой бесшовно зацикливается каждые 3000px
    for (const off of [0, 3000]) {
      planet(off + 300, 120, 54, 0xf08a5d, false);
      planet(off + 1100, 90, 34, 0x6ec1e4, true);
      planet(off + 1900, 150, 46, 0xb58cf2, false);
      planet(off + 2700, 110, 30, 0x86d49a, true);
    }
    stage.addChild(this.planets);

    // Слой 2: стена станции с иллюминаторами (прозрачные «дыры»)
    const wallTex = this.makeTexture((g) => {
      g.rect(0, 0, 360, 400).fill({ color: 0x3b3561 });
      g.roundRect(60, 70, 240, 150, 28).cut();
      g.roundRect(54, 64, 252, 162, 32).stroke({ width: 10, color: 0x5b5577 });
      g.roundRect(54, 64, 252, 162, 32).stroke({ width: 3, color: O });
      g.rect(0, 270, 360, 14).fill({ color: 0x2c2750 });
      g.rect(0, 300, 360, 100).fill({ color: 0x34305a });
      for (let x = 20; x < 360; x += 80) g.circle(x, 292, 4).fill({ color: 0x8f86c2 });
      g.rect(0, 0, 6, 400).fill({ color: 0x2c2750 });
      g.rect(170, 250, 20, 12).fill({ color: 0xffc531 });
    });
    this.wall = new TilingSprite({ texture: wallTex, width: 100, height: 400 });
    stage.addChild(this.wall);

    // Слой 3: мир — пол, препятствия, дверь, бегуны, робот
    this.world = new Container();
    stage.addChild(this.world);
    const floorTex = this.makeTexture((g) => {
      g.rect(0, 0, CELL, 220).fill({ color: 0x5f6788 });
      g.rect(0, 0, CELL, 10).fill({ color: 0xffc531 });
      for (let x = 0; x < CELL; x += 34) g.poly([x, 0, x + 17, 0, x + 7, 10, x - 10, 10]).fill({ color: O });
      g.rect(0, 10, CELL, 4).fill({ color: O, alpha: 0.6 });
      g.rect(CELL - 3, 14, 3, 206).fill({ color: 0x474e6c });
      for (const [x, y] of [
        [14, 30],
        [CELL - 18, 30],
        [14, 120],
        [CELL - 18, 120],
      ])
        g.circle(x!, y!, 3.5).fill({ color: 0x8b93b5 });
    });
    this.floor = new TilingSprite({ texture: floorTex, width: 100, height: 220 });
    this.world.addChild(this.floor);

    this.obstacles = new Container();
    this.world.addChild(this.obstacles);
    this.door = this.makeDoor();
    this.world.addChild(this.door);

    this.robot = this.makeRobot();
    this.world.addChild(this.robot);

    this.runnersLayer = new Container();
    this.runnersLayer.sortableChildren = true;
    this.world.addChild(this.runnersLayer);

    this.fx = new Graphics();
    this.world.addChild(this.fx);
  }

  private makeDoor(): Container {
    const c = new Container();
    const g = new Graphics();
    g.roundRect(-70, -250, 140, 250, 10).fill({ color: 0x2c2750 }).stroke({ width: 5, color: O });
    g.rect(-56, -236, 112, 236).fill({ color: 0x3fd07a, alpha: 0.35 });
    g.rect(-56, -236, 40, 236).fill({ color: 0x8b93b5 }).stroke({ width: 3, color: O });
    g.rect(16, -236, 40, 236).fill({ color: 0x8b93b5 }).stroke({ width: 3, color: O });
    g.rect(-16, -236, 32, 236).fill({ color: 0xc9ffe0, alpha: 0.5 });
    g.roundRect(-58, -300, 116, 40, 8).fill({ color: 0x26890c }).stroke({ width: 4, color: O });
    c.addChild(g);
    const t = new Text({ text: 'ВЫХОД', style: { fontFamily: 'Nunito', fontWeight: '900', fontSize: 24, fill: 0xffffff } });
    t.anchor.set(0.5);
    t.position.set(0, -280);
    c.addChild(t);
    return c;
  }

  private makeRobot(): Container {
    const c = new Container();
    const body = new Graphics();
    // корпус
    body.roundRect(-80, -210, 120, 150, 26).fill({ color: 0x9aa3b5 }).stroke({ width: 6, color: O });
    body.roundRect(-64, -190, 88, 50, 16).fill({ color: 0x2a2438 }).stroke({ width: 4, color: O });
    body.rect(-70, -120, 100, 10).fill({ color: 0xe8434f });
    body.circle(-40, -86, 8).fill({ color: 0xffc531 }).stroke({ width: 3, color: O });
    body.circle(-14, -86, 8).fill({ color: 0x3fd07a }).stroke({ width: 3, color: O });
    // антенна
    body.moveTo(-20, -210).lineTo(-20, -244).stroke({ width: 5, color: O });
    body.circle(-20, -250, 9).fill({ color: 0xff3b3b }).stroke({ width: 4, color: O });
    // сопло
    body.poly([-60, -60, 20, -60, 6, -30, -46, -30]).fill({ color: 0x5b5577 }).stroke({ width: 5, color: O });
    // манипуляторы
    body.moveTo(30, -170).lineTo(90, -186).lineTo(118, -160).stroke({ width: 16, color: O, cap: 'round', join: 'round' });
    body.moveTo(30, -170).lineTo(90, -186).lineTo(118, -160).stroke({ width: 9, color: 0xc3cad8, cap: 'round', join: 'round' });
    body.moveTo(30, -100).lineTo(92, -90).lineTo(118, -116).stroke({ width: 16, color: O, cap: 'round', join: 'round' });
    body.moveTo(30, -100).lineTo(92, -90).lineTo(118, -116).stroke({ width: 9, color: 0xc3cad8, cap: 'round', join: 'round' });
    body.circle(122, -158, 10).fill({ color: 0x5b5577 }).stroke({ width: 4, color: O });
    body.circle(122, -118, 10).fill({ color: 0x5b5577 }).stroke({ width: 4, color: O });
    c.addChild(body);
    this.robotEyes = new Graphics();
    this.robotEyes.blendMode = 'add';
    c.addChild(this.robotEyes);
    this.robotArcs = new Graphics();
    this.robotArcs.blendMode = 'add';
    c.addChild(this.robotArcs);
    return c;
  }

  // ───────────── Данные с сервера ─────────────

  update(state: EscapeState): void {
    this.state = state;
    this.stateAt = serverNow();
    if (this.ready) this.apply(state, false);
  }

  private apply(state: EscapeState, initial: boolean): void {
    const levelChanged = state.level !== this.level;
    if (levelChanged) {
      // Новый уровень — всех расставляем заново (под затемнением)
      for (const r of this.runners.values()) r.root.destroy({ children: true });
      this.runners.clear();
      this.level = state.level;
      this.robotX = START_X + state.robotPos * CELL;
    }
    const obsKey = JSON.stringify(state.obstacles) + state.trackLength;
    if (obsKey !== this.obstacleKey) {
      this.obstacleKey = obsKey;
      this.drawObstacles(state);
    }
    this.door.position.set(START_X + state.trackLength * CELL + 40, this.floorY);

    this.layout = this.computeLayout(state);
    const seen = new Set<string>();
    const moved = state.moveRev !== this.moveRev && !initial && !levelChanged;
    this.moveRev = state.moveRev;
    for (const r of state.runners) {
      seen.add(r.playerId);
      let v = this.runners.get(r.playerId);
      const tx = this.runnerX(r);
      if (!v) {
        v = this.createRunner(r, tx);
        this.runners.set(r.playerId, v);
      }
      if (moved && r.lastMove === 'step' && Math.abs(tx - v.targetX) > 1) {
        v.fromX = v.x;
        v.targetX = tx;
        v.moveT = 0;
        v.moveDur = 1.1 + (hash(r.playerId) % 5) * 0.06;
        v.detour = false;
      } else if (moved && r.lastMove === 'detour') {
        v.fromX = v.x;
        v.targetX = tx;
        v.moveT = 0;
        v.moveDur = 1.3;
        v.detour = true;
        v.bubble.text = 'обход!';
        v.bubbleT = 1.6;
      } else if (Math.abs(v.targetX - tx) > 1 && v.moveT >= v.moveDur) {
        v.x = v.targetX = v.fromX = tx;
      }
      if (r.status !== v.status) {
        if (r.status === 'caught' && v.status === 'running') this.catchFx(v);
        if (r.status === 'escaped') {
          v.bubble.text = 'спасён!';
          v.bubbleT = 2;
        }
        v.status = r.status;
      }
      const lane = this.layout.get(r.playerId)?.lane ?? 0;
      v.laneY = 30 + lane * 30;
      v.root.zIndex = lane;
      if (v.avatarKey !== JSON.stringify(r.avatar)) this.loadAvatar(v, r.avatar);
    }
    for (const [id, v] of this.runners) {
      if (!seen.has(id)) {
        v.root.destroy({ children: true });
        this.runners.delete(id);
      }
    }
  }

  /** Внешний сигнал «робот поймал» — для мгновенной вспышки */
  caught(playerId: string): void {
    const v = this.runners.get(playerId);
    if (v && v.status === 'running') {
      v.status = 'caught';
      this.catchFx(v);
    }
  }

  private layout = new Map<string, { dx: number; lane: number }>();

  /** Кто стоит на одной клетке — расставляем сеткой: до 4 рядов в глубину, остальные — вбок */
  private computeLayout(state: EscapeState): Map<string, { dx: number; lane: number }> {
    const groups = new Map<string, EscapeRunner[]>();
    for (const r of state.runners) {
      const key = r.status === 'escaped' ? 'door' : String(r.pos);
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    const out = new Map<string, { dx: number; lane: number }>();
    for (const list of groups.values()) {
      list.sort((a, b) => hash(a.playerId) - hash(b.playerId));
      const rows = Math.min(4, list.length);
      const cols = Math.ceil(list.length / rows);
      const step = Math.min(56, (CELL - 30) / Math.max(1, cols - 1 || 1));
      list.forEach((r, i) => {
        const col = Math.floor(i / rows);
        const row = i % rows;
        out.set(r.playerId, { dx: (col - (cols - 1) / 2) * step + (row % 2 ? 14 : -14) * (cols > 1 ? 0 : 1), lane: row });
      });
    }
    return out;
  }

  private runnerX(r: EscapeRunner): number {
    const dx = this.layout.get(r.playerId)?.dx ?? 0;
    if (r.status === 'escaped') return START_X + (this.state?.trackLength ?? 0) * CELL + 10 + dx;
    return START_X + r.pos * CELL + dx;
  }

  private createRunner(r: EscapeRunner, x: number): RunnerView {
    const root = new Container();
    const lane = this.layout.get(r.playerId)?.lane ?? 0;
    const shadow = new Graphics().ellipse(0, 0, 30, 8).fill({ color: 0x000000, alpha: 0.28 });
    const legs = new Graphics();
    const body = new Container();
    const color = hexToNum(r.color);
    const ring = new Graphics().circle(0, -48, 36).fill({ color, alpha: 0.85 }).stroke({ width: 4, color: O });
    body.addChild(ring);
    const label = new Text({
      text: r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name,
      style: { fontFamily: 'Nunito', fontWeight: '900', fontSize: 15, fill: 0xffffff, stroke: { color: O, width: 4 } },
    });
    label.anchor.set(0.5, 0);
    label.position.set(0, 12);
    const bubble = new Text({
      text: '',
      style: { fontFamily: 'Nunito', fontWeight: '900', fontSize: 16, fill: 0xffc531, stroke: { color: O, width: 4 } },
    });
    bubble.anchor.set(0.5, 1);
    bubble.position.set(0, -112);
    root.addChild(shadow, legs, body, label, bubble);
    root.zIndex = lane;
    this.runnersLayer.addChild(root);
    const v: RunnerView = {
      id: r.playerId,
      root,
      body,
      legs,
      shadow,
      sprite: null,
      label,
      bubble,
      x,
      targetX: x,
      fromX: x,
      moveT: 1,
      moveDur: 1,
      detour: false,
      laneY: 30 + lane * 30,
      phase: (hash(r.playerId) % 100) / 16,
      status: r.status,
      dying: r.status === 'caught' ? 1 : 0,
      avatarKey: '',
      bubbleT: 0,
    };
    if (r.status === 'caught') root.alpha = 0;
    this.loadAvatar(v, r.avatar);
    return v;
  }

  private loadAvatar(v: RunnerView, a: Avatar): void {
    v.avatarKey = JSON.stringify(a);
    avatarTexture(a)
      .then((tex) => {
        if (this.destroyed || v.root.destroyed) return;
        if (v.sprite) v.sprite.destroy();
        const s = new Sprite(tex);
        s.anchor.set(0.5, 1);
        s.scale.set(0.62);
        s.position.set(0, -4);
        v.sprite = s;
        v.body.removeChildren().forEach((c) => c.destroy());
        v.body.addChild(s);
      })
      .catch(() => undefined);
  }

  private catchFx(v: RunnerView): void {
    v.dying = 0.0001;
    this.particles.push({ x: v.x, y: this.floorY + v.laneY - 50, vx: 0, vy: 0, life: 0, max: 0.5, r: 30, kind: 'flash', color: 0xffffff });
    if (!this.reduced) {
      for (let i = 0; i < 16 * this.quality; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 180 + Math.random() * 260;
        this.particles.push({
          x: v.x,
          y: this.floorY + v.laneY - 50,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0,
          max: 0.5 + Math.random() * 0.3,
          r: 3 + Math.random() * 3,
          kind: 'spark',
          color: 0x7fd3f7,
        });
      }
    }
  }

  private drawObstacles(state: EscapeState): void {
    this.obstacles.removeChildren().forEach((c) => c.destroy());
    for (const o of state.obstacles) {
      const g = new Graphics();
      const x = START_X + o.cell * CELL;
      if (o.kind === 'pit') {
        g.ellipse(0, 0, 62, 26).fill({ color: 0x0b0620 }).stroke({ width: 5, color: O });
        g.ellipse(0, -4, 50, 16).fill({ color: 0x1d1440 });
        for (let k = -2; k <= 2; k++) g.rect(k * 26 - 8, -34, 14, 8).fill({ color: k % 2 ? 0xffc531 : O });
      } else {
        g.ellipse(0, 0, 66, 22).fill({ color: 0x3aa7d9, alpha: 0.85 }).stroke({ width: 4, color: O });
        g.ellipse(-16, -6, 22, 6).fill({ color: 0xc9e9f7, alpha: 0.8 });
        g.ellipse(26, 4, 10, 3).fill({ color: 0xc9e9f7, alpha: 0.6 });
      }
      g.position.set(x, this.floorY + 70);
      this.obstacles.addChild(g);
    }
  }

  // ───────────── Кадр ─────────────

  private tick(dt: number): void {
    if (!this.state) return;
    this.time += dt;
    this.adaptQuality(dt);
    // Узкая полоса над вопросом — «камера ближе»: срезаем потолок, чтобы герои были крупнее
    const aspect = this.app.screen.width / Math.max(1, this.app.screen.height);
    const H = aspect > 3.2 ? 360 : DESIGN_H;
    this.scale = this.app.screen.height / H;
    this.root.scale.set(this.scale);
    const W = this.app.screen.width / this.scale;
    const s = this.state;
    const newFloor = Math.round(H * (aspect > 3.2 ? 0.78 : 0.66));
    if (newFloor !== this.floorY) {
      this.floorY = newFloor;
      this.drawObstacles(s);
      this.door.position.set(START_X + s.trackLength * CELL + 40, this.floorY);
    }

    // Робот: позиция экстраполируется локально, источник истины — сервер
    const elapsed = s.clockRunning ? (serverNow() - this.stateAt) / 1000 : 0;
    const robotPos = Math.min(s.trackLength, s.robotPos + s.robotSpeed * elapsed);
    const robotTarget = START_X + robotPos * CELL - 40;
    this.robotX += (robotTarget - this.robotX) * Math.min(1, dt * 4);

    // Камера: держим в кадре робота и бегущих, стараемся показать дверь
    const worldEnd = START_X + s.trackLength * CELL + 240;
    const running = [...this.runners.values()].filter((r) => r.status !== 'caught');
    const front = running.length ? Math.max(...running.map((r) => r.x)) : this.robotX + 400;
    const left = this.robotX - 220;
    const right = Math.max(front + 260, left + 600);
    let target: number;
    if (worldEnd - (this.robotX - 240) <= W) target = Math.max(this.robotX - 240, worldEnd - W);
    else target = Math.max(left, (left + right) / 2 - W / 2);
    target = Math.min(target, worldEnd - W);
    if (worldEnd + 40 < W) target = (worldEnd - W) / 2;
    this.camX += (target - this.camX) * Math.min(1, dt * 2.2);

    // Все бегут: станция непрерывно уносится назад (влево). Останавливаемся только на итогах уровня
    const stopped = !!s.banner && s.banner.kind !== 'levelStart';
    const wantSpeed = this.reduced || stopped ? 0 : RUN_SPEED;
    this.scrollSpeed += (wantSpeed - this.scrollSpeed) * Math.min(1, dt * 2);
    this.scroll += this.scrollSpeed * dt;

    // Параллакс: дальние планеты медленно, стены средне, пол быстро
    const pf = this.reduced ? 0 : 1;
    this.far.width = W;
    this.far.height = H;
    this.far.tilePosition.x = -(this.camX * 0.12 + this.scroll * 0.06 + this.time * 6) * pf;
    this.planets.x = -((this.camX * 0.18 * pf + this.scroll * 0.12 + (this.reduced ? 0 : this.time * 4)) % 3000);
    this.planets.y = H * 0.08;
    this.wall.width = W;
    this.wall.height = this.floorY + 40;
    this.wall.y = this.floorY - this.wall.height + 2;
    this.wall.tilePosition.y = this.wall.height - 400;
    this.wall.tilePosition.x = -(this.camX * 0.5 + this.scroll * 0.5) * pf;
    this.world.x = -this.camX;
    this.floor.x = this.camX - 40;
    this.floor.y = this.floorY;
    this.floor.width = W + 80;
    this.floor.height = H - this.floorY + 10;
    this.floor.tilePosition.x = -(this.camX - 40 + this.scroll);

    this.updateRobot(dt);
    this.updateRunners(dt);
    this.updateParticles(dt);
  }

  private adaptQuality(dt: number): void {
    // Если проседает ниже 30 fps — автоматически уменьшаем число частиц
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 1.5) {
      const fps = this.fpsFrames / this.fpsAcc;
      if (fps < 30) this.quality = Math.max(0.2, this.quality * 0.6);
      else if (fps > 55) this.quality = Math.min(1, this.quality + 0.1);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
  }

  private updateRobot(dt: number): void {
    const charging = this.scrollSpeed / RUN_SPEED;
    const hover = this.reduced ? 0 : Math.sin(this.time * 7) * 5;
    this.robot.position.set(this.robotX, this.floorY + 60 + hover);
    // Робот несётся вперёд: наклон и подрагивание корпуса
    this.robot.rotation = this.reduced ? 0 : 0.09 * charging + Math.sin(this.time * 23) * 0.012 * charging;
    // Светящиеся глаза
    const e = this.robotEyes;
    e.clear();
    const pulse = 0.6 + Math.sin(this.time * 6) * 0.25;
    for (const ex of [-44, -4]) {
      e.circle(ex, -165, 18).fill({ color: 0xff2a2a, alpha: 0.25 * pulse });
      e.circle(ex, -165, 10).fill({ color: 0xff4040, alpha: 0.8 });
      e.circle(ex + 2, -167, 4).fill({ color: 0xffe0e0, alpha: 1 });
    }
    // Электрические дуги между манипуляторами
    this.arcTimer -= dt;
    if (this.arcTimer <= 0) {
      this.arcTimer = this.reduced ? 0.4 : 0.06;
      const a = this.robotArcs;
      a.clear();
      const x0 = 126;
      const y0 = -150;
      const y1 = -124;
      for (let k = 0; k < 2; k++) {
        const pts: number[] = [x0, y0];
        const steps = 6;
        for (let i = 1; i < steps; i++) {
          pts.push(x0 + 6 + (Math.random() - 0.3) * 26, y0 + ((y1 - y0) * i) / steps);
        }
        pts.push(x0, y1);
        a.poly(pts, false).stroke({ width: 8, color: 0x3fd0ff, alpha: 0.25 });
        a.poly(pts, false).stroke({ width: 2.5, color: 0xe0faff, alpha: 0.95 });
      }
    }
    // Огонь из сопла тянется за роботом
    if (!this.reduced) {
      const n = Math.random() < 0.9 * this.quality ? 3 : 1;
      for (let i = 0; i < n; i++) {
        this.particles.push({
          x: this.robotX - 20 + (Math.random() - 0.5) * 30,
          y: this.floorY + 60 - 30 + Math.random() * 8,
          vx: -160 - Math.random() * 140 - this.scrollSpeed * 0.8,
          vy: 20 + Math.random() * 40,
          life: 0,
          max: 0.45 + Math.random() * 0.3,
          r: 10 + Math.random() * 8,
          kind: 'fire',
          color: 0xffc531,
        });
      }
      // Полосы скорости за роботом
      if (charging > 0.5 && Math.random() < dt * 8 * this.quality) {
        this.particles.push({
          x: this.robotX - 90,
          y: this.floorY - 40 - Math.random() * 160,
          vx: -this.scrollSpeed * 1.6,
          vy: 0,
          life: 0,
          max: 0.35,
          r: 40 + Math.random() * 40,
          kind: 'streak',
          color: 0xffffff,
        });
      }
    }
  }

  private updateRunners(dt: number): void {
    for (const v of this.runners.values()) {
      // Движение к цели с прыжком
      let hop = 0;
      let laneOffset = 0;
      if (v.moveT < v.moveDur) {
        v.moveT += dt;
        const k = Math.min(1, v.moveT / v.moveDur);
        const ease = 1 - Math.pow(1 - k, 3);
        v.x = v.fromX + (v.targetX - v.fromX) * ease;
        if (!this.reduced) hop = Math.sin(k * Math.PI) * (v.detour ? 34 : 18);
        if (v.detour && !this.reduced) laneOffset = Math.sin(k * Math.PI) * 46;
      } else {
        v.x = v.targetX;
      }
      const run = v.status === 'running' && !this.reduced;
      // Шаг быстрее, когда станция «несётся», и рывок, когда бегун продвигается вперёд
      const sprint = v.moveT < v.moveDur && !v.detour ? 1.5 : 1;
      const speed = (9 + 6 * (this.scrollSpeed / RUN_SPEED)) * sprint;
      const ph = this.time * speed + v.phase;
      const bob = run ? Math.abs(Math.sin(ph)) * 7 : v.status === 'escaped' && !this.reduced ? Math.abs(Math.sin(this.time * 5 + v.phase)) * 12 : 0;
      v.root.position.set(v.x, this.floorY + v.laneY + laneOffset);
      v.body.position.y = -bob - hop - 12;
      // Бег всерьёз: корпус наклонён вперёд, раскачивается в такт шагам
      v.body.rotation = run ? Math.sin(ph) * 0.05 + 0.14 * (this.scrollSpeed / RUN_SPEED) + 0.03 : 0;
      v.shadow.scale.set(1 - (bob + hop) / 90);

      // Ноги: бег циклом
      const g = v.legs;
      g.clear();
      const swing = run ? Math.sin(ph) * 17 : 0;
      g.moveTo(-8, -18 - bob - hop).lineTo(-8 + swing, -2 - hop * 0.3).stroke({ width: 7, color: O, cap: 'round' });
      g.moveTo(8, -18 - bob - hop).lineTo(8 - swing, -2 - hop * 0.3).stroke({ width: 7, color: O, cap: 'round' });

      // Облачко пыли под ногами
      if (run && Math.random() < dt * 9 * this.quality) {
        this.particles.push({
          x: v.x - 12,
          y: this.floorY + v.laneY - 2,
          vx: -60 - Math.random() * 40 - this.scrollSpeed * 0.6,
          vy: -20 - Math.random() * 20,
          life: 0,
          max: 0.6,
          r: 5 + Math.random() * 4,
          kind: 'dust',
          color: 0xd9d4ee,
        });
      }

      // Пузырь «обход!» / «спасён!»
      if (v.bubbleT > 0) {
        v.bubbleT -= dt;
        v.bubble.alpha = Math.min(1, v.bubbleT);
      } else v.bubble.alpha = 0;

      // Выбывание: вспышка и затухание
      if (v.dying > 0 && v.dying < 1) {
        v.dying = Math.min(1, v.dying + dt / 0.7);
        v.root.alpha = 1 - v.dying;
        if (!this.reduced) v.root.scale.set(1 + v.dying * 0.5);
      } else if (v.status === 'caught') {
        v.root.alpha = 0;
      } else {
        v.root.alpha = v.status === 'escaped' ? 0.9 : 1;
        v.root.scale.set(1);
      }
    }
  }

  private updateParticles(dt: number): void {
    const g = this.fx;
    g.clear();
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.max) continue;
      const k = p.life / p.max;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'spark') p.vy += 600 * dt;
      if (p.kind === 'fire') {
        const color = k < 0.3 ? 0xffe066 : k < 0.6 ? 0xff8a3d : 0xe8434f;
        g.circle(p.x, p.y, p.r * (1 - k * 0.6)).fill({ color, alpha: 0.85 * (1 - k) });
      } else if (p.kind === 'dust') {
        g.circle(p.x, p.y, p.r * (0.6 + k)).fill({ color: p.color, alpha: 0.45 * (1 - k) });
      } else if (p.kind === 'streak') {
        g.rect(p.x, p.y, p.r, 3).fill({ color: p.color, alpha: 0.35 * (1 - k) });
      } else if (p.kind === 'spark') {
        g.circle(p.x, p.y, p.r * (1 - k)).fill({ color: p.color, alpha: 1 - k });
      } else {
        g.circle(p.x, p.y, p.r + k * 90).fill({ color: 0xffffff, alpha: 0.9 * (1 - k) });
      }
      alive.push(p);
    }
    const cap = Math.round(500 * this.quality) + 60;
    this.particles = alive.length > cap ? alive.slice(alive.length - cap) : alive;
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObs?.disconnect();
    if (this.ready) {
      this.app.destroy(true, { children: true });
    }
  }
}
