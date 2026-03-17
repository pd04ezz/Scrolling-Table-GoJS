# High-Performance Node Virtualization Guide

This document explains the logic behind the dynamic virtualization system implemented in [attempt.html](file:///d:/EQ/code/GoJS%20Practice/Scrolling-Table-GoJS/attempt.html). This system allows GoJS to handle 3,000+ attributes per node with zero lag, smooth scrolling, and perfect link persistence.

## 1. The Core Strategy: "Windowing"

The most important concept is that **GoJS never sees all 3000 items.** 
- The full list of 3000 items is stored in `fullItems` (raw memory).
- A tiny window (approx. 60 items) is stored in `visibleItems` (the Model).
- GoJS only renders what is in `visibleItems`.

By limiting the "DOM pressure", the browser's GPU only has to track a few dozen text blocks instead of thousands, which is why the diagram stays responsive even on low-end hardware.

---

## 2. Key Functions & Calculations

### [getViewportMetrics(node)](file:///d:/EQ/code/GoJS%20Practice/Scrolling-Table-GoJS/attempt.html#27-47)
This is the "Brain" of the responsive design. Instead of using hardcoded numbers like "60 rows", it measures the node in real-time.
- **Logic**: It finds the `SCROLLBAR` height and the height of a single `TableRow`.
- **Calculation**: `Capacity = (Bar Height / Row Height) - 3`.
- **Purpose**: It tells the system exactly how many rows physically fit on the user's screen right now. If the user resizes the node to be taller, this function detects it instantly, and the "Scroll floor" drops accordingly.

### [updateWindow(node, centerIndex)](file:///d:/EQ/code/GoJS%20Practice/Scrolling-Table-GoJS/attempt.html#176-226)
This function performs the array slicing logic.
- **Logic**: It takes the current scroll position (`centerIndex`) and identifies the `start` and [end](file:///d:/EQ/code/GoJS%20Practice/Scrolling-Table-GoJS/ScrollingTable.js#53-59) offsets.
- **The Buffer**: It adds `BUFFER=20` to both sides. If you are looking at row 100, it actually loads rows 80 through 140.
- **Sorting**: It pulls in "linked attributes" (see below) and re-sorts the map so everything appears in its correct numerical order.

### [updateVirtualScrollBar(node)](file:///d:/EQ/code/GoJS%20Practice/Scrolling-Table-GoJS/attempt.html#229-265)
Since the internal table only has 60 items, the native GoJS scrollbar would normally look huge.
- **Logic**: This function calculates the **Global Percentage**. If the user is at row 1500 of 3000, it calculates `1500 / 3000 = 0.5`.
- **Visuals**: It manually moves the `THUMB` to the 50% mark on the bar and shrinks the thumb size to reflect the true magnitude of the data.

---

## 3. How We Overcame "Laggy Loading"

Lag usually happens when a system tries to do too many UI updates per second. We solved this with three optimizations:

1. **Transaction Batching**: When scrolling, we wrap the entire "Window Shift" in a single `diagram.model.startTransaction`. This tells GoJS to wait until we are finished switching all 60 items before it even tries to repaint the screen.
2. **The Buffer Safety Cushion**: By loading 20 extra rows above and below the view, the user can scroll a short distance *without the window needing to shift at all*. This "Micro-Scrolling" is handled by the native GPU, making small movements feel buttery smooth.
3. **Lazy Port Binding**: Ports are only created for the 60 visible items. This keeps the GoJS "Link Network" lightweight.

---

## 4. Why Thumb Dragging is Instant

The most difficult problem was dragging the scrollbar thumb at high speeds.

**The Problem**: If you drag the thumb 500 pixels in one second, you are technically skipping through 2,000 rows. A normal system would try to render all 2,000 rows in between, causing a massive crash.

**The Solution**:
- **Manual Mapping**: Inside `thumb.actionMove`, we calculate the Mouse Y-percentage. We use that percentage to jump **directly** to the target index in the 3000-item array.
- **`node.invalidateConnectedLinks()`**: When you drag fast, the lines often "lag" behind the node. We call this specific function during the drag loop. It forces GoJS to instantly re-calculate the math for every arrow and line connected to the node in that exact frame.
- **Result**: Even if you scroll 3000 items in half a second, the code only performs a few jump-renders instead of trying to "walk" through every item.

## 5. Persistence of Links
Usually, virtualization breaks links because the target "Port" disappears when it scrolls off-screen.
- **We fixed this** by scanning `linkDataArray` on startup ([buildLinkedSet](file:///d:/EQ/code/GoJS%20Practice/Scrolling-Table-GoJS/attempt.html#403-412)).
- Any attribute that has a line connected to it is **Hard-Coded** into the "Visible" list. 
- It stays in the model forever (hidden off the top/bottom edges), so GoJS never loses the anchor point, and your lines never snap or disappear.
