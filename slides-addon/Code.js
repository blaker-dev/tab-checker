// Creates the menu item when the presentation opens
function onOpen(e) {
  SlidesApp.getUi()
    .createAddonMenu()
    .addItem('Open Tab Order Checker', 'showSidebar')
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

// The core function replacing your DOM scraper
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
    let description = element.getDescription() || "";
    let textContent = "";
    
    // If it's a shape, try to extract the text inside it
    if (rawType === "SHAPE") {
      textContent = element.asShape().getText().asString().trim();
    }
    
    // Combine Title and Description for the Alt Text
    let altText = (title + " " + description).trim();

    // Smart Type Guessing
    let itemType = "Element";
    if (rawType === "IMAGE") {
      itemType = "Image";
    } else if (rawType === "LINE") {
      itemType = "Line";
    } else if (rawType === "GROUP") {
      itemType = "Group";
    } else if (rawType === "SHAPE") {
      itemType = textContent ? "Text Box" : "Shape";
    }

    // Name Assignment (Alt Text -> Text Content -> Unnamed)
    let displayName = altText || textContent;
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
      elements[i].select(); // Natively highlights the element in the UI!
      break;
    }
  }
}