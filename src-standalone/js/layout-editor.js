// ── Layout Editor ─────────────────────────────────────────────────────────────
// Per-tab panel reordering with localStorage persistence.
// Storage key format: le3dp.layout.<tabId>
// Panels are identified by their data-panel-key attribute.

var _layoutEditActive = false;
var _layoutOriginalOrder = {};  // tabId -> [key, ...]
var _layoutDragSrc = null;

function _panelKey(el) {
  return el.getAttribute('data-panel-key') || null;
}

function _getDraggableChildren(tabPane) {
  return Array.prototype.filter.call(tabPane.children, function(child) {
    return !!_panelKey(child);
  });
}

function _getTabIdFromPane(pane) {
  return pane.id.replace(/^pane-/, '');
}

function _layoutStorageKey(tabId) {
  return 'le3dp.layout.' + tabId;
}

function _saveLayout(tabId) {
  var pane = document.getElementById('pane-' + tabId);
  if (!pane) return;
  var children = _getDraggableChildren(pane);
  var order = children.map(function(c) { return _panelKey(c); });
  try { localStorage.setItem(_layoutStorageKey(tabId), JSON.stringify(order)); } catch(e) {}
}

function _reorderPane(pane, orderedKeys) {
  if (!orderedKeys || !orderedKeys.length) return;
  var allChildren = Array.from(pane.children);
  var keyToEl = {};
  allChildren.forEach(function(c) {
    var k = _panelKey(c);
    if (k) keyToEl[k] = c;
  });

  // Find the first non-keyed child as an anchor for insertion
  var anchor = null;
  for (var i = 0; i < allChildren.length; i++) {
    if (!_panelKey(allChildren[i])) { anchor = allChildren[i]; break; }
  }

  // Insert keyed elements in the specified order, all before the anchor
  orderedKeys.forEach(function(key) {
    var el = keyToEl[key];
    if (el) pane.insertBefore(el, anchor); // anchor=null → append to end
  });
}

function _restoreLayout(tabId) {
  var pane = document.getElementById('pane-' + tabId);
  if (!pane) return;
  var raw = localStorage.getItem(_layoutStorageKey(tabId));
  if (!raw) return;
  var savedOrder;
  try { savedOrder = JSON.parse(raw); } catch(e) { return; }
  if (!Array.isArray(savedOrder) || !savedOrder.length) return;

  // Include any new keys not in saved order (e.g. after an update) at the end
  var allChildren = Array.from(pane.children);
  var allKeys = allChildren.map(function(c) { return _panelKey(c); }).filter(Boolean);
  var savedSet = {};
  savedOrder.forEach(function(k) { savedSet[k] = true; });
  allKeys.forEach(function(k) { if (!savedSet[k]) savedOrder.push(k); });

  _reorderPane(pane, savedOrder);
}

// ── Public API ────────────────────────────────────────────────────────────────

function initLayoutEditor() {
  document.querySelectorAll('.tab-panel').forEach(function(pane) {
    var tabId = _getTabIdFromPane(pane);
    var children = _getDraggableChildren(pane);
    _layoutOriginalOrder[tabId] = children.map(function(c) { return _panelKey(c); });
    try { _restoreLayout(tabId); } catch(e) {}
  });
}

function toggleLayoutEdit() {
  _layoutEditActive = !_layoutEditActive;
  var root = document.getElementById('surface-edge-mesh-root');
  var toggleBtn = document.getElementById('layout-edit-toggle');
  var resetBtn = document.getElementById('layout-reset-btn');

  if (_layoutEditActive) {
    if (root) root.classList.add('layout-edit-active');
    if (toggleBtn) { toggleBtn.textContent = '\uD83D\uDD13 Lock Layout'; toggleBtn.classList.add('active'); }
    if (resetBtn) resetBtn.style.display = '';
    _enableDrag();
  } else {
    if (root) root.classList.remove('layout-edit-active');
    if (toggleBtn) { toggleBtn.textContent = '\u2699\uFE0F Edit Layout'; toggleBtn.classList.remove('active'); }
    if (resetBtn) resetBtn.style.display = 'none';
    _disableDrag();
  }
}

function resetCurrentTabLayout() {
  var activePane = document.querySelector('#surface-edge-mesh-root .tab-panel.active');
  if (!activePane) return;
  var tabId = _getTabIdFromPane(activePane);
  try { localStorage.removeItem(_layoutStorageKey(tabId)); } catch(e) {}
  var orig = _layoutOriginalOrder[tabId];
  if (orig) _reorderPane(activePane, orig);
}

// ── Drag-and-drop ─────────────────────────────────────────────────────────────

function _enableDrag() {
  document.querySelectorAll('.tab-panel').forEach(function(pane) {
    // Attach pane-level handlers so drops on whitespace/gaps are caught
    pane.addEventListener('dragover', _onPaneDragOver);
    pane.addEventListener('drop', _onPaneDrop);

    _getDraggableChildren(pane).forEach(function(child) {
      // Inject drag handle
      var handle = document.createElement('div');
      handle.className = 'le3dp-drag-handle';
      handle.setAttribute('aria-hidden', 'true');
      handle.innerHTML = '\u22EE\u22EE Drag to reorder';
      child.insertBefore(handle, child.firstChild);

      child.setAttribute('draggable', 'true');
      child.addEventListener('dragstart', _onDragStart);
      child.addEventListener('dragover', _onDragOver);
      child.addEventListener('dragleave', _onDragLeave);
      child.addEventListener('drop', _onDrop);
      child.addEventListener('dragend', _onDragEnd);
    });
  });
}

function _disableDrag() {
  document.querySelectorAll('.tab-panel').forEach(function(pane) {
    // Remove pane-level drop zone listeners
    pane.removeEventListener('dragover', _onPaneDragOver);
    pane.removeEventListener('drop', _onPaneDrop);

    _getDraggableChildren(pane).forEach(function(child) {
      // Remove injected drag handle
      var handle = child.querySelector('.le3dp-drag-handle');
      if (handle) handle.parentNode.removeChild(handle);

      child.removeAttribute('draggable');
      child.removeEventListener('dragstart', _onDragStart);
      child.removeEventListener('dragover', _onDragOver);
      child.removeEventListener('dragleave', _onDragLeave);
      child.removeEventListener('drop', _onDrop);
      child.removeEventListener('dragend', _onDragEnd);
      child.classList.remove('layout-drag-over-before', 'layout-drag-over-after', 'layout-dragging');
    });
  });
}

function _onDragStart(e) {
  _layoutDragSrc = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', _panelKey(this) || '');
  this.classList.add('layout-dragging');
}

function _clearDragIndicators(pane) {
  _getDraggableChildren(pane).forEach(function(c) {
    c.classList.remove('layout-drag-over-before', 'layout-drag-over-after');
  });
}

function _onDragOver(e) {
  e.preventDefault();
  e.stopPropagation(); // prevent pane-level handler from also firing
  e.dataTransfer.dropEffect = 'move';
  if (!_layoutDragSrc || this === _layoutDragSrc) return;
  if (this.parentElement !== _layoutDragSrc.parentElement) return;

  _clearDragIndicators(this.parentElement);
  var rect = this.getBoundingClientRect();
  if (e.clientY < rect.top + rect.height / 2) {
    this.classList.add('layout-drag-over-before');
  } else {
    this.classList.add('layout-drag-over-after');
  }
}

function _onDragLeave(e) {
  // Only clear if actually leaving this element (not entering a child)
  if (!this.contains(e.relatedTarget)) {
    this.classList.remove('layout-drag-over-before', 'layout-drag-over-after');
  }
}

function _onDrop(e) {
  e.preventDefault();
  e.stopPropagation(); // prevent pane-level handler from also firing
  this.classList.remove('layout-drag-over-before', 'layout-drag-over-after');
  if (!_layoutDragSrc || _layoutDragSrc === this) return;
  if (this.parentElement !== _layoutDragSrc.parentElement) return;

  var pane = this.parentElement;
  var tabId = _getTabIdFromPane(pane);
  var rect = this.getBoundingClientRect();

  if (e.clientY < rect.top + rect.height / 2) {
    pane.insertBefore(_layoutDragSrc, this);
  } else {
    pane.insertBefore(_layoutDragSrc, this.nextSibling);
  }

  _saveLayout(tabId);
}

function _onDragEnd(e) {
  this.classList.remove('layout-dragging');
  if (this.parentElement) _clearDragIndicators(this.parentElement);
  _layoutDragSrc = null;
}

// ── Pane-level drop zone (handles drops on whitespace/gaps) ───────────────────

function _onPaneDragOver(e) {
  if (!_layoutDragSrc) return;
  if (_layoutDragSrc.parentElement !== this) return; // cross-tab guard
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  // Show drag indicator on the nearest panel relative to the cursor Y
  var pane = this;
  var children = _getDraggableChildren(pane);
  _clearDragIndicators(pane);
  var nearest = null;
  var nearestBefore = false;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child === _layoutDragSrc) continue;
    var rect = child.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) {
      nearest = child;
      nearestBefore = true;
      break;
    }
    nearest = child;
    nearestBefore = false;
  }
  if (nearest) {
    nearest.classList.add(nearestBefore ? 'layout-drag-over-before' : 'layout-drag-over-after');
  }
}

function _onPaneDrop(e) {
  if (!_layoutDragSrc) return;
  if (_layoutDragSrc.parentElement !== this) return; // cross-tab guard
  e.preventDefault();

  var pane = this;
  _clearDragIndicators(pane);

  // Find the insertion point by cursor Y position among sibling panels
  var children = _getDraggableChildren(pane);
  var insertBefore = null;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child === _layoutDragSrc) continue;
    var rect = child.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) {
      insertBefore = child;
      break;
    }
  }

  pane.insertBefore(_layoutDragSrc, insertBefore); // insertBefore=null → append to end
  _saveLayout(_getTabIdFromPane(pane));
}
