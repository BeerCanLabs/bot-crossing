import * as THREE from 'three'
import { terrainHeight } from './planet.js'

/**
 * Colony Depot / Plugin Workshop Kiosk
 * Sits near the spaceship (port side), serving as the colony's modular software & addon depot.
 * Designed with a retro-industrial sci-fi aesthetic: rugged housing, illuminated console screens,
 * holographic overhead banner, and an alert beacon.
 */

const METAL_BASE = 0x3d434d
const HOUSING_BODY = 0x1a1e26
const ACCENT_AMBER = 0xffa726
const SCREEN_GLOW = 0x4dd0e1

export class ShopKiosk {
  constructor(scene, shipPos, planet) {
    this.scene = scene
    this.shipPos = shipPos
    this.planet = planet

    this.group = new THREE.Group()
    this.group.name = 'colony-shop-kiosk'
    scene.add(this.group)

    this.hovered = false
    this.raycaster = new THREE.Raycaster()

    // Positioned opposite the billboard on the port side (-X, -Z)
    this.relOffset = new THREE.Vector3(-5.2, 0, -4.8)
    this.position = new THREE.Vector3().addVectors(shipPos, this.relOffset)
    this.group.position.copy(this.position)

    // Angled facing isometric camera and colony center
    this.group.rotation.y = -Math.PI * 0.25

    this._buildMesh()
    this._positionOnTerrain()
  }

  setPlanet(planet) {
    this.planet = planet
    this._positionOnTerrain()
  }

  _positionOnTerrain() {
    const y = terrainHeight(this.position.x, this.position.z, this.planet)
    this.position.y = y
    this.group.position.y = y
  }

  _buildMesh() {
    // 1. Octagonal landing pad / foundation
    const baseGeo = new THREE.CylinderGeometry(1.4, 1.6, 0.25, 8)
    const baseMat = new THREE.MeshStandardMaterial({
      color: METAL_BASE,
      roughness: 0.8,
      metalness: 0.3
    })
    const baseMesh = new THREE.Mesh(baseGeo, baseMat)
    baseMesh.position.y = 0.125
    this.group.add(baseMesh)

    // Base trim ring
    const ringGeo = new THREE.TorusGeometry(1.35, 0.04, 6, 8)
    const ringMat = new THREE.MeshStandardMaterial({
      color: ACCENT_AMBER,
      roughness: 0.4,
      metalness: 0.6
    })
    const ringMesh = new THREE.Mesh(ringGeo, ringMat)
    ringMesh.rotation.x = Math.PI / 2
    ringMesh.position.y = 0.26
    this.group.add(ringMesh)

    // 2. Central Kiosk Column / Server rack
    const bodyGeo = new THREE.BoxGeometry(1.1, 1.8, 0.9)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: HOUSING_BODY,
      roughness: 0.6,
      metalness: 0.4
    })
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat)
    bodyMesh.position.y = 1.15
    this.group.add(bodyMesh)

    // 3. Interactive Front Touchscreen Console (angled)
    const consoleGeo = new THREE.BoxGeometry(0.85, 0.6, 0.25)
    const consoleMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f16,
      roughness: 0.3,
      metalness: 0.7
    })
    const consoleMesh = new THREE.Mesh(consoleGeo, consoleMat)
    consoleMesh.position.set(0, 1.25, 0.48)
    consoleMesh.rotation.x = -Math.PI * 0.1
    this.group.add(consoleMesh)

    // Glow screen
    const screenCanvas = document.createElement('canvas')
    screenCanvas.width = 256
    screenCanvas.height = 128
    const sctx = screenCanvas.getContext('2d')
    sctx.fillStyle = '#06131c'
    sctx.fillRect(0, 0, 256, 128)
    sctx.fillStyle = '#00e5ff'
    sctx.font = 'bold 22px monospace'
    sctx.fillText('COLONY DEPOT', 35, 45)
    sctx.fillStyle = '#ffa726'
    sctx.font = '14px monospace'
    sctx.fillText('• ADDONS & ROLES', 45, 80)
    sctx.fillText('• STATUS: ACTIVE', 45, 105)

    this.screenTex = new THREE.CanvasTexture(screenCanvas)
    const screenGeo = new THREE.PlaneGeometry(0.75, 0.45)
    this.screenMat = new THREE.MeshBasicMaterial({
      map: this.screenTex,
      transparent: true
    })
    const screenMesh = new THREE.Mesh(screenGeo, this.screenMat)
    screenMesh.position.set(0, 1.28, 0.62)
    screenMesh.rotation.x = -Math.PI * 0.1
    this.group.add(screenMesh)

    // 4. Overhead Holographic Header / Canopy
    const archGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8)
    const archMat = new THREE.MeshStandardMaterial({ color: 0x666b75, metalness: 0.8, roughness: 0.3 })
    
    const postL = new THREE.Mesh(archGeo, archMat)
    postL.position.set(-0.55, 2.4, 0)
    const postR = new THREE.Mesh(archGeo, archMat)
    postR.position.set(0.55, 2.4, 0)
    this.group.add(postL, postR)

    // Top Signboard
    const signGeo = new THREE.BoxGeometry(1.3, 0.35, 0.15)
    const signCanvas = document.createElement('canvas')
    signCanvas.width = 256
    signCanvas.height = 64
    const signCtx = signCanvas.getContext('2d')
    signCtx.fillStyle = '#111822'
    signCtx.fillRect(0, 0, 256, 64)
    signCtx.strokeStyle = '#ffa726'
    signCtx.lineWidth = 4
    signCtx.strokeRect(2, 2, 252, 60)
    signCtx.fillStyle = '#ffa726'
    signCtx.font = 'bold 28px monospace'
    signCtx.textAlign = 'center'
    signCtx.fillText('SHOP / DEPOT', 128, 42)

    this.signTex = new THREE.CanvasTexture(signCanvas)
    const signMat = new THREE.MeshBasicMaterial({ map: this.signTex })
    const signMesh = new THREE.Mesh(signGeo, signMat)
    signMesh.position.set(0, 2.9, 0)
    this.group.add(signMesh)

    // 5. Pulsing Mast Beacon Light
    const beaconGeo = new THREE.SphereGeometry(0.1, 12, 12)
    this.beaconMat = new THREE.MeshBasicMaterial({ color: ACCENT_AMBER })
    this.beacon = new THREE.Mesh(beaconGeo, this.beaconMat)
    this.beacon.position.set(0, 3.15, 0)
    this.group.add(this.beacon)

    // Hit-box for raycasting
    const hitBoxGeo = new THREE.BoxGeometry(2.0, 3.4, 2.0)
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false })
    this.hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat)
    this.hitBox.position.y = 1.7
    this.group.add(this.hitBox)
  }

  pick(camera, ndcX, ndcY) {
    if (!this.hitBox || !camera) return false
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera)
    const hits = this.raycaster.intersectObject(this.hitBox, false)
    return hits.length > 0
  }

  setHover(hovered) {
    if (this.hovered === hovered) return
    this.hovered = hovered
    if (hovered) {
      this.beaconMat.color.setHex(0x00ffff)
      this.group.scale.set(1.05, 1.05, 1.05)
    } else {
      this.beaconMat.color.setHex(ACCENT_AMBER)
      this.group.scale.set(1, 1, 1)
    }
  }

  update(dt, elapsed, night) {
    // Pulse beacon light
    const pulse = 0.6 + 0.4 * Math.sin(elapsed * 4)
    if (!this.hovered) {
      this.beaconMat.color.setRGB(1 * pulse, 0.65 * pulse, 0.15 * pulse)
    }
  }

  dispose() {
    this.scene.remove(this.group)
    if (this.screenTex) this.screenTex.dispose()
    if (this.signTex) this.signTex.dispose()
  }
}
