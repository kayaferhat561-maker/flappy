'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Phase = 'ready' | 'playing' | 'over'
type Pipe = { x: number; gapY: number; passed: boolean }

const W = 400
const H = 600
const GROUND = 90
const BIRD_X = 110
const BIRD_R = 20
const GRAVITY = 1600
const FLAP = -460
const MAX_FALL = 720
const PIPE_W = 70
const GAP = 170
const SPEED = 170
const SPACING = 230
const RESTART_DELAY = 0.6
const BEST_KEY = 'flappy-best'

const CLOUDS = [
  { x: 40, y: 90, s: 1 },
  { x: 220, y: 150, s: 0.7 },
  { x: 330, y: 70, s: 0.9 },
  { x: 480, y: 130, s: 0.8 },
]

function randomGapY() {
  const min = 70 + GAP / 2
  const max = H - GROUND - 70 - GAP / 2
  return min + Math.random() * (max - min)
}

function circleHitsRect(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number) {
  const nx = Math.max(x, Math.min(cx, x + w))
  const ny = Math.max(y, Math.min(cy, y + h))
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r
}

export function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)

  const game = useRef({
    phase: 'ready' as Phase,
    birdY: H * 0.42,
    vel: 0,
    pipes: [] as Pipe[],
    score: 0,
    best: 0,
    scroll: 0,
    time: 0,
    overAt: 0,
  })

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(BEST_KEY) ?? 0)
    if (Number.isFinite(stored)) {
      game.current.best = stored
      setBest(stored)
    }
  }, [])

  const changePhase = useCallback((next: Phase) => {
    game.current.phase = next
    setPhase(next)
  }, [])

  const flap = useCallback(() => {
    const g = game.current
    if (g.phase === 'ready') {
      g.pipes = [{ x: W + 60, gapY: randomGapY(), passed: false }]
      g.score = 0
      setScore(0)
      g.vel = FLAP
      changePhase('playing')
    } else if (g.phase === 'playing') {
      g.vel = FLAP
    } else if (g.time - g.overAt > RESTART_DELAY) {
      g.birdY = H * 0.42
      g.vel = 0
      g.pipes = []
      g.score = 0
      setScore(0)
      changePhase('ready')
    }
  }, [changePhase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault()
        if (!e.repeat) flap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flap])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const face = new Image()
    face.crossOrigin = 'anonymous'
    face.src = '/images/ahsen.png'

    const endGame = () => {
      const g = game.current
      g.overAt = g.time
      if (g.score > g.best) {
        g.best = g.score
        setBest(g.score)
        window.localStorage.setItem(BEST_KEY, String(g.score))
      }
      changePhase('over')
    }

    const update = (dt: number) => {
      const g = game.current
      g.time += dt
      if (g.phase !== 'over') g.scroll += SPEED * dt

      if (g.phase === 'ready') {
        g.birdY = H * 0.42 + Math.sin(g.time * 6) * 8
        return
      }

      g.vel = Math.min(g.vel + GRAVITY * dt, MAX_FALL)
      g.birdY += g.vel * dt

      if (g.phase === 'over') {
        g.birdY = Math.min(g.birdY, H - GROUND - BIRD_R)
        return
      }

      if (g.birdY - BIRD_R < 0) {
        g.birdY = BIRD_R
        g.vel = 0
      }

      for (const p of g.pipes) p.x -= SPEED * dt
      const last = g.pipes[g.pipes.length - 1]
      if (!last || last.x < W - SPACING) {
        g.pipes.push({ x: W + 10, gapY: randomGapY(), passed: false })
      }
      g.pipes = g.pipes.filter((p) => p.x + PIPE_W > -20)

      for (const p of g.pipes) {
        if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.passed = true
          g.score += 1
          setScore(g.score)
        }
        const top = p.gapY - GAP / 2
        const bottom = p.gapY + GAP / 2
        if (
          circleHitsRect(BIRD_X, g.birdY, BIRD_R - 2, p.x, -100, PIPE_W, top + 100) ||
          circleHitsRect(BIRD_X, g.birdY, BIRD_R - 2, p.x, bottom, PIPE_W, H - bottom)
        ) {
          endGame()
          return
        }
      }

      if (g.birdY + BIRD_R >= H - GROUND) {
        g.birdY = H - GROUND - BIRD_R
        endGame()
      }
    }

    const drawCloud = (x: number, y: number, s: number) => {
      ctx.beginPath()
      ctx.arc(x, y, 22 * s, 0, Math.PI * 2)
      ctx.arc(x + 24 * s, y - 10 * s, 26 * s, 0, Math.PI * 2)
      ctx.arc(x + 52 * s, y, 20 * s, 0, Math.PI * 2)
      ctx.rect(x, y, 52 * s, 20 * s)
      ctx.fill()
    }

    const drawPipe = (x: number, y: number, h: number, capAtBottom: boolean) => {
      if (h <= 0) return
      const body = ctx.createLinearGradient(x, 0, x + PIPE_W, 0)
      body.addColorStop(0, '#5fbf3f')
      body.addColorStop(0.35, '#9be15d')
      body.addColorStop(1, '#3d8a2a')
      ctx.fillStyle = body
      ctx.fillRect(x, y, PIPE_W, h)
      ctx.strokeStyle = '#24501a'
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, PIPE_W, h)

      const capH = 26
      const capY = capAtBottom ? y + h - capH : y
      ctx.fillStyle = body
      ctx.fillRect(x - 5, capY, PIPE_W + 10, capH)
      ctx.strokeRect(x - 5, capY, PIPE_W + 10, capH)
    }

    const drawBird = (y: number, vel: number, time: number, phase: Phase) => {
      const angle = phase === 'ready' ? 0 : Math.max(-0.45, Math.min(1.3, vel / 550))
      ctx.save()
      ctx.translate(BIRD_X, y)
      ctx.rotate(angle)
      ctx.lineWidth = 2.5
      ctx.strokeStyle = '#3a2a14'

      if (face.complete && face.naturalWidth > 0) {
        const flapPhase = phase === 'over' ? 0 : Math.sin(time * 22)
        ctx.fillStyle = '#fff6d5'
        for (const side of [-1, 1]) {
          ctx.beginPath()
          ctx.ellipse(
            side * (BIRD_R + 4),
            2 + flapPhase * 5,
            10,
            6 - Math.abs(flapPhase) * 2,
            side * (0.4 - flapPhase * 0.3),
            0,
            Math.PI * 2,
          )
          ctx.fill()
          ctx.stroke()
        }

        ctx.save()
        ctx.beginPath()
        ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2)
        ctx.clip()
        const s = Math.min(face.naturalWidth, face.naturalHeight)
        const crop = s * 0.86
        const sx = (face.naturalWidth - crop) / 2
        const sy = (face.naturalHeight - crop) / 2
        ctx.drawImage(face, sx, sy, crop, crop, -BIRD_R, -BIRD_R, BIRD_R * 2, BIRD_R * 2)
        ctx.restore()

        ctx.lineWidth = 3
        ctx.strokeStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2)
        ctx.stroke()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#3a2a14'
        ctx.beginPath()
        ctx.arc(0, 0, BIRD_R + 1.5, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
        return
      }

      ctx.fillStyle = '#f7c948'
      ctx.beginPath()
      ctx.ellipse(0, 0, BIRD_R + 3, BIRD_R, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#fbe7a1'
      ctx.beginPath()
      ctx.ellipse(-2, 6, 10, 6, 0, 0, Math.PI * 2)
      ctx.fill()

      const flapPhase = phase === 'over' ? 0 : Math.sin(time * 22)
      ctx.fillStyle = '#fff6d5'
      ctx.beginPath()
      ctx.ellipse(-8, 1 + flapPhase * 4, 9, 6 - Math.abs(flapPhase) * 2, -0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(7, -6, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#1a1a1a'
      ctx.beginPath()
      ctx.arc(9, -6, 2.6, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#f26b38'
      ctx.beginPath()
      ctx.moveTo(12, 0)
      ctx.lineTo(25, 3)
      ctx.lineTo(12, 8)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }

    const draw = () => {
      const g = game.current
      const sky = ctx.createLinearGradient(0, 0, 0, H - GROUND)
      sky.addColorStop(0, '#4ec0ca')
      sky.addColorStop(1, '#b8ecef')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      const cloudSpan = W + 160
      for (const c of CLOUDS) {
        const x = ((((c.x - g.scroll * 0.15) % cloudSpan) + cloudSpan) % cloudSpan) - 100
        drawCloud(x, c.y, c.s)
      }

      ctx.fillStyle = '#8fd694'
      const hillSpan = 160
      const hillOffset = (g.scroll * 0.4) % hillSpan
      for (let x = -hillOffset - hillSpan; x < W + hillSpan; x += hillSpan) {
        ctx.beginPath()
        ctx.ellipse(x + hillSpan / 2, H - GROUND + 10, hillSpan * 0.6, 60, 0, Math.PI, 0)
        ctx.fill()
      }

      for (const p of g.pipes) {
        const top = p.gapY - GAP / 2
        const bottom = p.gapY + GAP / 2
        drawPipe(p.x, -4, top + 4, true)
        drawPipe(p.x, bottom, H - GROUND - bottom, false)
      }

      ctx.fillStyle = '#ded895'
      ctx.fillRect(0, H - GROUND, W, GROUND)
      ctx.fillStyle = '#73bf2e'
      ctx.fillRect(0, H - GROUND, W, 16)
      ctx.fillStyle = '#5aa320'
      const stripe = 24
      const stripeOffset = g.scroll % stripe
      for (let x = -stripeOffset - stripe; x < W + stripe; x += stripe) {
        ctx.beginPath()
        ctx.moveTo(x, H - GROUND)
        ctx.lineTo(x + 12, H - GROUND)
        ctx.lineTo(x + 4, H - GROUND + 16)
        ctx.lineTo(x - 8, H - GROUND + 16)
        ctx.closePath()
        ctx.fill()
      }
      ctx.fillStyle = '#3a2a14'
      ctx.fillRect(0, H - GROUND, W, 3)
      ctx.fillStyle = '#c9c27a'
      ctx.fillRect(0, H - GROUND + 16, W, 3)

      drawBird(g.birdY, g.vel, g.time, g.phase)
    }

    let raf = 0
    let lastTime = performance.now()
    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 1 / 30)
      lastTime = now
      update(dt)
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [changePhase])

  const isNewBest = phase === 'over' && score > 0 && score >= best

  return (
    <div
      className="relative overflow-hidden rounded-xl border-4 border-[#3a2a14] shadow-2xl select-none touch-none"
      style={{ width: 'min(calc(100vw - 2rem), calc((100dvh - 2rem) * 2 / 3))', aspectRatio: '2 / 3' }}
      onPointerDown={(e) => {
        e.preventDefault()
        flap()
      }}
    >
      <canvas
        ref={canvasRef}
        className="block size-full"
        role="img"
        aria-label="Flappy Bird game. Press space or tap to flap."
      />

      {phase === 'playing' && (
        <p
          className="pointer-events-none absolute inset-x-0 top-[6%] text-center font-mono text-5xl font-black text-white"
          style={{ WebkitTextStroke: '2px #3a2a14', textShadow: '0 4px 0 #3a2a14' }}
        >
          {score}
        </p>
      )}

      {phase === 'ready' && (
        <div className="pointer-events-none absolute inset-x-0 top-[16%] flex flex-col items-center gap-3 px-6 text-center">
          <h1
            className="text-balance font-mono text-4xl font-black tracking-tight text-[#f7c948] sm:text-5xl"
            style={{ WebkitTextStroke: '2px #3a2a14', textShadow: '0 4px 0 #3a2a14' }}
          >
            Flappy Bird
          </h1>
          <p className="rounded-full bg-[#3a2a14]/80 px-4 py-1.5 font-mono text-sm font-bold text-white">
            Tap or press Space to flap
          </p>
          {best > 0 && <p className="font-mono text-sm font-bold text-[#3a2a14]">{`Best: ${best}`}</p>}
        </div>
      )}

      {phase === 'over' && (
        <div
          className="absolute inset-x-0 top-[22%] flex flex-col items-center gap-4 px-6"
          role="status"
          aria-live="polite"
        >
          <h2
            className="font-mono text-4xl font-black text-[#f26b38]"
            style={{ WebkitTextStroke: '2px #3a2a14', textShadow: '0 4px 0 #3a2a14' }}
          >
            Game Over
          </h2>
          <div className="flex w-full max-w-60 items-center justify-around rounded-lg border-4 border-[#3a2a14] bg-[#ded895] px-4 py-3 font-mono font-black text-[#3a2a14]">
            <div className="flex flex-col items-center">
              <span className="text-xs uppercase text-[#f26b38]">Score</span>
              <span className="text-3xl">{score}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs uppercase text-[#f26b38]">Best</span>
              <span className="text-3xl">{best}</span>
            </div>
          </div>
          {isNewBest && (
            <p className="rounded-full bg-[#f26b38] px-3 py-1 font-mono text-xs font-black uppercase text-white">
              New best!
            </p>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={flap}
            className="rounded-lg border-4 border-[#3a2a14] bg-[#73bf2e] px-6 py-2 font-mono text-lg font-black text-white shadow-[0_4px_0_#3a2a14] transition-transform active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
          >
            Play again
          </button>
        </div>
      )}
    </div>
  )
}
