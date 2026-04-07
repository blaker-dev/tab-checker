document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scan-btn');
  const listContainer = document.getElementById('tab-order-list');
  const statusMsg = document.getElementById('status-message');
  
  let currentTabId = null; // We need to store this to use during hover events

  scanBtn.addEventListener('click', async () => {
    statusMsg.textContent = "Scanning slide...";
    statusMsg.style.color = "#5f6368";
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTabId = tab.id; // Save the tab ID for later
      
      if (!tab.url.includes("docs.google.com/presentation")) {
        throw new Error("Please open a Google Slides presentation.");
      }

      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: getSlideTabOrder 
      });

      const slideElements = injectionResults[0].result;
      
      renderList(slideElements);
      statusMsg.textContent = "Scan complete!";
      statusMsg.style.color = "#1e8e3e"; 

    } catch (error) {
      statusMsg.textContent = error.message;
      statusMsg.style.color = "#d93025"; 
    }
  });

  // --- UI RENDERING LOGIC ---
  function renderList(elements) {
    listContainer.innerHTML = ''; 

    if (!elements || elements.length === 0) {
      listContainer.innerHTML = '<li style="color: #5f6368; text-align: center;">No elements found.</li>';
      return;
    }

    elements.forEach((el, index) => {
      const li = document.createElement('li');
      
      const numberSpan = document.createElement('strong');
      numberSpan.textContent = `${index + 1}. `;
      
      const badge = document.createElement('span');
      badge.className = 'type-badge';
      badge.textContent = el.type;

      const textSpan = document.createElement('span');
      textSpan.textContent = el.text;
      if (el.text.startsWith('Unnamed')) {
        textSpan.style.fontStyle = 'italic';
        textSpan.style.color = '#80868b';
      }

      li.appendChild(numberSpan);
      li.appendChild(badge);
      li.appendChild(textSpan);
      
      // --- HOVER EVENT LISTENERS ---
      // When the mouse enters the list item, inject the highlight script
      li.addEventListener('mouseenter', () => {
        if (!currentTabId) return;
        chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: highlightElementInSlide,
          args: [el.id] // Pass the specific element ID to the injected function
        });
      });

      // When the mouse leaves, inject the cleanup script
      li.addEventListener('mouseleave', () => {
         if (!currentTabId) return;
         chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: removeHighlightFromSlide
        });
      });

      listContainer.appendChild(li);
    });
  }
});

// ==========================================
//        --- INJECTED SCRIPTS  ---
// ==========================================
function getSlideTabOrder() {
  const gTags = Array.from(document.querySelectorAll('g[id^="editor-"]'));
  const tabOrderData = [];

  gTags.forEach((gTag) => {
    if (gTag.id.endsWith('_0')) return;
    if (gTag.id.endsWith('-bg')) return;

    let isNested = false;
    let parent = gTag.parentElement;
    while (parent && parent.tagName.toLowerCase() === 'g') {
       if (parent.id && parent.id.startsWith('editor-') && !parent.id.endsWith('_0')) {
           isNested = true; 
           break;
       }
       parent = parent.parentElement;
    }
    if (isNested) return; 

    const parentSvg = gTag.closest('svg');
    if (parentSvg) {
      const rect = parentSvg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
    }

    const gRect = gTag.getBoundingClientRect();
    if (gRect.width === 0 && gRect.height === 0) return;

    const ariaLabel = gTag.getAttribute('aria-label') || "";
    const textContent = gTag.textContent.trim();
    const labelLower = ariaLabel.toLowerCase();

    let itemType = "Element";
    if (labelLower.includes("image") || gTag.querySelector('image')) {
        itemType = "Image";
    } else if (labelLower.includes("shape") || gTag.querySelector('path, rect, circle, polygon')) {
        itemType = "Shape";
    } else if (labelLower.includes("text box") || labelLower.includes("title") || textContent) {
        itemType = "Text Box";
    } else if (labelLower.includes("line") || gTag.querySelector('line')) {
        itemType = "Line";
    }

    let displayName = ariaLabel || textContent;
    if (!displayName) {
        displayName = `Unnamed ${itemType}`;
    }

    if (displayName.length > 40 && !displayName.startsWith('Unnamed')) {
        displayName = displayName.substring(0, 40) + '...';
    }

    tabOrderData.push({
      id: gTag.id,
      type: itemType,
      text: displayName
    });
  });

  return tabOrderData;
}

// --- HIGHLIGHT FUNCTIONS ---
function highlightElementInSlide(elementId) {
  const targetElement = document.getElementById(elementId);
  if (!targetElement) return;

  // Get the exact coordinates of the element on the screen
  const rect = targetElement.getBoundingClientRect();

  // Look for an existing overlay, or create one if it doesn't exist
  let overlay = document.getElementById('tab-checker-highlight-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tab-checker-highlight-overlay';
    
    // Style the overlay
    overlay.style.position = 'fixed';
    overlay.style.border = '3px solid #1a73e8'; // Blue outline
    overlay.style.backgroundColor = 'rgba(26, 115, 232, 0.2)'; // Light blue fill
    overlay.style.borderRadius = '4px';
    overlay.style.zIndex = '999999'; // Ensure it's on top of everything
    overlay.style.pointerEvents = 'none'; // Don't intercept clicks
    overlay.style.transition = 'all 0.1s ease'; // Smooth movement
    
    document.body.appendChild(overlay);
  }

  // Move the overlay to perfectly cover the target element
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.display = 'block';
}

function removeHighlightFromSlide() {
  const overlay = document.getElementById('tab-checker-highlight-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}