import { ref, computed } from 'vue'

export function useDraggable() {
  const ox = ref(0)
  const oy = ref(0)
  let dragging = false
  let startX = 0, startY = 0, startOX = 0, startOY = 0

  const dragStyle = computed(() =>
    ox.value === 0 && oy.value === 0
      ? {}
      : { transform: `translate(${ox.value}px, ${oy.value}px)` }
  )

  function onDragDown(e: PointerEvent) {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return
    dragging = true
    startX = e.clientX; startY = e.clientY
    startOX = ox.value; startOY = oy.value
    ;(e.currentTarget as HTMLElement)?.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function onDragMove(e: PointerEvent) {
    if (!dragging) return
    ox.value = startOX + (e.clientX - startX)
    oy.value = startOY + (e.clientY - startY)
  }

  function onDragUp(e: PointerEvent) {
    if (!dragging) return
    dragging = false
    ;(e.currentTarget as HTMLElement)?.releasePointerCapture(e.pointerId)
  }

  function resetDrag() { ox.value = 0; oy.value = 0 }

  return { dragStyle, onDragDown, onDragMove, onDragUp, resetDrag }
}
