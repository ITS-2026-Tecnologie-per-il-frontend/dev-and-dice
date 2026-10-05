type Identifiable = {
	id: number
}

export function getDropTargetId(target: EventTarget | null): number | null {
	if (!(target instanceof HTMLElement)) return null
	const item = target.closest<HTMLElement>('[data-reorder-item]')
	if (!item) return null

	const id = Number(item.dataset.reorderId)
	return Number.isFinite(id) ? id : null
}

export function getDropIndex(container: HTMLElement, clientY: number, targetId: number | null): number {
	const items = container.querySelectorAll<HTMLElement>('[data-reorder-item]')
	if (targetId !== null) {
		const targetIndex = Array.from(items).findIndex((item) => Number(item.dataset.reorderId) === targetId)
		if (targetIndex < 0) return items.length

		const bounds = items[targetIndex].getBoundingClientRect()
		return targetIndex + (clientY >= bounds.top + bounds.height / 2 ? 1 : 0)
	}

	for (let index = 0; index < items.length; index++) {
		const bounds = items[index].getBoundingClientRect()
		if (clientY < bounds.top + bounds.height / 2) return index
	}
	return items.length
}

export function reorderByIdToIndex<T extends Identifiable>(items: T[], sourceId: number, insertionIndex: number): T[] {
	const sourceIndex = items.findIndex((item) => item.id === sourceId)
	if (sourceIndex < 0) return items

	const reorderedItems = [...items]
	const [sourceItem] = reorderedItems.splice(sourceIndex, 1)
	const adjustedIndex = insertionIndex > sourceIndex ? insertionIndex - 1 : insertionIndex
	const boundedIndex = Math.max(0, Math.min(adjustedIndex, reorderedItems.length))
	if (boundedIndex === sourceIndex) return items

	reorderedItems.splice(boundedIndex, 0, sourceItem)
	return reorderedItems
}

export function reorderById<T extends Identifiable>(items: T[], sourceId: number, targetId: number): T[] {
	const targetIndex = items.findIndex((item) => item.id === targetId)
	if (targetIndex < 0) return items
	return reorderByIdToIndex(items, sourceId, targetIndex + (items.findIndex((item) => item.id === sourceId) < targetIndex ? 1 : 0))
}

export function reorderByDrop<T extends Identifiable>(
	items: T[],
	sourceId: number,
	targetId: number | null,
	insertionIndex: number,
): T[] {
	const sourceIndex = items.findIndex((item) => item.id === sourceId)
	if (sourceIndex < 0 || targetId === sourceId) return items

	if (targetId === null && (insertionIndex === sourceIndex || insertionIndex === sourceIndex + 1)) {
		return items
	}

	return reorderByIdToIndex(items, sourceId, insertionIndex)
}
