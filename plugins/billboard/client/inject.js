import { createBillboard } from './billboard.js'
import { createHudModal } from './hud-modal.js'
import './styles.css'

/**
 * Initializes the Task Board plugin on the client side once Bot Crossing is booted.
 */
export function initTaskBoardClient() {
  function tryMount() {
    const bc = window.botCrossing
    if (!bc || !bc.colony || !bc.colony.scene) {
      setTimeout(tryMount, 200)
      return
    }

    const scene = bc.colony.scene
    const hudModal = createHudModal(() => fetchAndSync())

    // Mount 3D Billboard next to the spaceship
    const billboard = createBillboard(scene, () => {
      hudModal.open()
    })

    // Hook into render loop for beacon pulse
    const origRender = bc.engine?.renderer?.render
    if (origRender && bc.engine.renderer) {
      // Subscribe to frame ticks
      let lastTime = 0
      const tick = () => {
        const now = performance.now() * 0.001
        billboard.tick(now)
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }

    // Hook click raycasting for billboard mesh
    window.addEventListener('click', (e) => {
      if (e.target !== bc.engine?.canvas) return
      const mouse = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      }
      const raycaster = new (window.THREE || THREE).Raycaster()
      raycaster.setFromCamera(mouse, bc.engine.camera)
      const hits = raycaster.intersectObjects(billboard.group.children, true)
      if (hits.length > 0) {
        hudModal.open()
      }
    })

    async function fetchAndSync() {
      try {
        const res = await fetch('/api/taskboard/tasks')
        if (!res.ok) return
        const data = await res.json()
        const tasks = data.tasks || []
        const providerName = data.providerName || 'Tasks'

        billboard.updateTasks(tasks, providerName)
        hudModal.renderTasks(tasks, providerName)
      } catch {
        // Retry silently on next poll
      }
    }

    // Initial fetch & poll every 30s
    fetchAndSync()
    setInterval(fetchAndSync, 30000)

    console.log('[TaskBoard] Plugin mounted successfully onto Bot Crossing!')
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryMount)
  } else {
    tryMount()
  }
}

// Auto-run if loaded via script tag
if (typeof window !== 'undefined') {
  initTaskBoardClient()
}
