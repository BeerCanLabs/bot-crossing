import * as THREE from 'three'

/**
 * Creates the procedural 3D sci-fi billboard next to the spaceship.
 */
export function createBillboard(scene, onOpenModal) {
  const group = new THREE.Group()
  group.name = 'TaskBoardBillboard'

  // Position in the regolith to the right of the spaceship
  group.position.set(-17.6, 0, -5.0)
  group.rotation.y = -Math.PI / 6

  // Canvas texture for screen
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 600
  const ctx = canvas.getContext('2d')

  function drawScreen(tasks = [], providerName = 'Tasks') {
    ctx.fillStyle = '#060a14'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Border grid lines
    ctx.strokeStyle = '#0e2238'
    ctx.lineWidth = 4
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)

    // Header bar
    ctx.fillStyle = '#0a192f'
    ctx.fillRect(20, 20, canvas.width - 40, 80)

    // Header text
    ctx.fillStyle = '#00e5ff'
    ctx.font = 'bold 44px monospace'
    ctx.fillText('TASKS // OPS DECK', 40, 75)

    ctx.fillStyle = '#64748b'
    ctx.font = '22px monospace'
    ctx.fillText(`PROVIDER: ${providerName.toUpperCase()}`, 680, 75)

    // Divider
    ctx.strokeStyle = '#00e5ff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(20, 105)
    ctx.lineTo(canvas.width - 20, 105)
    ctx.stroke()

    // Task lines
    const displayTasks = tasks.slice(0, 7)
    let y = 160

    if (displayTasks.length === 0) {
      ctx.fillStyle = '#38bdf8'
      ctx.font = '26px monospace'
      ctx.fillText('> ALL SYSTEMS NOMINAL // QUEUE STANDBY', 40, 260)
      ctx.fillStyle = '#64748b'
      ctx.font = '20px monospace'
      ctx.fillText('CLICK BOARD TO CONFIGURE PROVIDERS (NOTION, JIRA, GITHUB)', 40, 310)
    } else {
      for (const t of displayTasks) {
        ctx.fillStyle = t.status === 'in_progress' ? '#00e5ff' : '#94a3b8'
        ctx.font = 'bold 22px monospace'
        const statusIcon = t.status === 'in_progress' ? '⚒' : '⏳'
        ctx.fillText(`${statusIcon} ${t.status.toUpperCase()}`, 40, y)

        ctx.fillStyle = '#f1f5f9'
        ctx.font = '22px monospace'
        const title = (t.title || 'Untitled').slice(0, 42)
        ctx.fillText(title, 260, y)

        ctx.fillStyle = '#38bdf8'
        ctx.font = '20px monospace'
        const assignee = `@${t.assignee || 'all'}`
        ctx.fillText(assignee, 850, y)

        y += 56
      }
    }
  }

  drawScreen([])

  const screenTexture = new THREE.CanvasTexture(canvas)
  screenTexture.minFilter = THREE.LinearFilter
  screenTexture.magFilter = THREE.LinearFilter

  // Billboard Screen Mesh
  const screenGeo = new THREE.BoxGeometry(6.4, 3.8, 0.15)
  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTexture,
    emissive: new THREE.Color(0x0a1c2e),
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.7,
  })
  const screenMesh = new THREE.Mesh(screenGeo, screenMat)
  screenMesh.position.y = 4.2
  screenMesh.castShadow = true
  screenMesh.receiveShadow = true
  group.add(screenMesh)

  // Structural Support Pylons
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.4 })
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.4, 8), pylonMat)
  leftLeg.position.set(-2.4, 2.2, 0)
  group.add(leftLeg)

  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.4, 8), pylonMat)
  rightLeg.position.set(2.4, 2.2, 0)
  group.add(rightLeg)

  // Top mast with pulsing cyan strobe
  const beaconGeo = new THREE.SphereGeometry(0.15, 8, 8)
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff })
  const beacon = new THREE.Mesh(beaconGeo, beaconMat)
  beacon.position.set(0, 6.3, 0)
  group.add(beacon)

  scene.add(group)

  // Click interaction
  screenMesh.userData = { isBillboard: true, onClick: onOpenModal }

  return {
    group,
    beacon,
    updateTasks(tasks, providerName) {
      drawScreen(tasks, providerName)
      screenTexture.needsUpdate = true
    },
    tick(time) {
      if (beaconMat) {
        const pulse = (Math.sin(time * 3) + 1) * 0.5
        beaconMat.color.setRGB(0, pulse, pulse)
      }
    },
  }
}
