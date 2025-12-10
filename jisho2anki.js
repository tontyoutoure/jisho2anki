// ==UserScript==
// @name         Jisho2Anki - Step 2 (UI Injection)
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Inject buttons into Jisho.org for Anki integration
// @author       You
// @match        https://jisho.org/search/*
// @match        https://jisho.org/word/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const BUTTON_SIZE = '24px';
    const ICON_COLOR = '#999';
    const ICON_HOVER_COLOR = '#555';

    // SVG Icons
    const UPLOAD_ICON = `<svg viewBox="0 0 24 24" width="${BUTTON_SIZE}" height="${BUTTON_SIZE}" stroke="${ICON_COLOR}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
    const CONFIG_ICON = `<svg viewBox="0 0 24 24" width="${BUTTON_SIZE}" height="${BUTTON_SIZE}" stroke="${ICON_COLOR}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

    // --- Helper Functions ---

    function createButton(htmlIcon, title, onClickHandler) {
        const btn = document.createElement('button');
        btn.innerHTML = htmlIcon;
        btn.title = title;
        btn.style.background = 'none';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        btn.style.padding = '0 5px';
        btn.style.transition = 'all 0.2s ease';

        // Hover effects using JS since we aren't using an external stylesheet
        btn.onmouseover = () => { btn.querySelector('svg').style.stroke = ICON_HOVER_COLOR; };
        btn.onmouseout = () => { btn.querySelector('svg').style.stroke = ICON_COLOR; };

        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent Jisho default actions if any
            onClickHandler(e);
        });

        return btn;
    }

    function injectControls() {
        // Target the specific "Exact match" block using the class found in omoi.html
        const exactBlock = document.querySelector('.exact_block');

        // Safety check: if the page doesn't have an exact match block, stop.
        if (!exactBlock) return;

        // Create container for our buttons
        const container = document.createElement('div');
        container.id = 'jisho2anki-controls';
        container.style.display = 'inline-flex';
        container.style.alignItems = 'center';
        container.style.float = 'right'; // Position to the right
        container.style.marginTop = '-5px'; // Slight adjustment to align with text

        // 1. Upload Button
        const uploadBtn = createButton(UPLOAD_ICON, "Upload to Anki", () => {
            console.log("上传");
        });

        // 2. Config Button
        const configBtn = createButton(CONFIG_ICON, "Configure AnkiConnect", () => {
            console.log("配置");
        });

        // Assemble
        container.appendChild(uploadBtn);
        container.appendChild(configBtn);

        // Insert into the header (h4) of the exact block
        const header = exactBlock.querySelector('h4');
        if (header) {
            header.appendChild(container);
        } else {
            // Fallback if h4 is missing (rare), just prepend to block
            exactBlock.insertBefore(container, exactBlock.firstChild);
        }
    }

    // --- Main Execution ---
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectControls);
    } else {
        injectControls();
    }

})();