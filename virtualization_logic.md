# GoJS Scrolling Table: Virtualization & Logic Documentation

This document outlines the core logic, mathematics, and edge cases handled in the `attempt.html` (GoJS Scrolling Table) implementation. It serves as a master reference for how virtualization, resizing, filtering, and scroll synchronization work seamlessly together.

## 1. Core Metrics & Viewport Mathematics

### `ROW_HEIGHT` and `BUTTONS_H`
The application relies strictly on pixel-perfect calculations instead of letting GoJS arbitrarily layout rows. 
- **`ROW_HEIGHT`**: Represents the exact pixel height of a single `TableRow` (usually exactly 30px). It is dynamically detected after the first layout pass to ensure accuracy even if fonts or margins change.
- **`BUTTONS_H`**: Represents the aggregate height of the `PAGEUP`, `UP`, `DOWN`, and `PAGEDOWN` scrollbar buttons.

### Viewport Capacity Math
To figure out how many rows to render without crashing the browser with thousands of DOM nodes, the capacity is calculated using the visual bounds of the `SCROLLER` panel:
```javascript
const snappedH = snapToRow(rawH, rowh); // rawH is the actualBounds.height of the SCROLLER
const capacity = Math.max(1, Math.floor(snappedH / rowH));
```
- **Why this works:** The `TABLE` and `SCROLLBAR` sit side-by-side in columns. The table has permissions to span the entire height of the `SCROLLER`. Dividing the height by exactly `ROW_HEIGHT` determines how many full rows fit perfectly.

### The Window Size (`BUFFER`)
Rendering exactly what's seen on screen would cause white flashes when scrolling fast. We use a buffer (e.g., 40 rows above, 40 rows below) so that dragging the scrollbar feels instantaneous.
`windowSize = capacity + BUFFER * 2`

---

## 2. Resizing & Anti-Drift Math

Resizing the node was one of the most mechanically complex pieces because GoJS tools often snap to absolute grids, which can cause erratic jumping during clicks.

### The `doActivate` Override
When you click the resize handle, we freeze the math variables immediately.
```javascript
this._stableRowH = table.elt(0).actualBounds.height;
this._stableButtonsH = 40; 
```
- **Scenario Tackled**: If you zoom in/out or layout changes temporarily misalign bounds, `_stableRowH` captures what the table physically measures precisely when the drag starts, preventing mathematical mismatch.
- **Click Drift Fix**: We lock the padding for boundary constants to `40px` instead of the dynamic button sizes. Previously, evaluating button sizes grabbed the background tracking shapes, forcing a resize jump of 15-20px simply upon clicking the node. 

### The `computeResizing` Override (Min-Height Clamp)
During the drag, we restrict the user from shrinking the node so small that it hides all rows.
```javascript
const minRows = Math.min(8, total); // At least 8 rows MUST be seen (or max count)
const minHeight = (minRows - 1) * rowH + 40;
```
- **Visual Spacing Hack**: By doing `(minRows - 1) * rowh`, the absolute pixel boundary evaluates to e.g., `7 * 30 = 210`. Adding the `40px` padding results in exactly `250px`. 
- Since `250px` gives a capacity of `250/30 = 8.33`, exactly 8 rows are perfectly rendered allowing it to start at a pixel perfect fit.

### The `PartResized` Listener
Once the user releases the mouse clip, the exact layout needs to be forcefully snapped into an absolute multiple of the bounds to prevent lingering blank space.
```javascript
const snappedH = Math.max(minScrollerH, Math.min(snapToRow(currentH, rowh), targetMaxH));
```

---

## 3. Virtual Initialization (Populating the `visibleItems`)

When scrolling natively or dragging a virtual node, we don't process 3,000 items at once.
Instead, `updateWindow(node, centerIndex)` determines exactly which items exist in memory currently:

1. **Calculate the Viewport Start/End**:
   `start = max(0, centerIndex - BUFFER)`
   `end = min(total length, start + windowSize)`
2. **Mandatory Connections Rules (CRITICAL SCENARIOS)**:
   - *Scenario:* A link connects to an attribute that is scrolled off-screen. If we virtualize it away, GoJS will delete the link! 
   - *Fix:* `node.findLinksConnected()` iterates over all existing links. If an attribute has an active link, it is **force injected** into the virtual render window regardless of scroll location so the link never breaks.
3. **Mandatory Filters**:
   - Similar to links, if an attribute's visibility is tracked via the active filters state (`nodeState.activeFilters`), we force it into the `visibleItems` array as well so toggling it handles instantly without jumping.

---

## 4. Scrollbar Math & Synchronization

### Synchronization between Virtual and Native scrollbars 
Non-virtualized nodes (say, < 200 items) just render perfectly natively. Virtualized nodes have the standard `SCROLLBAR`'s internal `click`, `actionMove`, and `doMouseWheel` intercepted.

### Thumb Math (`updateVirtualScrollBar`)
The `THUMB` height and position is dynamically recalculated depending on where you are in the 3,000 item list.
```javascript
const ratio = Math.min(1, capacity / fullLength);
const trackH = Math.max(0, availH - 40);
const thumbH = Math.max(15, ratio * trackH); // Thumb height represents visual ratio of what is currently seen.

// Alignment defines the Y-position in the track
const maxGlobalTopIndex = fullLength - capacity;
let percentage = constrainedTopIndex / maxGlobalTopIndex;
thumb.alignment = new go.Spot(0.5, percentage, 0, 0);
```
- **Scenario Tackled**: If `capacity` is 10, but the list is 3000, `thumbH` evaluates very small. The `Math.max(15, ...)` lock guarantees the thumb never vanishes to 0px and remains clickable.

### Dynamic Link Routing & Auto-Alignment (`VirtualizedLink`)
When drawing links or moving closely coupled nodes, standard GoJS bindings fall short for dynamic geometry. We implemented a custom `VirtualizedLink` class overriding `computePoints()`.

```javascript
class VirtualizedLink extends go.Link {
    computePoints() {
        // 1. Determine shortest physical distance dynamically
        const isLeft = (fromNode.location.x > toNode.location.x);

        // 2. Evaluate off-screen routing mathematically
        // If the port exists off-screen, the link origin is snapped directly 
        // to the top or bottom of the `SCROLLER` boundaries on the correct side.
        
        // 3. Inject calculated origins directly to bypass infinite layout loops
        if (!this.fromSpot.equals(fSpot)) this.fromSpot = fSpot;
        this.fromEndSegmentLength = isLeft ? 0 : 10; // Eliminate stub for left-drawn links
        
        return super.computePoints();
    }
}
```
- **The Gap Elimination**: Off-screen links naturally cause an awkward straight line crossing the table margin. The logic evaluates `fromEndSegmentLength` locally, assigning `0` if the link originates from the left or if it routes over the top/bottom boundary, creating the illusion of the link curving directly into the header or footer boundary.
- **Auto-Flop Alignment**: Because it evaluates raw `center.X` geometry on every render tick, dragging a node completely to the other side of its target causes the links to instantly switch walls (Right -> Left), ensuring paths never awkwardly clip through the middle of the nodes.

---

## 5. Filter Interaction State Management (`globalNodeState`)

Because `node.data` gets recreated constantly during scrolling transactions, keeping track of active filters natively in `isVirtualized` components fails.

**The Solution:**
```javascript
const globalNodeState = new Map(); // nodeKey -> { fullItems: [], activeFilters: Set }
```
- Every time a node generates, it dumps its true list and filter state into the map isolated by `node.key`.
- Toggling the filter simply flips a bit in `activeFilters.add(name)` in the memory map. Following a transaction, it forces a partial render of only the `visibleItems` bindings in the viewport without needing to evaluate the 3,000 unseen rows.

---

## 6. Interactive Linking, Ports, & Layers

To maintain a clean UI without compromising on high-density data mapping functionality, the standard static node ports have been upgraded.

### Roaming Hover Ports 
Instead of rendering ports on every single row (which bloats DOM operations and triggers layout shifts on hover), we define exactly two node-level ports: `ROAMING_LEFT` and `ROAMING_RIGHT`.
- `mouseEnter` on a `TableRow` intercepts the vertical Y-coordinate and dynamically moves the node's two roaming arrows to sit identically flush with that exact row.
- **Link Overrides (`LinkingTool.doActivate`)**: If a user clicks `TEMP_RIGHT` (the arrow), the diagram intercepts the click, instantly hides the arrows, and transfers the drawing origin logically to the `rowName` port underneath. This ensures the temporary drawing line emits physically from the row edge, not from the floating arrow hit-box.

### Direct Row Linking
Users can bypass the arrows entirely by clicking and dragging directly on the `TableRow` text. `LinkingTool.doActivate` checks where the click originated globally:
```javascript
const isLeftHalf = pt.x < bounds.centerX;
this.temporaryLink.fromSpot = isLeftHalf ? go.Spot.Left : go.Spot.Right;
```
This enables seamless omni-directional link routing dynamically based on physical click halves. Additionally, `diagram.toolManager.linkingTool.direction = go.LinkingTool.ForwardsOnly;` is strictly enforced to prevent confusing "backwards" links from Destinations to Sources.

### Foreground Selection Hoisting
When dealing with dense meshes of links, clicking a node triggers a custom `selectionChanged` event:
```javascript
node.layerName = node.isSelected ? "Foreground" : "";
node.findLinksConnected().each(link => {
    link.layerName = isSelected ? "Foreground" : "";
});
```
This forces the selected node and its entire ecosystem of connected wires to securely render above all other UI elements natively until unselected.
