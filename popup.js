document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scan-btn');
  const listContainer = document.getElementById('tab-order-list');
  const statusMsg = document.getElementById('status-message');

  scanBtn.addEventListener('click', async () => {
    statusMsg.textContent = "Scanning slide...";
    statusMsg.style.color = "#5f6368";
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes("docs.google.com/presentation")) {
        throw new Error("Please open a Google Slides presentation.");
      }

      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
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

      // Make unnamed elements slightly italic/greyed out to distinguish them
      const textSpan = document.createElement('span');
      textSpan.textContent = el.text;
      if (el.text.startsWith('Unnamed')) {
        textSpan.style.fontStyle = 'italic';
        textSpan.style.color = '#80868b';
      }

      li.appendChild(numberSpan);
      li.appendChild(badge);
      li.appendChild(textSpan);
      listContainer.appendChild(li);
    });
  }
});

// --- CORE SCANNING FUNCTION ---
function getSlideTabOrder() {
  const gTags = Array.from(document.querySelectorAll('g[id^="editor-"]'));
  const tabOrderData = [];

  gTags.forEach((gTag) => {
    if (gTag.id.endsWith('_0')) return;

    let isNested = false;
    let parent = gTag.parentElement;
    while (parent && parent.tagName.toLowerCase() === 'g') {
       if (parent.id && parent.id.startsWith('editor-') && !parent.id.endsWith('_0')) {
           isNested = true;
           break;
       }
       parent = parent.parentElement;
    }
    // If it's a child part of a larger element, skip it so we only count the parent
    // eliminates double counting
    if (isNested) return; 

    // Ensure it's on the currently visible slide
    const parentSvg = gTag.closest('svg');
    if (parentSvg) {
      const rect = parentSvg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
    }

    const gRect = gTag.getBoundingClientRect();
    if (gRect.width === 0 && gRect.height === 0) return;

    // data extraction
    const ariaLabel = gTag.getAttribute('aria-label') || "";
    const textContent = gTag.textContent.trim();
    const labelLower = ariaLabel.toLowerCase();

    // Type Guessing (even if there is no text!)
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

    // If it has a label, use it. If not, use the text. If neither, call it "Unnamed [Type]"
    let displayName = ariaLabel || textContent;
    if (!displayName) {
        displayName = `Unnamed ${itemType}`;
    }

    // Limit text length so huge paragraphs don't break your UI
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