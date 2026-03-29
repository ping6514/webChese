import * as PIXI from 'pixi.js'
import { GlowFilter } from '@pixi/filter-glow'
import { gsap } from 'gsap'
import { Emitter, upgradeConfig } from '@pixi/particle-emitter'
import type { EmitterConfigV3 } from '@pixi/particle-emitter'

export class EffectsManager {
  public container: PIXI.Container
  private particleContainer: PIXI.Container
  private particleEmitters: Emitter[] = []
  
  constructor(container: PIXI.Container) {
    this.container = container
    // Create dedicated container for particles to avoid transform issues
    this.particleContainer = new PIXI.Container()
    this.container.addChild(this.particleContainer)
  }
  
  createBeam(from: { x: number; y: number }, to: { x: number; y: number }) {
    const beam = new PIXI.Graphics()
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.sqrt(dx * dx + dy * dy)
    
    beam.moveTo(0, 0)
    beam.lineTo(length, 0)
    beam.stroke({ width: 4, color: 0xff9c9e, alpha: 1 })
    
    beam.x = from.x
    beam.y = from.y
    beam.rotation = Math.atan2(dy, dx)
    
    const glowFilter = new GlowFilter({
      distance: 10,
      outerStrength: 2,
      color: 0xff4d4f
    })
    beam.filters = [glowFilter]
    
    this.container.addChild(beam)
    
    beam.scale.x = 0
    gsap.to(beam.scale, {
      x: 1,
      duration: 0.2,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(beam, {
          alpha: 0,
          duration: 0.3,
          delay: 0.1,
          onComplete: () => {
            if (beam.parent) {
              beam.parent.removeChild(beam)
            }
            beam.destroy({ children: true })
          }
        })
      }
    })
    
    // TEMPORARILY DISABLED: Particle effects causing updateLocalTransform errors
    // this.createBeamParticles(from, to)
  }
  
  private createBeamParticles(from: { x: number; y: number }, to: { x: number; y: number }) {
    const particleTexture = PIXI.Texture.from(this.createParticleCanvas())
    
    const config: EmitterConfigV3 = {
      lifetime: { min: 0.2, max: 0.4 },
      frequency: 0.005,
      spawnChance: 1,
      particlesPerWave: 2,
      pos: { x: from.x, y: from.y },
      behaviors: [
        {
          type: 'alpha',
          config: {
            alpha: {
              list: [
                { value: 1, time: 0 },
                { value: 0, time: 1 }
              ]
            }
          }
        },
        {
          type: 'scale',
          config: {
            scale: {
              list: [
                { value: 0.5, time: 0 },
                { value: 0.1, time: 1 }
              ]
            }
          }
        },
        {
          type: 'color',
          config: {
            color: {
              list: [
                { value: 'ff9c9e', time: 0 },
                { value: 'ff4d4f', time: 1 }
              ]
            }
          }
        },
        {
          type: 'moveSpeed',
          config: {
            speed: {
              list: [
                { value: 300, time: 0 },
                { value: 50, time: 1 }
              ]
            }
          }
        },
        {
          type: 'rotationStatic',
          config: {
            min: 0,
            max: 360
          }
        }
      ]
    }
    
    const emitter = new Emitter(this.particleContainer, upgradeConfig(config, [particleTexture]))
    this.particleEmitters.push(emitter)
    
    emitter.emit = true
    setTimeout(() => {
      emitter.emit = false
      setTimeout(() => {
        try {
          emitter.destroy()
        } catch (e) {
          console.warn('Error destroying beam emitter:', e)
        }
        this.particleEmitters = this.particleEmitters.filter(e => e !== emitter)
      }, 500)
    }, 200)
  }
  
  createDamageText(x: number, y: number, damage: number, isCritical: boolean = false) {
    const text = new PIXI.Text({
      text: `-${damage}`,
      style: {
        fontSize: isCritical ? 48 : 32,
        fontWeight: 'bold',
        fill: isCritical ? 0xff4d4f : 0xff9c9e,
        stroke: { color: 0x000000, width: 4 }
      }
    })
    
    text.anchor.set(0.5)
    text.x = x
    text.y = y
    
    if (isCritical) {
      const glowFilter = new GlowFilter({
        distance: 15,
        outerStrength: 3,
        color: 0xff0000
      })
      text.filters = [glowFilter]
      
      gsap.to(text, {
        rotation: 0.1,
        duration: 0.05,
        repeat: 5,
        yoyo: true
      })
    }
    
    this.container.addChild(text)
    
    gsap.timeline()
      .to(text, {
        y: y - 80,
        duration: 1,
        ease: 'power2.out'
      })
      .to(text, {
        alpha: 0,
        duration: 0.5
      }, 0.5)
      .call(() => {
        if (text.parent) {
          text.parent.removeChild(text)
        }
        text.destroy({ children: true })
      })
  }
  
  createHealText(x: number, y: number, amount: number) {
    const text = new PIXI.Text({
      text: `+${amount}`,
      style: {
        fontSize: 28,
        fontWeight: 'bold',
        fill: 0x52c41a,
        stroke: { color: 0x000000, width: 3 }
      }
    })
    
    text.anchor.set(0.5)
    text.x = x
    text.y = y
    
    this.container.addChild(text)
    
    // DISABLED: Particle effects
    // this.createHealParticles(x, y)
    
    gsap.timeline()
      .to(text, {
        y: y - 60,
        duration: 1.2,
        ease: 'power2.out'
      })
      .to(text, {
        alpha: 0,
        duration: 0.4
      }, 0.8)
      .call(() => {
        if (text.parent) {
          text.parent.removeChild(text)
        }
        text.destroy({ children: true })
      })
  }
  
  createEnchantEffect(x: number, y: number) {
    console.log('💫 EffectsManager.createEnchantEffect called at:', x, y)
    
    // Create container for all effects
    const effectContainer = new PIXI.Container()
    effectContainer.x = x
    effectContainer.y = y
    effectContainer.visible = true
    this.container.addChild(effectContainer)
    
    console.log('Container added, children count:', this.container.children.length)
    
    // Main light beam - MUCH wider and more intense, START VISIBLE
    const mainBeam = new PIXI.Graphics()
    mainBeam.roundRect(-60, -150, 120, 180, 20)
    mainBeam.fill({ color: 0xc8e6ff, alpha: 0.8 })
    mainBeam.scale.set(1, 1)
    mainBeam.y = -100
    mainBeam.visible = true
    
    const mainGlow = new GlowFilter({
      distance: 40,
      outerStrength: 5,
      color: 0x91caff
    })
    mainBeam.filters = [mainGlow]
    effectContainer.addChild(mainBeam)
    
    // Side beams - BIGGER and more dramatic, START VISIBLE
    const leftBeam = new PIXI.Graphics()
    leftBeam.roundRect(-70, -130, 40, 150, 15)
    leftBeam.fill({ color: 0x91caff, alpha: 0.6 })
    leftBeam.y = -90
    leftBeam.visible = true
    leftBeam.filters = [new GlowFilter({ distance: 25, outerStrength: 3, color: 0x91caff })]
    effectContainer.addChild(leftBeam)
    
    const rightBeam = new PIXI.Graphics()
    rightBeam.roundRect(30, -130, 40, 150, 15)
    rightBeam.fill({ color: 0x91caff, alpha: 0.6 })
    rightBeam.y = -90
    rightBeam.visible = true
    rightBeam.filters = [new GlowFilter({ distance: 25, outerStrength: 3, color: 0x91caff })]
    effectContainer.addChild(rightBeam)
    
    console.log('Beams created and added, starting animation...')
    
    // Energy burst circle - MUCH BIGGER
    const burst = new PIXI.Graphics()
    burst.circle(0, 0, 50)
    burst.fill({ color: 0xffffff, alpha: 0 })
    burst.scale.set(1, 1)
    burst.filters = [new GlowFilter({ distance: 50, outerStrength: 6, color: 0x91caff })]
    effectContainer.addChild(burst)
    
    // Sparkle particles - MORE and BIGGER
    const sparkles: PIXI.Graphics[] = []
    for (let i = 0; i < 20; i++) {
      const sparkle = new PIXI.Graphics()
      sparkle.circle(0, 0, 5)
      sparkle.fill({ color: 0xffffff, alpha: 0 })
      sparkle.scale.set(1, 1)
      sparkle.filters = [new GlowFilter({ distance: 12, outerStrength: 3, color: 0x91caff })]
      effectContainer.addChild(sparkle)
      sparkles.push(sparkle)
    }
    
    // POWERFUL animation sequence - visible and impactful
    const timeline = gsap.timeline({
      onStart: () => console.log('🎬 Animation started'),
      onComplete: () => console.log('🎬 Animation completed')
    })
    
    // Phase 1: Descent (0-0.3s)
    timeline
      .to(mainBeam, {
        y: -20,
        duration: 0.3,
        ease: 'power3.out'
      }, 0)
      .to(leftBeam, {
        y: -10,
        duration: 0.3,
        ease: 'power2.out'
      }, 0.05)
      .to(rightBeam, {
        y: -10,
        duration: 0.3,
        ease: 'power2.out'
      }, 0.05)
      
      // Phase 2: IMPACT (0.3-0.5s)
      .to(mainBeam.scale, {
        y: 1.3,
        duration: 0.2,
        ease: 'back.out(2)'
      })
      .to(mainBeam, {
        alpha: 1,
        y: 10,
        duration: 0.2,
        ease: 'power3.in'
      }, '<')
      .to([leftBeam, rightBeam], {
        alpha: 1,
        y: 5,
        duration: 0.2,
        ease: 'power3.in'
      }, '<')
      .to(burst.scale, {
        x: 2,
        y: 2,
        duration: 0.15,
        ease: 'back.out(3)'
      }, '<')
      .to(burst, {
        alpha: 1,
        duration: 0.15,
        ease: 'power2.out'
      }, '<')
      
      // Phase 3: Expansion (0.5-1.0s)
      .to(burst.scale, {
        x: 5,
        y: 5,
        duration: 0.5,
        ease: 'power2.out'
      })
      .to(burst, {
        alpha: 0,
        duration: 0.5,
        ease: 'power1.in'
      }, '<')
      .to(mainBeam.scale, {
        y: 0.7,
        duration: 0.4,
        ease: 'power2.in'
      }, '<')
      .to(mainBeam, {
        alpha: 0,
        y: 30,
        duration: 0.4,
        ease: 'power2.in'
      }, '<')
      .to([leftBeam, rightBeam], {
        alpha: 0,
        y: 25,
        duration: 0.4,
        ease: 'power2.in'
      }, '<')
    
    // Animate sparkles - EXPLOSIVE spread
    sparkles.forEach((sparkle, i) => {
      const angle = (i / sparkles.length) * Math.PI * 2
      const distance = 60 + Math.random() * 40
      const targetX = Math.cos(angle) * distance
      const targetY = Math.sin(angle) * distance
      
      timeline
        .to(sparkle, {
          alpha: 1,
          x: targetX * 0.3,
          y: targetY * 0.3,
          duration: 0.15,
          ease: 'power2.out'
        }, 0.5)
        .to(sparkle, {
          alpha: 0,
          x: targetX,
          y: targetY,
          duration: 0.5,
          ease: 'power1.in'
        }, 0.6)
    })
    
    // Cleanup
    timeline.call(() => {
      console.log('🧹 Cleaning up enchant effect')
      if (effectContainer.parent) {
        effectContainer.parent.removeChild(effectContainer)
      }
      effectContainer.destroy({ children: true })
    })
    
    // POWERFUL screen shake on impact
    const originalY = this.container.y
    gsap.timeline()
      .to(this.container, {
        y: originalY + 4,
        duration: 0.05,
        ease: 'power3.out'
      }, 0.5)
      .to(this.container, {
        y: originalY - 3,
        duration: 0.05,
        ease: 'power2.inOut'
      })
      .to(this.container, {
        y: originalY + 2,
        duration: 0.05,
        ease: 'power2.inOut'
      })
      .to(this.container, {
        y: originalY,
        duration: 0.05,
        ease: 'power1.in'
      })
  }
  
  createReviveEffect(x: number, y: number) {
    // Create revive wave effect - expanding circle
    const wave = new PIXI.Graphics()
    wave.circle(0, 0, 7)
    wave.stroke({ width: 2, color: 0x91caff, alpha: 0.98 })
    
    wave.x = x
    wave.y = y
    
    const glowFilter = new GlowFilter({
      distance: 18,
      outerStrength: 1.5,
      color: 0x91caff
    })
    wave.filters = [glowFilter]
    
    this.container.addChild(wave)
    
    // Animate: expand and fade
    gsap.timeline()
      .to(wave.scale, {
        x: 6,
        y: 6,
        duration: 0.76,
        ease: 'power2.out'
      })
      .to(wave, {
        alpha: 0,
        duration: 0.76,
        ease: 'power1.in'
      }, 0)
      .call(() => {
        if (wave.parent) {
          wave.parent.removeChild(wave)
        }
        wave.destroy()
      })
  }
  
  createBoneRefineEffect(x: number, y: number) {
    // Corpse dissolve effect - dark particles rising
    const particles = new PIXI.Graphics()
    
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8
      const offsetX = Math.cos(angle) * 15
      const offsetY = Math.sin(angle) * 15
      
      particles.circle(offsetX, offsetY, 3)
      particles.fill({ color: 0x8c8c8c, alpha: 0.8 })
    }
    
    particles.x = x
    particles.y = y
    
    this.container.addChild(particles)
    
    // Animate: rise and fade
    gsap.timeline()
      .to(particles, {
        y: y - 40,
        alpha: 0,
        duration: 0.8,
        ease: 'power1.out'
      })
      .call(() => {
        if (particles.parent) {
          particles.parent.removeChild(particles)
        }
        particles.destroy()
      })
  }
  
  createSealEffect(x: number, y: number) {
    // Seal effect - purple chains
    const chains = new PIXI.Graphics()
    
    // Draw cross pattern
    chains.moveTo(-20, 0)
    chains.lineTo(20, 0)
    chains.stroke({ width: 3, color: 0x722ed1, alpha: 0.9 })
    
    chains.moveTo(0, -20)
    chains.lineTo(0, 20)
    chains.stroke({ width: 3, color: 0x722ed1, alpha: 0.9 })
    
    chains.x = x
    chains.y = y
    chains.alpha = 0
    
    const glowFilter = new GlowFilter({
      distance: 12,
      outerStrength: 2,
      color: 0x722ed1
    })
    chains.filters = [glowFilter]
    
    this.container.addChild(chains)
    
    // Animate: appear and contract
    gsap.timeline()
      .to(chains, {
        alpha: 1,
        duration: 0.2,
        ease: 'power2.out'
      })
      .to(chains.scale, {
        x: 0.5,
        y: 0.5,
        duration: 0.4,
        ease: 'back.in'
      })
      .to(chains, {
        alpha: 0,
        duration: 0.2
      }, '-=0.2')
      .call(() => {
        if (chains.parent) {
          chains.parent.removeChild(chains)
        }
        chains.destroy()
      })
  }
  
  createItemUseEffect(itemId: string, x: number, y: number) {
    // Generic item use effect based on item type
    if (itemId.includes('bone_refine')) {
      this.createBoneRefineEffect(x, y)
    } else if (itemId.includes('nether_seal')) {
      this.createSealEffect(x, y)
    } else if (itemId.includes('dead_return')) {
      // Remove enchant effect - purple spiral
      this.createDisenchantEffect(x, y)
    } else {
      // Default: simple flash
      this.createGenericItemEffect(x, y)
    }
  }
  
  createDisenchantEffect(x: number, y: number) {
    // Disenchant effect - purple spiral dissolving
    const spiral = new PIXI.Graphics()
    
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12
      const radius = 8 + i * 2
      const px = Math.cos(angle) * radius
      const py = Math.sin(angle) * radius
      
      spiral.circle(px, py, 2)
      spiral.fill({ color: 0xb37feb, alpha: 0.8 })
    }
    
    spiral.x = x
    spiral.y = y
    
    this.container.addChild(spiral)
    
    // Animate: spin and fade
    gsap.timeline()
      .to(spiral, {
        rotation: Math.PI * 2,
        alpha: 0,
        duration: 0.7,
        ease: 'power1.out'
      })
      .call(() => {
        if (spiral.parent) {
          spiral.parent.removeChild(spiral)
        }
        spiral.destroy()
      })
  }
  
  createGenericItemEffect(x: number, y: number) {
    // Generic flash effect
    const flash = new PIXI.Graphics()
    flash.circle(0, 0, 25)
    flash.fill({ color: 0xffffff, alpha: 0.6 })
    
    flash.x = x
    flash.y = y
    
    this.container.addChild(flash)
    
    // Animate: quick flash
    gsap.timeline()
      .to(flash, {
        alpha: 0,
        duration: 0.3,
        ease: 'power2.out'
      })
      .to(flash.scale, {
        x: 1.5,
        y: 1.5,
        duration: 0.3,
        ease: 'power2.out'
      }, 0)
      .call(() => {
        if (flash.parent) {
          flash.parent.removeChild(flash)
        }
        flash.destroy()
      })
  }
  
  createDeathEffect(x: number, y: number, color: number) {
    // Central explosion flash - white with cyan tint
    const flash = new PIXI.Graphics()
    flash.circle(0, 0, 30)
    flash.fill({ color: 0xe0f7ff, alpha: 0.9 })
    flash.x = x
    flash.y = y
    this.container.addChild(flash)
    
    // Multiple explosion rings for more impact - cyan-white color
    const rings: PIXI.Graphics[] = []
    for (let i = 0; i < 3; i++) {
      const ring = new PIXI.Graphics()
      ring.circle(0, 0, 10 + i * 5)
      ring.stroke({ width: 4 - i, color: 0xe0f7ff, alpha: 0.9 })
      ring.x = x
      ring.y = y
      this.container.addChild(ring)
      rings.push(ring)
      
      // Staggered ring expansion
      gsap.timeline()
        .to(ring.scale, {
          x: 4 + i * 0.5,
          y: 4 + i * 0.5,
          duration: 0.6,
          delay: i * 0.05,
          ease: 'power2.out'
        })
        .to(ring, {
          alpha: 0,
          duration: 0.6,
          delay: i * 0.05,
          ease: 'power1.in'
        }, 0)
        .call(() => {
          if (ring.parent) {
            ring.parent.removeChild(ring)
          }
          ring.destroy()
        })
    }
    
    // Explosion sparks - white with cyan tint
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12
      const spark = new PIXI.Graphics()
      spark.circle(0, 0, 4)
      spark.fill({ color: 0xe0f7ff, alpha: 0.8 })
      spark.x = x
      spark.y = y
      this.container.addChild(spark)
      
      gsap.timeline()
        .to(spark, {
          x: x + Math.cos(angle) * 60,
          y: y + Math.sin(angle) * 60,
          alpha: 0,
          duration: 0.5,
          ease: 'power2.out'
        })
        .call(() => {
          if (spark.parent) {
            spark.parent.removeChild(spark)
          }
          spark.destroy()
        })
    }
    
    // Flash animation
    gsap.timeline()
      .to(flash, {
        alpha: 0,
        duration: 0.2,
        ease: 'power2.out'
      })
      .to(flash.scale, {
        x: 3,
        y: 3,
        duration: 0.2,
        ease: 'power2.out'
      }, 0)
      .call(() => {
        if (flash.parent) {
          flash.parent.removeChild(flash)
        }
        flash.destroy()
      })
  }
  
  /* DISABLED: Particle methods
  private createHealParticles(x: number, y: number) {
    const particleTexture = PIXI.Texture.from(this.createParticleCanvas())
    
    const config: EmitterConfigV3 = {
      lifetime: { min: 0.5, max: 1 },
      frequency: 0.01,
      spawnChance: 1,
      particlesPerWave: 5,
      pos: { x, y },
      behaviors: [
        {
          type: 'alpha',
          config: {
            alpha: {
              list: [
                { value: 1, time: 0 },
                { value: 0, time: 1 }
              ]
            }
          }
        },
        {
          type: 'scale',
          config: {
            scale: {
              list: [
                { value: 0.3, time: 0 },
                { value: 0.1, time: 1 }
              ]
            }
          }
        },
        {
          type: 'color',
          config: {
            color: {
              list: [
                { value: '95de64', time: 0 },
                { value: '52c41a', time: 1 }
              ]
            }
          }
        },
        {
          type: 'moveSpeed',
          config: {
            speed: {
              list: [
                { value: 100, time: 0 },
                { value: 20, time: 1 }
              ]
            }
          }
        }
      ]
    }
    
    const emitter = new Emitter(this.particleContainer, upgradeConfig(config, [particleTexture]))
    this.particleEmitters.push(emitter)
    
    emitter.emit = true
    setTimeout(() => {
      emitter.emit = false
      setTimeout(() => {
        try {
          emitter.destroy()
        } catch (e) {
          console.warn('Error destroying heal emitter:', e)
        }
        this.particleEmitters = this.particleEmitters.filter(e => e !== emitter)
      }, 1000)
    }, 300)
  }
  */
  
  /* DISABLED: Death explosion uses particles
  createDeathExplosion(x: number, y: number) {
    const particleTexture = PIXI.Texture.from(this.createParticleCanvas())
    
    const config: EmitterConfigV3 = {
      lifetime: { min: 0.5, max: 1.5 },
      frequency: 0.001,
      spawnChance: 1,
      particlesPerWave: 20,
      pos: { x, y },
      behaviors: [
        {
          type: 'alpha',
          config: {
            alpha: {
              list: [
                { value: 1, time: 0 },
                { value: 0, time: 1 }
              ]
            }
          }
        },
        {
          type: 'scale',
          config: {
            scale: {
              list: [
                { value: 1, time: 0 },
                { value: 0.2, time: 1 }
              ]
            }
          }
        },
        {
          type: 'color',
          config: {
            color: {
              list: [
                { value: 'ffffff', time: 0 },
                { value: '666666', time: 0.5 },
                { value: '000000', time: 1 }
              ]
            }
          }
        },
        {
          type: 'moveSpeed',
          config: {
            speed: {
              list: [
                { value: 400, time: 0 },
                { value: 0, time: 1 }
              ]
            }
          }
        },
        {
          type: 'rotationStatic',
          config: {
            min: 0,
            max: 360
          }
        }
      ]
    }
    
    const emitter = new Emitter(this.particleContainer, upgradeConfig(config, [particleTexture]))
    this.particleEmitters.push(emitter)
    
    emitter.emit = true
    setTimeout(() => {
      emitter.emit = false
      setTimeout(() => {
        try {
          emitter.destroy()
        } catch (e) {
          console.warn('Error destroying death emitter:', e)
        }
        this.particleEmitters = this.particleEmitters.filter(e => e !== emitter)
      }, 1500)
    }, 100)
  }
  
  private createParticleCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const ctx = canvas.getContext('2d')!
    
    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 16, 16)
    
    return canvas
  }
  */
  
  update(delta: number) {
    // Particle emitters disabled - no update needed
  }
  
  destroy() {
    // Clean up particle container
    if (this.particleContainer.parent) {
      this.particleContainer.parent.removeChild(this.particleContainer)
    }
    this.particleContainer.destroy({ children: true })
  }
}
