// Creates the menu item when the presentation opens
function onOpen(e) {
  SlidesApp.getUi()
    .createAddonMenu()
    .addItem('Open Tab Order Manager', 'showSidebar')
    .addToUi();
}

// Ensures the menu appears immediately upon installation
function onInstall(e) {
  onOpen(e);
}

// Opens the HTML sidebar
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
      .setTitle('Tab Order Checker')
      .setWidth(300);
  SlidesApp.getUi().showSidebar(html);
}

// The core function
function getSlideElements() {
  const presentation = SlidesApp.getActivePresentation();
  const selection = presentation.getSelection();
  const currentPage = selection.getCurrentPage();
  
  if (!currentPage) {
    throw new Error("Please select a specific slide first.");
  }

  const elements = currentPage.getPageElements();
  const tabOrderData = [];

  elements.forEach((element) => {
    const objectId = element.getObjectId();
    const rawType = element.getPageElementType().toString(); // e.g., "SHAPE", "IMAGE", "LINE"
    
    let title = element.getTitle() || "";
    let itemType = rawType;
    let textContent = "";
    
    // Check if it's actually a Text Box (subtype of shapes)
    if (rawType === "SHAPE") {
      const shape = element.asShape();
      textContent = shape.getText().asString().trim();
      
      // Check the exact sub-type of the shape
      if (shape.getShapeType() === SlidesApp.ShapeType.TEXT_BOX) {
        itemType = "Text Box";
      } else {
        itemType = "Shape";
      }
    }

    // Display Name
    let displayName = title || textContent;
    if (!displayName) {
        displayName = `Unnamed ${itemType}`;
    }

    if (displayName.length > 40 && !displayName.startsWith('Unnamed')) {
        displayName = displayName.substring(0, 40) + '...';
    }

    tabOrderData.push({
      id: objectId,
      type: itemType,
      text: displayName
    });
  });

  return tabOrderData;
}

// Function to actually select the element in the editor
function highlightElementInSlide(objectId) {
  const presentation = SlidesApp.getActivePresentation();
  const currentPage = presentation.getSelection().getCurrentPage();
  if (!currentPage) return;
  
  const elements = currentPage.getPageElements();
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].getObjectId() === objectId) {
      elements[i].select(); 
      break;
    }
  }
}

function reorderSlideElements(orderedIds) {
  const presentation = SlidesApp.getActivePresentation();
  const currentPage = presentation.getSelection().getCurrentPage();
  if (!currentPage) throw new Error("No slide selected.");

  const elements = currentPage.getPageElements();
  
  // Create a map to quickly look up elements by their ID
  const elementMap = {};
  elements.forEach(el => {
    elementMap[el.getObjectId()] = el;
  });

  // Rebuild the exact stack order by sequentially bringing elements to the front
  orderedIds.forEach(id => {
    const el = elementMap[id];
    if (el) {
      el.bringToFront();
    }
  });
}