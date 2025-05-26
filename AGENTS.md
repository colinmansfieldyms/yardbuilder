# AGENTS.md

These instructions apply to all files in this repository.

## Formatting
- Use **2 spaces** for indentation in HTML, CSS, and JavaScript.

## Testing
- Run [Prettier](https://prettier.io/) before committing:
  ```bash
  npx prettier -w index.html script.js style.css
  ```
  For a quick check, you can run:
  ```bash
  npx prettier -c index.html script.js style.css
  ```
- Lint all JavaScript changes before committing.

## Commit Guidelines
- Write concise, descriptive commit messages.
- Do **not** amend or squash existing commits.

## Pull Request Guidelines
- Summarize your changes clearly in the PR description.
- Ensure Prettier has been run on all modified files.

## Application Guide

### 1. Undo / Redo

Key Listener: intercepts Ctrl+Z / ⌘+Z and calls `undoLastAction()`.
`undoStack`: holds past actions (move, resize, delete).
`pushUndoAction(action)`: pushes an action onto the stack and updates the Undo button.
`undoLastAction()`: pops the last action and reverts it (move, resize, or delete), then updates UI.

Undo Button:
`undoBtn` click → `undoLastAction()`
`updateUndoButtonState()` enables/disables with visual feedback.

### 2. Sidebar & Collapsible Menus

Sidebar Collapse
Click `.sidebar-header` toggles `#sidebar.collapsed` and swaps icon (☰ ↔ ✕).

Generic Menus
Each `.menu-title` toggles its content panel (show/hide + ▲/▼ icon).

### 3. “Other Elements” Panel

UI Controls
Dropdown `#otherElementType` drives which fields show (labels vs. custom images vs. shapes).
`toggleOtherElementFields()` shows/hides label controls, size inputs, image note/button.

Custom Image Upload
`selectImageBtn` → file picker (`customImageFileInput`).
Validates file type/size, reads as data URL, displays preview.

### 4. Live Label Preview

`updateLabelPreview()` applies text, size, color from inputs to `#labelPreviewBox` in real time.

### 5. Yard Spots & Dock Doors Controls

Show/Hide Numbers
Toggles container visibility and calls `toggleLabelRotationFields()`.

Prefix/Suffix
Toggles extra inputs when numbering is “yes.”

### 6. Orientation & Label Rotation

Orientation Selectors
`updateLabelLocation()` & `updateNumberDirection()` repopulate positioning options.
`onChangeOrientation()` wires these updates and rotation-field toggles.

Rotation Tooltips
`updateRotationTooltip()` sets user‑friendly descriptions (none, 90°, dynamic).
`toggleLabelRotationFields()` shows rotation inputs only when vertical numbering is on.

### 7. Zones

Auto‑Resize Toggle
`zoneAutoResizeCheckbox` toggles “resize every X spots” inputs.

Add Zone
`addZoneBtn` → reads name, type, spot count, calls `calculateZoneDimensions()`, builds SVG group.

Zones Table
`addZoneToTable(name, id)`: creates/updates table rows, sets hover highlights.
`rebuildZonesTable()`: refreshes table from existing SVG zones.

### 8. Lost‑Trailer Box

State: `lostBoxType` (wide/tall), `lostBoxHidden`, `lostBoxGroup`.
`ensureLostBoxOnTop()`: always appends it last in SVG.
`rebuildLostBox()`: removes old box, calls createLostBoxGroup(), positions it.

### 9. Dragging & Resizing

Mouse Events on canvasSVG:
`mousedown`: start move or resize, snapshot old state in `__undoData`.
`mousemove`: apply live transform or resize with snap‑to‑grid and “guard shack” aspect locking.
`mouseup`: finalize action, push undo entry, or delete if dropped in trash.

Helpers
`getTranslation()`, `updateElementSize()`

### 10. Trash & Delete

Visual Feedback
`checkTrashHover()`: swaps trash icon open/closed when dragging over.
`finalizeTrashCheck()`: if dropped over open trash, clones for undo, removes element, rebuilds tables/layers.
Animate: `animateTrash()`, `createPuff()`

### 11. Adding Spots & Dock Doors

Buttons: `#addYardSpotsBtn`, `#addDockDoorsBtn`

Numbering:
`buildNumberingArray(opts)` builds sequence with prefix/suffix and direction.
`createLineBasedSpots(opts)`: lays out lines, spot groups, labels, triangles (docks).

### 12. Creating Other Elements

Labels: `createLabelElement` (text, size, color) measures text, builds hitbox + text node.
Custom Images: `createCustomImageElement(dataURL)`
Shapes (grass, building, pavement, guard_shack): builds rect/image and resize corner via `addResizeCorner()`.

### 13. Counters

`updateCounters()`: scans all non‑lost spots, tallies regular vs. dock, updates DOM.

### 14. Magnetize (Snapping)

Toggle: `magnetizeToggle`
`magnetizePosition(elem, x, y)`: snaps edges within threshold to any other draggable.

### 15. Scaling Canvas

Controls: `#canvasScale` slider, `#resetScaleBtn`
`applyScale(scaleVal)`: scales `<g id="scalableContent">`, repositions lost box.

### 16. Export / Import

Export IDs → Excel:
`exportIdsToExcel()`: gathers facility ID, lost box, zone data; builds XLSX (ExcelJS); downloads.

Export JPG / SVG:
`exportAsJPG()`: html2canvas → JPEG
`exportAsSVG()`: serializes SVG, ensures namespaces, hides export‑ignore elements.

Import SVG:
`parseImportedSVG(text)`: validates, replaces `#scalableContent`, reassigns draggables, restores state (facility, scale, zones, layers).

### 17. Layers Management

Sidebar: `layersSidebar`, `layersHeader` toggle collapse.
`assignLayerId(el)`: gives new elements unique data-layer-id.
`getLayerName()` / `getLayerIcon()`: heuristics for display text/icon.
`rebuildLayersList()`: populates list items in reverse order, with drag‑handle.
Drag‑Reorder: HTML5 drag events on `<li>` to reorder, then `updateOrderFromList()` reflows SVG.
Context Menu: right‑click on layer or canvas element → `layerContextMen`u with actions: bring/send front/back, delete, add/remove/edit spots or docks.
