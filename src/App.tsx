import { useEffect, useRef, useState } from 'react';
import './App.css';

// Game constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const GROUND_HEIGHT = 60;
const PLAYER_RADIUS = 24;
const ENEMY_WIDTH = 32;
const ENEMY_HEIGHT = 40;
const HOLE_WIDTH = 80;
const GRAVITY = 0.7;
const JUMP_VELOCITY = -13;
const MOVE_SPEED = 5;
const LEVEL_LENGTH = 2400;
const ENEMY_COLOR = '#ff8800';
const PLAYER_COLOR = '#1e90ff';

// Helper types
type Enemy = { x: number; y: number; alive: boolean };
type Hole = { x: number; width: number };

function generateLevel(): { enemies: Enemy[]; holes: Hole[] } {
  const enemies: Enemy[] = [];
  const holes: Hole[] = [];
  let x = 200;
  while (x < LEVEL_LENGTH - 100) {
    // Randomly place holes
    if (Math.random() < 0.18) {
      const width = HOLE_WIDTH + Math.random() * 40;
      holes.push({ x, width });
      x += width + 100 + Math.random() * 100;
      continue;
    }
    // Randomly place enemies
    if (Math.random() < 0.22) {
      enemies.push({ x, y: GAME_HEIGHT - GROUND_HEIGHT - ENEMY_HEIGHT, alive: true });
    }
    x += 120 + Math.random() * 120;
  }
  return { enemies, holes };
}

function rectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [resetKey, setResetKey] = useState(0);
  const [level, setLevel] = useState(() => generateLevel());
  const [gameState, setGameState] = useState<'playing' | 'dead' | 'win'>('playing');

  // Player state
  const player = useRef({
    x: 60,
    y: GAME_HEIGHT - GROUND_HEIGHT - PLAYER_RADIUS,
    vx: 0,
    vy: 0,
    onGround: false,
  });
  // Camera state
  const cameraX = useRef(0);

  // Input state
  const keys = useRef({ left: false, right: false, jump: false });

  // Reset game
  const resetGame = () => {
    setLevel(generateLevel());
    setGameState('playing');
    player.current = {
      x: 60,
      y: GAME_HEIGHT - GROUND_HEIGHT - PLAYER_RADIUS,
      vx: 0,
      vy: 0,
      onGround: false,
    };
    cameraX.current = 0;
    setResetKey(k => k + 1);
  };

  // Game loop
  useEffect(() => {
    let animationId: number;
    function loop() {
      if (gameState !== 'playing') return;
      // Handle input
      if (keys.current.left) player.current.vx = -MOVE_SPEED;
      else if (keys.current.right) player.current.vx = MOVE_SPEED;
      else player.current.vx = 0;

      // Apply gravity
      player.current.vy += GRAVITY;

      // Move player
      player.current.x += player.current.vx;
      player.current.y += player.current.vy;

      // Clamp to ground
      // Check if player is over a hole
      let overHole = false;
      for (const hole of level.holes) {
        if (
          player.current.x + PLAYER_RADIUS > hole.x &&
          player.current.x - PLAYER_RADIUS < hole.x + hole.width
        ) {
          overHole = true;
          break;
        }
      }
      if (!overHole && player.current.y > GAME_HEIGHT - GROUND_HEIGHT - PLAYER_RADIUS) {
        player.current.y = GAME_HEIGHT - GROUND_HEIGHT - PLAYER_RADIUS;
        player.current.vy = 0;
        player.current.onGround = true;
      } else {
        player.current.onGround = false;
      }

      // Prevent going left of screen
      if (player.current.x < 0) player.current.x = 0;

      // Camera follows player
      cameraX.current = Math.max(0, player.current.x - 200);
      if (cameraX.current > LEVEL_LENGTH - GAME_WIDTH) cameraX.current = LEVEL_LENGTH - GAME_WIDTH;

      // Check for holes
      // If the player falls below the visible screen, trigger loss
      if (player.current.y - PLAYER_RADIUS > GAME_HEIGHT) {
        setGameState('dead');
        return;
      }

      // Check for enemies
      for (const enemy of level.enemies) {
        if (!enemy.alive) continue;
        // Collision
        if (
          rectsOverlap(
            player.current.x - PLAYER_RADIUS,
            player.current.y - PLAYER_RADIUS,
            PLAYER_RADIUS * 2,
            PLAYER_RADIUS * 2,
            enemy.x,
            enemy.y,
            ENEMY_WIDTH,
            ENEMY_HEIGHT
          )
        ) {
          // Check if player is falling onto enemy
          if (player.current.vy > 0 && player.current.y < enemy.y) {
            enemy.alive = false;
            player.current.vy = JUMP_VELOCITY * 0.7;
          } else {
            setGameState('dead');
            return;
          }
        }
      }

      // Win condition
      if (player.current.x > LEVEL_LENGTH - 60) {
        setGameState('win');
        return;
      }

      // Redraw
      draw();
      animationId = requestAnimationFrame(loop);
    }
    function draw() {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Sky
      ctx.fillStyle = '#b3e0ff';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Ground
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);

      // Holes
      for (const hole of level.holes) {
        const hx = hole.x - cameraX.current;
        if (hx + hole.width < 0 || hx > GAME_WIDTH) continue;
        ctx.clearRect(hx, GAME_HEIGHT - GROUND_HEIGHT, hole.width, GROUND_HEIGHT);
      }

      // Enemies
      for (const enemy of level.enemies) {
        if (!enemy.alive) continue;
        const ex = enemy.x - cameraX.current;
        if (ex + ENEMY_WIDTH < 0 || ex > GAME_WIDTH) continue;
        ctx.fillStyle = ENEMY_COLOR;
        ctx.beginPath();
        ctx.moveTo(ex, enemy.y + ENEMY_HEIGHT);
        ctx.lineTo(ex + ENEMY_WIDTH / 2, enemy.y);
        ctx.lineTo(ex + ENEMY_WIDTH, enemy.y + ENEMY_HEIGHT);
        ctx.closePath();
        ctx.fill();
        // Draw face
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex + ENEMY_WIDTH / 2, enemy.y + ENEMY_HEIGHT - 10, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(ex + ENEMY_WIDTH / 2 - 2, enemy.y + ENEMY_HEIGHT - 10, 1.5, 0, Math.PI * 2);
        ctx.arc(ex + ENEMY_WIDTH / 2 + 2, enemy.y + ENEMY_HEIGHT - 10, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player (soccer ball)
      const px = player.current.x - cameraX.current;
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, player.current.y, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_COLOR;
      ctx.shadowColor = '#222';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
      // Soccer ball pattern
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, player.current.y, PLAYER_RADIUS - 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, player.current.y - PLAYER_RADIUS + 4);
      ctx.lineTo(px, player.current.y + PLAYER_RADIUS - 4);
      ctx.moveTo(px - PLAYER_RADIUS + 4, player.current.y);
      ctx.lineTo(px + PLAYER_RADIUS - 4, player.current.y);
      ctx.stroke();

      // Finish flag
      ctx.fillStyle = '#fff';
      ctx.fillRect(LEVEL_LENGTH - cameraX.current - 30, GAME_HEIGHT - GROUND_HEIGHT - 60, 8, 60);
      ctx.fillStyle = '#e53935';
      ctx.fillRect(LEVEL_LENGTH - cameraX.current - 22, GAME_HEIGHT - GROUND_HEIGHT - 60, 14, 14);
    }
    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [resetKey, level, gameState]);

  // Keyboard controls
  useEffect(() => {
    function handleKey(e: KeyboardEvent, down: boolean) {
      if (e.code === 'ArrowLeft') keys.current.left = down;
      if (e.code === 'ArrowRight') keys.current.right = down;
      if (e.code === 'Space') {
        if (down && player.current.onGround && gameState === 'playing') {
          player.current.vy = JUMP_VELOCITY;
        }
        keys.current.jump = down;
      }
      // Reset
      if (down && (e.code === 'KeyR' || e.code === 'Enter') && gameState !== 'playing') {
        resetGame();
      }
    }
    const down = (e: KeyboardEvent) => handleKey(e, true);
    const up = (e: KeyboardEvent) => handleKey(e, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line
  }, [gameState]);

  return (
    <div style={{ textAlign: 'center', marginTop: 20 }}>
      <h1>Super Mario Soccer Clone</h1>
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        style={{ border: '2px solid #333', background: '#b3e0ff', marginBottom: 16 }}
      />
      <div>
        <b>Controls:</b> Left/Right Arrow = Move, Space = Jump, R/Enter = Reset
      </div>
      {gameState === 'dead' && (
        <div style={{ color: '#e53935', fontWeight: 'bold', fontSize: 24, marginTop: 12 }}>
          Game Over! Press R or Enter to restart.
        </div>
      )}
      {gameState === 'win' && (
        <div style={{ color: '#43a047', fontWeight: 'bold', fontSize: 24, marginTop: 12 }}>
          You Win! Press R or Enter to play again.
        </div>
      )}
    </div>
  );
}

export default App;
