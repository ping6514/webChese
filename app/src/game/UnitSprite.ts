import * as PIXI from 'pixi.js'
import { GlowFilter } from '@pixi/filter-glow'
import { gsap } from 'gsap'
import type { PieceBase } from '../engine'

export interface UnitSpriteData {
  id: string
  side: 'red' | 'black'
  base: PieceBase
  label: string
  hp: number
  maxHp: number
  image?: string
  enchantName?: string | null
  enchantImage?: string | null
  isSealed?: boolean
}

export class UnitSprite extends PIXI.Container {
  public unitId: string
  private background!: PIXI.Graphics
  private labelText!: PIXI.Text
  private hpBar!: PIXI.Graphics
  private hpText!: PIXI.Text
  private glowFilter!: GlowFilter
  private enchantBadge?: PIXI.Container
  private sealIcon?: PIXI.Text
  private soulNameText?: PIXI.Text
  
  constructor(data: UnitSpriteData) {
    super()
    
    this.unitId = data.id
    this.eventMode = 'static'
    this.cursor = 'pointer'
    
    this.setupBackground(data.side)
    
    // Setup enchant badge first (background layer)
    if (data.enchantImage) {
      this.setupEnchantBadge(data.enchantImage)
    }
    
    // Setup label after enchant badge so it appears on top
    // Pass enchantName to add shimmer effect when enchanted
    this.setupLabel(data.label, data.side, data.enchantName)
    this.setupHpBar(data.hp, data.maxHp)
    this.setupGlow(data.side)
    
    // Setup seal icon if unit is sealed
    if (data.isSealed) {
      this.setupSealIcon()
    }
  }
  
  private setupBackground(side: 'red' | 'black') {
    this.background = new PIXI.Graphics()
    const color = side === 'red' ? 0xff4d4f : 0x52c41a
    
    this.background.roundRect(-30, -30, 60, 60, 10)
    this.background.fill({ color, alpha: 0.15 })
    this.background.stroke({ width: 2, color, alpha: 0.8 })
    
    this.addChild(this.background)
  }
  
  private setupLabel(label: string, side: 'red' | 'black', enchantName?: string | null) {
    this.labelText = new PIXI.Text({
      text: label,
      style: {
        fontSize: 28,
        fontWeight: '900',
        fill: side === 'red' ? 0xffb0b2 : 0xb7eb8f,
        stroke: { color: 0x000000, width: 3 },
        dropShadow: {
          color: 0x000000,
          blur: 3,
          angle: Math.PI / 4,
          distance: 2,
        }
      }
    })
    this.labelText.anchor.set(0.5)
    this.labelText.y = 0  // Keep piece type vertically centered
    this.addChild(this.labelText)
    
    // Add shimmer animation when enchanted - slow fade to invisible
    if (enchantName) {
      gsap.to(this.labelText, {
        alpha: 0,
        duration: 2.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      })
      
      // Add soul name text below piece type - larger with outline
      const soulNameText = new PIXI.Text({
        text: enchantName,
        style: {
          fontSize: 14,
          fontWeight: 'bold',
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 3 },
          dropShadow: {
            color: 0xb37feb,
            blur: 4,
            distance: 1
          }
        }
      })
      soulNameText.anchor.set(0.5)
      soulNameText.y = 20  // Near bottom of unit sprite
      soulNameText.alpha = 0.95
      this.soulNameText = soulNameText
      this.addChild(soulNameText)
    } else {
      this.soulNameText = undefined
    }
  }
  
  private setupHpBar(hp: number, maxHp: number) {
    this.hpBar = new PIXI.Graphics()
    this.hpText = new PIXI.Text({
      text: `${hp}`,
      style: {
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: { color: 0x1a1a1a, width: 2 }
      }
    })
    this.hpText.anchor.set(0.5)
    this.hpText.y = -35
    
    this.updateHpBar(hp, maxHp)
    this.addChild(this.hpBar)
    this.addChild(this.hpText)
  }
  
  updateHpBar(hp: number, maxHp: number) {
    this.hpBar.clear()
    
    const barWidth = 50
    const barHeight = 6
    const x = -barWidth / 2
    const y = -40
    
    this.hpBar.roundRect(x, y, barWidth, barHeight, 4)
    this.hpBar.fill({ color: 0x000000, alpha: 0.4 })
    
    const hpPercent = Math.max(0, Math.min(1, hp / maxHp))
    const hpColor = hpPercent > 0.5 ? 0x52c41a : hpPercent > 0.25 ? 0xe8d070 : 0xff4d4f
    
    if (hpPercent > 0) {
      this.hpBar.roundRect(x, y, barWidth * hpPercent, barHeight, 4)
      this.hpBar.fill({ color: hpColor, alpha: 0.9 })
    }
    
    this.hpText.text = `${hp}`
  }
  
  private setupGlow(side: 'red' | 'black') {
    this.glowFilter = new GlowFilter({
      distance: 15,
      outerStrength: 0,
      innerStrength: 0,
      color: side === 'red' ? 0xff4d4f : 0x52c41a,
      quality: 0.5
    })
    this.filters = [this.glowFilter] as any
  }
  
  private setupSealIcon() {
    this.sealIcon = new PIXI.Text({
      text: '🔒',
      style: {
        fontSize: 20,
        fontWeight: 'bold'
      }
    })
    this.sealIcon.anchor.set(0.5)
    this.sealIcon.position.set(20, -20)  // Top right corner
    this.sealIcon.alpha = 0.9
    this.addChild(this.sealIcon)
  }
  
  private removeSealIcon() {
    if (this.sealIcon) {
      this.removeChild(this.sealIcon)
      this.sealIcon.destroy()
      this.sealIcon = undefined
    }
  }
  
  private setupEnchantBadge(enchantImage?: string | null) {
    this.enchantBadge = new PIXI.Container()
    
    // Soul card image as avatar (upper half, semi-transparent)
    if (enchantImage) {
      try {
        // Load texture and wait for it
        PIXI.Assets.load(enchantImage).then((texture) => {
          if (!this.enchantBadge) return // Badge was removed
          
          const soulSprite = new PIXI.Sprite(texture)
          soulSprite.anchor.set(0.5, 0)
          soulSprite.position.set(0, -30)
          
          // Scale to fit width
          const targetWidth = 60
          const scale = targetWidth / soulSprite.width
          soulSprite.scale.set(scale)
          
          // Add mask to soul sprite only to clip overflow
          const spriteMask = new PIXI.Graphics()
          spriteMask.rect(-30, -30, 60, 60)
          spriteMask.fill(0xffffff)
          soulSprite.mask = spriteMask
          
          // Shimmer animation
          soulSprite.alpha = 0.85
          gsap.to(soulSprite, {
            alpha: 0.7,
            duration: 2,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
          })
          
          // Add mask first, then sprite to badge container
          this.enchantBadge!.addChild(spriteMask)
          this.enchantBadge!.addChild(soulSprite)
        }).catch((err) => {
          console.warn('Failed to load soul card image:', enchantImage, err)
        })
      } catch (err) {
        console.warn('Error setting up soul card image:', err)
      }
    }
    
    // Soul name text is now added in setupLabel method
    
    this.addChild(this.enchantBadge)
  }
  
  select() {
    gsap.to(this.glowFilter, {
      outerStrength: 2,
      innerStrength: 1,
      duration: 0.3
    })
    
    gsap.to(this.scale, {
      x: 1.15,
      y: 1.15,
      duration: 0.3,
      ease: 'back.out(1.7)'
    })
  }
  
  deselect() {
    gsap.to(this.glowFilter, {
      outerStrength: 0,
      innerStrength: 0,
      duration: 0.3
    })
    
    gsap.to(this.scale, {
      x: 1,
      y: 1,
      duration: 0.3,
      ease: 'power2.out'
    })
  }
  
  moveTo(targetX: number, targetY: number, duration: number = 0.5): Promise<void> {
    return new Promise((resolve) => {
      const startY = this.y
      const midY = Math.min(startY, targetY) - 40
      
      const timeline = gsap.timeline({
        onComplete: resolve
      })
      
      timeline
        .to(this, {
          x: targetX,
          y: midY,
          duration: duration / 2,
          ease: 'power2.out'
        })
        .to(this, {
          y: targetY,
          duration: duration / 2,
          ease: 'power2.in'
        }, `-=${duration / 4}`)
        
      gsap.to(this, {
        rotation: Math.PI * 2,
        duration,
        ease: 'none'
      })
    })
  }
  
  playHitAnimation() {
    const timeline = gsap.timeline()
    
    timeline
      .to(this, { x: this.x + 8, duration: 0.05 })
      .to(this, { x: this.x - 8, duration: 0.05 })
      .to(this, { x: this.x + 5, duration: 0.05 })
      .to(this, { x: this.x, duration: 0.05 })
    
    const colorMatrix = new PIXI.ColorMatrixFilter()
    const existingFilters = Array.isArray(this.filters) ? [...(this.filters as any[])] : []
    this.filters = [...existingFilters, colorMatrix] as any
    
    gsap.timeline()
      .to(colorMatrix, {
        duration: 0.1,
        onUpdate: () => {
          colorMatrix.brightness(1.5, false)
        }
      })
      .to(colorMatrix, {
        duration: 0.2,
        onUpdate: () => {
          colorMatrix.brightness(1, false)
        },
        onComplete: () => {
          this.filters = existingFilters as any
        }
      })
  }
  
  playAttackAnimation() {
    const timeline = gsap.timeline()
    
    timeline
      .to(this.scale, {
        x: 1.2,
        y: 1.2,
        duration: 0.15,
        ease: 'power2.out'
      })
      .to(this.scale, {
        x: 1,
        y: 1,
        duration: 0.2,
        ease: 'elastic.out(1, 0.5)'
      })
  }
  
  playDeathAnimation(): Promise<void> {
    return new Promise((resolve) => {
      // Create explosion flash
      const flash = new PIXI.Graphics()
      flash.circle(0, 0, 40)
      flash.fill({ color: 0xffffff, alpha: 0 })
      this.addChild(flash)
      
      // Create particle fragments
      const fragments: PIXI.Graphics[] = []
      for (let i = 0; i < 8; i++) {
        const fragment = new PIXI.Graphics()
        const angle = (Math.PI * 2 * i) / 8
        fragment.rect(-3, -3, 6, 6)
        fragment.fill({ color: this.unitId.includes('red') ? 0xff4d4f : 0x52c41a, alpha: 0.8 })
        fragment.x = 0
        fragment.y = 0
        this.addChild(fragment)
        fragments.push(fragment)
        
        // Animate fragments outward
        gsap.to(fragment, {
          x: Math.cos(angle) * 50,
          y: Math.sin(angle) * 50,
          alpha: 0,
          rotation: Math.random() * Math.PI * 2,
          duration: 0.6,
          ease: 'power2.out'
        })
      }
      
      gsap.timeline({
        onComplete: () => {
          this.destroy()
          resolve()
        }
      })
        // Flash effect
        .to(flash, {
          alpha: 0.8,
          duration: 0.1,
          ease: 'power2.out'
        })
        .to(flash.scale, {
          x: 2,
          y: 2,
          duration: 0.1,
          ease: 'power2.out'
        }, 0)
        .to(flash, {
          alpha: 0,
          duration: 0.3,
          ease: 'power1.in'
        })
        // Shake and shrink
        .to(this, {
          x: this.x + 3,
          duration: 0.05,
          ease: 'none'
        }, 0)
        .to(this, {
          x: this.x - 3,
          duration: 0.05,
          ease: 'none'
        }, 0.05)
        .to(this, {
          x: this.x,
          duration: 0.05,
          ease: 'none'
        }, 0.1)
        // Spin and fade
        .to(this, {
          alpha: 0,
          rotation: Math.PI * 3,
          duration: 0.5,
          ease: 'power2.in'
        }, 0.15)
        .to(this.scale, {
          x: 0.3,
          y: 0.3,
          duration: 0.5,
          ease: 'power2.in'
        }, 0.15)
    })
  }
  
  updateData(data: Partial<UnitSpriteData>) {
    if (data.hp !== undefined && data.maxHp !== undefined) {
      this.updateHpBar(data.hp, data.maxHp)
      this.hpText.text = `${data.hp}`
    }
    
    // Update enchant badge and label when enchant status changes
    if (data.enchantName !== undefined) {
      // Remove old enchant badge
      if (this.enchantBadge) {
        this.removeChild(this.enchantBadge)
        this.enchantBadge = undefined
      }
      // Remove old soul name text (區域變數轉為 instance 追蹤)
      if (this.soulNameText) {
        gsap.killTweensOf(this.soulNameText)
        this.removeChild(this.soulNameText)
        this.soulNameText = undefined
      }
      // Remove old label（同時殺掉 shimmer 動畫）
      if (this.labelText) {
        gsap.killTweensOf(this.labelText)
        this.removeChild(this.labelText)
      }
      
      // Recreate enchant badge if enchanted
      if (data.enchantImage) {
        this.setupEnchantBadge(data.enchantImage)
      }
      
      // Recreate label with new enchant status
      // Need to get side and label from current state - assume they don't change
      const side = this.labelText.style.fill === 0xffb0b2 ? 'red' : 'black'
      const label = this.labelText.text
      this.setupLabel(label, side, data.enchantName)
    }
    
    // Update seal status
    if (data.isSealed !== undefined) {
      if (data.isSealed && !this.sealIcon) {
        this.setupSealIcon()
      } else if (!data.isSealed && this.sealIcon) {
        this.removeSealIcon()
      }
    }
  }
}
