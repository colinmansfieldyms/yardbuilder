(function () {
  "use strict";
  // Main application logic

  // -------------------------------
  // UNDO / CTRL+Z Support
  // -------------------------------
  document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    const isZ = key === "z";
    if (isZ && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey) {
        redoLastAction();
      } else {
        undoLastAction();
      }
    }
  });

  let undoStack = [];
  let redoStack = [];

  /**
   * pushUndoAction()
   *
   * Each action stored in undoStack should have:
   *   {
   *     type: 'move' or 'resize',
   *     element: a reference to the DOM element,
   *     oldX, oldY, oldWidth, oldHeight,  // previous state
   *     newX, newY, newWidth, newHeight   // new state
   *   }
   *
   * We'll only store what we need for undoing.
   */
  function pushUndoAction(action) {
    undoStack.push(action);
    redoStack = [];
    updateUndoButtonState();
    updateRedoButtonState();
  }

  /**
   * undoLastAction()
   *
   * Pops the last action from the stack and reverts it.
   * Then you can optionally push a "redo" action to a redo stack if you want redo support.
   */
  function undoLastAction() {
    if (undoStack.length === 0) {
      return;
    }

    const action = undoStack.pop();

    if (action.type === "move") {
      action.element.setAttribute(
        "transform",
        `translate(${action.oldX},${action.oldY})`,
      );
      redoStack.push(action);
    } else if (action.type === "resize") {
      updateElementSize(action.element, action.oldWidth, action.oldHeight);
      redoStack.push(action);
    } else if (action.type === "delete") {
      const { element, parent, index, oldX, oldY } = action;
      if (parent && element) {
        const children = Array.from(parent.children);
        if (index >= children.length) {
          parent.appendChild(element);
        } else {
          parent.insertBefore(element, children[index]);
        }
        element.setAttribute("transform", `translate(${oldX},${oldY})`);
        element.setAttribute("data-type", "draggable");
        element.setAttribute("style", "cursor: move;");
        rebuildZonesTable();
        updateCounters();
        ensureLostBoxOnTop();
        rebuildLayersList();
        redoStack.push({
          type: "delete",
          element,
          parent,
          index,
          oldX,
          oldY,
        });
      }
    } else if (action.type === "group-modify") {
      const g = document.querySelector(
        `#scalableContent > g[data-layer-id="${action.elementId}"]`,
      );
      if (g && action.before) {
        const clone = action.before.cloneNode(true);
        g.parentNode.replaceChild(clone, g);
        rebuildZonesTable();
        updateCounters();
        ensureLostBoxOnTop();
        rebuildLayersList();
        scheduleHighlightCleanup(clone);
        redoStack.push({
          type: "group-modify",
          elementId: action.elementId,
          before: action.after,
          after: action.before,
        });
      }
    } else if (action.type === "reorder") {
      applyLayerOrder(action.before);
      redoStack.push({
        type: "reorder",
        before: action.after,
        after: action.before,
      });
    }
    updateUndoButtonState();
    updateRedoButtonState();
  }

  function redoLastAction() {
    if (redoStack.length === 0) {
      return;
    }

    const action = redoStack.pop();

    if (action.type === "move") {
      action.element.setAttribute(
        "transform",
        `translate(${action.newX},${action.newY})`,
      );
      undoStack.push(action);
    } else if (action.type === "resize") {
      updateElementSize(action.element, action.newWidth, action.newHeight);
      undoStack.push(action);
    } else if (action.type === "delete") {
      if (action.element) {
        action.element.remove();
        rebuildZonesTable();
        updateCounters();
        undoStack.push(action);
      }
    } else if (action.type === "group-modify") {
      const g = document.querySelector(
        `#scalableContent > g[data-layer-id="${action.elementId}"]`,
      );
      if (g && action.before) {
        const clone = action.before.cloneNode(true);
        g.parentNode.replaceChild(clone, g);
        rebuildZonesTable();
        updateCounters();
        ensureLostBoxOnTop();
        rebuildLayersList();
        scheduleHighlightCleanup(clone);
        undoStack.push({
          type: "group-modify",
          elementId: action.elementId,
          before: action.after,
          after: action.before,
        });
      }
    } else if (action.type === "reorder") {
      applyLayerOrder(action.before);
      undoStack.push({
        type: "reorder",
        before: action.after,
        after: action.before,
      });
    }
    updateUndoButtonState();
    updateRedoButtonState();
  }

  // -------------------------------
  // UNDO BUTTON FUNCTIONALITY
  // -------------------------------

  // Select the Undo button
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");

  // Check if the button exists to avoid errors
  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      undoLastAction();
    });
  }
  if (redoBtn) {
    redoBtn.addEventListener("click", () => {
      redoLastAction();
    });
  }

  function updateUndoButtonState() {
    if (undoBtn) {
      if (undoStack.length > 0) {
        undoBtn.disabled = false;
        undoBtn.style.opacity = "1";
        undoBtn.style.cursor = "pointer";
      } else {
        undoBtn.disabled = true;
        undoBtn.style.opacity = "0.5";
        undoBtn.style.cursor = "not-allowed";
      }
    }
  }
  updateUndoButtonState();

  function updateRedoButtonState() {
    if (redoBtn) {
      if (redoStack.length > 0) {
        redoBtn.disabled = false;
        redoBtn.style.opacity = "1";
        redoBtn.style.cursor = "pointer";
      } else {
        redoBtn.disabled = true;
        redoBtn.style.opacity = "0.5";
        redoBtn.style.cursor = "not-allowed";
      }
    }
  }
  updateRedoButtonState();

  // -------------------------------
  // SIDEBAR COLLAPSE
  // -------------------------------
  const sidebar = document.getElementById("sidebar");
  const collapseIcon = document.getElementById("collapseIcon");
  const sidebarHeader = sidebar.querySelector(".sidebar-header");
  sidebarHeader.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    collapseIcon.textContent = sidebar.classList.contains("collapsed")
      ? "☰"
      : "✕";
  });

  // -------------------------------
  // COLLAPSIBLE MENUS
  // -------------------------------
  document.querySelectorAll(".menu-title").forEach((title) => {
    title.addEventListener("click", () => {
      const contentId = title.getAttribute("data-target");
      const content = document.getElementById(contentId);
      // Toggle display
      if (content.style.display === "block") {
        content.style.display = "none";
        title.querySelector(".collapse-icon").textContent = "▼";
      } else {
        content.style.display = "block";
        title.querySelector(".collapse-icon").textContent = "▲";
      }
    });
  });

  // -------------------------------
  // SHOW/HIDE LABEL FIELDS FOR "OTHER ELEMENTS"
  //  + CUSTOM IMAGE FIELDS
  // -------------------------------
  const otherElementType = document.getElementById("otherElementType");
  const labelTextFieldLabel = document.getElementById("labelTextFieldLabel");
  const otherElementLabel = document.getElementById("otherElementLabel");
  const otherElementWidthLabel = document.getElementById(
    "otherElementWidthLabel",
  );
  const otherElementHeightLabel = document.getElementById(
    "otherElementHeightLabel",
  );
  const otherElementWidth = document.getElementById("otherElementWidth");
  const otherElementHeight = document.getElementById("otherElementHeight");
  const customImageNote = document.getElementById("customImageNote");
  const selectImageBtn = document.getElementById("selectImageBtn");
  const customImagePreview = document.getElementById("customImagePreview");
  const customImageFileInput = document.getElementById("customImageFileInput");

  // Label-specific elements
  const labelFontSizeLabel = document.getElementById("labelFontSizeLabel");
  const labelFontSizeRange = document.getElementById("labelFontSizeRange");
  const labelColorLabel = document.getElementById("labelColorLabel");
  const labelColorSelect = document.getElementById("labelColorSelect");
  const labelPreviewTitle = document.getElementById("labelPreviewTitle");
  const labelPreviewBox = document.getElementById("labelPreviewBox");

  let customImageData = null;

  function toggleOtherElementFields() {
    const val = otherElementType.value;

    // Label fields
    const isLabelType = val === "label";
    labelTextFieldLabel.style.display = isLabelType ? "block" : "none";
    otherElementLabel.style.display = isLabelType ? "block" : "none";

    // Hide width/height if label
    otherElementWidthLabel.style.display = isLabelType ? "none" : "block";
    otherElementWidth.style.display = isLabelType ? "none" : "block";
    otherElementHeightLabel.style.display = isLabelType ? "none" : "block";
    otherElementHeight.style.display = isLabelType ? "none" : "block";

    // Font size, color, preview
    labelFontSizeLabel.style.display = isLabelType ? "block" : "none";
    labelFontSizeRange.style.display = isLabelType ? "block" : "none";
    labelColorLabel.style.display = isLabelType ? "block" : "none";
    labelColorSelect.style.display = isLabelType ? "block" : "none";
    labelPreviewTitle.style.display = isLabelType ? "block" : "none";
    labelPreviewBox.style.display = isLabelType ? "block" : "none";

    // Custom Image UI
    const isCustomImage = val === "custom_image";
    customImageNote.style.display = isCustomImage ? "block" : "none";
    selectImageBtn.style.display = isCustomImage ? "inline-block" : "none";

    if (!isCustomImage) {
      customImagePreview.style.display = "none";
      customImagePreview.src = "";
      selectImageBtn.disabled = false;
      customImageData = null;
    }

    // Clear preview if not label
    if (!isLabelType) {
      labelPreviewBox.textContent = "";
    }
  }
  otherElementType.addEventListener("change", toggleOtherElementFields);
  toggleOtherElementFields();

  // Handle file selection for Custom Image
  selectImageBtn.addEventListener("click", () => {
    customImageFileInput.value = ""; // reset
    customImageFileInput.click();
  });

  customImageFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) {
      customImageData = null;
      return;
    }
    // Basic type check
    const fileName = file.name.toLowerCase();
    if (
      !(
        fileName.endsWith(".jpg") ||
        fileName.endsWith(".jpeg") ||
        fileName.endsWith(".png") ||
        fileName.endsWith(".svg")
      )
    ) {
      alert("Invalid file type. Please select a JPG, PNG, or SVG.");
      customImageData = null;
      return;
    }

    // Check file size (max 1MB)
    if (file.size > 1024 * 1024) {
      alert("File size exceeds 1MB. Please select a smaller image.");
      customImageData = null;
      return;
    }

    // Read it as a data URL
    const reader = new FileReader();
    reader.onload = function (ev) {
      customImageData = ev.target.result;
      // Display small preview & disable the button
      customImagePreview.src = customImageData;
      customImagePreview.style.display = "inline-block";
      selectImageBtn.disabled = true;
    };
    reader.readAsDataURL(file);
  });

  // -------------------------------
  // LIVE PREVIEW FOR LABEL
  // -------------------------------
  function updateLabelPreview() {
    const text = otherElementLabel.value || "";
    const size = labelFontSizeRange.value;
    const color = labelColorSelect.value;
    labelPreviewBox.style.fontSize = size + "px";
    labelPreviewBox.style.color = color;
    labelPreviewBox.textContent = text;
  }
  otherElementLabel.addEventListener("input", updateLabelPreview);
  labelFontSizeRange.addEventListener("input", updateLabelPreview);
  labelColorSelect.addEventListener("change", updateLabelPreview);
  // Initialize once
  updateLabelPreview();

  // -------------------------------
  // YARD SPOTS => SHOW/HIDE FIELDS
  // -------------------------------
  const yardSpotShowNumbers = document.getElementById("yardSpotShowNumbers");
  const yardSpotNumbersContainer = document.getElementById(
    "yardSpotNumbersContainer",
  );
  yardSpotShowNumbers.addEventListener("change", () => {
    yardSpotNumbersContainer.style.display =
      yardSpotShowNumbers.value === "yes" ? "block" : "none";
    toggleLabelRotationFields(
      yardSpotShowNumbers.value,
      "yardSpotOrientation",
      "yardSpotLabelRotation",
      "yardSpotLabelRotationTooltip",
    );
  });
  const yardSpotPrefixSuffixDropdown = document.getElementById(
    "yardSpotPrefixSuffixDropdown",
  );
  const yardSpotPrefixSuffixContainer = document.getElementById(
    "yardSpotPrefixSuffixContainer",
  );
  yardSpotPrefixSuffixDropdown.addEventListener("change", () => {
    yardSpotPrefixSuffixContainer.style.display =
      yardSpotPrefixSuffixDropdown.value === "yes" ? "block" : "none";
  });

  // -------------------------------
  // DOCK DOORS => SHOW/HIDE FIELDS
  // -------------------------------
  const dockDoorShowNumbers = document.getElementById("dockDoorShowNumbers");
  const dockDoorNumbersContainer = document.getElementById(
    "dockDoorNumbersContainer",
  );
  dockDoorShowNumbers.addEventListener("change", () => {
    dockDoorNumbersContainer.style.display =
      dockDoorShowNumbers.value === "yes" ? "block" : "none";
    toggleLabelRotationFields(
      dockDoorShowNumbers.value,
      "dockDoorOrientation",
      "dockDoorLabelRotation",
      "dockDoorLabelRotationTooltip",
    );
  });
  const dockDoorPrefixSuffixDropdown = document.getElementById(
    "dockDoorPrefixSuffixDropdown",
  );
  const dockDoorPrefixSuffixContainer = document.getElementById(
    "dockDoorPrefixSuffixContainer",
  );
  dockDoorPrefixSuffixDropdown.addEventListener("change", () => {
    dockDoorPrefixSuffixContainer.style.display =
      dockDoorPrefixSuffixDropdown.value === "yes" ? "block" : "none";
  });

  // -------------------------------
  // ORIENTATION => LABEL LOCATION, NUMBER DIRECTION
  // -------------------------------
  const yardSpotOrientation = document.getElementById("yardSpotOrientation");
  const yardSpotLabelLocation = document.getElementById(
    "yardSpotLabelLocation",
  );
  const yardSpotNumberDirection = document.getElementById(
    "yardSpotNumberDirection",
  );
  const dockDoorOrientation = document.getElementById("dockDoorOrientation");
  const dockDoorLabelLocation = document.getElementById(
    "dockDoorLabelLocation",
  );
  const dockDoorNumberDirection = document.getElementById(
    "dockDoorNumberDirection",
  );

  function updateLabelLocation(orientation, locationSelect) {
    locationSelect.innerHTML = "";
    if (orientation === "vertical") {
      locationSelect.add(new Option("Top", "top"));
      locationSelect.add(new Option("Bottom", "bottom"));
    } else {
      locationSelect.add(new Option("Left", "left"));
      locationSelect.add(new Option("Right", "right"));
    }
  }
  function updateNumberDirection(orientation, directionSelect) {
    directionSelect.innerHTML = "";
    if (orientation === "vertical") {
      // If orientation === 'vertical', we show "Left to Right" and "Right to Left"
      directionSelect.add(new Option("Left to Right", "ltr"));
      directionSelect.add(new Option("Right to Left", "rtl"));
    } else {
      // Otherwise (if orientation === 'horizontal'), we show "Top to Bottom" and "Bottom to Top"
      directionSelect.add(new Option("Top to Bottom", "ttb"));
      directionSelect.add(new Option("Bottom to Top", "btt"));
    }
  }
  function onChangeOrientation(
    orientationSelect,
    labelLocSelect,
    numDirSelect,
  ) {
    const orientationVal = orientationSelect.value;
    updateLabelLocation(orientationVal, labelLocSelect);
    updateNumberDirection(orientationVal, numDirSelect);
    toggleLabelRotationFields(
      orientationSelect.id === "yardSpotOrientation"
        ? yardSpotShowNumbers.value
        : dockDoorShowNumbers.value,
      orientationSelect.id,
      orientationSelect.id === "yardSpotOrientation"
        ? "yardSpotLabelRotation"
        : "dockDoorLabelRotation",
      orientationSelect.id === "yardSpotOrientation"
        ? "yardSpotLabelRotationTooltip"
        : "dockDoorLabelRotationTooltip",
    );
  }
  yardSpotOrientation.addEventListener("change", () => {
    onChangeOrientation(
      yardSpotOrientation,
      yardSpotLabelLocation,
      yardSpotNumberDirection,
    );
  });
  dockDoorOrientation.addEventListener("change", () => {
    onChangeOrientation(
      dockDoorOrientation,
      dockDoorLabelLocation,
      dockDoorNumberDirection,
    );
  });
  onChangeOrientation(
    yardSpotOrientation,
    yardSpotLabelLocation,
    yardSpotNumberDirection,
  );
  onChangeOrientation(
    dockDoorOrientation,
    dockDoorLabelLocation,
    dockDoorNumberDirection,
  );

  // -------------------------------
  // LABEL ROTATION => DESCRIPTIONS AS TOOLTIPS
  // -------------------------------
  const yardSpotLabelRotation = document.getElementById(
    "yardSpotLabelRotation",
  );
  const yardSpotLabelRotTooltip = document.getElementById(
    "yardSpotLabelRotationTooltip",
  );
  const dockDoorLabelRotation = document.getElementById(
    "dockDoorLabelRotation",
  );
  const dockDoorLabelRotTooltip = document.getElementById(
    "dockDoorLabelRotationTooltip",
  );

  function updateRotationTooltip(select, tooltipElem) {
    const val = select.value;
    switch (val) {
      case "none":
        tooltipElem.textContent = "Labels are never rotated.";
        break;
      case "90":
        tooltipElem.textContent = "All labels are rotated 90°.";
        break;
      default:
        tooltipElem.textContent =
          "Labels rotate only if they have more than 3 characters.";
        break;
    }
  }
  yardSpotLabelRotation.addEventListener("change", () => {
    updateRotationTooltip(yardSpotLabelRotation, yardSpotLabelRotTooltip);
  });
  dockDoorLabelRotation.addEventListener("change", () => {
    updateRotationTooltip(dockDoorLabelRotation, dockDoorLabelRotTooltip);
  });
  updateRotationTooltip(yardSpotLabelRotation, yardSpotLabelRotTooltip);
  updateRotationTooltip(dockDoorLabelRotation, dockDoorLabelRotTooltip);

  function toggleLabelRotationFields(
    showNumbersVal,
    orientationId,
    rotationSelectId,
    rotationTooltipId,
  ) {
    const rotationSelect = document.getElementById(rotationSelectId);
    const rotationTooltip = document.getElementById(rotationTooltipId);
    const orientationSelect = document.getElementById(orientationId);
    if (showNumbersVal === "yes" && orientationSelect.value === "vertical") {
      document.getElementById(rotationSelectId + "Label").style.display =
        "block";
      rotationSelect.style.display = "block";
    } else {
      document.getElementById(rotationSelectId + "Label").style.display =
        "none";
      rotationSelect.style.display = "none";
    }
    if (showNumbersVal === "yes" && orientationSelect.value === "vertical") {
      const currentVal = rotationSelect.value;
      updateRotationTooltip(rotationSelect, rotationTooltip);
    }
  }

  // -------------------------------
  // ZONES => TOGGLE "RESIZE EVERY X SPOTS?"
  // -------------------------------
  const zoneAutoResizeCheckbox = document.getElementById(
    "zoneAutoResizeCheckbox",
  );
  const zoneResizeLabel = document.getElementById("zoneResizeLabel");
  const zoneResizeCount = document.getElementById("zoneResizeCount");
  zoneAutoResizeCheckbox.addEventListener("change", () => {
    const show = zoneAutoResizeCheckbox.checked;
    zoneResizeLabel.style.display = show ? "block" : "none";
    zoneResizeCount.style.display = show ? "block" : "none";
  });

  // -------------------------------
  // STATE VARS
  // -------------------------------
  let snapToGrid = false;
  let hideTrash = false;
  let magnetizeEnabled = false;
  let currentScale = 1;
  let previousScale = 1;
  const baseWidth = 1046.5;
  const baseHeight = 500;

  let facilityId = 1;
  let nextSpotSequence = 1;
  let nextZoneId = 1;
  const zoneNameToIdMap = {};
  let nextLayerId = 1;

  // For Lost Box
  let lostBoxType = "wide"; // 'wide' or 'tall'
  let lostBoxHidden = false; // hide on canvas or not
  let lostBoxGroup = null;

  function ensureLostBoxOnTop() {
    const scalable = document.getElementById("scalableContent");
    const lost = scalable.querySelector("g.lostTrailer");
    if (lost) scalable.appendChild(lost);
  }

  // Initialize facility
  const facilityNumberInput = document.getElementById("facilityNumberInput");
  const startingZoneNumberInput = document.getElementById(
    "startingZoneNumberInput",
  );

  facilityId = parseInt(facilityNumberInput.value, 10) || 1;
  nextZoneId = parseInt(startingZoneNumberInput.value, 10) || 1;

  // Layers sidebar elements - defined early so rebuildLostBox() can access
  const layersSidebar = document.getElementById("layersSidebar");
  const layersHeader = document.getElementById("layersHeader");
  const layersCollapseIcon = document.getElementById("layersCollapseIcon");
  const layersList = document.getElementById("layersList");
  const layerContextMenu = document.getElementById("layerContextMenu");
  const contextAdd = document.getElementById("contextAdd");
  const contextRemove = document.getElementById("contextRemove");
  const contextEditFirst = document.getElementById("contextEditFirst");
  let contextTarget = null;
  let contextType = null; // 'dock' or 'spot'

  const hideContextMenu = document.getElementById("hideContextMenu");
  const hideContextOption = document.getElementById("hideContextOption");
  let hideContextType = null; // 'trash' or 'lost'
  document
    .getElementById("bodyWrapper")
    .classList.toggle(
      "layers-open",
      !layersSidebar.classList.contains("collapsed"),
    );

  facilityNumberInput.addEventListener("change", () => {
    facilityId = parseInt(facilityNumberInput.value, 10) || 1;

    // Reassign existing spot IDs to match new facility ID
    reassignSpotIdsForNewFacility(facilityId);

    // Rebuild Lost Box if needed
    rebuildLostBox();
    ensureLostBoxOnTop();
  });

  startingZoneNumberInput.addEventListener("change", () => {
    const newStart = parseInt(startingZoneNumberInput.value, 10) || 1;
    reassignZoneIdsForNewStart(newStart);
  });

  function reassignSpotIdsForNewFacility(newFacId) {
    const allSpots = document.querySelectorAll("g.eagleViewDropSpot");

    allSpots.forEach((spot) => {
      // Skip the Lost Box if it’s the lostTrailer
      if (spot.classList.contains("lostTrailer")) return;

      // Retrieve data-sequence
      const seq = spot.getAttribute("data-sequence");
      // If no sequence is found, skip it (or handle older logic differently)
      if (!seq) return;

      // Build the new spot ID
      const newId = buildSpotId(newFacId, seq);
      spot.setAttribute("data-spot-id", newId);

      // Also fix any triangles
      const loadTri = spot.querySelector("[data-loading-id]");
      if (loadTri) {
        loadTri.setAttribute("data-loading-id", newId);
      }
      const unloadTri = spot.querySelector("[data-unloading-id]");
      if (unloadTri) {
        unloadTri.setAttribute("data-unloading-id", newId);
      }
    });
  }

  function reassignZoneIdsForNewStart(newStart) {
    const rows = Array.from(zonesTableBody.querySelectorAll("tr"));

    for (let key in zoneNameToIdMap) {
      delete zoneNameToIdMap[key];
    }

    let currentId = newStart;
    rows.forEach((row) => {
      const zoneName = row.children[0].textContent;
      const oldId = row.getAttribute("data-zone-id");

      document.querySelectorAll(`g[data-zone-id="${oldId}"]`).forEach((el) => {
        el.setAttribute("data-zone-id", currentId);
      });

      row.setAttribute("data-zone-id", currentId);
      row.children[1].textContent = currentId;

      zoneNameToIdMap[zoneName] = currentId;
      currentId++;
    });

    nextZoneId = currentId;
  }

  function getZoneId(zoneName) {
    if (!zoneNameToIdMap[zoneName]) {
      zoneNameToIdMap[zoneName] = nextZoneId;
      nextZoneId++;
    }
    return zoneNameToIdMap[zoneName];
  }
  function getNextSpotSequence() {
    const seq = nextSpotSequence;
    nextSpotSequence++;
    return seq; // e.g., returns 1, 2, 3, ...
  }
  function buildSpotId(facId, seq) {
    // Convert both to strings and concatenate
    return String(facId) + String(seq);
  }

  // TOGGLES
  const snapToGridToggle = document.getElementById("snapToGridToggle");
  snapToGridToggle.addEventListener("change", () => {
    snapToGrid = snapToGridToggle.checked;
  });
  const hideTrashToggle = document.getElementById("hideTrashToggle");
  hideTrashToggle.addEventListener("change", () => {
    hideTrash = hideTrashToggle.checked;
    toggleTrashCanVisibility(hideTrash);
  });
  function toggleTrashCanVisibility(hide) {
    const trashCan = document.getElementById("trashCan");
    trashCan.style.display = hide ? "none" : "block";
  }

  // -------------------------------
  // LOST BOX
  // -------------------------------
  const lostBoxTypeSelect = document.getElementById("lostBoxTypeSelect");
  const hideLostBoxToggle = document.getElementById("hideLostBoxToggle");

  lostBoxTypeSelect.addEventListener("change", () => {
    lostBoxType = lostBoxTypeSelect.value;
    rebuildLostBox();
    ensureLostBoxOnTop();
  });
  hideLostBoxToggle.addEventListener("change", () => {
    lostBoxHidden = hideLostBoxToggle.checked;
    if (lostBoxGroup) {
      lostBoxGroup.style.display = lostBoxHidden ? "none" : "";
    }
  });

  function rebuildLostBox() {
    // Remove the old one, if it exists
    if (lostBoxGroup && lostBoxGroup.parentNode) {
      lostBoxGroup.parentNode.removeChild(lostBoxGroup);
    }
    lostBoxGroup = createLostBoxGroup(lostBoxType, facilityId);
    lostBoxGroup.style.display = lostBoxHidden ? "none" : "";
    document.getElementById("scalableContent").appendChild(lostBoxGroup);
    repositionLostBox(currentScale);
    assignLayerId(lostBoxGroup);
    ensureLostBoxOnTop();
    rebuildLayersList();
    ensureLostBoxOnTop();
    attachLostBoxContextMenu();
  }

  function createLostBoxGroup(lType, facId) {
    // Dimensions
    // Without top label:
    // wide => w=387, h=54.2
    // tall => w=196.2, h=109.8
    // We'll add 18.2 for the top label bar to final height
    let mainW = 0,
      mainH = 0,
      lostClassSuffix = 1;
    if (lType === "wide") {
      mainW = 387;
      mainH = 54.2;
      lostClassSuffix = 1;
    } else {
      mainW = 196.2;
      mainH = 109.8;
      lostClassSuffix = 2;
    }
    const topLabelH = 18.2;
    const totalH = mainH + topLabelH;

    // Create group
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("data-type", "draggable");
    group.setAttribute("transform", `translate(10, ${500 - totalH - 10})`); // Lost Box shows up on the bottom left by default
    group.setAttribute("data-w", mainW);
    group.setAttribute("data-h", mainH);
    group.setAttribute("x", "0");
    group.setAttribute("y", topLabelH);
    // Required classes:
    // droppable eagleViewDropSpot lostTrailer lostX lost_rowY
    // data-spot-id="X000"
    group.setAttribute(
      "class",
      `droppable eagleViewDropSpot lostTrailer lost${facId} lost_row${lostClassSuffix}`,
    );
    group.setAttribute("data-spot-id", `${facId}000`);

    // Hitbox
    const hitbox = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    hitbox.setAttribute("data-role", "hitbox");
    hitbox.setAttribute("width", mainW);
    hitbox.setAttribute("height", totalH);
    hitbox.setAttribute("fill", "transparent");
    hitbox.setAttribute("pointer-events", "fill");
    group.appendChild(hitbox);

    // Top Label rect
    const nameRect = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    nameRect.setAttribute("class", "zone-name-box");
    nameRect.setAttribute("x", "0");
    nameRect.setAttribute("y", "0");
    nameRect.setAttribute("width", mainW);
    nameRect.setAttribute("height", topLabelH);
    nameRect.setAttribute("pointer-events", "none");
    group.appendChild(nameRect);

    // The text "Lost"
    const nameText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    nameText.setAttribute("fill", "#fff");
    nameText.setAttribute("font-family", "Helvetica, sans-serif");
    nameText.setAttribute("font-size", "12");
    nameText.setAttribute("x", mainW / 2);
    nameText.setAttribute("y", 13);
    nameText.setAttribute("text-anchor", "middle");
    nameText.setAttribute("pointer-events", "none");
    nameText.textContent = "Lost";
    group.appendChild(nameText);

    // Outline for main body (below label)
    const outline = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    outline.setAttribute("class", "zone-outline");
    outline.setAttribute("x", "0");
    outline.setAttribute("y", topLabelH);
    outline.setAttribute("width", mainW);
    outline.setAttribute("height", mainH);
    outline.setAttribute("pointer-events", "none");
    group.appendChild(outline);

    // No resize corner, user can only drag

    return group;
  }

  function lostBoxContextHandler(e) {
    e.preventDefault();
    hideContextType = "lost";
    hideContextMenu.style.display = "block";
    hideContextMenu.style.left = e.clientX + "px";
    hideContextMenu.style.top = e.clientY + "px";
  }

  function attachLostBoxContextMenu() {
    if (!lostBoxGroup) return;
    lostBoxGroup.addEventListener("contextmenu", lostBoxContextHandler);
  }

  // -------------------------------
  // SVG WRAPPER & TRASH
  // -------------------------------
  const svgWrapper = document.getElementById("svgWrapper");
  const canvasSVG = document.getElementById("canvasSVG");
  const trashCan = document.getElementById("trashCan");
  const trashImg = trashCan.querySelector("img");

  // Rotate button (HTML button overlay)
  const rotateBtn = document.getElementById("rotateBtn");
  rotateBtn.setAttribute("data-export-ignore", "true");

  rotateBtn.addEventListener("click", () => {
    if (selectedElements.size !== 1) return;
    const el = Array.from(selectedElements)[0];
    rotateGroup(el);
    updateRotateButton();
    rotateBtn.blur();
  });

  // Selection state
  const selectedElements = new Set();
  let isSelecting = false;
  let marqueeEl = null;
  let selectStartX = 0;
  let selectStartY = 0;
  const dragStartMap = new Map();

  function updateSelectionIndicators() {
    layersList
      .querySelectorAll("li.selected")
      .forEach((li) => li.classList.remove("selected"));
    zonesTableBody
      .querySelectorAll("tr.selected")
      .forEach((tr) => tr.classList.remove("selected"));

    const zoneIds = new Set();
    selectedElements.forEach((el) => {
      const lid = el.getAttribute("data-layer-id");
      if (lid) {
        const li = layersList.querySelector(`li[data-target-id="${lid}"]`);
        if (li) li.classList.add("selected");
      }
      const zid = el.getAttribute("data-zone-id");
      if (zid) zoneIds.add(zid);
    });

    zoneIds.forEach((id) => {
      const tr = zonesTableBody.querySelector(`tr[data-zone-id="${id}"]`);
      if (tr) tr.classList.add("selected");
    });

    updateRotateButton();
  }

  function clearSelection() {
    selectedElements.forEach((el) => el.classList.remove("selected"));
    selectedElements.clear();
    updateSelectionIndicators();
  }

  function addToSelection(el) {
    if (!selectedElements.has(el)) {
      selectedElements.add(el);
      el.classList.add("selected");
      updateSelectionIndicators();
    }
  }

  function setSelection(list) {
    clearSelection();
    list.forEach((el) => {
      selectedElements.add(el);
      el.classList.add("selected");
    });
    updateSelectionIndicators();
  }

  function updateRotateButton() {
    rotateBtn.classList.remove("show");
    if (selectedElements.size !== 1) return;
    const el = Array.from(selectedElements)[0];
    const bbox = el.getBBox();
    const matrix = el.getCTM();
    if (!matrix) return;
    const pt = canvasSVG.createSVGPoint();
    pt.x = bbox.x + bbox.width + 4;
    pt.y = bbox.y - 4;
    const global = pt.matrixTransform(matrix);
    rotateBtn.style.left = `${global.x}px`;
    rotateBtn.style.top = `${global.y}px`;
    rotateBtn.classList.add("show");
  }

  trashCan.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    hideContextType = "trash";
    hideContextMenu.style.display = "block";
    hideContextMenu.style.left = e.clientX + "px";
    hideContextMenu.style.top = e.clientY + "px";
  });

  trashCan.addEventListener("click", () => {
    showTrashInstruction();
  });

  // -------------------------------
  // Zones Table
  // -------------------------------
  const zonesTableHeader = document.getElementById("zonesTableHeader");
  const zonesTableContent = document.getElementById("zonesTableContent");
  const zonesTableBody = document.querySelector("#zonesTable tbody");

  zonesTableHeader.addEventListener("click", () => {
    if (zonesTableContent.style.display === "block") {
      zonesTableContent.style.display = "none";
      zonesTableHeader.querySelector(".collapse-icon").textContent = "▼";
    } else {
      zonesTableContent.style.display = "block";
      zonesTableHeader.querySelector(".collapse-icon").textContent = "▲";
    }
  });

  function highlightZone(zoneId) {
    const spots = canvasSVG.querySelectorAll(
      `g.eagleViewDropSpot[data-zone-id="${zoneId}"]`,
    );
    spots.forEach((spot) => spot.classList.add("highlighted"));
  }
  function removeHighlightZone(zoneId) {
    const spots = canvasSVG.querySelectorAll(
      `g.eagleViewDropSpot[data-zone-id="${zoneId}"]`,
    );
    spots.forEach((spot) => spot.classList.remove("highlighted"));
  }
  function highlightLayer(layerId) {
    const g = document.querySelector(
      `#scalableContent > g[data-layer-id="${layerId}"]`,
    );
    if (g) g.classList.add("highlighted");
  }
  function removeHighlightLayer(layerId) {
    const g = document.querySelector(
      `#scalableContent > g[data-layer-id="${layerId}"]`,
    );
    if (g) g.classList.remove("highlighted");
  }

  function highlightAllSpots() {
    const spots = canvasSVG.querySelectorAll(
      "g.eagleViewDropSpot:not(.lostTrailer)",
    );
    spots.forEach((spot) => {
      const hasLoadingTriangle = spot.querySelector(".loading_triangle");
      const hasUnloadingTriangle = spot.querySelector(".unloading_triangle");
      if (!hasLoadingTriangle && !hasUnloadingTriangle) {
        spot.classList.add("highlighted");
      }
    });
  }
  function removeHighlightAllSpots() {
    const spots = canvasSVG.querySelectorAll(
      "g.eagleViewDropSpot:not(.lostTrailer)",
    );
    spots.forEach((spot) => {
      const hasLoadingTriangle = spot.querySelector(".loading_triangle");
      const hasUnloadingTriangle = spot.querySelector(".unloading_triangle");
      if (!hasLoadingTriangle && !hasUnloadingTriangle) {
        spot.classList.remove("highlighted");
      }
    });
  }
  function highlightAllDocks() {
    const spots = canvasSVG.querySelectorAll("g.eagleViewDropSpot");
    spots.forEach((spot) => {
      if (
        spot.querySelector(".loading_triangle") ||
        spot.querySelector(".unloading_triangle")
      ) {
        spot.classList.add("highlighted");
      }
    });
  }
  function removeHighlightAllDocks() {
    const spots = canvasSVG.querySelectorAll("g.eagleViewDropSpot");
    spots.forEach((spot) => spot.classList.remove("highlighted"));
  }

  function addZoneToTable(zoneName, zoneId) {
    // 1) Count current total
    const allZoneSpots = canvasSVG.querySelectorAll(
      `g.eagleViewDropSpot[data-zone-id="${zoneId}"]`,
    );
    const numberOfSpots = allZoneSpots.length;
    const spotIds = Array.from(allZoneSpots)
      .map((s) => s.getAttribute("data-spot-id"))
      .join(", ");

    // 2) See if a row for this zone already exists
    const existingRow = zonesTableBody.querySelector(
      `tr[data-zone-id="${zoneId}"]`,
    );
    if (existingRow) {
      // Update the zone name cell
      existingRow.children[0].textContent = zoneName;
      // existingRow.children[1] is Zone ID cell (unchanged)
      // existingRow.children[2] is "Number of Spots"
      existingRow.children[2].textContent = numberOfSpots;
      existingRow.children[3].textContent = spotIds;
      updateCounters();
      return;
    }

    // 3) Otherwise, create a new row
    const tr = document.createElement("tr");
    tr.setAttribute("data-zone-id", zoneId);

    // (A) Zone Name
    const tdName = document.createElement("td");
    tdName.textContent = zoneName;

    // (B) Zone ID
    const tdId = document.createElement("td");
    tdId.textContent = zoneId;

    // (C) Number of Spots
    const tdCount = document.createElement("td");
    tdCount.textContent = numberOfSpots;
    const tdIds = document.createElement("td");
    tdIds.textContent = spotIds;

    tr.appendChild(tdName);
    tr.appendChild(tdId);
    tr.appendChild(tdCount);
    tr.appendChild(tdIds);

    zonesTableBody.appendChild(tr);

    // highlight on hover
    tr.addEventListener("mouseover", () => highlightZone(zoneId));
    tr.addEventListener("mouseout", () => removeHighlightZone(zoneId));

    // Update counters after adding a new zone
    updateCounters();
  }

  // -------------------------------
  // Download Excel of Spot and Zone IDs
  // -------------------------------

  document
    .getElementById("exportIdsBtn")
    .addEventListener("click", exportIdsToExcel);

  async function exportIdsToExcel() {
    // 1) Gather data

    // (A) Facility ID
    const facilityID = parseInt(facilityNumberInput.value) || 1;

    // (B) Lost Box ID
    const lostBox = document.querySelector("g.lostTrailer");
    const lostBoxSpotId = lostBox ? lostBox.getAttribute("data-spot-id") : "";

    // (C) Build zoneData object
    const zoneData = {};

    // Collect all droppable spots, skipping the Lost Box
    const allSpots = document.querySelectorAll("g.eagleViewDropSpot");

    allSpots.forEach((spot) => {
      // If this is the lost trailer, skip it entirely so we don't get "Zone null"
      // or any unneeded extra sheet
      if (spot.classList.contains("lostTrailer")) {
        return;
      }

      // For everything else, read zone ID and name
      const zId = spot.getAttribute("data-zone-id");
      if (!zId || zId === "null") {
        // If there's no valid zone ID, skip so we don't create "Zone null" sheets
        return;
      }

      const zName = spot.getAttribute("data-zone-name") || "Zone " + zId;

      // For the Spot ID, we might store it as a number if it parses
      let sId = spot.getAttribute("data-spot-id");

      if (!zoneData[zId]) {
        zoneData[zId] = {
          name: zName,
          spotIds: [],
          isDock: false,
        };
      }
      zoneData[zId].spotIds.push(sId);

      // Detect dock if triangles
      const hasLoadingTriangle = spot.querySelector(".loading_triangle");
      const hasUnloadingTriangle = spot.querySelector(".unloading_triangle");
      if (hasLoadingTriangle || hasUnloadingTriangle) {
        zoneData[zId].isDock = true;
      }
    });

    // 2) Build Excel workbook
    const workbook = new ExcelJS.Workbook();

    // -- (Sheet 1) Summary
    const summarySheet = workbook.addWorksheet("Summary");

    // Bold the top row after we add it
    let row = summarySheet.addRow(["Facility ID", facilityID]);
    row.eachCell((cell) => (cell.font = { bold: true }));
    // Next row
    row = summarySheet.addRow(["Lost Box Spot ID", lostBoxSpotId]);
    row.eachCell((cell) => (cell.font = { bold: true }));

    // Blank line
    summarySheet.addRow([]);

    // Now the summary table header
    let headerRow = summarySheet.addRow(["Zone Name", "Zone ID"]);
    headerRow.eachCell((cell) => (cell.font = { bold: true }));

    // Populate zone list
    Object.keys(zoneData).forEach((zId) => {
      const zInfo = zoneData[zId];
      // Try to parse zone ID as number
      let numericZId = parseInt(zId, 10);
      if (Number.isNaN(numericZId)) {
        numericZId = zId; // keep it as text if it won't parse
      }
      summarySheet.addRow([zInfo.name, numericZId]);
    });

    // -- (Sheet 2+) One sheet per zone
    Object.keys(zoneData).forEach((zId) => {
      const zInfo = zoneData[zId];

      // Make a "safe" sheet name:
      //  - remove invalid chars: :\/?*[]
      //  - limit to 31 chars
      let safeSheetName = zInfo.name.replace(/[:\\\/\?\*\[\]]/g, "");
      safeSheetName = safeSheetName.substring(0, 31) || "Zone_" + zId;

      const sheet = workbook.addWorksheet(safeSheetName);

      // Add a header row with bold text
      const zHeaderRow = sheet.addRow(["Spot IDs", "Docks?"]);
      zHeaderRow.eachCell((cell) => (cell.font = { bold: true }));

      // For each spot ID in this zone
      zInfo.spotIds.forEach((spotId) => {
        // Attempt to store spot ID as number
        let numericSpotId = parseInt(spotId, 10);
        if (Number.isNaN(numericSpotId)) {
          numericSpotId = spotId; // fallback to string if not purely numeric
        }

        sheet.addRow([numericSpotId, zInfo.isDock ? "Yes" : "No"]);
      });
    });

    // 3) Download as YardIDs.xlsx
    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "YardIDs.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export IDs failed:", err);
      alert("Failed to export IDs to Excel. Check console for error details.");
    }
  }

  // -------------------------------
  // DRAG & RESIZE
  // -------------------------------
  let currentElement = null;
  let offsetX = 0;
  let offsetY = 0;
  let startWidth = 0;
  let startHeight = 0;
  let startMouseX = 0;
  let startMouseY = 0;
  let isResizing = false;

  canvasSVG.addEventListener("mousedown", (e) => {
    if (e.target.closest("#rotateBtn")) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    const target = e.target;
    const group = target.closest('g[data-type="draggable"]');
    const additive = e.shiftKey || e.metaKey;

    rotateBtn.classList.remove("show");

    if (!group) {
      // Start marquee selection
      if (!additive) {
        clearSelection();
      }
      isSelecting = true;
      selectStartX = e.clientX;
      selectStartY = e.clientY;
      marqueeEl = document.createElement("div");
      marqueeEl.className = "marquee";
      marqueeEl.style.left = selectStartX + "px";
      marqueeEl.style.top = selectStartY + "px";
      document.body.appendChild(marqueeEl);
      e.preventDefault();
      return;
    }

    const [oldX, oldY] = getTranslation(group);
    const oldW = parseFloat(group.getAttribute("data-w")) || 0;
    const oldH = parseFloat(group.getAttribute("data-h")) || 0;

    if (target.hasAttribute("data-resize")) {
      // Resize
      if (!selectedElements.has(group)) {
        setSelection([group]);
      }
      isResizing = true;
      currentElement = group;
      startWidth = oldW;
      startHeight = oldH;
      startMouseX = e.clientX;
      startMouseY = e.clientY;

      group.__undoData = {
        type: "resize",
        oldW: oldW,
        oldH: oldH,
      };

      e.preventDefault();
      return;
    }

    // Otherwise, drag or additive selection
    if (additive) {
      if (selectedElements.has(group)) {
        selectedElements.delete(group);
        group.classList.remove("selected");
        updateSelectionIndicators();
      } else {
        addToSelection(group);
      }
      e.preventDefault();
      return;
    }

    if (!selectedElements.has(group)) {
      setSelection([group]);
    }

    isResizing = false;
    currentElement = group;

    selectedElements.forEach((el) => {
      const [sx, sy] = getTranslation(el);
      dragStartMap.set(el, { startX: sx, startY: sy });
      el.__undoData = { type: "move", oldX: sx, oldY: sy };
    });

    offsetX = e.clientX - oldX * currentScale;
    offsetY = e.clientY - oldY * currentScale;

    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (isSelecting) {
      const x1 = Math.min(selectStartX, e.clientX);
      const y1 = Math.min(selectStartY, e.clientY);
      const x2 = Math.max(selectStartX, e.clientX);
      const y2 = Math.max(selectStartY, e.clientY);
      marqueeEl.style.left = x1 + "px";
      marqueeEl.style.top = y1 + "px";
      marqueeEl.style.width = x2 - x1 + "px";
      marqueeEl.style.height = y2 - y1 + "px";
      return;
    }

    if (!currentElement) return;
    e.preventDefault();

    if (isResizing) {
      const isLabel = !!currentElement.querySelector(
        '[data-role="main"].label-text',
      );
      if (isLabel) {
        // No resizing for labels
        return;
      }

      let dx = (e.clientX - startMouseX) / currentScale;
      let dy = (e.clientY - startMouseY) / currentScale;
      let newW = startWidth + dx;
      let newH = startHeight + dy;

      if (snapToGrid) {
        const gridSize = 20;
        newW = Math.round(newW / gridSize) * gridSize;
        newH = Math.round(newH / gridSize) * gridSize;
      }
      if (newW < 10) newW = 10;
      if (newH < 10) newH = 10;

      // Maintain aspect ratio if guard shack
      if (currentElement.getAttribute("data-guard") === "yes") {
        const aspect = startWidth / startHeight;
        if (Math.abs(dx) > Math.abs(dy)) {
          newH = newW / aspect;
        } else {
          newW = newH * aspect;
        }
      }
      updateElementSize(currentElement, newW, newH);
    } else {
      let x = (e.clientX - offsetX) / currentScale;
      let y = (e.clientY - offsetY) / currentScale;
      if (snapToGrid) {
        const gridSize = 20;
        x = Math.round(x / gridSize) * gridSize;
        y = Math.round(y / gridSize) * gridSize;
      }
      const maxX =
        currentScale < 1 ? baseWidth / currentScale - 10 : baseWidth - 10;
      const maxY =
        currentScale < 1 ? baseHeight / currentScale - 10 : baseHeight - 10;
      x = Math.max(0, Math.min(x, maxX));
      y = Math.max(0, Math.min(y, maxY));

      if (magnetizeEnabled) {
        [x, y] = magnetizePosition(currentElement, x, y);
      }

      const start = dragStartMap.get(currentElement);
      const dx = x - start.startX;
      const dy = y - start.startY;
      selectedElements.forEach((el) => {
        const info = dragStartMap.get(el);
        if (!info) return;
        let nx = info.startX + dx;
        let ny = info.startY + dy;
        el.setAttribute("transform", `translate(${nx},${ny})`);
      });
      checkTrashHover(currentElement);
    }
  });

  document.addEventListener("mouseup", (e) => {
    if (isSelecting) {
      if (marqueeEl && marqueeEl.parentNode) {
        marqueeEl.parentNode.removeChild(marqueeEl);
      }
      const rect = {
        left: Math.min(selectStartX, e.clientX),
        top: Math.min(selectStartY, e.clientY),
        right: Math.max(selectStartX, e.clientX),
        bottom: Math.max(selectStartY, e.clientY),
      };
      const elements = [];
      if (
        Math.abs(rect.right - rect.left) > 3 &&
        Math.abs(rect.bottom - rect.top) > 3
      ) {
        canvasSVG.querySelectorAll('g[data-type="draggable"]').forEach((el) => {
          const box = getGlobalBox(el);
          if (rectOverlap(box, rect)) {
            elements.push(el);
          }
        });
      }
      setSelection(elements);
      isSelecting = false;
      return;
    }

    if (!currentElement) {
      return;
    }
    if (!isResizing) {
      const trashOpen = trashImg.src.indexOf("jxXQYYR.png") !== -1;
      let deleteAll = false;
      if (trashOpen) {
        const currRect = getGlobalBox(currentElement);
        const trashRect = trashCan.getBoundingClientRect();
        if (rectOverlap(currRect, trashRect)) {
          deleteAll = true;
        }
      }

      const allSelected = Array.from(selectedElements);
      if (deleteAll && allSelected.length > 1) {
        allSelected.forEach((el) => {
          if (el === currentElement) {
            finalizeTrashCheck(el);
          } else {
            deleteGroupDirect(el);
          }
        });
      } else {
        allSelected.forEach((el) => finalizeTrashCheck(el));
      }
    }

    selectedElements.forEach((el) => {
      const stillInDOM = canvasSVG.contains(el);
      if (!stillInDOM) return;

      const [newX, newY] = getTranslation(el);
      const newW = parseFloat(el.getAttribute("data-w")) || 0;
      const newH = parseFloat(el.getAttribute("data-h")) || 0;

      const undoData = el.__undoData;
      if (undoData) {
        if (undoData.type === "move") {
          pushUndoAction({
            type: "move",
            element: el,
            oldX: undoData.oldX,
            oldY: undoData.oldY,
            newX: newX,
            newY: newY,
          });
        } else if (undoData.type === "resize" && el === currentElement) {
          pushUndoAction({
            type: "resize",
            element: el,
            oldWidth: undoData.oldW,
            oldHeight: undoData.oldH,
            newWidth: newW,
            newHeight: newH,
          });
        }
        delete el.__undoData;
      }
    });

    currentElement = null;
    isResizing = false;
    dragStartMap.clear();
    updateRotateButton();
  });

  function getTranslation(g) {
    const transform = g.getAttribute("transform") || "";
    const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
    if (match) {
      return [parseFloat(match[1]), parseFloat(match[2])];
    }
    return [0, 0];
  }

  function updateElementSize(group, w, h) {
    group.setAttribute("data-w", w);
    group.setAttribute("data-h", h);

    const mainRect = group.querySelector('rect[data-role="main"]');
    const mainImage = group.querySelector('image[data-role="main"]');
    if (mainRect) {
      mainRect.setAttribute("width", w);
      mainRect.setAttribute("height", h);
    }
    if (mainImage) {
      mainImage.setAttribute("width", w);
      mainImage.setAttribute("height", h);
    }

    const corner = group.querySelector('rect[data-resize="corner"]');
    if (corner) {
      corner.setAttribute("x", w - 12);
      corner.setAttribute("y", h - 12);
    }

    const hitbox = group.querySelector('rect[data-role="hitbox"]');
    if (hitbox) {
      hitbox.setAttribute("width", w);
      hitbox.setAttribute("height", h);
    }
  }

  function checkTrashHover(group) {
    if (hideTrash) return;
    const groupRect = getGlobalBox(group);
    const trashRect = trashCan.getBoundingClientRect();
    if (rectOverlap(groupRect, trashRect)) {
      if (trashImg.src !== "https://i.imgur.com/jxXQYYR.png") {
        trashImg.src = "https://i.imgur.com/jxXQYYR.png"; // open
      }
    } else {
      if (trashImg.src !== "https://i.imgur.com/PXejZqX.png") {
        trashImg.src = "https://i.imgur.com/PXejZqX.png"; // closed
      }
    }
  }
  function finalizeTrashCheck(group) {
    if (hideTrash) return;
    // Only if the trash can is open
    if (trashImg.src.indexOf("jxXQYYR.png") === -1) return;

    const groupRect = getGlobalBox(group);
    const trashRect = trashCan.getBoundingClientRect();
    if (rectOverlap(groupRect, trashRect)) {
      // Prevent the Lost Box from being trashed
      if (group.classList.contains("lostTrailer")) {
        trashImg.src = "https://i.imgur.com/PXejZqX.png"; // closed
        return;
      }
      animateTrash();
      createPuff();

      // -- 1) Capture necessary data for undo
      const parent = group.parentNode;
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(group);
      const clonedGroup = group.cloneNode(true); // Deep clone
      const [tx, ty] = getTranslation(group);
      const originalX = group.__undoData ? group.__undoData.oldX : tx;
      const originalY = group.__undoData ? group.__undoData.oldY : ty;

      // -- 2) Push delete action to undoStack
      pushUndoAction({
        type: "delete",
        element: clonedGroup,
        parent: parent,
        index: index,
        oldX: originalX,
        oldY: originalY,
      });

      // -- 3) Remove the group from the DOM
      group.remove();
      selectedElements.delete(group);
      updateSelectionIndicators();

      // -- 4) Rebuild the Zones List so the row is removed or updated:
      rebuildZonesTable();

      // Update counters after deletion
      updateCounters();

      ensureLostBoxOnTop();
      rebuildLayersList();

      trashImg.src = "https://i.imgur.com/PXejZqX.png"; // closed
    }
  }

  function deleteGroupDirect(group) {
    if (!group || group.classList.contains("lostTrailer")) return;
    const parent = group.parentNode;
    if (!parent) return;
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(group);
    const clonedGroup = group.cloneNode(true);
    const [tx, ty] = getTranslation(group);
    const originalX = group.__undoData ? group.__undoData.oldX : tx;
    const originalY = group.__undoData ? group.__undoData.oldY : ty;

    pushUndoAction({
      type: "delete",
      element: clonedGroup,
      parent: parent,
      index: index,
      oldX: originalX,
      oldY: originalY,
    });

    group.remove();
    selectedElements.delete(group);
    updateSelectionIndicators();
    rebuildZonesTable();
    updateCounters();
  }

  function animateTrash() {
    trashCan.classList.add("vibrate");
    setTimeout(() => {
      trashCan.classList.remove("vibrate");
    }, 300);
  }
  function createPuff() {
    const trashRect = trashCan.getBoundingClientRect();
    const puff = document.createElement("div");
    puff.className = "puff-overlay fade-out";
    puff.style.left = trashRect.left + window.scrollX + "px";
    puff.style.top = trashRect.top - 10 + window.scrollY + "px";
    puff.textContent = "💨";
    document.body.appendChild(puff);
    setTimeout(() => {
      document.body.removeChild(puff);
    }, 800);
  }

  function showDeleteConfirm(onYes) {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    const box = document.createElement("div");
    box.className = "confirm-box";
    box.innerHTML =
      '<p>Are you sure you want to delete this element?</p><div class="confirm-buttons"><button id="confirmYes">Yes</button><button id="confirmNo">No</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.querySelector("#confirmYes").addEventListener("click", () => {
      document.body.removeChild(overlay);
      onYes();
    });
    overlay.querySelector("#confirmNo").addEventListener("click", () => {
      document.body.removeChild(overlay);
    });
  }

  function showTrashInstruction() {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    const box = document.createElement("div");
    box.className = "confirm-box";
    box.innerHTML =
      '<p>Drag an item to the trash can to delete it</p><div class="confirm-buttons"><button id="trashOk">OK</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.querySelector("#trashOk").addEventListener("click", () => {
      document.body.removeChild(overlay);
    });
  }
  function rectOverlap(r1, r2) {
    return !(
      r2.left > r1.right ||
      r2.right < r1.left ||
      r2.top > r1.bottom ||
      r2.bottom < r1.top
    );
  }
  function getGlobalBox(group) {
    const bbox = group.getBBox();
    const ctm = group.getScreenCTM();
    const p1 = svgPoint(bbox.x, bbox.y, ctm);
    const p2 = svgPoint(bbox.x + bbox.width, bbox.y + bbox.height, ctm);
    return {
      left: Math.min(p1.x, p2.x),
      top: Math.min(p1.y, p2.y),
      right: Math.max(p1.x, p2.x),
      bottom: Math.max(p1.y, p2.y),
    };
  }
  function svgPoint(x, y, matrix) {
    const pt = canvasSVG.createSVGPoint();
    pt.x = x;
    pt.y = y;
    const transformed = pt.matrixTransform(matrix);
    return { x: transformed.x, y: transformed.y };
  }

  // -------------------------------
  // ADD SPOTS / DOCK DOORS
  // -------------------------------
  document.getElementById("addYardSpotsBtn").addEventListener("click", () => {
    const zoneName = document.getElementById("yardSpotZoneName").value.trim();
    if (!zoneName) {
      alert("Please input a Zone Name");
      return;
    }
    const count =
      parseInt(document.getElementById("yardSpotCount").value, 10) || 1;
    const orientation = document.getElementById("yardSpotOrientation").value;
    const showNumbers = document.getElementById("yardSpotShowNumbers").value;
    const labelRotation = document.getElementById(
      "yardSpotLabelRotation",
    ).value;

    let startNumber = 1;
    let prefixSuffixEnabled = false;
    let prefix = "";
    let suffix = "";
    let labelLocation = "left";
    let numberDirection = "ttb";

    if (showNumbers === "yes") {
      startNumber =
        parseInt(document.getElementById("yardSpotStartNumber").value, 10) || 1;
      prefixSuffixEnabled = yardSpotPrefixSuffixDropdown.value === "yes";
      prefix = prefixSuffixEnabled
        ? document.getElementById("yardSpotPrefix").value
        : "";
      suffix = prefixSuffixEnabled
        ? document.getElementById("yardSpotSuffix").value
        : "";
      labelLocation = document.getElementById("yardSpotLabelLocation").value;
      numberDirection = document.getElementById(
        "yardSpotNumberDirection",
      ).value;
    }

    const zoneId = getZoneId(zoneName);
    createLineBasedSpots({
      count,
      orientation,
      showNumbers,
      startNumber,
      prefix,
      suffix,
      prefixSuffixEnabled,
      labelLocation,
      numberDirection,
      labelRotation,
      zoneName,
      isDockDoor: false,
      zoneId,
    });

    addZoneToTable(zoneName, zoneId);
  });

  document.getElementById("addDockDoorsBtn").addEventListener("click", () => {
    const zoneName = document.getElementById("dockDoorZoneName").value.trim();
    if (!zoneName) {
      alert("Please input a Zone Name");
      return;
    }
    const count =
      parseInt(document.getElementById("dockDoorCount").value, 10) || 1;
    const orientation = document.getElementById("dockDoorOrientation").value;
    const showNumbers = document.getElementById("dockDoorShowNumbers").value;
    const labelRotation = document.getElementById(
      "dockDoorLabelRotation",
    ).value;

    let startNumber = 1;
    let prefixSuffixEnabled = false;
    let prefix = "";
    let suffix = "";
    let labelLocation = "left";
    let numberDirection = "ttb";

    if (showNumbers === "yes") {
      startNumber =
        parseInt(document.getElementById("dockDoorStartNumber").value, 10) || 1;
      prefixSuffixEnabled = dockDoorPrefixSuffixDropdown.value === "yes";
      prefix = prefixSuffixEnabled
        ? document.getElementById("dockDoorPrefix").value
        : "";
      suffix = prefixSuffixEnabled
        ? document.getElementById("dockDoorSuffix").value
        : "";
      labelLocation = document.getElementById("dockDoorLabelLocation").value;
      numberDirection = document.getElementById(
        "dockDoorNumberDirection",
      ).value;
    }

    const zoneId = getZoneId(zoneName);
    createLineBasedSpots({
      count,
      orientation,
      showNumbers,
      startNumber,
      prefix,
      suffix,
      prefixSuffixEnabled,
      labelLocation,
      numberDirection,
      labelRotation,
      zoneName,
      isDockDoor: true,
      zoneId,
    });

    addZoneToTable(zoneName, zoneId);
    updateCounters();
  });

  function buildNumberingArray(opts) {
    const arr = [];
    for (let i = 0; i < opts.count; i++) {
      arr.push(opts.startNumber + i);
    }
    if (opts.orientation === "vertical" && opts.numberDirection === "rtl") {
      arr.reverse();
    } else if (
      opts.orientation === "horizontal" &&
      opts.numberDirection === "btt"
    ) {
      arr.reverse();
    }
    return arr.map((num) => {
      if (!opts.prefixSuffixEnabled) return String(num);
      return opts.prefix + num + opts.suffix;
    });
  }

  function createLineBasedSpots(opts) {
    const zoneId = opts.zoneId;
    const numberingArray =
      opts.showNumbers === "yes"
        ? buildNumberingArray(opts)
        : new Array(opts.count).fill("");

    const container = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    container.setAttribute("data-type", "draggable");
    container.setAttribute("transform", "translate(10,10)");
    container.setAttribute("style", "cursor: move;");
    container.setAttribute("data-w", "0");
    container.setAttribute("data-h", "0");
    container.setAttribute("data-zone-id", zoneId);
    container.setAttribute("data-zone-name", opts.zoneName);
    container.setAttribute("data-orientation", opts.orientation);

    let totalW = 0,
      totalH = 0;
    let offsetX = 0,
      offsetY = 0;
    const spotW = opts.orientation === "horizontal" ? 50.8 : 11.1;
    const spotH = opts.orientation === "horizontal" ? 11.1 : 50.8;

    numberingArray.forEach((lbl, index) => {
      if (opts.orientation === "vertical") {
        const lineLeft = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line",
        );
        lineLeft.setAttribute("x1", offsetX);
        lineLeft.setAttribute("y1", 0);
        lineLeft.setAttribute("x2", offsetX);
        lineLeft.setAttribute("y2", spotH);
        lineLeft.setAttribute("stroke", "#fff");
        lineLeft.setAttribute("stroke-width", "1.2");
        lineLeft.setAttribute("pointer-events", "none");
        container.appendChild(lineLeft);

        if (index === numberingArray.length - 1) {
          const lineRight = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line",
          );
          lineRight.setAttribute("x1", offsetX + spotW);
          lineRight.setAttribute("y1", 0);
          lineRight.setAttribute("x2", offsetX + spotW);
          lineRight.setAttribute("y2", spotH);
          lineRight.setAttribute("stroke", "#fff");
          lineRight.setAttribute("stroke-width", "1.2");
          lineRight.setAttribute("pointer-events", "none");
          container.appendChild(lineRight);
        }
        if (opts.showNumbers === "yes" && lbl) {
          const text = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
          );
          text.setAttribute("class", "spot-label");
          text.textContent = lbl;
          text.setAttribute("pointer-events", "none");
          positionLabel(
            text,
            opts.orientation,
            opts.labelLocation,
            spotW,
            spotH,
            offsetX,
            0,
            lbl,
            opts.labelRotation,
          );
          container.appendChild(text);
        }

        const spotGroup = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "g",
        );
        spotGroup.setAttribute("class", "droppable eagleViewDropSpot");
        spotGroup.setAttribute("data-zone-name", opts.zoneName);
        spotGroup.setAttribute("data-zone-id", zoneId);

        // (1) Get the next sequence
        const seq = getNextSpotSequence();
        spotGroup.setAttribute("data-sequence", seq);

        // (2) Build the actual spot ID from facilityId + sequence
        const spotId = buildSpotId(facilityId, seq);
        spotGroup.setAttribute("data-spot-id", spotId);

        const spotRect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        spotRect.setAttribute("x", offsetX);
        spotRect.setAttribute("y", 0);
        spotRect.setAttribute("width", spotW);
        spotRect.setAttribute("height", spotH);
        spotRect.setAttribute("fill", "transparent");
        spotRect.setAttribute("pointer-events", "none");
        spotGroup.appendChild(spotRect);

        if (opts.isDockDoor) {
          addDockTriangles(
            spotGroup,
            spotId,
            offsetX,
            0,
            spotW,
            spotH,
            opts.labelLocation,
            opts.orientation,
          );
        }
        container.appendChild(spotGroup);
        offsetX += spotW;
      } else {
        const lineTop = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line",
        );
        lineTop.setAttribute("x1", 0);
        lineTop.setAttribute("y1", offsetY);
        lineTop.setAttribute("x2", spotW);
        lineTop.setAttribute("y2", offsetY);
        lineTop.setAttribute("stroke", "#fff");
        lineTop.setAttribute("stroke-width", "1.2");
        lineTop.setAttribute("pointer-events", "none");
        container.appendChild(lineTop);

        if (index === numberingArray.length - 1) {
          const lineBottom = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line",
          );
          lineBottom.setAttribute("x1", 0);
          lineBottom.setAttribute("y1", offsetY + spotH);
          lineBottom.setAttribute("x2", spotW);
          lineBottom.setAttribute("y2", offsetY + spotH);
          lineBottom.setAttribute("stroke", "#fff");
          lineBottom.setAttribute("stroke-width", "1.2");
          lineBottom.setAttribute("pointer-events", "none");
          container.appendChild(lineBottom);
        }
        if (opts.showNumbers === "yes" && lbl) {
          const text = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
          );
          text.setAttribute("class", "spot-label");
          text.textContent = lbl;
          text.setAttribute("pointer-events", "none");
          positionLabel(
            text,
            opts.orientation,
            opts.labelLocation,
            spotW,
            spotH,
            0,
            offsetY,
            lbl,
            opts.labelRotation,
          );
          container.appendChild(text);
        }

        const spotGroup = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "g",
        );
        spotGroup.setAttribute("class", "droppable eagleViewDropSpot");
        spotGroup.setAttribute("data-zone-name", opts.zoneName);
        spotGroup.setAttribute("data-zone-id", zoneId);

        // (1) Get the next sequence
        const seq = getNextSpotSequence();
        spotGroup.setAttribute("data-sequence", seq);

        // (2) Build the actual spot ID from facilityId + sequence
        const spotId = buildSpotId(facilityId, seq);
        spotGroup.setAttribute("data-spot-id", spotId);

        const spotRect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        spotRect.setAttribute("x", 0);
        spotRect.setAttribute("y", offsetY);
        spotRect.setAttribute("width", spotW);
        spotRect.setAttribute("height", spotH);
        spotRect.setAttribute("fill", "transparent");
        spotRect.setAttribute("pointer-events", "none");
        spotGroup.appendChild(spotRect);

        if (opts.isDockDoor) {
          addDockTriangles(
            spotGroup,
            spotId,
            0,
            offsetY,
            spotW,
            spotH,
            opts.labelLocation,
            opts.orientation,
          );
        }
        container.appendChild(spotGroup);
        offsetY += spotH;
      }
    });

    if (opts.orientation === "horizontal") {
      totalW = spotW;
      totalH = opts.count * spotH;
    } else {
      totalW = opts.count * spotW;
      totalH = spotH;
    }

    container.setAttribute("data-w", totalW);
    container.setAttribute("data-h", totalH);

    const containerHitbox = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    containerHitbox.setAttribute("data-role", "hitbox");
    containerHitbox.setAttribute("width", totalW);
    containerHitbox.setAttribute("height", totalH);
    containerHitbox.setAttribute("fill", "transparent");
    containerHitbox.setAttribute("pointer-events", "fill");
    container.insertBefore(containerHitbox, container.firstChild);

    document.getElementById("scalableContent").appendChild(container);
    assignLayerId(container);
    rebuildLayersList();
  }

  function addDockTriangles(
    spotGroup,
    spotId,
    x,
    y,
    w,
    h,
    labelLocation,
    orientation,
  ) {
    let side;
    if (labelLocation === "left") side = "right";
    else if (labelLocation === "right") side = "left";
    else if (labelLocation === "top") side = "bottom";
    else side = "top";

    const unloadingPoly = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon",
    );
    unloadingPoly.setAttribute("data-unloading-id", spotId);
    unloadingPoly.setAttribute("class", "unloading_triangle");
    unloadingPoly.setAttribute("fill", "#30C230");
    unloadingPoly.setAttribute("style", "display:none;");
    unloadingPoly.setAttribute(
      "points",
      getTrianglePoints(side, false, x, y, w, h),
    );

    const loadingPoly = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon",
    );
    loadingPoly.setAttribute("data-loading-id", spotId);
    loadingPoly.setAttribute("class", "loading_triangle");
    loadingPoly.setAttribute("fill", "#FFA500");
    loadingPoly.setAttribute("style", "display:none;");
    loadingPoly.setAttribute(
      "points",
      getTrianglePoints(side, true, x, y, w, h),
    );

    spotGroup.appendChild(unloadingPoly);
    spotGroup.appendChild(loadingPoly);
  }

  function getTrianglePoints(side, isLoading, x, y, w, h) {
    const size = 7;
    const half = size / 2;
    const shift = 8 + half;
    const cx = x + w / 2;
    const cy = y + h / 2;
    let p1, p2, p3;

    switch (side) {
      case "left":
        {
          const cxSide = x - shift;
          if (isLoading) {
            p1 = [cxSide + half, cy];
            p2 = [cxSide - half, cy - half];
            p3 = [cxSide - half, cy + half];
          } else {
            p1 = [cxSide - half, cy];
            p2 = [cxSide + half, cy - half];
            p3 = [cxSide + half, cy + half];
          }
        }
        break;
      case "right":
        {
          const cxSide = x + w + shift;
          if (isLoading) {
            p1 = [cxSide - half, cy];
            p2 = [cxSide + half, cy - half];
            p3 = [cxSide + half, cy + half];
          } else {
            p1 = [cxSide + half, cy];
            p2 = [cxSide - half, cy - half];
            p3 = [cxSide - half, cy + half];
          }
        }
        break;
      case "top":
        {
          const cySide = y - shift;
          if (isLoading) {
            p1 = [cx, cySide + half];
            p2 = [cx - half, cySide - half];
            p3 = [cx + half, cySide - half];
          } else {
            p1 = [cx, cySide - half];
            p2 = [cx - half, cySide + half];
            p3 = [cx + half, cySide + half];
          }
        }
        break;
      default:
        {
          const cySide = y + h + shift;
          if (isLoading) {
            p1 = [cx, cySide - half];
            p2 = [cx - half, cySide + half];
            p3 = [cx + half, cySide + half];
          } else {
            p1 = [cx, cySide + half];
            p2 = [cx - half, cySide - half];
            p3 = [cx + half, cySide - half];
          }
        }
        break;
    }
    return `${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`;
  }

  // -------------------------------
  // positionLabel()
  // -------------------------------
  function positionLabel(
    label,
    orientation,
    labelLocation,
    w,
    h,
    offsetX,
    offsetY,
    labelText,
    rotationMode,
  ) {
    let shouldRotate = false;
    if (rotationMode === "90") {
      shouldRotate = true;
    } else if (rotationMode === "dynamic") {
      if (orientation === "vertical" && labelText && labelText.length >= 3) {
        shouldRotate = true;
      }
    }

    if (!shouldRotate) {
      if (orientation === "vertical") {
        if (labelLocation === "top") {
          label.setAttribute("x", offsetX + w / 2);
          label.setAttribute("y", -4);
          label.setAttribute("text-anchor", "middle");
          label.setAttribute("dominant-baseline", "baseline");
        } else {
          label.setAttribute("x", offsetX + w / 2);
          label.setAttribute("y", h + 4);
          label.setAttribute("text-anchor", "middle");
          label.setAttribute("dominant-baseline", "hanging");
        }
      } else {
        if (labelLocation === "left") {
          label.setAttribute("x", -4);
          label.setAttribute("y", offsetY + h / 2);
          label.setAttribute("text-anchor", "end");
          label.setAttribute("dominant-baseline", "middle");
        } else {
          label.setAttribute("x", w + 4);
          label.setAttribute("y", offsetY + h / 2);
          label.setAttribute("dominant-baseline", "middle");
        }
      }
    } else {
      const baseOffset = 0;
      const pxPerChar = 2;
      const totalWidth = labelText.length * pxPerChar;
      const offset = baseOffset + totalWidth + 4;
      const centerX = offsetX + w / 2 + 1;
      let transformY = 0;
      if (labelLocation === "top") {
        transformY = -offset;
      } else {
        transformY = h + offset;
      }
      label.setAttribute(
        "transform",
        `translate(${centerX}, ${transformY}) rotate(-90)`,
      );
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "middle");
      label.setAttribute("x", 0);
      label.setAttribute("y", 0);
    }
  }

  // -------------------------------
  // CREATE OTHER ELEMENTS (including Custom Image)
  // -------------------------------
  document
    .getElementById("addOtherElementBtn")
    .addEventListener("click", () => {
      const type = otherElementType.value;
      const labelTxt = otherElementLabel.value || "Label";
      const fontSize = labelFontSizeRange.value;
      const fontColor = labelColorSelect.value;

      if (type === "custom_image") {
        if (!customImageData) {
          alert(
            "No image selected or invalid file. Please select a valid JPG, PNG, or SVG.",
          );
          return;
        }
        createCustomImageElement(customImageData);
        customImagePreview.style.display = "none";
        customImagePreview.src = "";
        selectImageBtn.disabled = false;
        customImageData = null;
        return;
      }

      if (type === "label") {
        createLabelElement(labelTxt, fontSize, fontColor);
        return;
      }

      const w = +otherElementWidth.value || 50;
      const h = +otherElementHeight.value || 50;
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("data-type", "draggable");
      group.setAttribute("transform", "translate(10,10)");
      group.setAttribute("data-w", w);
      group.setAttribute("data-h", h);

      const hitbox = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      hitbox.setAttribute("data-role", "hitbox");
      hitbox.setAttribute("width", w);
      hitbox.setAttribute("height", h);
      hitbox.setAttribute("fill", "transparent");
      hitbox.setAttribute("pointer-events", "fill");
      group.appendChild(hitbox);

      if (type === "guard_shack") {
        const img = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "image",
        );
        img.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "xlink:href",
          "https://i.imgur.com/cFQFq2L.png",
        );
        img.setAttribute("crossorigin", "anonymous");
        img.setAttribute("data-role", "main");
        img.setAttribute("data-guard", "yes");
        img.setAttribute("width", w);
        img.setAttribute("height", h);
        img.setAttribute("pointer-events", "none");
        group.appendChild(img);
        addResizeCorner(group, w, h);
      } else {
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect.setAttribute("data-role", "main");
        rect.setAttribute("width", w);
        rect.setAttribute("height", h);
        rect.setAttribute("pointer-events", "none");
        if (type === "grass") {
          rect.setAttribute("fill", "#63954B");
        } else if (type === "building") {
          rect.setAttribute("fill", "#fff");
        } else if (type === "pavement") {
          rect.setAttribute("fill", "#A1A3A5");
        }
        group.appendChild(rect);
        addResizeCorner(group, w, h);
      }

      document.getElementById("scalableContent").appendChild(group);
      assignLayerId(group);
      rebuildLayersList();
    });

  // Dynamically measure text so large labels get a bigger hitbox
  function measureTextSize(text, fontSize) {
    const tempSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    const tempText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    tempText.setAttribute("font-size", fontSize + "px");
    tempText.setAttribute("font-family", "Helvetica, sans-serif");
    tempText.textContent = text;
    tempSvg.appendChild(tempText);
    document.body.appendChild(tempSvg);
    const bbox = tempText.getBBox();
    document.body.removeChild(tempSvg);
    return { width: bbox.width, height: bbox.height };
  }

  function createLabelElement(text, fontSize, fontColor) {
    // Measure the text so we can set a draggable hitbox that matches.
    const { width, height } = measureTextSize(text, fontSize);

    // Add some margin
    const margin = 10;
    const totalW = width + margin;
    const totalH = height + margin;

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("data-type", "draggable");
    group.setAttribute("transform", "translate(10,10)");
    group.setAttribute("data-w", totalW);
    group.setAttribute("data-h", totalH);

    // Hitbox
    const hitbox = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    hitbox.setAttribute("data-role", "hitbox");
    hitbox.setAttribute("width", totalW);
    hitbox.setAttribute("height", totalH);
    hitbox.setAttribute("fill", "transparent");
    hitbox.setAttribute("pointer-events", "fill");
    group.appendChild(hitbox);

    // Actual text
    const textEl = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    textEl.setAttribute("class", "label-text");
    textEl.setAttribute("data-role", "main");
    textEl.textContent = text;
    // Center the text in the bounding box
    const centerX = totalW / 2;
    const centerY = totalH / 2;
    textEl.setAttribute("x", centerX);
    textEl.setAttribute("y", centerY);
    textEl.setAttribute("text-anchor", "middle");
    textEl.setAttribute("dominant-baseline", "middle");
    textEl.setAttribute("pointer-events", "none");

    // Apply chosen size/color
    textEl.setAttribute("font-size", fontSize + "px");
    textEl.setAttribute("fill", fontColor);

    group.appendChild(textEl);

    // No resize corner for label
    document.getElementById("scalableContent").appendChild(group);
    assignLayerId(group);
    rebuildLayersList();
  }

  function createCustomImageElement(imageData) {
    const defaultWidth = 100;
    const defaultHeight = 100;

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("data-type", "draggable");
    group.setAttribute("transform", "translate(10,10)");
    group.setAttribute("data-w", defaultWidth);
    group.setAttribute("data-h", defaultHeight);

    const hitbox = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    hitbox.setAttribute("data-role", "hitbox");
    hitbox.setAttribute("width", defaultWidth);
    hitbox.setAttribute("height", defaultHeight);
    hitbox.setAttribute("fill", "transparent");
    hitbox.setAttribute("pointer-events", "fill");
    group.appendChild(hitbox);

    const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
    img.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", imageData);
    img.setAttribute("data-role", "main");
    img.setAttribute("width", defaultWidth);
    img.setAttribute("height", defaultHeight);
    img.setAttribute("pointer-events", "none");
    group.appendChild(img);

    addResizeCorner(group, defaultWidth, defaultHeight);
    document.getElementById("scalableContent").appendChild(group);
    assignLayerId(group);
    rebuildLayersList();
  }

  function addResizeCorner(group, w, h) {
    if (group.getAttribute("data-zone") === "yes") return;
    const textCheck = group.querySelector('[data-role="main"].label-text');
    if (textCheck) return; // no corner for labels

    const corner = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    corner.setAttribute("data-resize", "corner");
    corner.setAttribute("width", "12");
    corner.setAttribute("height", "12");
    corner.setAttribute("fill", "transparent");
    corner.setAttribute("pointer-events", "fill");
    corner.setAttribute("x", w - 12);
    corner.setAttribute("y", h - 12);
    group.appendChild(corner);
  }

  // -------------------------------
  // CREATE ZONES (with sub-spots)
  // -------------------------------
  const zoneSpotCount = document.getElementById("zoneSpotCount");
  const zoneName = document.getElementById("zoneName");
  const zoneType = document.getElementById("zoneType");
  const zoneAutoResize = document.getElementById("zoneAutoResizeCheckbox");
  const zoneResizeCnt = document.getElementById("zoneResizeCount");
  const addZoneBtn = document.getElementById("addZoneBtn");

  addZoneBtn.addEventListener("click", () => {
    const zName = zoneName.value.trim();
    if (!zName) {
      alert("Please input a Zone Name");
      return;
    }

    const spots = +zoneSpotCount.value || 1;
    const zTypeV = zoneType.value;
    const autoR = zoneAutoResize.checked;
    const rEvery = +zoneResizeCnt.value || 10;
    const thisZoneId = getZoneId(zName);

    const { zoneW, zoneH, rows, columns } = calculateZoneDimensions(
      spots,
      zTypeV,
      autoR,
      rEvery,
    );
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("data-type", "draggable");
    group.setAttribute("transform", "translate(10,10)");
    group.setAttribute("data-w", zoneW);
    group.setAttribute("data-h", zoneH);
    group.setAttribute("data-zone", "yes");
    group.setAttribute("data-zone-id", thisZoneId);
    group.setAttribute("data-orientation", zTypeV);

    const hitbox = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    hitbox.setAttribute("data-role", "hitbox");
    hitbox.setAttribute("width", zoneW);
    hitbox.setAttribute("height", zoneH);
    hitbox.setAttribute("fill", "transparent");
    hitbox.setAttribute("pointer-events", "fill");
    group.appendChild(hitbox);

    const outline = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    outline.setAttribute("class", "zone-outline");
    outline.setAttribute("data-role", "main");
    outline.setAttribute("width", zoneW);
    outline.setAttribute("height", zoneH);
    outline.setAttribute("pointer-events", "none");
    group.appendChild(outline);

    const nameRect = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    nameRect.setAttribute("class", "zone-name-box");
    nameRect.setAttribute("x", "0");
    nameRect.setAttribute("y", "0");
    nameRect.setAttribute("width", zoneW);
    nameRect.setAttribute("height", "18.2");
    nameRect.setAttribute("pointer-events", "none");
    group.appendChild(nameRect);

    const nameText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    nameText.setAttribute("fill", "#fff");
    nameText.setAttribute("font-family", "Helvetica, sans-serif");
    nameText.setAttribute("font-size", "12");
    nameText.setAttribute("x", zoneW / 2);
    nameText.setAttribute("y", 13);
    nameText.setAttribute("text-anchor", "middle");
    nameText.setAttribute("pointer-events", "none");
    nameText.textContent = zName;
    group.appendChild(nameText);

    const spotsText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    spotsText.setAttribute("fill", "#ccc");
    spotsText.setAttribute("font-style", "italic");
    spotsText.setAttribute("font-size", "12");
    spotsText.setAttribute("font-family", "Helvetica, sans-serif");
    spotsText.setAttribute("text-anchor", "middle");
    spotsText.setAttribute("data-export-ignore", "true");
    spotsText.setAttribute("pointer-events", "none");
    const bodyCenterY = (zoneH - 18.2) / 2 + 18.2;
    spotsText.setAttribute("x", zoneW / 2);
    spotsText.setAttribute("y", bodyCenterY);
    spotsText.textContent = `${spots} Spots`;
    group.appendChild(spotsText);

    // For a "horizontal" Zone, each spot is tall (11.1 wide x 50.8 high).
    // For a "vertical" Zone, each spot is wide (50.8 wide x 11.1 high).
    const subW = zTypeV === "horizontal" ? 11.1 : 50.8;
    const subH = zTypeV === "horizontal" ? 50.8 : 11.1;

    let yOffset = 18.2;
    for (let r = 0; r < rows; r++) {
      let xOffset = 0;
      for (let c = 0; c < columns; c++) {
        const spotIndex = r * columns + c;
        if (spotIndex >= spots) break;

        const subSpotG = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "g",
        );
        subSpotG.setAttribute("class", "droppable eagleViewDropSpot");
        subSpotG.setAttribute("data-zone-name", zName);
        subSpotG.setAttribute("data-zone-id", thisZoneId);

        // (1) get the next sequence
        const seq = getNextSpotSequence();
        subSpotG.setAttribute("data-sequence", seq);

        // (2) build spot ID
        const spotId = buildSpotId(facilityId, seq);
        subSpotG.setAttribute("data-spot-id", spotId);

        const subRect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        subRect.setAttribute("x", xOffset);
        subRect.setAttribute("y", 18.2 + r * subH); // 18.2 offset for label bar
        subRect.setAttribute("width", subW);
        subRect.setAttribute("height", subH);
        subRect.setAttribute("fill", "transparent");
        subRect.setAttribute("pointer-events", "none");
        subSpotG.appendChild(subRect);
        group.appendChild(subSpotG);

        xOffset += subW;
      }
      yOffset += subH;
    }

    document.getElementById("scalableContent").appendChild(group);
    assignLayerId(group);
    rebuildLayersList();
    addZoneToTable(zName, thisZoneId);
  });

  function calculateZoneDimensions(spots, zType, autoR, rEvery) {
    // For a "horizontal" zone, each spot is 11.1 wide x 50.8 high
    // For a "vertical" zone, each spot is 50.8 wide x 11.1 high
    const subW = zType === "horizontal" ? 11.1 : 50.8;
    const subH = zType === "horizontal" ? 50.8 : 11.1;

    let rows = 1;
    let columns = spots;

    if (autoR) {
      // "auto resize" means break the spots into multiple rows once we hit `rEvery`
      if (zType === "horizontal") {
        // horizontally laid out => chunk columns by rEvery
        columns = Math.min(spots, rEvery);
        rows = Math.ceil(spots / rEvery);
      } else {
        // vertically laid out => chunk rows by rEvery
        rows = Math.min(spots, rEvery);
        columns = Math.ceil(spots / rEvery);
      }
    } else {
      if (zType === "horizontal") {
        // single row, all spots side by side
        columns = spots;
        rows = 1;
      } else {
        // single column, spots stacked vertically
        columns = 1;
        rows = spots;
      }
    }

    // The label bar is ~18.2 tall at the top, so add that to zoneH
    const zoneW = columns * subW;
    const zoneH = rows * subH + 18.2;

    return { zoneW, zoneH, rows, columns, subW, subH };
  }

  // -------------------------------
  // COUNTERS: Total Spots and Docks (Excluding Lost Box)
  // -------------------------------

  const totalSpotsElem = document.getElementById("totalSpots");
  const totalDocksElem = document.getElementById("totalDocks");

  function updateCounters() {
    // Select all spot groups excluding those with the 'lostTrailer' class
    const allSpots = canvasSVG.querySelectorAll(
      "g.eagleViewDropSpot:not(.lostTrailer)",
    );

    // Initialize counters
    let totalSpots = 0;
    let totalDocks = 0;

    // Iterate over each spot to determine if it's a dock or a regular spot
    allSpots.forEach((spot) => {
      const hasLoadingTriangle = spot.querySelector(".loading_triangle");
      const hasUnloadingTriangle = spot.querySelector(".unloading_triangle");

      if (hasLoadingTriangle || hasUnloadingTriangle) {
        // It's a dock
        totalDocks++;
      } else {
        // It's a regular spot
        totalSpots++;
      }
    });

    // Update the DOM elements with the new counts

    if (totalSpotsElem) {
      totalSpotsElem.textContent = `Spots: ${totalSpots}`;
    }

    if (totalDocksElem) {
      totalDocksElem.textContent = `Docks: ${totalDocks}`;
    }
  }

  // Initial call to set counters on page load
  updateCounters();

  if (totalSpotsElem) {
    totalSpotsElem.addEventListener("mouseover", highlightAllSpots);
    totalSpotsElem.addEventListener("mouseout", removeHighlightAllSpots);
  }
  if (totalDocksElem) {
    totalDocksElem.addEventListener("mouseover", highlightAllDocks);
    totalDocksElem.addEventListener("mouseout", removeHighlightAllDocks);
  }

  // -------------------------------
  // Magnetize
  // -------------------------------
  const magnetizeToggle = document.getElementById("magnetizeToggle");
  magnetizeToggle.addEventListener("change", () => {
    magnetizeEnabled = magnetizeToggle.checked;
  });

  // Helper to parse transform translate(x,y) + w,h from data attributes:
  function getRectFromGroup(g) {
    // Parse the group’s current transform="translate(X,Y)"
    let transform = g.getAttribute("transform") || "";
    let match = /translate\(([^,]+),\s*([^)]+)\)/.exec(transform);
    let x = 0,
      y = 0;
    if (match) {
      x = parseFloat(match[1]) || 0;
      y = parseFloat(match[2]) || 0;
    }
    // Then read the stored width/height
    let w = parseFloat(g.getAttribute("data-w")) || 0;
    let h = parseFloat(g.getAttribute("data-h")) || 0;

    return {
      left: x,
      top: y,
      right: x + w,
      bottom: y + h,
      width: w,
      height: h,
    };
  }

  function magnetizePosition(element, proposedX, proposedY) {
    // For the "dragged" element, we know w,h from data-w,data-h
    const eW = parseFloat(element.getAttribute("data-w")) || 0;
    const eH = parseFloat(element.getAttribute("data-h")) || 0;

    // Proposed edges if we place it at (proposedX, proposedY)
    let curLeft = proposedX;
    let curRight = proposedX + eW;
    let curTop = proposedY;
    let curBottom = proposedY + eH;

    const MAGNET_THRESHOLD = 10;

    // Gather all potential snap targets:
    // (If you want *every* draggable object, not just yard spots.)
    const allElements = document.querySelectorAll('g[data-type="draggable"]');

    allElements.forEach((other) => {
      if (other === element) return; // Skip the element we’re dragging

      const obox = getRectFromGroup(other);

      // Compare left->right
      if (Math.abs(curLeft - obox.right) < MAGNET_THRESHOLD) {
        curLeft = obox.right;
        curRight = obox.right + eW;
      }
      // Compare right->left
      if (Math.abs(curRight - obox.left) < MAGNET_THRESHOLD) {
        curRight = obox.left;
        curLeft = obox.left - eW;
      }

      // Compare top->bottom
      if (Math.abs(curTop - obox.bottom) < MAGNET_THRESHOLD) {
        curTop = obox.bottom;
        curBottom = obox.bottom + eH;
      }
      // Compare bottom->top
      if (Math.abs(curBottom - obox.top) < MAGNET_THRESHOLD) {
        curBottom = obox.top;
        curTop = obox.top - eH;
      }
    });

    return [curLeft, curTop];
  }

  // -------------------------------
  // SCALE
  // -------------------------------
  const canvasScaleInput = document.getElementById("canvasScale");
  const scaleDisplay = document.getElementById("scaleDisplay");
  const resetScaleBtn = document.getElementById("resetScaleBtn");

  canvasScaleInput.addEventListener("mousedown", () => {
    previousScale = currentScale;
  });

  function repositionLostBox(scaleVal) {
    if (!lostBoxGroup) return;
    const labelH = parseFloat(lostBoxGroup.getAttribute("y")) || 18.2;
    const mainH = parseFloat(lostBoxGroup.getAttribute("data-h")) || 0;
    const totalH = labelH + mainH;
    const tx = 10 / scaleVal;
    const ty = (baseHeight - totalH - 10) / scaleVal;
    lostBoxGroup.setAttribute("transform", `translate(${tx}, ${ty})`);
  }

  function applyScale(scaleVal) {
    if (isNaN(scaleVal) || scaleVal <= 0) return;
    const scalable = document.getElementById("scalableContent");
    scalable.setAttribute("transform", `scale(${scaleVal})`);
    canvasSVG.setAttribute("data-canvas-scale", scaleVal);
    repositionLostBox(scaleVal);
    currentScale = scaleVal;
    canvasScaleInput.value = scaleVal;
    scaleDisplay.textContent = scaleVal.toFixed(1);
  }

  function sanitizeHighlighting(root) {
    if (!root) return;
    root.querySelectorAll(".highlight-remove").forEach((el) => el.remove());
    root.querySelectorAll(".highlighted, .highlight-add").forEach((el) => {
      el.classList.remove("highlighted");
      el.classList.remove("highlight-add");
    });
  }

  canvasScaleInput.addEventListener("input", () => {
    const scaleVal = parseFloat(canvasScaleInput.value);
    applyScale(scaleVal);
  });

  resetScaleBtn.addEventListener("click", () => {
    applyScale(previousScale);
  });

  // -------------------------------
  // EXPORT (JPG / SVG)
  // -------------------------------
  const exportJpgBtn = document.getElementById("exportJpgBtn");
  const exportSvgBtn = document.getElementById("exportSvgBtn");
  exportJpgBtn.addEventListener("click", () => {
    exportAsJPG();
  });
  exportSvgBtn.addEventListener("click", () => {
    exportAsSVG();
  });

  async function exportAsJPG() {
    svgWrapper.classList.add(
      "no-border",
      "no-grid",
      "no-buttons",
      "export-cleanup",
    );
    try {
      const canvas = await html2canvas(svgWrapper, {
        backgroundColor: "#A1A3A5",
        width: 1046.5,
        height: 500,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = "eagle_view.jpg";
      link.href = canvas.toDataURL("image/jpeg");
      link.click();
    } catch (err) {
      console.error("JPG Export failed:", err);
      alert("Failed to export JPG. Check console for details.");
    } finally {
      svgWrapper.classList.remove(
        "no-border",
        "no-grid",
        "no-buttons",
        "export-cleanup",
      );
    }
  }

  function exportAsSVG() {
    const allLoadingTriangles = document.querySelectorAll(".loading_triangle");
    const allUnloadingTriangles = document.querySelectorAll(
      ".unloading_triangle",
    );
    allLoadingTriangles.forEach((tri) => (tri.style.display = "block"));
    allUnloadingTriangles.forEach((tri) => (tri.style.display = "block"));

    const gridOverlay = document.querySelector(".grid-overlay");
    let gridParent = null;
    let gridNextSibling = null;
    if (gridOverlay) {
      gridParent = gridOverlay.parentNode;
      gridNextSibling = gridOverlay.nextSibling;
      gridOverlay.remove();
    }

    canvasSVG.classList.add("export-cleanup", "no-grid");
    const draggableGroups = [
      ...document.querySelectorAll('g[data-type="draggable"]'),
    ];
    draggableGroups.forEach((g) => {
      g.removeAttribute("data-type");
      g.removeAttribute("style");
    });

    // **Hide elements with data-export-ignore by setting inline styles**
    const exportIgnoreElems = canvasSVG.querySelectorAll(
      "[data-export-ignore]",
    );
    exportIgnoreElems.forEach((elem) => {
      // Store original display style if needed
      elem.setAttribute("data-original-display", elem.style.display);
      elem.style.display = "none";
    });

    canvasSVG.setAttribute("data-facility-id", facilityId); // records the Facility ID
    canvasSVG.setAttribute("data-canvas-scale", currentScale);

    // store layer order
    const groupsForExport = canvasSVG.querySelectorAll("#scalableContent > g");
    groupsForExport.forEach((g, idx) => {
      g.setAttribute("data-layer-index", idx);
    });

    sanitizeHighlighting(canvasSVG);

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(canvasSVG);

    // **Restore original display styles**
    exportIgnoreElems.forEach((elem) => {
      const originalDisplay = elem.getAttribute("data-original-display");
      elem.style.display = originalDisplay || "";
      elem.removeAttribute("data-original-display");
    });

    canvasSVG.classList.remove("export-cleanup", "no-grid");
    if (gridOverlay && gridParent) {
      if (gridNextSibling) {
        gridParent.insertBefore(gridOverlay, gridNextSibling);
      } else {
        gridParent.appendChild(gridOverlay);
      }
    }
    draggableGroups.forEach((g) => {
      g.setAttribute("data-type", "draggable");
      g.setAttribute("style", "cursor: move;");
    });

    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(
        /^<svg/,
        '<svg xmlns="http://www.w3.org/2000/svg"',
      );
    }
    if (!source.match(/^<svg[^>]+"http:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(
        /^<svg/,
        '<svg xmlns:xlink="http://www.w3.org/1999/xlink"',
      );
    }

    const url =
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    const link = document.createElement("a");
    link.href = url;
    link.download = "eagle_view.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    allLoadingTriangles.forEach((tri) => (tri.style.display = "none"));
    allUnloadingTriangles.forEach((tri) => (tri.style.display = "none"));
  }

  // -------------------------------
  // IMPORT
  // -------------------------------
  const chooseSvgBtn = document.getElementById("chooseSvgBtn");
  const importFileInput = document.getElementById("importFileInput");

  chooseSvgBtn.addEventListener("click", () => {
    importFileInput.click();
  });

  importFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "image/svg+xml") {
      alert("Please select an SVG file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function (ev) {
      const svgText = ev.target.result;
      parseImportedSVG(svgText);
    };
    reader.readAsText(file);
  });

  function parseImportedSVG(svgText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const importedSVG = doc.querySelector("svg");
    if (!importedSVG) {
      alert("No <svg> element found in the selected file.");
      return;
    }
    const importedScalable = importedSVG.querySelector("#scalableContent");
    if (!importedScalable) {
      alert(
        "Could not find <g id='scalableContent'>. Not a valid Eagle View SVG.",
      );
      return;
    }

    const myScalableContent = document.getElementById("scalableContent");
    while (myScalableContent.firstChild) {
      myScalableContent.removeChild(myScalableContent.firstChild);
    }

    while (importedScalable.firstChild) {
      myScalableContent.appendChild(importedScalable.firstChild);
    }

    sanitizeHighlighting(myScalableContent);

    myScalableContent.querySelectorAll(":scope > g").forEach((g) => {
      if (g.hasAttribute("data-w") && g.hasAttribute("data-h")) {
        g.setAttribute("data-type", "draggable");
        g.setAttribute("style", "cursor: move;");
      }
    });

    const importedFacilityId = importedSVG.getAttribute("data-facility-id");
    if (importedFacilityId) {
      facilityNumberInput.value = importedFacilityId;
      // Simply update the facilityId variable without triggering the change
      // event so the imported Lost Box position is preserved
      facilityId = parseInt(importedFacilityId, 10) || 1;
    }

    const importedScale = parseFloat(
      importedSVG.getAttribute("data-canvas-scale"),
    );
    let finalScale;
    if (!isNaN(importedScale)) {
      finalScale = importedScale;
      applyScale(finalScale);
      myScalableContent.setAttribute("transform", `scale(${finalScale})`);
    } else {
      const importedTransform = importedScalable.getAttribute("transform");
      let parsedScale = 1;
      if (importedTransform) {
        const match = /scale\(([^)]+)\)/.exec(importedTransform);
        parsedScale = match ? parseFloat(match[1]) || 1 : 1;
      }
      const vb = importedSVG.getAttribute("viewBox");
      if (vb) {
        const parts = vb.split(/\s+/).map(parseFloat);
        if (parts.length === 4 && parts[2] && parts[3]) {
          const wScale = baseWidth / parts[2];
          parsedScale = wScale;
        }
      }
      finalScale = parsedScale;
      applyScale(finalScale);
      if (importedTransform) {
        myScalableContent.setAttribute("transform", importedTransform);
      } else {
        myScalableContent.setAttribute("transform", `scale(${finalScale})`);
      }
    }
    currentScale = finalScale;
    canvasScaleInput.value = finalScale;
    scaleDisplay.textContent = finalScale.toFixed(1);
    canvasSVG.setAttribute("data-canvas-scale", finalScale);
    previousScale = finalScale;

    const allLoadingTriangles =
      myScalableContent.querySelectorAll(".loading_triangle");
    const allUnloadingTriangles = myScalableContent.querySelectorAll(
      ".unloading_triangle",
    );
    allLoadingTriangles.forEach((tri) => (tri.style.display = "none"));
    allUnloadingTriangles.forEach((tri) => (tri.style.display = "none"));

    // **Reset display for all elements with data-export-ignore without removing the attribute**
    myScalableContent.querySelectorAll("[data-export-ignore]").forEach((el) => {
      el.style.display = ""; // Resets to default, making them visible on the canvas
    });

    // **Ensure "X Spots" retain the data-export-ignore attribute to stay hidden during export**
    myScalableContent.querySelectorAll("g.lostTrailer").forEach((el) => {
      el.removeAttribute("data-export-ignore", "");
      el.style.display = ""; // Ensure visibility on the canvas
    });

    // **Ensure Only One Lost Box Exists**
    const lostBoxes = myScalableContent.querySelectorAll("g.lostTrailer");
    if (lostBoxes.length > 1) {
      for (let i = 1; i < lostBoxes.length; i++) {
        lostBoxes[i].remove(); // Remove duplicates, keep only the first
      }
    }
    lostBoxGroup = lostBoxes[0] || null; // Reference the remaining Lost Box

    // Sort by stored layer index and assign fresh IDs
    const groupsArr = Array.from(
      myScalableContent.querySelectorAll(":scope > g"),
    );
    groupsArr.sort((a, b) => {
      return (
        (parseInt(a.getAttribute("data-layer-index")) || 0) -
        (parseInt(b.getAttribute("data-layer-index")) || 0)
      );
    });
    groupsArr.forEach((g) => myScalableContent.appendChild(g));
    groupsArr.forEach(assignLayerId);
    rebuildLayersList();

    rebuildZonesTable();
    updateCounters();

    alert(
      "SVG import complete! Triangles are hidden, and elements are now on the canvas and editable.",
    );
  }

  function rebuildZonesTable() {
    const myScalableContent = document.getElementById("scalableContent");
    const zoneGroups = myScalableContent.querySelectorAll("g[data-zone-id]");
    zonesTableBody.innerHTML = "";

    // Reset known zoneNameToIdMap so we can repopulate:
    for (let key in zoneNameToIdMap) {
      delete zoneNameToIdMap[key];
    }
    nextZoneId = parseInt(startingZoneNumberInput.value, 10) || 1;
    let smallestZoneId = Infinity;

    zoneGroups.forEach((group) => {
      const zoneId = group.getAttribute("data-zone-id");
      const zoneNameAttr = group.getAttribute("data-zone-name");

      // Fall back to any existing text if needed, but prefer data-zone-name:
      // (If this is a large "Zone" group, it might have a .zone-name-box + text).
      // But for normal spots, zoneNameAttr is the only reliable value.
      let zoneName =
        zoneNameAttr ||
        group.querySelector(".zone-name-box + text")?.textContent ||
        "Zone " + zoneId;

      // Store in map
      zoneNameToIdMap[zoneName] = parseInt(zoneId, 10);
      if (parseInt(zoneId, 10) >= nextZoneId) {
        nextZoneId = parseInt(zoneId, 10) + 1;
      }
      if (
        !isNaN(parseInt(zoneId, 10)) &&
        parseInt(zoneId, 10) < smallestZoneId
      ) {
        smallestZoneId = parseInt(zoneId, 10);
      }
      addZoneToTable(zoneName, zoneId);
    });
    if (zoneGroups.length > 0 && smallestZoneId !== Infinity) {
      startingZoneNumberInput.value = smallestZoneId;
    }
    updateSelectionIndicators();
  }

  // ------ Layers Management ------

  layersHeader.addEventListener("click", () => {
    layersSidebar.classList.toggle("collapsed");
    layersCollapseIcon.textContent = layersSidebar.classList.contains(
      "collapsed",
    )
      ? "☰"
      : "✕";
    document
      .getElementById("bodyWrapper")
      .classList.toggle(
        "layers-open",
        !layersSidebar.classList.contains("collapsed"),
      );
  });

  function assignLayerId(el) {
    if (!el.hasAttribute("data-layer-id")) {
      el.setAttribute("data-layer-id", nextLayerId++);
    }
  }

  function getLayerName(g) {
    if (g.classList.contains("lostTrailer")) return "Lost Box";
    if (g.hasAttribute("data-zone-name")) {
      const name = g.getAttribute("data-zone-name");
      const count = g.querySelectorAll("g.eagleViewDropSpot").length;
      return count ? `${name} (${count})` : name;
    }
    if (g.getAttribute("data-zone") === "yes") {
      const t = g.querySelector(".zone-name-box + text");
      return t ? t.textContent : "Zone";
    }
    if (g.getAttribute("data-zone-id")) {
      const name = g.getAttribute("data-zone-name") || "Group";
      const count = g.querySelectorAll("g.eagleViewDropSpot").length;
      return count ? `${name} (${count})` : name;
    }
    const main = g.querySelector('[data-role="main"]');
    if (main) {
      if (main.getAttribute("data-guard") === "yes") return "Guard Shack";
      if (main.tagName === "image") return "Custom Image";
      const fill = main.getAttribute("fill");
      if (fill === "#63954B") return "Grass";
      if (fill === "#fff") return "Building";
      if (fill === "#A1A3A5") return "Pavement";
    }
    if (g.querySelector("text")) return "Label";
    return "Element";
  }

  function getLayerIcon(g) {
    if (g.querySelector("g.eagleViewDropSpot")) {
      return g.querySelector(".loading_triangle") ? "🚪" : "🚛";
    }
    if (g.classList.contains("lostTrailer")) return "❌";
    if (g.getAttribute("data-zone") === "yes") return "📥";
    const main = g.querySelector('[data-role="main"]');
    if (main) {
      if (main.getAttribute("data-guard") === "yes") return "👮🏻‍♂️";
      if (main.tagName === "image") return "🖼️";
      const fill = main.getAttribute("fill");
      if (fill === "#63954B") return "🌱";
      if (fill === "#fff") return "🏢";
      if (fill === "#A1A3A5") return "⬛";
    }
    if (g.querySelector("text")) return "🔤";
    return "❔";
  }

  function rebuildLayersList() {
    layersList.innerHTML = "";
    const groups = Array.from(document.querySelectorAll("#scalableContent > g"))
      .filter((g) => !g.classList.contains("lostTrailer"))
      .reverse();

    groups.forEach((g, idx) => {
      assignLayerId(g);
      g.setAttribute("data-layer-index", idx);

      const li = document.createElement("li");
      li.setAttribute("data-target-id", g.getAttribute("data-layer-id"));
      li.draggable = true;
      li.innerHTML = `<span class="drag-handle">☰</span><span class="layer-icon">${getLayerIcon(g)}</span><span class="layer-name">${getLayerName(g)}</span>`;
      li.addEventListener("mouseover", () =>
        highlightLayer(g.getAttribute("data-layer-id")),
      );
      li.addEventListener("mouseout", () =>
        removeHighlightLayer(g.getAttribute("data-layer-id")),
      );
      layersList.appendChild(li);
    });
    updateSelectionIndicators();
  }

  let draggedItem = null;
  let dragStartX = 0;
  let layerOrderBefore = [];
  layersList.addEventListener("dragstart", (e) => {
    draggedItem = e.target;
    dragStartX = e.clientX;
    layerOrderBefore = getLayerOrder();
    e.target.classList.add("dragging");
  });
  layersList.addEventListener("dragend", (e) => {
    e.target.classList.remove("dragging");
    updateOrderFromList();
    draggedItem = null;
  });
  layersList.addEventListener("dragover", (e) => {
    e.preventDefault();
    const li = e.target.closest("li");
    const dragging = document.querySelector("#layersList li.dragging");
    if (!li || !dragging || li === dragging) return;
    if (Math.abs(e.clientX - dragStartX) > 80) return;
    const rect = li.getBoundingClientRect();
    const next = e.clientY - rect.top > rect.height / 2;
    layersList.insertBefore(dragging, next ? li.nextSibling : li);
  });

  function updateOrderFromList() {
    const scalable = document.getElementById("scalableContent");
    const lost = scalable.querySelector("g.lostTrailer");
    const order = Array.from(layersList.children).map(
      (li) => li.dataset.targetId,
    );
    const before = layerOrderBefore.length ? layerOrderBefore : getLayerOrder();
    order.reverse().forEach((id) => {
      const g = scalable.querySelector(`[data-layer-id="${id}"]`);
      if (g && g !== lost) {
        scalable.insertBefore(g, lost || null);
      }
    });
    ensureLostBoxOnTop();
    rebuildLayersList();
    const after = getLayerOrder();
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      pushUndoAction({ type: "reorder", before, after });
    }
    layerOrderBefore = [];
  }

  function getLayerOrder() {
    return Array.from(document.querySelectorAll("#scalableContent > g"))
      .filter((g) => !g.classList.contains("lostTrailer"))
      .map((g) => g.getAttribute("data-layer-id"));
  }

  function applyLayerOrder(order) {
    const scalable = document.getElementById("scalableContent");
    const lost = scalable.querySelector("g.lostTrailer");
    order.forEach((id) => {
      const g = scalable.querySelector(`[data-layer-id="${id}"]`);
      if (g && g !== lost) {
        scalable.insertBefore(g, lost || null);
      }
    });
    ensureLostBoxOnTop();
    rebuildLayersList();
  }

  function scheduleHighlightCleanup(group) {
    const adds = group.querySelectorAll(".highlight-add");
    adds.forEach((el) =>
      setTimeout(() => el.classList.remove("highlight-add"), 2000),
    );
    const removes = group.querySelectorAll(".highlight-remove");
    removes.forEach((el) => setTimeout(() => el.remove(), 2000));
  }

  function pushGroupChange(group, beforeClone) {
    pushUndoAction({
      type: "group-modify",
      elementId: group.getAttribute("data-layer-id"),
      before: beforeClone,
      after: group.cloneNode(true),
    });
  }

  document
    .getElementById("scalableContent")
    .addEventListener("contextmenu", (e) => {
      const g = e.target.closest("#scalableContent > g");
      if (!g || g.classList.contains("lostTrailer")) return;
      e.preventDefault();
      contextTarget = g;
      const sampleSpot = g.querySelector("g.eagleViewDropSpot");
      if (sampleSpot) {
        const hasTriangle =
          sampleSpot.querySelector(".loading_triangle") ||
          sampleSpot.querySelector(".unloading_triangle");
        contextType = hasTriangle ? "dock" : "spot";
        contextAdd.textContent =
          contextType === "dock" ? "⊕ Add Docks" : "⊕ Add Spots";
        contextRemove.textContent =
          contextType === "dock" ? "⊖ Remove Docks" : "⊖ Remove Spots";
        contextAdd.style.display = "block";
        contextRemove.style.display = "block";
        contextEditFirst.style.display = "block";
      } else {
        contextType = null;
        contextAdd.style.display = "none";
        contextRemove.style.display = "none";
        contextEditFirst.style.display = "none";
      }
      layerContextMenu.style.display = "block";
      layerContextMenu.style.left = e.clientX + "px";
      layerContextMenu.style.top = e.clientY + "px";
    });

  layersList.addEventListener("contextmenu", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    e.preventDefault();
    contextTarget = document.querySelector(
      `#scalableContent > g[data-layer-id="${li.dataset.targetId}"]`,
    );
    if (!contextTarget) return;
    const sampleSpot = contextTarget.querySelector("g.eagleViewDropSpot");
    if (sampleSpot) {
      const hasTriangle =
        sampleSpot.querySelector(".loading_triangle") ||
        sampleSpot.querySelector(".unloading_triangle");
      contextType = hasTriangle ? "dock" : "spot";
      contextAdd.textContent =
        contextType === "dock" ? "⊕ Add Docks" : "⊕ Add Spots";
      contextRemove.textContent =
        contextType === "dock" ? "⊖ Remove Docks" : "⊖ Remove Spots";
      contextAdd.style.display = "block";
      contextRemove.style.display = "block";
      contextEditFirst.style.display = "block";
    } else {
      contextType = null;
      contextAdd.style.display = "none";
      contextRemove.style.display = "none";
      contextEditFirst.style.display = "none";
    }
    layerContextMenu.style.display = "block";
    layerContextMenu.style.left = e.clientX + "px";
    layerContextMenu.style.top = e.clientY + "px";
  });

  document.addEventListener("click", () => {
    layerContextMenu.style.display = "none";
    hideContextMenu.style.display = "none";
  });

  layerContextMenu.addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    if (!action || !contextTarget) return;
    if (contextTarget.classList.contains("lostTrailer")) return;
    const parent = contextTarget.parentNode;
    const beforeOrder = getLayerOrder();
    if (action === "bring-front") {
      parent.appendChild(contextTarget);
    } else if (action === "bring-forward") {
      const next = contextTarget.nextElementSibling;
      if (next) parent.insertBefore(next, contextTarget);
    } else if (action === "send-backward") {
      const prev = contextTarget.previousElementSibling;
      if (prev) parent.insertBefore(contextTarget, prev);
    } else if (action === "send-back") {
      parent.insertBefore(contextTarget, parent.firstChild);
    } else if (action === "delete") {
      layerContextMenu.style.display = "none";
      const targets =
        selectedElements.has(contextTarget) && selectedElements.size > 1
          ? Array.from(selectedElements)
          : [contextTarget];
      showDeleteConfirm(() => {
        targets.forEach((t) => deleteGroupDirect(t));
        contextTarget = null;
        ensureLostBoxOnTop();
        rebuildLayersList();
        rebuildZonesTable();
        updateCounters();
      });
      return;
    } else if (action === "add-items") {
      if (!contextType) return;
      const num = parseInt(
        prompt(
          `Add how many ${contextType === "dock" ? "docks" : "spots"}?`,
          "1",
        ),
        10,
      );
      if (Number.isNaN(num) || num <= 0) return;

      if (contextTarget.getAttribute("data-zone") === "yes") {
        addZoneItems(contextTarget, num);
      } else {
        addItems(contextTarget, num, contextType === "dock");
      }
    } else if (action === "remove-items") {
      if (!contextType) return;
      const num = parseInt(
        prompt(
          `Remove how many ${contextType === "dock" ? "docks" : "spots"}?`,
          "1",
        ),
        10,
      );
      if (Number.isNaN(num) || num <= 0) return;
      removeItems(contextTarget, num);
    } else if (action === "edit-first") {
      editFirstNumber(contextTarget);
    }
    const afterOrder = getLayerOrder();
    if (
      contextTarget &&
      contextTarget.isConnected &&
      JSON.stringify(beforeOrder) !== JSON.stringify(afterOrder)
    ) {
      pushUndoAction({
        type: "reorder",
        before: beforeOrder,
        after: afterOrder,
      });
    }
    ensureLostBoxOnTop();
    layerContextMenu.style.display = "none";
    ensureLostBoxOnTop();
    rebuildLayersList();
    rebuildZonesTable();
    updateCounters();
  });

  hideContextOption.addEventListener("click", () => {
    hideContextMenu.style.display = "none";
    if (hideContextType === "trash") {
      hideTrashToggle.checked = true;
      hideTrash = true;
      toggleTrashCanVisibility(true);
    } else if (hideContextType === "lost") {
      hideLostBoxToggle.checked = true;
      lostBoxHidden = true;
      if (lostBoxGroup) lostBoxGroup.style.display = "none";
    }
    hideContextType = null;
  });

  function inferLabelLocation(label, orientation) {
    if (!label) return orientation === "vertical" ? "bottom" : "right";
    const transform = label.getAttribute("transform");
    if (transform && transform.includes("rotate(-90)")) {
      const match = /translate\([^,]+,\s*([^)]+)\)/.exec(transform);
      const ty = match ? parseFloat(match[1]) : 0;
      if (orientation === "vertical") {
        return ty < 0 ? "top" : "bottom";
      }
    }
    const x = parseFloat(label.getAttribute("x") || 0);
    const y = parseFloat(label.getAttribute("y") || 0);
    if (orientation === "vertical") {
      return y < 0 ? "top" : "bottom";
    }
    return x < 0 ? "left" : "right";
  }

  function adjustGroupSize(group) {
    const spots = group.querySelectorAll("g.eagleViewDropSpot");
    if (!spots.length) return;
    const firstRect = spots[0].querySelector("rect");
    const spotW = parseFloat(firstRect.getAttribute("width"));
    const spotH = parseFloat(firstRect.getAttribute("height"));
    let orientation = group.getAttribute("data-orientation");
    if (!orientation) orientation = spotW > spotH ? "vertical" : "horizontal";

    if (group.getAttribute("data-zone") === "yes") {
      let maxX = 0;
      let maxY = 0;
      spots.forEach((sp) => {
        const r = sp.querySelector("rect");
        const x =
          parseFloat(r.getAttribute("x")) + parseFloat(r.getAttribute("width"));
        const y =
          parseFloat(r.getAttribute("y")) +
          parseFloat(r.getAttribute("height"));
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      });
      const zoneW = maxX;
      const zoneH = maxY;
      group.setAttribute("data-w", zoneW);
      group.setAttribute("data-h", zoneH);

      const hit = group.querySelector('rect[data-role="hitbox"]');
      if (hit) {
        hit.setAttribute("width", zoneW);
        hit.setAttribute("height", zoneH);
      }
      const outline = group.querySelector("rect.zone-outline");
      if (outline) {
        outline.setAttribute("width", zoneW);
        outline.setAttribute("height", zoneH);
      }
      const nameRect = group.querySelector("rect.zone-name-box");
      if (nameRect) {
        nameRect.setAttribute("width", zoneW);
      }
      const nameText = group.querySelector(".zone-name-box + text");
      if (nameText) {
        nameText.setAttribute("x", zoneW / 2);
      }
      const txt = group.querySelector('text[fill="#ccc"]');
      if (txt) {
        txt.setAttribute("x", zoneW / 2);
        const bodyCenterY = (zoneH - 18.2) / 2 + 18.2;
        txt.setAttribute("y", bodyCenterY);
        txt.textContent = `${spots.length} Spots`;
      }
    } else {
      if (orientation === "vertical") {
        group.setAttribute("data-w", spots.length * spotW);
        group.setAttribute("data-h", spotH);
      } else {
        group.setAttribute("data-w", spotW);
        group.setAttribute("data-h", spots.length * spotH);
      }

      const hit = group.querySelector('rect[data-role="hitbox"]');
      if (hit) {
        hit.setAttribute("width", group.getAttribute("data-w"));
        hit.setAttribute("height", group.getAttribute("data-h"));
      }
    }

    if (group.getAttribute("data-zone") === "yes") {
      const zn = group.getAttribute("data-zone-name") || "Zone";
      const zid = group.getAttribute("data-zone-id");
      addZoneToTable(zn, zid);
    }
  }

  function spotsFromLabel(label) {
    const g = label.parentNode;
    const labels = Array.from(g.querySelectorAll(".spot-label"));
    const idx = labels.indexOf(label);
    const spots = g.querySelectorAll("g.eagleViewDropSpot");
    return spots[idx] || null;
  }

  function addZoneItems(group, count) {
    const before = group.cloneNode(true);
    const spots = group.querySelectorAll("g.eagleViewDropSpot");
    if (!spots.length) return;

    // measure one spot
    const firstRect = spots[0].querySelector("rect");
    const spotW = parseFloat(firstRect.getAttribute("width"));
    const spotH = parseFloat(firstRect.getAttribute("height"));

    // keep the header offset
    const headerOffset = 18.2;

    // orientation: 'horizontal' => one row, marching X
    //              'vertical'   => one column, marching Y
    const orientation =
      group.getAttribute("data-orientation") ||
      (spotW > spotH ? "vertical" : "horizontal");

    // count how many already exist
    const origCount = spots.length;

    for (let i = 0; i < count; i++) {
      const idx = origCount + i;

      // compute x,y for a *single* row or column
      const x = orientation === "horizontal" ? idx * spotW : 0;
      const y =
        orientation === "horizontal"
          ? headerOffset
          : headerOffset + idx * spotH;

      // build the spot
      const sg = document.createElementNS("http://www.w3.org/2000/svg", "g");
      sg.setAttribute("class", "droppable eagleViewDropSpot");
      sg.setAttribute("data-zone-name", group.getAttribute("data-zone-name"));
      sg.setAttribute("data-zone-id", group.getAttribute("data-zone-id"));

      // assign IDs
      const seq = getNextSpotSequence();
      const spotId = buildSpotId(facilityId, seq);
      sg.setAttribute("data-sequence", seq);
      sg.setAttribute("data-spot-id", spotId);

      // invisible rect
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("x", x);
      r.setAttribute("y", y);
      r.setAttribute("width", spotW);
      r.setAttribute("height", spotH);
      r.setAttribute("fill", "transparent");
      r.setAttribute("pointer-events", "none");
      sg.appendChild(r);

      group.appendChild(sg);
    }

    // now recalc the zone’s outline / hitbox / counts / layers
    adjustGroupSize(group);
    updateCounters();
    rebuildLayersList();
    updateZoneSpotText(group);
    pushGroupChange(group, before);
  }

  function removeZoneItems(group, count) {
    const before = group.cloneNode(true);
    const spots = group.querySelectorAll("g.eagleViewDropSpot");
    if (!spots.length) return;
    const removeCount = Math.min(count, spots.length);
    if (spots.length === 1 && removeCount >= 1) {
      const confirmDelete = confirm(
        "Only one spot left. Removing it will delete the entire group. Continue?",
      );
      if (!confirmDelete) return;
    }
    const toRemove = Array.from(spots).slice(-removeCount);
    toRemove.forEach((sp) => sp.remove());

    if (spots.length - removeCount <= 0) {
      deleteGroupDirect(group);
      return;
    }

    adjustGroupSize(group);
    updateCounters();
    rebuildLayersList();
    updateZoneSpotText(group);
    pushGroupChange(group, before);
  }

  function addItems(group, count, isDock) {
    const before = group.cloneNode(true);
    const spots = group.querySelectorAll("g.eagleViewDropSpot");
    if (!spots.length) return;
    const firstRect = spots[0].querySelector("rect");
    const spotW = parseFloat(firstRect.getAttribute("width"));
    const spotH = parseFloat(firstRect.getAttribute("height"));
    let orientation = group.getAttribute("data-orientation");
    if (!orientation) {
      orientation =
        parseFloat(group.getAttribute("data-w")) >
        parseFloat(group.getAttribute("data-h"))
          ? "vertical"
          : "horizontal";
    }
    const firstLabel = group.querySelector(".spot-label");
    const hasLabels = !!firstLabel;
    const labelLocation = hasLabels
      ? inferLabelLocation(firstLabel, orientation)
      : orientation === "vertical"
        ? "bottom"
        : "right";
    const rotationMode =
      firstLabel && firstLabel.getAttribute("transform") ? "90" : "dynamic";

    const labels = Array.from(group.querySelectorAll(".spot-label"));
    let prefix = "";
    let suffix = "";
    let nextNum = 0;
    let ascending = true;
    if (labels.length) {
      const mFirst = labels[0].textContent.match(/^(\D*)(\d+)(.*)$/);
      if (mFirst) {
        prefix = mFirst[1];
        suffix = mFirst[3];
      }
      const mLast =
        labels[labels.length - 1].textContent.match(/^(\D*)(\d+)(.*)$/);
      if (mLast) {
        nextNum = parseInt(mLast[2], 10);
      }
      if (labels.length > 1) {
        const n1 = parseInt(labels[0].textContent.match(/\d+/)[0], 10);
        const n2 = parseInt(labels[1].textContent.match(/\d+/)[0], 10);
        ascending = n2 > n1;
      }
    }
    for (let i = 0; i < count; i++) {
      const idx = spots.length + i;
      const seq = getNextSpotSequence();
      const spotId = buildSpotId(facilityId, seq);

      // Boundary line for the new outer edge
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      if (orientation === "vertical") {
        const pos = (idx + 1) * spotW;
        line.setAttribute("x1", pos);
        line.setAttribute("y1", 0);
        line.setAttribute("x2", pos);
        line.setAttribute("y2", spotH);
      } else {
        const pos = (idx + 1) * spotH;
        line.setAttribute("x1", 0);
        line.setAttribute("y1", pos);
        line.setAttribute("x2", spotW);
        line.setAttribute("y2", pos);
      }
      line.setAttribute("stroke", "#fff");
      line.setAttribute("stroke-width", "1.2");
      line.setAttribute("pointer-events", "none");
      group.appendChild(line);

      if (hasLabels) {
        const txt = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        txt.setAttribute("class", "spot-label");
        txt.setAttribute("pointer-events", "none");
        nextNum += ascending ? 1 : -1;
        const lblTxt = prefix + nextNum + suffix;
        txt.textContent = lblTxt;
        positionLabel(
          txt,
          orientation,
          labelLocation,
          spotW,
          spotH,
          orientation === "vertical" ? idx * spotW : 0,
          orientation === "horizontal" ? idx * spotH : 0,
          lblTxt,
          rotationMode,
        );
        group.appendChild(txt);
      }

      const sg = document.createElementNS("http://www.w3.org/2000/svg", "g");
      sg.setAttribute("class", "droppable eagleViewDropSpot");
      sg.setAttribute(
        "data-zone-name",
        group.getAttribute("data-zone-name") || "",
      );
      if (group.getAttribute("data-zone-id")) {
        sg.setAttribute("data-zone-id", group.getAttribute("data-zone-id"));
      }
      sg.setAttribute("data-sequence", seq);
      sg.setAttribute("data-spot-id", spotId);
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      const x = orientation === "vertical" ? idx * spotW : 0;
      const y = orientation === "horizontal" ? idx * spotH : 0;
      r.setAttribute("x", x);
      r.setAttribute("y", y);
      r.setAttribute("width", spotW);
      r.setAttribute("height", spotH);
      r.setAttribute("fill", "transparent");
      r.setAttribute("pointer-events", "none");
      sg.appendChild(r);

      if (isDock) {
        addDockTriangles(
          sg,
          spotId,
          x,
          y,
          spotW,
          spotH,
          labelLocation,
          orientation,
        );
      }

      group.appendChild(sg);
      sg.classList.add("highlight-add");
      setTimeout(() => sg.classList.remove("highlight-add"), 2000);
    }

    adjustGroupSize(group);
    updateCounters();
    rebuildLayersList();

    if (orientation === "vertical") {
      group.setAttribute("data-w", (spots.length + count) * spotW);
    } else {
      group.setAttribute("data-h", (spots.length + count) * spotH);
    }
    const hit = group.querySelector('rect[data-role="hitbox"]');
    if (hit) {
      hit.setAttribute("width", group.getAttribute("data-w"));
      hit.setAttribute("height", group.getAttribute("data-h"));
    }
    if (group.getAttribute("data-zone") === "yes") {
      updateZoneSpotText(group);
    }
    pushGroupChange(group, before);
  }

  function removeItems(group, count) {
    const before = group.cloneNode(true);
    if (group.getAttribute("data-zone") === "yes") {
      removeZoneItems(group, count);
      return;
    }
    const spots = group.querySelectorAll("g.eagleViewDropSpot");
    if (!spots.length) return;
    const removeCount = Math.min(count, spots.length);
    if (spots.length === 1 && removeCount >= 1) {
      const confirmDelete = confirm(
        "Only one spot left. Removing it will delete the entire group. Continue?",
      );
      if (!confirmDelete) return;
    }
    const toRemove = Array.from(spots).slice(-removeCount);
    toRemove.forEach((sp) => {
      const rect = sp.querySelector("rect");
      if (rect) {
        const overlay = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        overlay.setAttribute("x", rect.getAttribute("x"));
        overlay.setAttribute("y", rect.getAttribute("y"));
        overlay.setAttribute("width", rect.getAttribute("width"));
        overlay.setAttribute("height", rect.getAttribute("height"));
        overlay.setAttribute("fill", "none");
        overlay.classList.add("highlight-remove");
        group.appendChild(overlay);
        setTimeout(() => overlay.remove(), 2000);
      }
      sp.remove();
    });

    if (spots.length - removeCount <= 0) {
      deleteGroupDirect(group);
      return;
    }

    const labels = group.querySelectorAll(".spot-label");
    for (let i = 0; i < removeCount && labels.length; i++) {
      const lbl = labels[labels.length - 1 - i];
      if (lbl) lbl.remove();
    }

    const lines = group.querySelectorAll("line");
    for (let i = 0; i < removeCount; i++) {
      const ln = lines[lines.length - 1 - i];
      if (ln) ln.remove();
    }

    adjustGroupSize(group);
    updateCounters();
    rebuildLayersList();

    const firstRect = spots[0].querySelector("rect");
    const spotW = parseFloat(firstRect.getAttribute("width"));
    const spotH = parseFloat(firstRect.getAttribute("height"));
    let orientation = group.getAttribute("data-orientation");
    if (!orientation) {
      orientation =
        parseFloat(group.getAttribute("data-w")) >
        parseFloat(group.getAttribute("data-h"))
          ? "vertical"
          : "horizontal";
    }
    const remaining = spots.length - removeCount;
    if (orientation === "vertical") {
      group.setAttribute("data-w", Math.max(remaining, 1) * spotW);
    } else {
      group.setAttribute("data-h", Math.max(remaining, 1) * spotH);
    }
    const hit = group.querySelector('rect[data-role="hitbox"]');
    if (hit) {
      hit.setAttribute("width", group.getAttribute("data-w"));
      hit.setAttribute("height", group.getAttribute("data-h"));
    }
    if (group.getAttribute("data-zone") === "yes") {
      updateZoneSpotText(group);
    }
    pushGroupChange(group, before);
  }

  function updateZoneSpotText(group) {
    const count = group.querySelectorAll("g.eagleViewDropSpot").length;
    const txt = group.querySelector('text[fill="#ccc"]');
    if (txt) {
      txt.textContent = `${count} Spots`;
    }

    const zn = group.getAttribute("data-zone-name") || "Zone";
    const zid = group.getAttribute("data-zone-id");
    addZoneToTable(zn, zid);
  }

  function editFirstNumber(group) {
    const before = group.cloneNode(true);
    const firstLabel = group.querySelector(".spot-label");
    if (!firstLabel) return;
    const m = firstLabel.textContent.match(/^(\D*)(\d+)(.*)$/);
    if (!m) return;
    const prefix = m[1];
    const suffix = m[3];
    const start = parseInt(prompt("What number to start with?", m[2]), 10);
    if (Number.isNaN(start)) return;
    const labels = group.querySelectorAll(".spot-label");
    const firstRect = group.querySelector("g.eagleViewDropSpot rect");
    if (!firstRect) return;
    const spotW = parseFloat(firstRect.getAttribute("width"));
    const spotH = parseFloat(firstRect.getAttribute("height"));
    let orientation = group.getAttribute("data-orientation");
    if (!orientation) orientation = spotW > spotH ? "vertical" : "horizontal";
    const labelLocation = inferLabelLocation(firstLabel, orientation);
    const rotationMode = firstLabel.getAttribute("transform")
      ? "90"
      : "dynamic";
    labels.forEach((lbl, idx) => {
      const newTxt = prefix + (start + idx) + suffix;
      lbl.textContent = newTxt;
      const spot = spotsFromLabel(lbl);
      if (spot) {
        const r = spot.querySelector("rect");
        const x = parseFloat(r.getAttribute("x"));
        const y = parseFloat(r.getAttribute("y"));
        positionLabel(
          lbl,
          orientation,
          labelLocation,
          spotW,
          spotH,
          orientation === "vertical" ? x : 0,
          orientation === "horizontal" ? y : 0,
          newTxt,
          rotationMode,
        );
      }
    });
    labels.forEach((lbl, idx) => {
      lbl.textContent = prefix + (start + idx) + suffix;
    });
    pushGroupChange(group, before);
  }

  function rotateGroup(group) {
    const before = group.cloneNode(true);

    // Gather all spot sub-elements
    const spots = group.querySelectorAll("g.eagleViewDropSpot");
    if (!spots.length) {
      // Fallback for non-spot groups: just swap width/height
      const w = parseFloat(group.getAttribute("data-w")) || 0;
      const h = parseFloat(group.getAttribute("data-h")) || 0;
      updateElementSize(group, h, w);
      group.setAttribute("data-w", h);
      group.setAttribute("data-h", w);
      pushGroupChange(group, before);
      return;
    }

    // 1) Infer old orientation (from data-orientation or spot size)
    const firstRect = spots[0].querySelector("rect");
    const spotW = parseFloat(firstRect.getAttribute("width"));
    const spotH = parseFloat(firstRect.getAttribute("height"));
    let orientation = group.getAttribute("data-orientation");
    if (!orientation) {
      orientation = spotW > spotH ? "vertical" : "horizontal";
    }

    // 2) Compute new orientation
    const newOrientation =
      orientation === "vertical" ? "horizontal" : "vertical";
    group.setAttribute("data-orientation", newOrientation);

    // 3) Remove existing boundary lines
    Array.from(group.querySelectorAll("line")).forEach((ln) => ln.remove());

    // 4) Swap spot width/height
    const newSpotW = spotH;
    const newSpotH = spotW;

    // 5) For each spot, reposition rect, triangles, and label
    const labels = group.querySelectorAll(".spot-label");
    spots.forEach((sp, idx) => {
      // a) Move the <rect> to its new (x, y)
      const r = sp.querySelector("rect");
      const x = newOrientation === "vertical" ? idx * newSpotW : 0;
      const y = newOrientation === "horizontal" ? idx * newSpotH : 0;
      r.setAttribute("x", x);
      r.setAttribute("y", y);
      r.setAttribute("width", newSpotW);
      r.setAttribute("height", newSpotH);

      // b) Remove old triangles (if any)
      const loadTri = sp.querySelector(".loading_triangle");
      const unloadTri = sp.querySelector(".unloading_triangle");
      if (loadTri) loadTri.remove();
      if (unloadTri) unloadTri.remove();

      // c) Compute old label location using the same helper:
      const lbl = labels[idx];
      const oldLoc = lbl
        ? inferLabelLocation(lbl, orientation)
        : orientation === "vertical"
          ? "bottom"
          : "left";

      // d) Map oldLoc → newLoc according to the 4-step cycle:
      let newLoc;
      if (orientation === "horizontal") {
        // horizontal/left  → vertical/bottom
        // horizontal/right → vertical/top
        newLoc = oldLoc === "left" ? "bottom" : "top";
      } else {
        // vertical/bottom → horizontal/right
        // vertical/top    → horizontal/left
        newLoc = oldLoc === "bottom" ? "right" : "left";
      }

      // e) If this spot had triangles, re-add them using newLoc & newOrientation
      if (loadTri || unloadTri) {
        addDockTriangles(
          sp,
          sp.getAttribute("data-spot-id"),
          x,
          y,
          newSpotW,
          newSpotH,
          newLoc,
          newOrientation,
        );
      }

      // f) Reposition the label (if it exists)
      if (lbl) {
        const rotationMode = lbl.getAttribute("transform") ? "90" : "dynamic";
        positionLabel(
          lbl,
          newOrientation,
          newLoc,
          newSpotW,
          newSpotH,
          newOrientation === "vertical" ? x : 0,
          newOrientation === "horizontal" ? y : 0,
          lbl.textContent,
          rotationMode,
        );
      }
    });

    // 6) Draw the new boundary lines
    for (let i = 0; i <= spots.length; i++) {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      if (newOrientation === "vertical") {
        const pos = i * newSpotW;
        line.setAttribute("x1", pos);
        line.setAttribute("y1", 0);
        line.setAttribute("x2", pos);
        line.setAttribute("y2", newSpotH);
      } else {
        const pos = i * newSpotH;
        line.setAttribute("x1", 0);
        line.setAttribute("y1", pos);
        line.setAttribute("x2", newSpotW);
        line.setAttribute("y2", pos);
      }
      line.setAttribute("stroke", "#fff");
      line.setAttribute("stroke-width", "1.2");
      line.setAttribute("pointer-events", "none");
      group.appendChild(line);
    }

    // 7) Update group size, counters, and layer list; record undo
    adjustGroupSize(group);
    updateCounters();
    rebuildLayersList();
    pushGroupChange(group, before);
  }

  rebuildLostBox();
  ensureLostBoxOnTop();
  rebuildLayersList();
})();
