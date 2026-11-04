"use client"

import React, { useEffect, useRef } from "react"

export default function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Kuş Görseli (public/resim.png dosyasından okur)
    const birdImg = new Image()
    birdImg.src = "/resim.png"

    // Arka plan yıldızları
    const stars: Array<{ x: number; y: number; size: number; alpha: number }> = []
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * (canvas.height - 60),
        size: Math.random() * 2,
        alpha: Math.random(),
      })
    }

    // Oyun Değişkenleri
    let frames = 0
    let score = 0
    let gameState: "START" | "PLAY" | "GAMEOVER" = "START"
    let animationFrameId: number

    // Kuş Objesi
    const bird = {
      x: 50,
      y: 150,
      w: 46,
      h: 46,
      gravity: 0.25,
      jump: 4.6,
      velocity: 0,

      draw() {
        ctx.save()
        ctx.translate(this.x + this.w / 2, this.y + this.h / 2)

        const angle = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.velocity / 10))
        ctx.rotate(angle)

        // Fotoğrafın arkasında neon parlama efekti
        ctx.save()
        ctx.shadowColor = "#e056fd"
        ctx.shadowBlur = 12
        ctx.fillStyle = "rgba(224, 86, 253, 0.5)"
        ctx.beginPath()
        ctx.arc(0, 0, this.w / 2 + 1, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // Görseli yuvarlak yapma (Maskeleme)
        ctx.beginPath()
        ctx.arc(0, 0, this.w / 2, 0, Math.PI * 2)
        ctx.clip()

        if (birdImg.complete && birdImg.naturalWidth !== 0) {
          ctx.drawImage(birdImg, -this.w / 2, -this.h / 2, this.w, this.h)
        } else {
          ctx.fillStyle = "#e056fd"
          ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h)
        }
        ctx.restore()

        // Neon Kenar Çerçevesi
        ctx.save()
        ctx.translate(this.x + this.w / 2, this.y + this.h / 2)
        ctx.strokeStyle = "#f3a683"
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(0, 0, this.w / 2, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      },

      update() {
        if (gameState === "PLAY") {
          this.velocity += this.gravity
          this.y += this.velocity

          if (this.y + this.h >= canvas.height - 50) {
            this.y = canvas.height - 50 - this.h
            gameOver()
          }

          if (this.y <= 0) {
            this.y = 0
            this.velocity = 0
          }
        } else if (gameState === "START") {
          // Başlangıçta aniden düşmeyi engelleme süzülmesi
          this.y = 150 + Math.sin(frames * 0.08) * 8
          this.velocity = 0
        }
      },

      flap() {
        this.velocity = -this.jump
      },

      reset() {
        this.y = 150
        this.velocity = 0
      },
    }

    // Borular (Neon Mor / Koyu Temalı)
    const pipes = {
      position: [] as Array<{ x: number; y: number; passed?: boolean }>,
      w: 64,
      gap: 140,
      dx: 2,

      draw() {
        for (let i = 0; i < this.position.length; i++) {
          const p = this.position[i]
          const topY = p.y
          const bottomY = p.y + this.gap

          const pipeGradient = ctx.createLinearGradient(p.x, 0, p.x + this.w, 0)
          pipeGradient.addColorStop(0, "#2d0a4e")
          pipeGradient.addColorStop(0.5, "#481380")
          pipeGradient.addColorStop(1, "#1a052e")

          ctx.fillStyle = pipeGradient
          ctx.strokeStyle = "#a29bfe"
          ctx.lineWidth = 2
          ctx.shadowColor = "#6c5ce7"
          ctx.shadowBlur = 8

          // Üst Boru
          ctx.fillRect(p.x, 0, this.w, topY)
          ctx.strokeRect(p.x, 0, this.w, topY)
          ctx.fillRect(p.x - 3, topY - 20, this.w + 6, 20)
          ctx.strokeRect(p.x - 3, topY - 20, this.w + 6, 20)

          // Alt Boru
          ctx.fillRect(p.x, bottomY, this.w, canvas.height - bottomY - 50)
          ctx.strokeRect(p.x, bottomY, this.w, canvas.height - bottomY - 50)
          ctx.fillRect(p.x - 3, bottomY, this.w + 6, 20)
          ctx.strokeRect(p.x - 3, bottomY, this.w + 6, 20)

          ctx.shadowBlur = 0
        }
      },

      update() {
        if (gameState !== "PLAY") return

        if (frames % 120 === 0) {
          this.position.push({
            x: canvas.width,
            y: Math.floor(Math.random() * (canvas.height - 250 - this.gap)) + 50,
          })
        }

        for (let i = 0; i < this.position.length; i++) {
          const p = this.position[i]
          p.x -= this.dx

          const birdRight = bird.x + bird.w
          const birdBottom = bird.y + bird.h
          const pipeRight = p.x + this.w
          const pipeBottomGap = p.y + this.gap

          if (birdRight > p.x && bird.x < pipeRight) {
            if (bird.y < p.y || birdBottom > pipeBottomGap) {
              gameOver()
            }
          }

          if (p.x + this.w < bird.x && !p.passed) {
            score++
            p.passed = true
          }

          if (p.x + this.w < 0) {
            this.position.shift()
            i--
          }
        }
      },

      reset() {
        this.position = []
      },
    }

    // Zemin
    const ground = {
      draw() {
        ctx.fillStyle = "#0c0517"
        ctx.fillRect(0, canvas.height - 50, canvas.width, 50)

        ctx.fillStyle = "#8e44ad"
        ctx.shadowColor = "#9b59b6"
        ctx.shadowBlur = 10
        ctx.fillRect(0, canvas.height - 50, canvas.width, 4)
        ctx.shadowBlur = 0

        ctx.strokeStyle = "rgba(142, 68, 173, 0.2)"
        ctx.lineWidth = 1
        for (let x = 0; x < canvas.width; x += 20) {
          ctx.beginPath()
          ctx.moveTo(x, canvas.height - 46)
          ctx.lineTo(x, canvas.height)
          ctx.stroke()
        }
      },
    }

    // Arka Plan Çizimi
    function drawBackground() {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height)
      bgGrad.addColorStop(0, "#0a0314")
      bgGrad.addColorStop(0.6, "#180a29")
      bgGrad.addColorStop(1, "#240d38")
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = "#ffffff"
      stars.forEach((s) => {
        ctx.globalAlpha = Math.sin(frames * 0.05 + s.alpha * 10) * 0.5 + 0.5
        ctx.fillRect(s.x, s.y, s.size, s.size)
      })
      ctx.globalAlpha = 1.0
    }

    // Arayüz
    function drawUI() {
      ctx.textAlign = "center"
      ctx.fillStyle = "#FFFFFF"

      if (gameState === "START") {
        ctx.shadowColor = "#a29bfe"
        ctx.shadowBlur = 12
        ctx.font = "bold 22px 'Segoe UI', Arial"
        ctx.fillText("HAZIR MISIN?", canvas.width / 2, canvas.height / 2 - 40)

        ctx.font = "15px 'Segoe UI', Arial"
        ctx.fillStyle = "#dcdde1"
        ctx.fillText("Başlamak İçin Tıkla veya Boşluk'a Bas", canvas.width / 2, canvas.height / 2 + 10)
        ctx.shadowBlur = 0
      } else if (gameState === "GAMEOVER") {
        ctx.shadowColor = "#e84118"
        ctx.shadowBlur = 15
        ctx.font = "bold 32px 'Segoe UI', Arial"
        ctx.fillStyle = "#ff7675"
        ctx.fillText("OYUN BİTTİ", canvas.width / 2, canvas.height / 2 - 40)

        ctx.shadowColor = "#8e44ad"
        ctx.shadowBlur = 10;
        ctx.font = "bold 24px 'Segoe UI', Arial"
        ctx.fillStyle = "#FFF"
        ctx.fillText("Skor: " + score, canvas.width / 2, canvas.height / 2 + 10)

        ctx.shadowBlur = 0
        ctx.font = "15px 'Segoe UI', Arial"
        ctx.fillStyle = "#a6b0c3"
        ctx.fillText("Yeniden Başlamak İçin Tıkla", canvas.width / 2, canvas.height / 2 + 55)
      } else if (gameState === "PLAY") {
        ctx.shadowColor = "#9b59b6"
        ctx.shadowBlur = 12
        ctx.font = "bold 42px 'Segoe UI', Arial"
        ctx.fillText(score.toString(), canvas.width / 2, 70)
        ctx.shadowBlur = 0
      }
    }

    function gameOver() {
      gameState = "GAMEOVER"
    }

    function resetGame() {
      bird.reset()
      pipes.reset()
      score = 0
      frames = 0
      gameState = "PLAY"
      bird.flap()
    }

    function handleAction() {
      if (gameState === "START") {
        gameState = "PLAY"
        bird.flap()
      } else if (gameState === "PLAY") {
        bird.flap()
      } else if (gameState === "GAMEOVER") {
        resetGame()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") handleAction()
    }

    const handleCanvasClick = () => {
      handleAction()
    }

    window.addEventListener("keydown", handleKeyDown)
    canvas.addEventListener("click", handleCanvasClick)

    // Oyun Döngüsü
    function loop() {
      drawBackground()

      pipes.update()
      pipes.draw()

      ground.draw()

      bird.update()
      bird.draw()

      drawUI()

      frames++
      animationFrameId = requestAnimationFrame(loop)
    }

    loop()

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      canvas.removeEventListener("click", handleCanvasClick)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-950 via-slate-950 to-black p-4">
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 shadow-[0_0_35px_rgba(138,43,226,0.4)]">
        <canvas ref={canvasRef} width={360} height={640} className="block rounded-xl" />
      </div>
    </div>
  )
}
