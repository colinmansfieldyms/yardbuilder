(function () {
  "use strict";
  // Main application logic

  // -------------------------------
  // UNDO / CTRL+Z Support
  // -------------------------------
  document.addEventListener("keydown", (e) => {
    // Mac users often use metaKey (Command) instead of ctrlKey
    const isUndoKey = (e.ctrlKey || e.metaKey) && e.key === "z";
    if (isUndoKey) {
      e.preventDefault();
      undoLastAction();
    }
  });

  let undoStack = [];

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
    updateUndoButtonState();
  }

  /**
   * undoLastAction()
   *
   * Pops the last action from the stack and reverts it.
   * Then you can optionally push a "redo" action to a redo stack if you want redo support.
   */
  function undoLastAction() {
    if (undoStack.length === 0) {
      return; // nothing to undo
    }

    const action = undoStack.pop();
    if (!action.element) return;

    if (action.type === "move") {
      // Revert move
      action.element.setAttribute(
        "transform",
        `translate(${action.oldX},${action.oldY})`,
      );
    } else if (action.type === "resize") {
      // Revert resize
      updateElementSize(action.element, action.oldWidth, action.oldHeight);
    } else if (action.type === "delete") {
      // Undo delete by re-inserting the cloned element
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

        // Optionally, update zones and counters
        rebuildZonesTable();
        updateCounters();
        ensureLostBoxOnTop();
        rebuildLayersList();
      }
    }
    updateUndoButtonState();
  }

  // -------------------------------
  // UNDO BUTTON FUNCTIONALITY
  // -------------------------------

  // Select the Undo button
  const undoBtn = document.getElementById("undoBtn");

  // Check if the button exists to avoid errors
  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      undoLastAction();
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
    const lb = document.querySelector("#scalableContent > g.lostTrailer");
    if (lb && lb.parentNode) lb.parentNode.appendChild(lb);
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
  let contextTarget = null;
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

  // -------------------------------
  // SVG WRAPPER & TRASH
  // -------------------------------
  const svgWrapper = document.getElementById("svgWrapper");
  const canvasSVG = document.getElementById("canvasSVG");
  const trashCan = document.getElementById("trashCan");
  const trashImg = trashCan.querySelector("img");

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
    const target = e.target;
    const group = target.closest('g[data-type="draggable"]');
    if (!group) return;

    const [oldX, oldY] = getTranslation(group);
    const oldW = parseFloat(group.getAttribute("data-w")) || 0;
    const oldH = parseFloat(group.getAttribute("data-h")) || 0;

    if (target.hasAttribute("data-resize")) {
      // Resize
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

    // Otherwise, drag
    isResizing = false;
    currentElement = group;

    const [curX, curY] = [oldX, oldY];
    offsetX = e.clientX - curX * currentScale;
    offsetY = e.clientY - curY * currentScale;

    group.__undoData = {
      type: "move",
      oldX: oldX,
      oldY: oldY,
    };

    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
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

      currentElement.setAttribute("transform", `translate(${x},${y})`);
      checkTrashHover(currentElement);
    }
  });

  document.addEventListener("mouseup", () => {
    if (!currentElement) {
      return;
    }
    if (!isResizing) {
      finalizeTrashCheck(currentElement);
    }

    // Check if the element is still in the DOM
    const stillInDOM = canvasSVG.contains(currentElement);

    if (stillInDOM) {
      const [newX, newY] = getTranslation(currentElement);
      const newW = parseFloat(currentElement.getAttribute("data-w")) || 0;
      const newH = parseFloat(currentElement.getAttribute("data-h")) || 0;

      const undoData = currentElement.__undoData;
      if (undoData) {
        // Determine the type of action (move or resize)
        if (undoData.type === "move") {
          // Push a 'move' action to the undo stack
          pushUndoAction({
            type: "move",
            element: currentElement,
            oldX: undoData.oldX,
            oldY: undoData.oldY,
            newX: newX,
            newY: newY,
          });
        } else if (undoData.type === "resize") {
          // Push a 'resize' action to the undo stack
          pushUndoAction({
            type: "resize",
            element: currentElement,
            oldWidth: undoData.oldW,
            oldHeight: undoData.oldH,
            newWidth: newW,
            newHeight: newH,
          });
        }
        // Clean up: Remove the temporary undo data
        delete currentElement.__undoData;
      }
    }
    // If the element was deleted (not in DOM), do not push the 'move' action

    currentElement = null;
    isResizing = false;
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
      const originalX = group.__undoData ? group.__undoData.oldX : 0;
      const originalY = group.__undoData ? group.__undoData.oldY : 0;

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
    const originalX = group.__undoData ? group.__undoData.oldX : 0;
    const originalY = group.__undoData ? group.__undoData.oldY : 0;

    pushUndoAction({
      type: "delete",
      element: clonedGroup,
      parent: parent,
      index: index,
      oldX: originalX,
      oldY: originalY,
    });

    group.remove();
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
    const totalSpotsElem = document.getElementById("totalSpots");
    const totalDocksElem = document.getElementById("totalDocks");

    if (totalSpotsElem) {
      totalSpotsElem.textContent = `Spots: ${totalSpots}`;
    }

    if (totalDocksElem) {
      totalDocksElem.textContent = `Docks: ${totalDocks}`;
    }
  }

  // Initial call to set counters on page load
  updateCounters();

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
  }

  let draggedItem = null;
  let dragStartX = 0;
  layersList.addEventListener("dragstart", (e) => {
    draggedItem = e.target;
    dragStartX = e.clientX;
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
    order.reverse().forEach((id) => {
      const g = scalable.querySelector(`[data-layer-id="${id}"]`);
      if (g && g !== lost) {
        scalable.insertBefore(g, lost || null);
      }
    });
    ensureLostBoxOnTop();
    rebuildLayersList();
  }

  function ensureLostBoxOnTop() {
    const scalable = document.getElementById("scalableContent");
    const lost = scalable.querySelector("g.lostTrailer");
    if (lost) scalable.appendChild(lost);
  }

  document
    .getElementById("scalableContent")
    .addEventListener("contextmenu", (e) => {
      const g = e.target.closest("#scalableContent > g");
      if (!g || g.classList.contains("lostTrailer")) return;
      e.preventDefault();
      contextTarget = g;
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
    layerContextMenu.style.display = "block";
    layerContextMenu.style.left = e.clientX + "px";
    layerContextMenu.style.top = e.clientY + "px";
  });

  document.addEventListener("click", () => {
    layerContextMenu.style.display = "none";
  });

  layerContextMenu.addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    if (!action || !contextTarget) return;
    if (contextTarget.classList.contains("lostTrailer")) return;
    const parent = contextTarget.parentNode;
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
      deleteGroupDirect(contextTarget);
      contextTarget = null;
    }
    ensureLostBoxOnTop();
    layerContextMenu.style.display = "none";
    ensureLostBoxOnTop();
    rebuildLayersList();
  });

  rebuildLostBox();
  ensureLostBoxOnTop();
  rebuildLayersList();
})();
